-- ============================================================================
-- FIX get_pnl_report
-- 
-- Thay đổi:
-- 1. Doanh thu Gross = received + pending + shopee_processing (Gross)
-- 2. Tách rõ 3 nguồn doanh thu (cho UI hiển thị chi tiết)
-- 3. Thuế tạm nộp Shopee KT bao gồm cả processing × 10%
-- 4. Doanh thu Net = net of commissions + (processing × 0.9)
-- 
-- KHÔNG thay đổi tax_payable (vẫn tính ở app layer qua calculateTotalTaxPayable)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_pnl_report(DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_pnl_report(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  revenue_gross DECIMAL(15, 2),
  revenue_net DECIMAL(15, 2),
  revenue_gross_received DECIMAL(15, 2),       -- ✨ MỚI
  revenue_gross_pending DECIMAL(15, 2),         -- ✨ MỚI
  revenue_gross_processing DECIMAL(15, 2),      -- ✨ MỚI (raw amount từ shopee_processing_amounts)
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
  v_gross_processing DECIMAL(15, 2);
  v_net_commissions DECIMAL(15, 2);
  v_tax_withheld_commissions DECIMAL(15, 2);
  v_revenue_gross DECIMAL(15, 2);
  v_revenue_net DECIMAL(15, 2);
  v_tax_withheld_total DECIMAL(15, 2);
  v_marketing DECIMAL(15, 2);
  v_salary DECIMAL(15, 2);
  v_operating DECIMAL(15, 2);
  v_tax DECIMAL(15, 2);
  v_other DECIMAL(15, 2);
  v_total_exp DECIMAL(15, 2);
BEGIN
  -- Doanh thu từ commissions (chia 2 status)
  SELECT
    COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.gross_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.gross_amount ELSE 0 END), 0),
    COALESCE(SUM(c.net_amount), 0),
    COALESCE(SUM(c.tax_withheld), 0)
  INTO v_gross_received, v_gross_pending, v_net_commissions, v_tax_withheld_commissions
  FROM public.commissions c
  WHERE COALESCE(c.is_deleted, false) = false
    AND c.earned_date BETWEEN p_from_date AND p_to_date;

  -- ✨ Doanh thu từ shopee_processing_amounts (Gross - số tiền đang xử lý)
  -- KHÔNG filter theo date: số processing là snapshot hiện tại, luôn cộng vào báo cáo
  -- (giống như Affiliate active không quan tâm có doanh thu trong kỳ hay không)
  BEGIN
    SELECT COALESCE(SUM(sp.amount), 0)
    INTO v_gross_processing
    FROM public.shopee_processing_amounts sp
    WHERE EXISTS (
      SELECT 1 FROM public.affiliate_accounts aa
      WHERE aa.id = sp.affiliate_id
        AND COALESCE(aa.is_deleted, false) = false
        AND aa.status IN ('active', 'paused')
    );
  EXCEPTION WHEN undefined_table THEN
    v_gross_processing := 0;
  END;

  -- Tổng doanh thu Gross
  v_revenue_gross := v_gross_received + v_gross_pending + v_gross_processing;

  -- Tổng doanh thu Net = net commissions + processing × 0.9
  v_revenue_net := v_net_commissions + ROUND(v_gross_processing * 0.9, 2);

  -- Tổng thuế tạm nộp Shopee KT = tax từ commissions + 10% của processing
  v_tax_withheld_total := v_tax_withheld_commissions + ROUND(v_gross_processing * 0.10, 2);

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
    v_gross_processing,
    v_tax_withheld_total,
    v_marketing,
    v_salary,
    v_operating,
    v_tax,
    v_other,
    v_total_exp;
END;
$$;
