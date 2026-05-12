-- ============================================================================
-- PHASE 14 FIX: Update 3 RPC để loại trừ giao dịch chuyển nội bộ khỏi P&L
-- 
-- Trước: tính TẤT CẢ expense vào chi phí
-- Sau:   chỉ tính expense có is_internal_transfer = false
-- 
-- 3 RPC sửa:
-- 1. get_pnl_report - báo cáo P&L chính
-- 2. get_expense_breakdown - chi tiết chi phí theo nhóm
-- 3. get_ads_expense_this_month - chi phí Ads tháng này
-- ============================================================================

-- ============================================================================
-- 1. get_pnl_report
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_pnl_report(date, date);

CREATE OR REPLACE FUNCTION public.get_pnl_report(p_from_date date, p_to_date date)
 RETURNS TABLE(revenue_gross numeric, revenue_net numeric, total_commission_tax_withheld numeric, expense_marketing numeric, expense_salary numeric, expense_operating numeric, expense_tax numeric, expense_other numeric, total_expense numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
  -- Doanh thu (không thay đổi)
  SELECT 
    COALESCE(SUM(c.gross_amount), 0),
    COALESCE(SUM(c.net_amount), 0),
    COALESCE(SUM(c.tax_withheld), 0)
  INTO v_revenue_gross, v_revenue_net, v_tax_withheld
  FROM public.commissions c
  WHERE c.is_deleted = false
    AND c.earned_date BETWEEN p_from_date AND p_to_date;

  -- Chi phí theo type - ✨ LOẠI TRỪ chuyển nội bộ
  WITH all_expenses AS (
    SELECT bt.amount, ec.type
    FROM public.bank_transactions bt
    LEFT JOIN public.expense_categories ec ON ec.id = bt.expense_category_id
    WHERE bt.trans_type = 'expense'
      AND COALESCE(bt.is_deleted, false) = false
      AND COALESCE(bt.is_internal_transfer, false) = false  -- ✨ THÊM
      AND bt.trans_date BETWEEN p_from_date AND p_to_date
    UNION ALL
    SELECT ct.amount, ec.type
    FROM public.cash_transactions ct
    LEFT JOIN public.expense_categories ec ON ec.id = ct.expense_category_id
    WHERE ct.trans_type = 'expense'
      AND COALESCE(ct.is_deleted, false) = false
      AND COALESCE(ct.is_internal_transfer, false) = false  -- ✨ THÊM
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
$function$;

-- ============================================================================
-- 2. get_expense_breakdown
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_expense_breakdown(date, date);

CREATE OR REPLACE FUNCTION public.get_expense_breakdown(p_from_date date, p_to_date date)
 RETURNS TABLE(category_id uuid, category_name text, category_type text, total_amount numeric, transaction_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  WITH all_expenses AS (
    SELECT bt.amount, bt.expense_category_id
    FROM public.bank_transactions bt
    WHERE bt.trans_type = 'expense'
      AND COALESCE(bt.is_deleted, false) = false
      AND COALESCE(bt.is_internal_transfer, false) = false  -- ✨ THÊM
      AND bt.trans_date BETWEEN p_from_date AND p_to_date
    UNION ALL
    SELECT ct.amount, ct.expense_category_id
    FROM public.cash_transactions ct
    WHERE ct.trans_type = 'expense'
      AND COALESCE(ct.is_deleted, false) = false
      AND COALESCE(ct.is_internal_transfer, false) = false  -- ✨ THÊM
      AND ct.trans_date BETWEEN p_from_date AND p_to_date
  )
  SELECT
    ec.id,
    COALESCE(ec.name, 'Chưa phân loại')::TEXT,
    COALESCE(ec.type, 'other')::TEXT,
    COALESCE(SUM(ae.amount), 0)::DECIMAL(15, 2),
    COUNT(*)::BIGINT
  FROM all_expenses ae
  LEFT JOIN public.expense_categories ec ON ec.id = ae.expense_category_id
  GROUP BY ec.id, ec.name, ec.type
  HAVING SUM(ae.amount) > 0
  ORDER BY SUM(ae.amount) DESC;
$function$;

-- ============================================================================
-- 3. get_ads_expense_this_month
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_ads_expense_this_month();

CREATE OR REPLACE FUNCTION public.get_ads_expense_this_month()
 RETURNS TABLE(total_ads_expense numeric, transaction_count bigint, category_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  v_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;

  RETURN QUERY
  WITH matching_categories AS (
    SELECT id, name
    FROM public.expense_categories
    WHERE is_active = true
      AND (
        name ILIKE '%facebook ads%'
        OR name ILIKE '%fb ads%'
        OR name ILIKE '%fbads%'
        OR name ILIKE '%marketing%'
        OR name ILIKE '%quảng cáo%'
        OR name ILIKE '%quang cao%'
        OR name = 'Ads'
        OR name ILIKE 'Ads %'
        OR name ILIKE '% Ads'
        OR name ILIKE '% Ads %'
      )
  ),
  bank_expenses AS (
    SELECT amount
    FROM public.bank_transactions bt
    WHERE bt.trans_type = 'expense'
      AND COALESCE(bt.is_deleted, false) = false
      AND COALESCE(bt.is_internal_transfer, false) = false  -- ✨ THÊM
      AND bt.expense_category_id IN (SELECT id FROM matching_categories)
      AND bt.trans_date BETWEEN v_start AND v_end
  ),
  cash_expenses AS (
    SELECT amount
    FROM public.cash_transactions ct
    WHERE ct.trans_type = 'expense'
      AND COALESCE(ct.is_deleted, false) = false
      AND COALESCE(ct.is_internal_transfer, false) = false  -- ✨ THÊM
      AND ct.expense_category_id IN (SELECT id FROM matching_categories)
      AND ct.trans_date BETWEEN v_start AND v_end
  ),
  all_expenses AS (
    SELECT amount FROM bank_expenses
    UNION ALL
    SELECT amount FROM cash_expenses
  )
  SELECT
    COALESCE(SUM(amount), 0)::DECIMAL(15, 2) AS total_ads_expense,
    COUNT(*)::BIGINT AS transaction_count,
    (SELECT COUNT(*) FROM matching_categories)::BIGINT AS category_count
  FROM all_expenses;
END;
$function$;
