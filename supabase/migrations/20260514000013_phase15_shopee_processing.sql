-- ============================================================================
-- PHASE 15: Track "Shopee đang xử lý" per affiliate
-- 
-- Mỗi affiliate có 1 số tiền "đang xử lý" (Shopee đã ghi nhận nhưng chưa đối soát)
-- Kế toán nhập thủ công qua trang Tổng tài sản
-- ============================================================================

-- 1. Bảng lưu giá trị hiện tại cho mỗi affiliate
CREATE TABLE IF NOT EXISTS public.shopee_processing_amounts (
  affiliate_id UUID PRIMARY KEY REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  snapshot_date DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_shopee_processing_updated 
  ON public.shopee_processing_amounts(updated_at DESC);

-- RLS
ALTER TABLE public.shopee_processing_amounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read shopee_processing" ON public.shopee_processing_amounts;
CREATE POLICY "Authenticated can read shopee_processing"
  ON public.shopee_processing_amounts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can manage shopee_processing" ON public.shopee_processing_amounts;
CREATE POLICY "Authenticated can manage shopee_processing"
  ON public.shopee_processing_amounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. RPC: update giá trị "đang xử lý" cho 1 affiliate
-- ============================================================================
DROP FUNCTION IF EXISTS public.upsert_shopee_processing(UUID, DECIMAL, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_shopee_processing(
  p_affiliate_id UUID,
  p_amount DECIMAL(15, 2),
  p_snapshot_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_affiliate_name TEXT;
  v_old_amount DECIMAL(15, 2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Số tiền không được âm';
  END IF;

  SELECT full_name INTO v_affiliate_name
  FROM public.affiliate_accounts
  WHERE id = p_affiliate_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy affiliate';
  END IF;

  -- Lấy giá trị cũ để log audit
  SELECT amount INTO v_old_amount
  FROM public.shopee_processing_amounts
  WHERE affiliate_id = p_affiliate_id;

  -- Upsert
  INSERT INTO public.shopee_processing_amounts (
    affiliate_id, amount, snapshot_date, notes, updated_at, updated_by
  )
  VALUES (
    p_affiliate_id, p_amount, p_snapshot_date, p_notes, NOW(), v_user_id
  )
  ON CONFLICT (affiliate_id) DO UPDATE
  SET 
    amount = EXCLUDED.amount,
    snapshot_date = EXCLUDED.snapshot_date,
    notes = EXCLUDED.notes,
    updated_at = NOW(),
    updated_by = v_user_id;

  PERFORM public.log_audit(
    CASE WHEN v_old_amount IS NULL THEN 'create' ELSE 'update' END,
    'shopee_processing_amounts',
    p_affiliate_id,
    'Cập nhật Shopee đang xử lý của ' || COALESCE(v_affiliate_name, '') || 
      ': ' || COALESCE(v_old_amount::TEXT, '0') || 'đ → ' || p_amount::TEXT || 'đ',
    NULL,
    jsonb_build_object(
      'affiliate_id', p_affiliate_id,
      'old_amount', v_old_amount,
      'new_amount', p_amount,
      'snapshot_date', p_snapshot_date
    )
  );

  RETURN p_affiliate_id;
END;
$$;

-- ============================================================================
-- 3. Update RPC get_total_assets để include "Shopee đang xử lý"
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
  -- 1. Tiền mặt
  SELECT COALESCE(SUM(
    CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
  ), 0) INTO v_cash
  FROM public.cash_transactions
  WHERE COALESCE(is_deleted, false) = false;

  -- 2. Tiền ngân hàng
  SELECT COALESCE(SUM(
    CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
  ), 0) INTO v_bank
  FROM public.bank_transactions
  WHERE COALESCE(is_deleted, false) = false;

  -- 3. Affiliate đang cầm
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

  -- 4. Shopee chưa chuyển (commissions pending)
  SELECT COALESCE(SUM(net_amount), 0) INTO v_pending
  FROM public.commissions
  WHERE is_deleted = false AND status = 'pending';

  -- 5. ✨ MỚI: Shopee đang xử lý (số nhập tay)
  SELECT COALESCE(SUM(amount), 0) INTO v_processing
  FROM public.shopee_processing_amounts;

  -- 6. Processing breakdown - tất cả affiliate active, kèm số đang xử lý (kể cả 0)
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

  -- 7. Bank breakdown theo từng TK
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
    v_processing,
    v_cash + v_bank + v_holding + v_pending + v_processing,
    v_bank_breakdown,
    v_affiliate_breakdown,
    v_processing_breakdown;
END;
$$;
