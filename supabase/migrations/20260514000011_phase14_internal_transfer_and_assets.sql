-- ============================================================================
-- PHASE 14: 
-- 1. Fix P&L tính sai (loại trừ chuyển nội bộ cash↔bank)
-- 2. Báo cáo Tổng tài sản
-- ============================================================================

-- ============================================================================
-- 1. Thêm cột is_internal_transfer cho cả 2 bảng
-- ============================================================================
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS is_internal_transfer BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS is_internal_transfer BOOLEAN NOT NULL DEFAULT false;

-- Index cho query nhanh khi filter
CREATE INDEX IF NOT EXISTS idx_bank_transactions_internal 
  ON public.bank_transactions(is_internal_transfer) 
  WHERE is_internal_transfer = true;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_internal 
  ON public.cash_transactions(is_internal_transfer) 
  WHERE is_internal_transfer = true;

-- ============================================================================
-- 2. BACKFILL: đánh dấu các giao dịch chuyển nội bộ đã có
-- (Phát hiện qua pattern description)
-- ============================================================================
UPDATE public.bank_transactions
SET is_internal_transfer = true
WHERE (
     description ILIKE '%Nộp tiền mặt vào ngân hàng%'
  OR description ILIKE '%từ TK tiền mặt vào ngân hàng%'
  OR description ILIKE '%chuyển tiền mặt%'
  OR description ILIKE '%gom từ affiliates%'
) AND is_internal_transfer = false;

UPDATE public.cash_transactions
SET is_internal_transfer = true
WHERE (
     description ILIKE '%Chuyển tiền mặt vào TK ngân hàng%'
  OR description ILIKE '%chuyển vào ngân hàng%'
  OR description ILIKE '%gom từ affiliates%'
) AND is_internal_transfer = false;

-- ============================================================================
-- 3. Update RPC submit_bank_from_cash - set is_internal_transfer = true
-- ============================================================================
DROP FUNCTION IF EXISTS public.submit_bank_from_cash(UUID, UUID, DECIMAL, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.submit_bank_from_cash(
  p_affiliate_id UUID,
  p_bank_account_id UUID,
  p_amount DECIMAL(15, 2),
  p_trans_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  bank_txn_id UUID,
  cash_txn_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bank_id UUID;
  v_cash_id UUID;
  v_affiliate_name TEXT;
  v_description TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền phải lớn hơn 0';
  END IF;

  IF p_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn tài khoản ngân hàng';
  END IF;

  IF p_affiliate_id IS NOT NULL THEN
    SELECT full_name INTO v_affiliate_name
    FROM public.affiliate_accounts
    WHERE id = p_affiliate_id AND is_deleted = false;
    v_description := 'Nộp tiền ' || COALESCE(v_affiliate_name, '') || ' từ TK tiền mặt vào ngân hàng';
  ELSE
    v_description := 'Nộp tiền mặt vào ngân hàng (gom từ affiliates)';
  END IF;

  -- 1. Tạo bank_transaction (income) - đánh dấu chuyển nội bộ
  INSERT INTO public.bank_transactions (
    bank_account_id,
    account_id,
    trans_type,
    trans_date,
    amount,
    description,
    notes,
    is_internal_transfer
  )
  VALUES (
    p_bank_account_id,
    p_affiliate_id,
    'income',
    p_trans_date,
    p_amount,
    v_description,
    p_notes,
    true  -- ✨ ĐÁNH DẤU
  )
  RETURNING id INTO v_bank_id;

  -- 2. Tạo cash_transaction (expense) - đánh dấu chuyển nội bộ
  INSERT INTO public.cash_transactions (
    account_id,
    trans_type,
    trans_date,
    amount,
    description,
    notes,
    is_internal_transfer
  )
  VALUES (
    p_affiliate_id,
    'expense',
    p_trans_date,
    p_amount,
    CASE 
      WHEN p_affiliate_id IS NOT NULL 
      THEN 'Chuyển tiền mặt vào TK ngân hàng (của ' || COALESCE(v_affiliate_name, '') || ')'
      ELSE 'Chuyển tiền mặt vào TK ngân hàng (gom từ affiliates)'
    END,
    p_notes,
    true  -- ✨ ĐÁNH DẤU
  )
  RETURNING id INTO v_cash_id;

  PERFORM public.log_audit(
    'create',
    'bank_transactions',
    v_bank_id,
    v_description || ' ' || p_amount::TEXT || 'đ',
    NULL,
    jsonb_build_object(
      'affiliate_id', p_affiliate_id,
      'amount', p_amount,
      'cash_txn_id', v_cash_id,
      'internal_transfer', true
    )
  );

  RETURN QUERY SELECT v_bank_id, v_cash_id;
END;
$$;

-- ============================================================================
-- 4. RPC: get_total_assets - báo cáo tổng tài sản
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_total_assets();

CREATE OR REPLACE FUNCTION public.get_total_assets()
RETURNS TABLE(
  cash_balance DECIMAL(15, 2),
  bank_balance DECIMAL(15, 2),
  affiliate_holding DECIMAL(15, 2),
  shopee_pending DECIMAL(15, 2),
  total_assets DECIMAL(15, 2),
  bank_breakdown JSONB,
  affiliate_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cash DECIMAL(15, 2);
  v_bank DECIMAL(15, 2);
  v_holding DECIMAL(15, 2);
  v_pending DECIMAL(15, 2);
  v_bank_breakdown JSONB;
  v_affiliate_breakdown JSONB;
BEGIN
  -- 1. Số dư tiền mặt = SUM(income) - SUM(expense)
  SELECT COALESCE(SUM(
    CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
  ), 0) INTO v_cash
  FROM public.cash_transactions
  WHERE COALESCE(is_deleted, false) = false;

  -- 2. Số dư ngân hàng = SUM(income) - SUM(expense) cho tất cả TK
  SELECT COALESCE(SUM(
    CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
  ), 0) INTO v_bank
  FROM public.bank_transactions
  WHERE COALESCE(is_deleted, false) = false;

  -- 3. Affiliate đang cầm chưa nộp = SUM(commissions received) - SUM(cash deposits của affiliate)
  -- = Tổng các affiliate có (received commissions - cash deposits) > 0
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
        'id', id,
        'name', full_name,
        'received', received,
        'deposited', deposited,
        'holding', holding
      ) ORDER BY holding DESC
    ) FILTER (WHERE holding > 0), '[]'::jsonb)
  INTO v_holding, v_affiliate_breakdown
  FROM per_affiliate;

  -- 4. Shopee đã đối soát chưa chuyển = SUM(commissions pending)
  SELECT COALESCE(SUM(net_amount), 0) INTO v_pending
  FROM public.commissions
  WHERE is_deleted = false AND status = 'pending';

  -- 5. Bank breakdown theo từng TK
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ba.id,
      'bank_name', ba.bank_name,
      'account_number', ba.account_number,
      'balance', COALESCE(bt.balance, 0)
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
    v_cash + v_bank + v_holding + v_pending,
    v_bank_breakdown,
    v_affiliate_breakdown;
END;
$$;
