-- ============================================================================
-- PHASE 10: NỘP TIỀN VÀO TK CÔNG TY + XÓA HOA HỒNG AN TOÀN
-- 
-- 1. RPC submit_deposit: ghi giao dịch nộp tiền vào bank_transactions
-- 2. RPC delete_commission: xóa hoa hồng nhập tay (commission KHÔNG link với shopee)
-- 3. RPC get_affiliate_undeposited: lấy số tiền đang cầm (để form gợi ý)
-- ============================================================================

-- ============================================================================
-- 1. RPC: submit_deposit
-- Affiliate nộp tiền vào TK công ty
-- → Tạo 1 bank_transaction (trans_type='income', account_id=affiliate)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_affiliate_deposit(
  p_affiliate_id UUID,
  p_company_bank_id UUID,
  p_amount DECIMAL(15, 2),
  p_trans_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_trans_id UUID;
  v_affiliate_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền nộp phải lớn hơn 0';
  END IF;

  -- Lấy tên affiliate cho description
  SELECT full_name INTO v_affiliate_name
  FROM public.affiliate_accounts
  WHERE id = p_affiliate_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy affiliate';
  END IF;

  -- Tạo bank_transaction
  INSERT INTO public.bank_transactions (
    bank_account_id,
    account_id,           -- ✨ link với affiliate
    trans_type,
    trans_date,
    amount,
    description,
    notes,
    created_by
  )
  VALUES (
    p_company_bank_id,
    p_affiliate_id,
    'income',
    p_trans_date,
    p_amount,
    'Affiliate ' || COALESCE(v_affiliate_name, '') || ' nộp tiền',
    p_notes,
    v_user_id
  )
  RETURNING id INTO v_trans_id;

  -- Audit
  PERFORM public.log_audit(
    'create',
    'bank_transactions',
    v_trans_id,
    'Affiliate ' || COALESCE(v_affiliate_name, '') || 
    ' nộp ' || p_amount::TEXT || 'đ vào công ty',
    NULL,
    jsonb_build_object(
      'affiliate_id', p_affiliate_id,
      'amount', p_amount,
      'date', p_trans_date
    )
  );

  RETURN v_trans_id;
END;
$$;

-- ============================================================================
-- 2. RPC: delete_commission - xóa hoa hồng
-- Chặn xóa nếu commission link với shopee_payment (phải xóa từ Đối soát)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_commission(
  p_commission_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_commission RECORD;
  v_linked_payment_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  SELECT * INTO v_commission
  FROM public.commissions
  WHERE id = p_commission_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hoa hồng';
  END IF;

  -- Check có link với shopee_payment không
  SELECT id INTO v_linked_payment_id
  FROM public.shopee_payments
  WHERE commission_id = p_commission_id AND is_deleted = false
  LIMIT 1;

  IF v_linked_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Hoa hồng này thuộc đợt thanh toán Shopee. Vui lòng xóa từ trang Đối soát Shopee.';
  END IF;

  -- Xóa mềm
  UPDATE public.commissions
  SET is_deleted = true, updated_at = NOW()
  WHERE id = p_commission_id;

  PERFORM public.log_audit(
    'delete',
    'commissions',
    p_commission_id,
    'Xóa hoa hồng ' || v_commission.gross_amount::TEXT || 'đ',
    jsonb_build_object(
      'gross_amount', v_commission.gross_amount,
      'earned_date', v_commission.earned_date
    ),
    NULL
  );

  RETURN true;
END;
$$;

-- ============================================================================
-- 3. RPC: update_commission - sửa hoa hồng (chỉ commission KHÔNG link shopee)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_commission(
  p_commission_id UUID,
  p_earned_date DATE,
  p_gross_amount DECIMAL(15, 2),
  p_tax_withheld DECIMAL(15, 2),
  p_net_amount DECIMAL(15, 2),
  p_status TEXT,
  p_received_date DATE DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_old RECORD;
  v_linked_payment_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  SELECT * INTO v_old
  FROM public.commissions
  WHERE id = p_commission_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hoa hồng';
  END IF;

  -- Check link shopee
  SELECT id INTO v_linked_payment_id
  FROM public.shopee_payments
  WHERE commission_id = p_commission_id AND is_deleted = false
  LIMIT 1;

  IF v_linked_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Hoa hồng này thuộc đợt thanh toán Shopee. Vui lòng sửa từ trang Đối soát Shopee.';
  END IF;

  UPDATE public.commissions
  SET
    earned_date = p_earned_date,
    period_month = EXTRACT(MONTH FROM p_earned_date)::INT,
    period_year = EXTRACT(YEAR FROM p_earned_date)::INT,
    gross_amount = p_gross_amount,
    tax_withheld = p_tax_withheld,
    net_amount = p_net_amount,
    status = p_status,
    received_date = p_received_date,
    description = p_description,
    updated_at = NOW()
  WHERE id = p_commission_id;

  PERFORM public.log_audit(
    'update',
    'commissions',
    p_commission_id,
    'Sửa hoa hồng',
    jsonb_build_object(
      'gross_amount', v_old.gross_amount,
      'net_amount', v_old.net_amount
    ),
    jsonb_build_object(
      'gross_amount', p_gross_amount,
      'net_amount', p_net_amount
    )
  );

  RETURN true;
END;
$$;
