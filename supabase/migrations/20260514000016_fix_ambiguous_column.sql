-- ============================================================================
-- FIX: get_bank_book_stats - lỗi column "opening_balance" is ambiguous
-- 
-- Nguyên nhân: 
-- - RETURNS TABLE có cột `opening_balance` 
-- - Biến local cũng có `opening_balance`
-- - Cột bảng `bank_accounts.opening_balance` cũng cùng tên
-- → Postgres không biết tham chiếu cái nào
-- 
-- Cách fix: dùng table alias `ba.opening_balance` để rõ ràng
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_bank_book_stats(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_bank_book_stats(
  p_bank_account_id UUID,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  total_income DECIMAL(15, 2),
  total_expense DECIMAL(15, 2),
  net_change DECIMAL(15, 2),
  transaction_count BIGINT,
  opening_balance DECIMAL(15, 2),
  closing_balance DECIMAL(15, 2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_account_opening DECIMAL(15, 2);
  v_pre_period_change DECIMAL(15, 2);
  v_in_period_income DECIMAL(15, 2);
  v_in_period_expense DECIMAL(15, 2);
  v_in_period_count BIGINT;
  v_opening DECIMAL(15, 2);
  v_net DECIMAL(15, 2);
  v_closing DECIMAL(15, 2);
BEGIN
  -- ✨ FIX: dùng table alias `ba.opening_balance` để tránh ambiguous
  SELECT COALESCE(ba.opening_balance, 0) INTO v_account_opening
  FROM public.bank_accounts ba
  WHERE ba.id = p_bank_account_id;

  v_account_opening := COALESCE(v_account_opening, 0);

  -- Thay đổi do giao dịch trước p_from_date
  SELECT COALESCE(SUM(
    CASE WHEN bt.trans_type = 'income' THEN bt.amount ELSE -bt.amount END
  ), 0) INTO v_pre_period_change
  FROM public.bank_transactions bt
  WHERE bt.bank_account_id = p_bank_account_id
    AND COALESCE(bt.is_deleted, false) = false
    AND bt.trans_date < p_from_date;

  v_opening := v_account_opening + v_pre_period_change;

  -- Thay đổi trong kỳ
  SELECT 
    COALESCE(SUM(CASE WHEN bt.trans_type = 'income' THEN bt.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bt.trans_type = 'expense' THEN bt.amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_in_period_income, v_in_period_expense, v_in_period_count
  FROM public.bank_transactions bt
  WHERE bt.bank_account_id = p_bank_account_id
    AND COALESCE(bt.is_deleted, false) = false
    AND bt.trans_date BETWEEN p_from_date AND p_to_date;

  v_net := v_in_period_income - v_in_period_expense;
  v_closing := v_opening + v_net;

  RETURN QUERY SELECT 
    v_in_period_income,
    v_in_period_expense,
    v_net,
    v_in_period_count,
    v_opening,
    v_closing;
END;
$$;
