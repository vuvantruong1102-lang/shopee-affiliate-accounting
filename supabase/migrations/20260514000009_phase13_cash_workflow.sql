-- ============================================================================
-- PHASE 13: REFACTOR DÒNG TIỀN
-- 
-- Workflow mới:
-- Affiliate → Kế toán (tiền mặt) → TK ngân hàng công ty
--             ↓                     ↓
--      cash_transactions     bank_transactions
-- 
-- RPC mới:
-- 1. submit_affiliate_cash_deposit - affiliate nộp tiền mặt (ghi cash_transactions)
-- 2. submit_bank_from_cash - kế toán nộp tiền mặt vào ngân hàng (atomic 2 bút toán)
-- 3. create_cash_transaction - thêm thu/chi tiền mặt thủ công
-- 4. create_bank_transaction - thêm thu/chi ngân hàng thủ công
-- ============================================================================

-- 1. Đảm bảo cash_transactions có account_id (link affiliate)
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.affiliate_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_account_id 
  ON public.cash_transactions(account_id) 
  WHERE account_id IS NOT NULL;

-- 2. Đảm bảo cash_transactions có updated_at + is_deleted
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- 3. Đảm bảo cash_transactions có notes
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Trigger updated_at cho cash_transactions
CREATE OR REPLACE FUNCTION public.set_cash_transactions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_transactions_updated_at ON public.cash_transactions;
CREATE TRIGGER trg_cash_transactions_updated_at
  BEFORE UPDATE ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cash_transactions_updated_at();

-- ============================================================================
-- RPC 1: submit_affiliate_cash_deposit
-- 
-- Affiliate nộp tiền mặt cho kế toán → ghi vào cash_transactions (income)
-- ============================================================================
DROP FUNCTION IF EXISTS public.submit_affiliate_cash_deposit(UUID, DECIMAL, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.submit_affiliate_cash_deposit(
  p_affiliate_id UUID,
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

  SELECT full_name INTO v_affiliate_name
  FROM public.affiliate_accounts
  WHERE id = p_affiliate_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy affiliate';
  END IF;

  INSERT INTO public.cash_transactions (
    account_id,
    trans_type,
    trans_date,
    amount,
    description,
    notes
  )
  VALUES (
    p_affiliate_id,
    'income',
    p_trans_date,
    p_amount,
    COALESCE(v_affiliate_name, 'Affiliate') || ' nộp tiền mặt',
    p_notes
  )
  RETURNING id INTO v_trans_id;

  PERFORM public.log_audit(
    'create',
    'cash_transactions',
    v_trans_id,
    COALESCE(v_affiliate_name, 'Affiliate') || ' nộp tiền mặt ' || p_amount::TEXT || 'đ',
    NULL,
    jsonb_build_object(
      'affiliate_id', p_affiliate_id,
      'amount', p_amount,
      'date', p_trans_date,
      'method', 'cash'
    )
  );

  RETURN v_trans_id;
END;
$$;

-- ============================================================================
-- RPC 2: submit_bank_from_cash
-- 
-- Kế toán nộp tiền mặt (đã thu từ affiliate) vào TK ngân hàng công ty.
-- ATOMIC: tạo cùng lúc 2 bút toán:
-- - Bank: +X (income, link affiliate nếu có)
-- - Cash: -X (expense)
-- ============================================================================
DROP FUNCTION IF EXISTS public.submit_bank_from_cash(UUID, UUID, DECIMAL, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.submit_bank_from_cash(
  p_affiliate_id UUID,     -- nullable: NULL nếu không liên quan affiliate cụ thể
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

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không tìm thấy affiliate';
    END IF;

    v_description := 'Nộp tiền ' || v_affiliate_name || ' từ TK tiền mặt vào ngân hàng';
  ELSE
    v_description := 'Nộp tiền mặt vào ngân hàng';
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
    p_affiliate_id,
    'income',
    p_trans_date,
    p_amount,
    v_description,
    p_notes
  )
  RETURNING id INTO v_bank_id;

  -- 2. Tạo cash_transaction (expense) tương ứng
  INSERT INTO public.cash_transactions (
    account_id,
    trans_type,
    trans_date,
    amount,
    description,
    notes
  )
  VALUES (
    p_affiliate_id,
    'expense',
    p_trans_date,
    p_amount,
    'Chuyển tiền mặt vào TK ngân hàng' || 
      CASE WHEN p_affiliate_id IS NOT NULL THEN ' (của ' || v_affiliate_name || ')' ELSE '' END,
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

-- ============================================================================
-- RPC 3: create_cash_transaction - thu/chi tiền mặt thủ công
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_cash_transaction(TEXT, DATE, DECIMAL, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_cash_transaction(
  p_trans_type TEXT,         -- 'income' | 'expense'
  p_trans_date DATE,
  p_amount DECIMAL(15, 2),
  p_description TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_trans_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền phải lớn hơn 0';
  END IF;

  IF p_trans_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Loại giao dịch phải là thu hoặc chi';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'Vui lòng nhập diễn giải';
  END IF;

  INSERT INTO public.cash_transactions (
    trans_type,
    trans_date,
    amount,
    description,
    notes
  )
  VALUES (
    p_trans_type,
    p_trans_date,
    p_amount,
    p_description,
    p_notes
  )
  RETURNING id INTO v_trans_id;

  PERFORM public.log_audit(
    'create',
    'cash_transactions',
    v_trans_id,
    CASE WHEN p_trans_type = 'income' THEN 'Thu tiền mặt: ' ELSE 'Chi tiền mặt: ' END
      || p_description || ' ' || p_amount::TEXT || 'đ',
    NULL,
    jsonb_build_object('type', p_trans_type, 'amount', p_amount)
  );

  RETURN v_trans_id;
END;
$$;

-- ============================================================================
-- RPC 4: create_bank_transaction - thu/chi ngân hàng thủ công
-- (Dùng cho "Nộp tiền khác" hoặc chi tiêu ngân hàng)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_bank_transaction(UUID, TEXT, DATE, DECIMAL, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_bank_transaction(
  p_bank_account_id UUID,
  p_trans_type TEXT,         -- 'income' | 'expense'
  p_trans_date DATE,
  p_amount DECIMAL(15, 2),
  p_description TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_trans_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền phải lớn hơn 0';
  END IF;

  IF p_trans_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Loại giao dịch phải là thu hoặc chi';
  END IF;

  IF p_description IS NULL OR TRIM(p_description) = '' THEN
    RAISE EXCEPTION 'Vui lòng nhập diễn giải';
  END IF;

  IF p_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn tài khoản ngân hàng';
  END IF;

  INSERT INTO public.bank_transactions (
    bank_account_id,
    trans_type,
    trans_date,
    amount,
    description,
    notes
  )
  VALUES (
    p_bank_account_id,
    p_trans_type,
    p_trans_date,
    p_amount,
    p_description,
    p_notes
  )
  RETURNING id INTO v_trans_id;

  PERFORM public.log_audit(
    'create',
    'bank_transactions',
    v_trans_id,
    CASE WHEN p_trans_type = 'income' THEN 'Thu ngân hàng: ' ELSE 'Chi ngân hàng: ' END
      || p_description || ' ' || p_amount::TEXT || 'đ',
    NULL,
    jsonb_build_object('type', p_trans_type, 'amount', p_amount)
  );

  RETURN v_trans_id;
END;
$$;
