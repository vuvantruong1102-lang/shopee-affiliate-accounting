-- ============================================================================
-- PHASE 13 UPDATE: Cập nhật RPC submit_bank_from_cash
-- 
-- Cho phép affiliate_id = NULL (kế toán gom tiền nhiều người rồi nộp 1 lần)
-- Sửa mô tả cho phù hợp
-- ============================================================================

DROP FUNCTION IF EXISTS public.submit_bank_from_cash(UUID, UUID, DECIMAL, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.submit_bank_from_cash(
  p_affiliate_id UUID,     -- nullable: NULL khi gom nhiều người
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

  -- Nếu có chỉ định affiliate cụ thể (legacy, hiện không dùng trong UI mới)
  IF p_affiliate_id IS NOT NULL THEN
    SELECT full_name INTO v_affiliate_name
    FROM public.affiliate_accounts
    WHERE id = p_affiliate_id AND is_deleted = false;
    v_description := 'Nộp tiền ' || COALESCE(v_affiliate_name, '') || ' từ TK tiền mặt vào ngân hàng';
  ELSE
    v_description := 'Nộp tiền mặt vào ngân hàng (gom từ affiliates)';
  END IF;

  -- 1. Tạo bank_transaction (income)
  INSERT INTO public.bank_transactions (
    bank_account_id,
    account_id,
    trans_type,
    trans_date,
    amount,
    description,
    notes
  )
  VALUES (
    p_bank_account_id,
    p_affiliate_id,  -- NULL nếu không liên quan affiliate cụ thể
    'income',
    p_trans_date,
    p_amount,
    v_description,
    p_notes
  )
  RETURNING id INTO v_bank_id;

  -- 2. Tạo cash_transaction (expense) tương ứng - account_id = NULL khi gom
  INSERT INTO public.cash_transactions (
    account_id,
    trans_type,
    trans_date,
    amount,
    description,
    notes
  )
  VALUES (
    p_affiliate_id,  -- NULL nếu gom
    'expense',
    p_trans_date,
    p_amount,
    CASE 
      WHEN p_affiliate_id IS NOT NULL 
      THEN 'Chuyển tiền mặt vào TK ngân hàng (của ' || COALESCE(v_affiliate_name, '') || ')'
      ELSE 'Chuyển tiền mặt vào TK ngân hàng (gom từ affiliates)'
    END,
    p_notes
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
      'cash_txn_id', v_cash_id
    )
  );

  RETURN QUERY SELECT v_bank_id, v_cash_id;
END;
$$;
