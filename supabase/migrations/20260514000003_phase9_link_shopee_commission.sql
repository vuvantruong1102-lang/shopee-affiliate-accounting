-- ============================================================================
-- PHASE 9: ĐƠN GIẢN HÓA ĐỐI SOÁT SHOPEE
-- 
-- THAY ĐỔI WORKFLOW:
-- Trước: Nhập đợt thanh toán + breakdown theo ngày → Đối soát thủ công
-- Sau:   Nhập đợt thanh toán (3 số) → Auto tạo commission liên kết
-- 
-- DATABASE CHANGES:
-- 1. Thêm cột commission_id vào shopee_payments (link 1-1 với commission)
-- 2. Bỏ ràng buộc UNIQUE trên payment_code (cho phép trùng nhưng cảnh báo)
-- 3. RPC mới: confirm_shopee_payment - tạo đợt + commission cùng lúc
-- 4. RPC mới: mark_shopee_payment_received - update cả 2 bảng
-- 5. RPC mới: update_shopee_payment - sửa đợt + commission đồng bộ
-- 6. RPC mới: delete_shopee_payment - xóa mềm cả 2
-- ============================================================================

-- 1. THÊM CỘT commission_id
ALTER TABLE public.shopee_payments
  ADD COLUMN IF NOT EXISTS commission_id UUID REFERENCES public.commissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shopee_payments_commission 
  ON public.shopee_payments(commission_id) 
  WHERE commission_id IS NOT NULL AND is_deleted = false;

-- 2. BỎ UNIQUE CONSTRAINT trên payment_code (cho phép trùng)
-- Vì giờ chỉ là cảnh báo, không phải hard constraint
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'shopee_payments' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%payment_code%'
  ) THEN
    EXECUTE 'ALTER TABLE public.shopee_payments DROP CONSTRAINT IF EXISTS shopee_payments_payment_code_key';
  END IF;
END $$;

-- Tạo index thường để query nhanh (không UNIQUE)
CREATE INDEX IF NOT EXISTS idx_shopee_payments_payment_code 
  ON public.shopee_payments(payment_code) 
  WHERE is_deleted = false;

-- ============================================================================
-- 3. RPC: confirm_shopee_payment
-- 
-- Tạo cùng lúc:
-- - 1 bản ghi shopee_payments
-- - 1 bản ghi commissions (tự link qua commission_id)
-- 
-- Returns: { payment_id, commission_id }
-- ============================================================================
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

  -- 1. Tạo commission trước (để lấy ID)
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

  -- 2. Tạo shopee_payment, link với commission
  INSERT INTO public.shopee_payments (
    account_id,
    payment_code,
    payment_date,
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

-- ============================================================================
-- 4. RPC: mark_shopee_payment_received
-- 
-- Khi tiền về tài khoản cá nhân affiliate
-- Update cả shopee_payments.is_received và commissions.status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_shopee_payment_received(
  p_payment_id UUID,
  p_received_date DATE DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commission_id UUID;
  v_payment_code TEXT;
  v_actual_date DATE;
BEGIN
  v_actual_date := COALESCE(p_received_date, CURRENT_DATE);

  -- Lấy commission_id của đợt này
  SELECT commission_id, payment_code 
  INTO v_commission_id, v_payment_code
  FROM public.shopee_payments
  WHERE id = p_payment_id AND is_deleted = false;

  IF v_commission_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đợt thanh toán hoặc đợt chưa được link với commission';
  END IF;

  -- Update shopee_payment
  UPDATE public.shopee_payments
  SET 
    is_received = true,
    received_date = v_actual_date,
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- Update commission
  UPDATE public.commissions
  SET 
    status = 'received',
    received_date = v_actual_date,
    updated_at = NOW()
  WHERE id = v_commission_id;

  -- Audit
  PERFORM public.log_audit(
    'update',
    'shopee_payments',
    p_payment_id,
    'Xác nhận đã nhận tiền đợt ' || COALESCE(v_payment_code, '(không mã)'),
    NULL,
    jsonb_build_object('received_date', v_actual_date)
  );

  RETURN true;
END;
$$;

-- ============================================================================
-- 5. RPC: unmark_shopee_payment_received (hoàn tác đánh dấu nhận)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.unmark_shopee_payment_received(
  p_payment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commission_id UUID;
  v_payment_code TEXT;
BEGIN
  SELECT commission_id, payment_code 
  INTO v_commission_id, v_payment_code
  FROM public.shopee_payments
  WHERE id = p_payment_id AND is_deleted = false;

  IF v_commission_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đợt thanh toán';
  END IF;

  UPDATE public.shopee_payments
  SET 
    is_received = false,
    received_date = NULL,
    updated_at = NOW()
  WHERE id = p_payment_id;

  UPDATE public.commissions
  SET 
    status = 'pending',
    received_date = NULL,
    updated_at = NOW()
  WHERE id = v_commission_id;

  PERFORM public.log_audit(
    'update',
    'shopee_payments',
    p_payment_id,
    'Hoàn tác đánh dấu đã nhận - đợt ' || COALESCE(v_payment_code, '(không mã)'),
    NULL,
    NULL
  );

  RETURN true;
END;
$$;

-- ============================================================================
-- 6. RPC: update_shopee_payment - sửa số tiền của đợt
-- Cập nhật cả commission tương ứng
-- ============================================================================
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

  -- Update shopee_payment
  UPDATE public.shopee_payments
  SET
    payment_code = p_payment_code,
    payment_date = p_payment_date,
    total_gross = p_total_gross,
    total_tax = p_total_tax,
    total_net = p_total_net,
    notes = p_notes,
    updated_at = NOW()
  WHERE id = p_payment_id;

  -- Update commission tương ứng
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

-- ============================================================================
-- 7. RPC: delete_shopee_payment - xóa mềm cả 2
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_shopee_payment(
  p_payment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_commission_id UUID;
  v_payment_code TEXT;
  v_net DECIMAL(15, 2);
BEGIN
  SELECT commission_id, payment_code, total_net 
  INTO v_commission_id, v_payment_code, v_net
  FROM public.shopee_payments
  WHERE id = p_payment_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đợt thanh toán';
  END IF;

  -- Xóa mềm shopee_payment
  UPDATE public.shopee_payments
  SET is_deleted = true, updated_at = NOW()
  WHERE id = p_payment_id;

  -- Xóa mềm commission tương ứng
  IF v_commission_id IS NOT NULL THEN
    UPDATE public.commissions
    SET is_deleted = true, updated_at = NOW()
    WHERE id = v_commission_id;
  END IF;

  PERFORM public.log_audit(
    'delete',
    'shopee_payments',
    p_payment_id,
    'Xóa đợt thanh toán Shopee ' || COALESCE(v_payment_code, '(không mã)') || 
    ' (net: ' || v_net::TEXT || 'đ)',
    jsonb_build_object('payment_code', v_payment_code, 'total_net', v_net),
    NULL
  );

  RETURN true;
END;
$$;

-- ============================================================================
-- 8. RPC: check_duplicate_payment_code - kiểm tra trùng (cho UI cảnh báo)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_duplicate_payment_code(
  p_payment_code TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE(
  payment_id UUID,
  account_name TEXT,
  payment_date DATE,
  total_net DECIMAL(15, 2)
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    sp.id,
    aa.full_name,
    sp.payment_date,
    sp.total_net
  FROM public.shopee_payments sp
  JOIN public.affiliate_accounts aa ON aa.id = sp.account_id
  WHERE sp.payment_code = p_payment_code
    AND sp.is_deleted = false
    AND (p_exclude_id IS NULL OR sp.id <> p_exclude_id)
  LIMIT 5;
$$;
