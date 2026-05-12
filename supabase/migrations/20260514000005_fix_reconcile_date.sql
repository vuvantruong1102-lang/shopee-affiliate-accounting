-- ============================================================================
-- PHASE 9 FIX 2: SỬA NOT NULL CONSTRAINT trên reconcile_date
-- 
-- Lỗi: null value in column "reconcile_date" violates not-null constraint
-- Nguyên nhân: Bảng shopee_payments Phase 4 có cột reconcile_date NOT NULL,
--              nhưng RPC Phase 9 không insert giá trị cho cột này.
-- 
-- Giải pháp: 
-- 1. Bỏ NOT NULL trên reconcile_date (Phase 9 không cần dùng)
-- 2. Update RPC confirm_shopee_payment để set reconcile_date = payment_date (an toàn)
-- ============================================================================

-- 1. Bỏ NOT NULL constraint (nếu có)
ALTER TABLE public.shopee_payments
  ALTER COLUMN reconcile_date DROP NOT NULL;

-- 2. RECREATE RPC confirm_shopee_payment - set reconcile_date = payment_date
DROP FUNCTION IF EXISTS public.confirm_shopee_payment(UUID, TEXT, DATE, DECIMAL, DECIMAL, DECIMAL, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.confirm_shopee_payment(
  p_account_id UUID,
  p_payment_code TEXT,
  p_payment_date DATE,
  p_total_gross DECIMAL(15, 2),
  p_total_tax DECIMAL(15, 2),
  p_total_net DECIMAL(15, 2),
  p_is_received BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  payment_id UUID,
  commission_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_payment_id UUID;
  v_commission_id UUID;
  v_period_year INT;
  v_period_month INT;
  v_received_date DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  v_period_year := EXTRACT(YEAR FROM p_payment_date)::INT;
  v_period_month := EXTRACT(MONTH FROM p_payment_date)::INT;
  v_received_date := CASE WHEN p_is_received THEN p_payment_date ELSE NULL END;

  -- 1. Tạo commission trước
  INSERT INTO public.commissions (
    account_id,
    period_month,
    period_year,
    earned_date,
    received_date,
    gross_amount,
    tax_withheld,
    net_amount,
    status,
    description,
    created_by
  )
  VALUES (
    p_account_id,
    v_period_month,
    v_period_year,
    p_payment_date,
    v_received_date,
    p_total_gross,
    p_total_tax,
    p_total_net,
    CASE WHEN p_is_received THEN 'received' ELSE 'pending' END,
    'Đợt thanh toán Shopee ' || COALESCE(p_payment_code, ''),
    v_user_id
  )
  RETURNING id INTO v_commission_id;

  -- 2. Tạo shopee_payment - thêm reconcile_date = payment_date để an toàn
  INSERT INTO public.shopee_payments (
    account_id,
    payment_code,
    payment_date,
    reconcile_date,  -- ✨ SET = payment_date để tránh NOT NULL
    total_gross,
    total_tax,
    total_net,
    is_received,
    received_date,
    notes,
    commission_id,
    created_by
  )
  VALUES (
    p_account_id,
    p_payment_code,
    p_payment_date,
    p_payment_date,  -- reconcile_date
    p_total_gross,
    p_total_tax,
    p_total_net,
    p_is_received,
    v_received_date,
    p_notes,
    v_commission_id,
    v_user_id
  )
  RETURNING id INTO v_payment_id;

  -- 3. Audit log
  PERFORM public.log_audit(
    'create',
    'shopee_payments',
    v_payment_id,
    'Xác nhận đợt thanh toán Shopee ' || COALESCE(p_payment_code, '(không mã)') || 
    ' • Net: ' || p_total_net::TEXT || 'đ',
    NULL,
    jsonb_build_object(
      'payment_code', p_payment_code,
      'total_net', p_total_net,
      'is_received', p_is_received
    )
  );

  RETURN QUERY SELECT v_payment_id, v_commission_id;
END;
$$;

-- 3. Tương tự update_shopee_payment cũng update reconcile_date
DROP FUNCTION IF EXISTS public.update_shopee_payment(UUID, TEXT, DATE, DECIMAL, DECIMAL, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION public.update_shopee_payment(
  p_payment_id UUID,
  p_payment_code TEXT,
  p_payment_date DATE,
  p_total_gross DECIMAL(15, 2),
  p_total_tax DECIMAL(15, 2),
  p_total_net DECIMAL(15, 2),
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commission_id UUID;
  v_old_payment RECORD;
BEGIN
  SELECT * INTO v_old_payment
  FROM public.shopee_payments
  WHERE id = p_payment_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đợt thanh toán';
  END IF;

  v_commission_id := v_old_payment.commission_id;

  UPDATE public.shopee_payments
  SET
    payment_code = p_payment_code,
    payment_date = p_payment_date,
    reconcile_date = p_payment_date,  -- sync luôn
    total_gross = p_total_gross,
    total_tax = p_total_tax,
    total_net = p_total_net,
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_payment_id;

  IF v_commission_id IS NOT NULL THEN
    UPDATE public.commissions
    SET
      earned_date = p_payment_date,
      period_month = EXTRACT(MONTH FROM p_payment_date)::INT,
      period_year = EXTRACT(YEAR FROM p_payment_date)::INT,
      gross_amount = p_total_gross,
      tax_withheld = p_total_tax,
      net_amount = p_total_net,
      description = 'Đợt thanh toán Shopee ' || COALESCE(p_payment_code, ''),
      updated_at = NOW()
    WHERE id = v_commission_id;
  END IF;

  PERFORM public.log_audit(
    'update',
    'shopee_payments',
    p_payment_id,
    'Sửa đợt thanh toán Shopee ' || COALESCE(p_payment_code, '(không mã)'),
    jsonb_build_object(
      'total_gross', v_old_payment.total_gross,
      'total_net', v_old_payment.total_net
    ),
    jsonb_build_object(
      'total_gross', p_total_gross,
      'total_net', p_total_net
    )
  );

  RETURN true;
END;
$$;
