-- ============================================================================
-- PHASE 8 FIX 4: SỬA CÔNG THỨC P&L
-- 
-- Trước: Lãi = Doanh thu NET − Chi phí (theo type category)
-- Sau:   Lãi = Doanh thu GROSS − Tổng thuế phải nộp − Chi phí
-- 
-- Trả về thêm: 
--   - revenue_gross (đã có)
--   - tax_payable (MỚI - tính từ TypeScript bên ngoài, vì cần luật lũy tiến phức tạp)
-- 
-- → Trong RPC, ta KHÔNG tính tax_payable nữa. Để client tính (đã có lib/ytd-tax.ts).
-- → RPC chỉ trả số liệu doanh thu + chi phí. Phía page sẽ tính tax_payable rồi truyền vào view.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_pnl_report(DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_pnl_report(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  revenue_gross DECIMAL(15, 2),
  revenue_net DECIMAL(15, 2),
  total_commission_tax_withheld DECIMAL(15, 2),  -- Thuế tạm 10% Shopee đã KT
  
  -- Chi phí theo type
  expense_marketing DECIMAL(15, 2),
  expense_salary DECIMAL(15, 2),
  expense_operating DECIMAL(15, 2),
  expense_tax DECIMAL(15, 2),
  expense_other DECIMAL(15, 2),
  total_expense DECIMAL(15, 2)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_revenue_gross DECIMAL(15, 2);
  v_revenue_net DECIMAL(15, 2);
  v_tax_withheld DECIMAL(15, 2);
  v_marketing DECIMAL(15, 2);
  v_salary DECIMAL(15, 2);
  v_operating DECIMAL(15, 2);
  v_tax DECIMAL(15, 2);
  v_other DECIMAL(15, 2);
  v_total_exp DECIMAL(15, 2);
BEGIN
  -- Doanh thu
  SELECT 
    COALESCE(SUM(c.gross_amount), 0),
    COALESCE(SUM(c.net_amount), 0),
    COALESCE(SUM(c.tax_withheld), 0)
  INTO v_revenue_gross, v_revenue_net, v_tax_withheld
  FROM public.commissions c
  WHERE c.is_deleted = false
    AND c.earned_date BETWEEN p_from_date AND p_to_date;

  -- Chi phí theo type (cả bank + cash)
  WITH all_expenses AS (
    SELECT bt.amount, ec.type
    FROM public.bank_transactions bt
    LEFT JOIN public.expense_categories ec ON ec.id = bt.expense_category_id
    WHERE bt.trans_type = 'expense'
      AND bt.is_deleted = false
      AND bt.trans_date BETWEEN p_from_date AND p_to_date
    UNION ALL
    SELECT ct.amount, ec.type
    FROM public.cash_transactions ct
    LEFT JOIN public.expense_categories ec ON ec.id = ct.expense_category_id
    WHERE ct.trans_type = 'expense'
      AND ct.is_deleted = false
      AND ct.trans_date BETWEEN p_from_date AND p_to_date
  )
  SELECT
    COALESCE(SUM(CASE WHEN type = 'marketing' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'salary' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'operating' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'tax' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'other' OR type IS NULL THEN amount ELSE 0 END), 0)
  INTO v_marketing, v_salary, v_operating, v_tax, v_other
  FROM all_expenses;

  v_total_exp := v_marketing + v_salary + v_operating + v_tax + v_other;

  RETURN QUERY SELECT
    v_revenue_gross, v_revenue_net, v_tax_withheld,
    v_marketing, v_salary, v_operating, v_tax, v_other, v_total_exp;
END;
$$;
