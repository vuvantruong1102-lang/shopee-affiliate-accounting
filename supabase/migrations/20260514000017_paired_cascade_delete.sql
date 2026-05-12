-- ============================================================================
-- PAIRED TRANSACTION CASCADE DELETE
-- 
-- Khi user xóa bank_transaction "Nộp tiền mặt vào NH" thì tự xóa
-- cash_transaction "Chi: nộp vào NH" tương ứng (và ngược lại).
-- 
-- Implementation:
-- 1. Thêm cột paired_cash_id, paired_bank_id để link 2 chiều
-- 2. Update RPC submit_bank_from_cash để set paired_id khi tạo
-- 3. Backfill paired_id cho dữ liệu cũ (match by date + amount + is_internal_transfer)
-- 4. Trigger: khi 1 giao dịch bị soft delete → tự soft delete giao dịch paired
-- ============================================================================

-- 1. Thêm cột paired
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS paired_cash_id UUID 
    REFERENCES public.cash_transactions(id) ON DELETE SET NULL;

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS paired_bank_id UUID 
    REFERENCES public.bank_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_txns_paired_cash 
  ON public.bank_transactions(paired_cash_id) 
  WHERE paired_cash_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cash_txns_paired_bank 
  ON public.cash_transactions(paired_bank_id) 
  WHERE paired_bank_id IS NOT NULL;

-- ============================================================================
-- 2. Backfill paired_id cho dữ liệu cũ
-- 
-- Match: cùng amount, cùng trans_date, cùng is_internal_transfer=true, chưa có pair
-- ============================================================================
WITH matched_pairs AS (
  SELECT DISTINCT ON (bt.id)
    bt.id AS bank_id,
    ct.id AS cash_id
  FROM public.bank_transactions bt
  JOIN public.cash_transactions ct ON 
    ct.trans_date = bt.trans_date
    AND ct.amount = bt.amount
    AND COALESCE(ct.is_internal_transfer, false) = true
    AND COALESCE(ct.is_deleted, false) = false
    AND ct.trans_type = 'expense'
    AND ct.paired_bank_id IS NULL
  WHERE COALESCE(bt.is_internal_transfer, false) = true
    AND COALESCE(bt.is_deleted, false) = false
    AND bt.trans_type = 'income'
    AND bt.paired_cash_id IS NULL
  ORDER BY bt.id, ct.created_at
)
UPDATE public.bank_transactions bt
SET paired_cash_id = mp.cash_id
FROM matched_pairs mp
WHERE bt.id = mp.bank_id;

-- Update chiều ngược lại
UPDATE public.cash_transactions ct
SET paired_bank_id = bt.id
FROM public.bank_transactions bt
WHERE bt.paired_cash_id = ct.id
  AND ct.paired_bank_id IS NULL;

-- ============================================================================
-- 3. Update RPC submit_bank_from_cash để set paired_id khi tạo
-- 
-- Lấy RPC cũ và update để link 2 giao dịch sau khi insert
-- ============================================================================

-- Drop tất cả overload có thể có
DROP FUNCTION IF EXISTS public.submit_bank_from_cash(UUID, DATE, DECIMAL, UUID, TEXT);
DROP FUNCTION IF EXISTS public.submit_bank_from_cash(UUID, DATE, DECIMAL, TEXT, UUID);
DROP FUNCTION IF EXISTS public.submit_bank_from_cash(UUID, DATE, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION public.submit_bank_from_cash(
  p_bank_account_id UUID,
  p_trans_date DATE,
  p_amount DECIMAL(15, 2),
  p_description TEXT DEFAULT NULL,
  p_affiliate_id UUID DEFAULT NULL
)
RETURNS TABLE(
  bank_transaction_id UUID,
  cash_transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bank_id UUID;
  v_cash_id UUID;
  v_desc TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền phải lớn hơn 0';
  END IF;

  v_desc := COALESCE(p_description, 'Nộp tiền mặt vào ngân hàng (gom từ affiliates)');

  -- Tạo bank transaction
  INSERT INTO public.bank_transactions (
    bank_account_id, trans_date, trans_type, amount,
    description, is_internal_transfer, created_by
  )
  VALUES (
    p_bank_account_id, p_trans_date, 'income', p_amount,
    v_desc, true, v_user_id
  )
  RETURNING id INTO v_bank_id;

  -- Tạo cash transaction (expense)
  INSERT INTO public.cash_transactions (
    trans_date, trans_type, amount, account_id,
    description, is_internal_transfer, paired_bank_id, created_by
  )
  VALUES (
    p_trans_date, 'expense', p_amount, p_affiliate_id,
    v_desc, true, v_bank_id, v_user_id
  )
  RETURNING id INTO v_cash_id;

  -- ✨ Update bank với paired_cash_id
  UPDATE public.bank_transactions
  SET paired_cash_id = v_cash_id
  WHERE id = v_bank_id;

  RETURN QUERY SELECT v_bank_id, v_cash_id;
END;
$$;

-- ============================================================================
-- 4. Trigger: khi soft delete 1 giao dịch → tự soft delete giao dịch paired
-- ============================================================================

-- Trigger function (dùng chung cho cả 2 bảng)
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_paired()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Chỉ trigger khi is_deleted vừa được set từ false → true
  IF NEW.is_deleted = true AND COALESCE(OLD.is_deleted, false) = false THEN
    
    -- Nếu là bank_transactions
    IF TG_TABLE_NAME = 'bank_transactions' THEN
      IF NEW.paired_cash_id IS NOT NULL THEN
        UPDATE public.cash_transactions
        SET is_deleted = true
        WHERE id = NEW.paired_cash_id
          AND COALESCE(is_deleted, false) = false;
      END IF;
    
    -- Nếu là cash_transactions
    ELSIF TG_TABLE_NAME = 'cash_transactions' THEN
      IF NEW.paired_bank_id IS NOT NULL THEN
        UPDATE public.bank_transactions
        SET is_deleted = true
        WHERE id = NEW.paired_bank_id
          AND COALESCE(is_deleted, false) = false;
      END IF;
    END IF;
  
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger cho bank_transactions
DROP TRIGGER IF EXISTS trg_bank_cascade_paired ON public.bank_transactions;
CREATE TRIGGER trg_bank_cascade_paired
  AFTER UPDATE OF is_deleted ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_paired();

-- Apply trigger cho cash_transactions
DROP TRIGGER IF EXISTS trg_cash_cascade_paired ON public.cash_transactions;
CREATE TRIGGER trg_cash_cascade_paired
  AFTER UPDATE OF is_deleted ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_paired();
