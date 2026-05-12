-- ============================================================================
-- AUTO-PAIR TRIGGER
-- 
-- Vấn đề: có nhiều overload của submit_bank_from_cash. Bản cũ KHÔNG set
-- paired_id khi tạo cặp giao dịch internal_transfer.
-- 
-- Giải pháp: Trigger AFTER INSERT tự tìm và link cặp dựa trên:
-- - cùng amount
-- - cùng trans_date
-- - cùng is_internal_transfer = true
-- - 1 bên income, 1 bên expense
-- - chưa có paired_id
-- 
-- Trigger này chạy bất kể RPC nào tạo giao dịch → đảm bảo paired_id luôn được set
-- ============================================================================

-- ============================================================================
-- Trigger function: khi insert bank_transaction internal_transfer income,
-- tìm cash_transaction internal_transfer expense cùng ngày + amount + chưa pair
-- → link 2 chiều
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_pair_bank_to_cash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matching_cash_id UUID;
BEGIN
  -- Chỉ chạy với internal_transfer income (nộp tiền mặt vào NH)
  IF COALESCE(NEW.is_internal_transfer, false) = false 
     OR NEW.trans_type <> 'income'
     OR NEW.paired_cash_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tìm cash_transaction match (chưa có pair)
  SELECT id INTO v_matching_cash_id
  FROM public.cash_transactions
  WHERE trans_date = NEW.trans_date
    AND amount = NEW.amount
    AND trans_type = 'expense'
    AND COALESCE(is_internal_transfer, false) = true
    AND paired_bank_id IS NULL
    AND COALESCE(is_deleted, false) = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_matching_cash_id IS NOT NULL THEN
    -- Update bản thân (bank) với paired_cash_id
    UPDATE public.bank_transactions
    SET paired_cash_id = v_matching_cash_id
    WHERE id = NEW.id;

    -- Update cash với paired_bank_id
    UPDATE public.cash_transactions
    SET paired_bank_id = NEW.id
    WHERE id = v_matching_cash_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger ngược lại: khi insert cash_transaction internal_transfer expense,
-- tìm bank_transaction income cùng ngày + amount + chưa pair
CREATE OR REPLACE FUNCTION public.auto_pair_cash_to_bank()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matching_bank_id UUID;
BEGIN
  -- Chỉ chạy với internal_transfer expense
  IF COALESCE(NEW.is_internal_transfer, false) = false 
     OR NEW.trans_type <> 'expense'
     OR NEW.paired_bank_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tìm bank_transaction match
  SELECT id INTO v_matching_bank_id
  FROM public.bank_transactions
  WHERE trans_date = NEW.trans_date
    AND amount = NEW.amount
    AND trans_type = 'income'
    AND COALESCE(is_internal_transfer, false) = true
    AND paired_cash_id IS NULL
    AND COALESCE(is_deleted, false) = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_matching_bank_id IS NOT NULL THEN
    UPDATE public.cash_transactions
    SET paired_bank_id = v_matching_bank_id
    WHERE id = NEW.id;

    UPDATE public.bank_transactions
    SET paired_cash_id = NEW.id
    WHERE id = v_matching_bank_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply triggers
DROP TRIGGER IF EXISTS trg_auto_pair_bank ON public.bank_transactions;
CREATE TRIGGER trg_auto_pair_bank
  AFTER INSERT ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_pair_bank_to_cash();

DROP TRIGGER IF EXISTS trg_auto_pair_cash ON public.cash_transactions;
CREATE TRIGGER trg_auto_pair_cash
  AFTER INSERT ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_pair_cash_to_bank();

-- ============================================================================
-- Backfill lại các cặp đã tồn tại (đặc biệt cặp 3tr vừa test)
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
    AND ct.trans_type = 'expense'
    AND ct.paired_bank_id IS NULL
    AND COALESCE(ct.is_deleted, false) = false
  WHERE COALESCE(bt.is_internal_transfer, false) = true
    AND bt.trans_type = 'income'
    AND bt.paired_cash_id IS NULL
    AND COALESCE(bt.is_deleted, false) = false
  ORDER BY bt.id, ct.created_at
)
UPDATE public.bank_transactions bt
SET paired_cash_id = mp.cash_id
FROM matched_pairs mp
WHERE bt.id = mp.bank_id;

-- Chiều ngược
UPDATE public.cash_transactions ct
SET paired_bank_id = bt.id
FROM public.bank_transactions bt
WHERE bt.paired_cash_id = ct.id
  AND ct.paired_bank_id IS NULL;
