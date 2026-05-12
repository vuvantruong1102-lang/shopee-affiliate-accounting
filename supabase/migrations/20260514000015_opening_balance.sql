-- ============================================================================
-- FIX BANK ACCOUNT v3: Thêm số dư đầu kỳ
-- 
-- 1. Thêm cột opening_balance vào bank_accounts
-- 2. Update RPC delete_bank_account (giữ logic cũ)
-- 3. Update RPC get_bank_book_stats - cộng opening_balance vào opening_balance trong kỳ
-- 4. Update RPC get_total_assets - cộng opening_balance vào tiền ngân hàng
-- ============================================================================

-- 1. Thêm cột opening_balance
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Đảm bảo các cột khác
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_deleted
  ON public.bank_accounts(is_deleted)
  WHERE is_deleted = false;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_bank_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bank_accounts_updated_at();

-- ============================================================================
-- 2. RPC delete_bank_account (giữ nguyên signature cũ)
-- ============================================================================
DROP FUNCTION IF EXISTS public.delete_bank_account(UUID);

CREATE OR REPLACE FUNCTION public.delete_bank_account(p_bank_account_id UUID)
RETURNS TABLE(
  was_hard_deleted BOOLEAN,
  transaction_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bank_name TEXT;
  v_txn_count INTEGER;
  v_hard BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  SELECT bank_name INTO v_bank_name
  FROM public.bank_accounts
  WHERE id = p_bank_account_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_txn_count
  FROM public.bank_transactions
  WHERE bank_account_id = p_bank_account_id;

  IF v_txn_count = 0 THEN
    DELETE FROM public.bank_accounts WHERE id = p_bank_account_id;
    v_hard := true;
  ELSE
    UPDATE public.bank_accounts
    SET is_deleted = true
    WHERE id = p_bank_account_id;
    v_hard := false;
  END IF;

  PERFORM public.log_audit(
    'delete',
    'bank_accounts',
    p_bank_account_id,
    CASE WHEN v_hard 
      THEN 'Hard delete TK ' || COALESCE(v_bank_name, '') 
      ELSE 'Soft delete TK ' || COALESCE(v_bank_name, '') || ' (' || v_txn_count || ' gd)'
    END,
    NULL,
    jsonb_build_object('was_hard_deleted', v_hard, 'transaction_count', v_txn_count)
  );

  RETURN QUERY SELECT v_hard, v_txn_count;
END;
$$;

-- ============================================================================
-- 3. Update RPC get_bank_book_stats - cộng opening_balance
-- 
-- Logic:
-- - opening_balance trong kỳ = opening_balance của TK + SUM(income/expense trước p_from_date)
-- - closing_balance = opening_balance trong kỳ + net_change trong kỳ
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_bank_book_stats(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_bank_book_stats(
  p_bank_account_id UUID,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  total_income DECIMAL(15, 2),
  total_expense DECIMAL(15, 2),
  net_change DECIMAL(15, 2),
  transaction_count BIGINT,
  opening_balance DECIMAL(15, 2),
  closing_balance DECIMAL(15, 2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_account_opening DECIMAL(15, 2);
  v_pre_period_change DECIMAL(15, 2);
  v_in_period_income DECIMAL(15, 2);
  v_in_period_expense DECIMAL(15, 2);
  v_in_period_count BIGINT;
  v_opening DECIMAL(15, 2);
  v_net DECIMAL(15, 2);
  v_closing DECIMAL(15, 2);
BEGIN
  -- Số dư đầu kỳ của TK (do user nhập)
  SELECT COALESCE(opening_balance, 0) INTO v_account_opening
  FROM public.bank_accounts
  WHERE id = p_bank_account_id;

  -- Thay đổi do giao dịch trước p_from_date
  SELECT COALESCE(SUM(
    CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
  ), 0) INTO v_pre_period_change
  FROM public.bank_transactions
  WHERE bank_account_id = p_bank_account_id
    AND COALESCE(is_deleted, false) = false
    AND trans_date < p_from_date;

  v_opening := COALESCE(v_account_opening, 0) + v_pre_period_change;

  -- Thay đổi trong kỳ
  SELECT 
    COALESCE(SUM(CASE WHEN trans_type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN trans_type = 'expense' THEN amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_in_period_income, v_in_period_expense, v_in_period_count
  FROM public.bank_transactions
  WHERE bank_account_id = p_bank_account_id
    AND COALESCE(is_deleted, false) = false
    AND trans_date BETWEEN p_from_date AND p_to_date;

  v_net := v_in_period_income - v_in_period_expense;
  v_closing := v_opening + v_net;

  RETURN QUERY SELECT 
    v_in_period_income,
    v_in_period_expense,
    v_net,
    v_in_period_count,
    v_opening,
    v_closing;
END;
$$;

-- ============================================================================
-- 4. Update RPC get_total_assets - cộng opening_balance của tất cả TK vào bank
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_total_assets();

CREATE OR REPLACE FUNCTION public.get_total_assets()
RETURNS TABLE(
  cash_balance DECIMAL(15, 2),
  bank_balance DECIMAL(15, 2),
  affiliate_holding DECIMAL(15, 2),
  shopee_pending DECIMAL(15, 2),
  shopee_processing DECIMAL(15, 2),
  total_assets DECIMAL(15, 2),
  bank_breakdown JSONB,
  affiliate_breakdown JSONB,
  processing_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cash DECIMAL(15, 2);
  v_bank DECIMAL(15, 2);
  v_holding DECIMAL(15, 2);
  v_pending DECIMAL(15, 2);
  v_processing DECIMAL(15, 2);
  v_bank_breakdown JSONB;
  v_affiliate_breakdown JSONB;
  v_processing_breakdown JSONB;
BEGIN
  -- Tiền mặt
  SELECT COALESCE(SUM(
    CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
  ), 0) INTO v_cash
  FROM public.cash_transactions
  WHERE COALESCE(is_deleted, false) = false;

  -- Tiền ngân hàng = SUM(opening_balance của các TK chưa xóa) + SUM(transactions)
  WITH bank_opening AS (
    SELECT COALESCE(SUM(opening_balance), 0) AS total
    FROM public.bank_accounts
    WHERE COALESCE(is_deleted, false) = false
  ),
  bank_txns AS (
    SELECT COALESCE(SUM(
      CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
    ), 0) AS total
    FROM public.bank_transactions
    WHERE COALESCE(is_deleted, false) = false
  )
  SELECT (SELECT total FROM bank_opening) + (SELECT total FROM bank_txns) INTO v_bank;

  -- Affiliate đang cầm
  WITH per_affiliate AS (
    SELECT 
      aa.id,
      aa.full_name,
      COALESCE(c.received_total, 0) AS received,
      COALESCE(d.deposited_total, 0) AS deposited,
      COALESCE(c.received_total, 0) - COALESCE(d.deposited_total, 0) AS holding
    FROM public.affiliate_accounts aa
    LEFT JOIN LATERAL (
      SELECT SUM(net_amount) AS received_total
      FROM public.commissions
      WHERE account_id = aa.id 
        AND is_deleted = false 
        AND status = 'received'
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT SUM(amount) AS deposited_total
      FROM public.cash_transactions
      WHERE account_id = aa.id
        AND trans_type = 'income'
        AND COALESCE(is_deleted, false) = false
    ) d ON true
    WHERE aa.is_deleted = false
  )
  SELECT 
    COALESCE(SUM(GREATEST(holding, 0)), 0),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', id, 'name', full_name,
        'received', received, 'deposited', deposited, 'holding', holding
      ) ORDER BY holding DESC
    ) FILTER (WHERE holding > 0), '[]'::jsonb)
  INTO v_holding, v_affiliate_breakdown
  FROM per_affiliate;

  -- Shopee chưa chuyển
  SELECT COALESCE(SUM(net_amount), 0) INTO v_pending
  FROM public.commissions
  WHERE is_deleted = false AND status = 'pending';

  -- Shopee đang xử lý (nếu bảng tồn tại)
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_processing
    FROM public.shopee_processing_amounts;
  EXCEPTION WHEN undefined_table THEN
    v_processing := 0;
  END;

  -- Processing breakdown
  BEGIN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'affiliate_id', aa.id,
        'affiliate_name', aa.full_name,
        'amount', COALESCE(sp.amount, 0),
        'snapshot_date', sp.snapshot_date,
        'updated_at', sp.updated_at,
        'notes', sp.notes
      ) ORDER BY aa.full_name
    ), '[]'::jsonb)
    INTO v_processing_breakdown
    FROM public.affiliate_accounts aa
    LEFT JOIN public.shopee_processing_amounts sp ON sp.affiliate_id = aa.id
    WHERE aa.is_deleted = false
      AND aa.status IN ('active', 'paused');
  EXCEPTION WHEN undefined_table THEN
    v_processing_breakdown := '[]'::jsonb;
  END;

  -- Bank breakdown - INCLUDE opening_balance vào balance
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ba.id,
      'bank_name', ba.bank_name,
      'account_number', ba.account_number,
      'opening_balance', COALESCE(ba.opening_balance, 0),
      'balance', COALESCE(ba.opening_balance, 0) + COALESCE(bt.balance, 0)
    ) ORDER BY ba.bank_name
  ), '[]'::jsonb)
  INTO v_bank_breakdown
  FROM public.bank_accounts ba
  LEFT JOIN LATERAL (
    SELECT SUM(
      CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
    ) AS balance
    FROM public.bank_transactions
    WHERE bank_account_id = ba.id 
      AND COALESCE(is_deleted, false) = false
  ) bt ON true
  WHERE COALESCE(ba.is_deleted, false) = false;

  RETURN QUERY SELECT 
    v_cash,
    v_bank,
    v_holding,
    v_pending,
    v_processing,
    v_cash + v_bank + v_holding + v_pending + v_processing,
    v_bank_breakdown,
    v_affiliate_breakdown,
    v_processing_breakdown;
END;
$$;
