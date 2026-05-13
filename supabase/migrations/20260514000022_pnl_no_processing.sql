-- ============================================================================
-- REVERT get_pnl_report: BỎ processing khỏi doanh thu
-- 
-- Theo yêu cầu user:
-- - Doanh thu Gross = HH đã chuyển (received) + HH chưa chuyển (pending)
-- - KHÔNG cộng shopee_processing_amounts
-- - Bảng hiển thị 1 dòng "Doanh thu Gross" duy nhất (không tách 3 nguồn)
-- 
-- Nhưng vẫn giữ 3 cột revenue_gross_received/pending/processing trong output
-- để frontend tự quyết định hiển thị (processing sẽ luôn = 0).
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_pnl_report(DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_pnl_report(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  revenue_gross DECIMAL(15, 2),
  revenue_net DECIMAL(15, 2),
  revenue_gross_received DECIMAL(15, 2),
  revenue_gross_pending DECIMAL(15, 2),
  revenue_gross_processing DECIMAL(15, 2),  -- giữ schema, luôn = 0
  total_commission_tax_withheld DECIMAL(15, 2),
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
  v_gross_received DECIMAL(15, 2);
  v_gross_pending DECIMAL(15, 2);
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
  -- Doanh thu từ commissions (chia 2 status, KHÔNG cộng processing)
  SELECT
    COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.gross_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.gross_amount ELSE 0 END), 0),
    COALESCE(SUM(c.net_amount), 0),
    COALESCE(SUM(c.tax_withheld), 0)
  INTO v_gross_received, v_gross_pending, v_revenue_net, v_tax_withheld
  FROM public.commissions c
  WHERE COALESCE(c.is_deleted, false) = false
    AND c.earned_date BETWEEN p_from_date AND p_to_date;

  v_revenue_gross := v_gross_received + v_gross_pending;

  -- Chi phí theo type - LOẠI TRỪ chuyển nội bộ
  WITH all_expenses AS (
    SELECT bt.amount, ec.type
    FROM public.bank_transactions bt
    LEFT JOIN public.expense_categories ec ON ec.id = bt.expense_category_id
    WHERE bt.trans_type = 'expense'
      AND COALESCE(bt.is_deleted, false) = false
      AND COALESCE(bt.is_internal_transfer, false) = false
      AND bt.trans_date BETWEEN p_from_date AND p_to_date
    UNION ALL
    SELECT ct.amount, ec.type
    FROM public.cash_transactions ct
    LEFT JOIN public.expense_categories ec ON ec.id = ct.expense_category_id
    WHERE ct.trans_type = 'expense'
      AND COALESCE(ct.is_deleted, false) = false
      AND COALESCE(ct.is_internal_transfer, false) = false
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
    v_revenue_gross,
    v_revenue_net,
    v_gross_received,
    v_gross_pending,
    0::DECIMAL(15, 2),  -- processing luôn = 0
    v_tax_withheld,
    v_marketing,
    v_salary,
    v_operating,
    v_tax,
    v_other,
    v_total_exp;
END;
$$;
