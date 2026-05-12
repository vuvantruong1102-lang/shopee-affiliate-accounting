-- ============================================================================
-- PHASE 10 FIX: BANK ACCOUNTS - is_company column + delete RPC
-- 
-- Đảm bảo bảng bank_accounts có cột is_company.
-- Tạo RPC delete_bank_account: xóa mềm nếu có giao dịch, xóa cứng nếu không.
-- ============================================================================

-- 1. Thêm cột is_company nếu chưa có (default true cho tất cả TK hiện tại)
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS is_company BOOLEAN NOT NULL DEFAULT true;

-- 2. RPC: delete_bank_account
-- Logic: 
-- - Có giao dịch (bank_transactions liên kết, chưa xóa) → xóa mềm
-- - Không có giao dịch → xóa cứng
CREATE OR REPLACE FUNCTION public.delete_bank_account(
  p_bank_account_id UUID
)
RETURNS TABLE(
  was_hard_deleted BOOLEAN,
  transaction_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_count BIGINT;
  v_account_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  -- Đếm giao dịch liên kết (chưa xóa mềm)
  SELECT COUNT(*) INTO v_count
  FROM public.bank_transactions
  WHERE bank_account_id = p_bank_account_id AND is_deleted = false;

  -- Lấy tên cho audit
  SELECT bank_name || ' ' || COALESCE(account_number, '')
  INTO v_account_name
  FROM public.bank_accounts
  WHERE id = p_bank_account_id;

  IF v_account_name IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản ngân hàng';
  END IF;

  IF v_count > 0 THEN
    -- Có giao dịch → xóa mềm
    UPDATE public.bank_accounts
    SET is_deleted = true, updated_at = NOW()
    WHERE id = p_bank_account_id;

    PERFORM public.log_audit(
      'delete',
      'bank_accounts',
      p_bank_account_id,
      'Xóa mềm TK ngân hàng ' || v_account_name || ' (còn ' || v_count || ' giao dịch)',
      NULL,
      NULL
    );

    RETURN QUERY SELECT false, v_count;
  ELSE
    -- Không có giao dịch → xóa cứng
    DELETE FROM public.bank_accounts WHERE id = p_bank_account_id;

    PERFORM public.log_audit(
      'delete',
      'bank_accounts',
      p_bank_account_id,
      'Xóa cứng TK ngân hàng ' || v_account_name,
      NULL,
      NULL
    );

    RETURN QUERY SELECT true, 0::BIGINT;
  END IF;
END;
$$;

-- 3. Trigger updated_at cho bank_accounts (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.bank_accounts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_bank_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
