-- ============================================================================
-- PHASE 6 FIX: 
-- 1. Sửa format số tiền trong get_dashboard_alerts (đang ra "###,###,###đ")
-- 2. Bỏ alert "Hoa hồng chậm về" (không còn hợp lý sau khi có Phase 4)
-- 3. Format số tiền sẽ làm ở client (TypeScript) để dễ kiểm soát
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_dashboard_alerts();

CREATE OR REPLACE FUNCTION public.get_dashboard_alerts()
RETURNS TABLE(
  alert_type TEXT,
  severity TEXT,
  title TEXT,
  description TEXT,
  affiliate_id UUID,
  affiliate_name TEXT,
  amount DECIMAL(15, 2),
  count_value INTEGER,
  link_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  
  -- ALERT 1: Affiliate đang cầm tiền (đã nhận > đã nộp)
  -- description chỉ chứa tên affiliate, số tiền sẽ format ở client từ field amount
  SELECT
    'undeposited'::TEXT AS alert_type,
    CASE 
      WHEN aa.undeposited > 50000000 THEN 'high'
      WHEN aa.undeposited > 10000000 THEN 'medium'
      ELSE 'low'
    END::TEXT AS severity,
    'Đang cầm tiền của công ty'::TEXT AS title,
    aa.full_name::TEXT AS description,
    aa.id AS affiliate_id,
    aa.full_name AS affiliate_name,
    aa.undeposited AS amount,
    NULL::INTEGER AS count_value,
    ('/affiliates/' || aa.id)::TEXT AS link_url
  FROM (
    SELECT
      aa.id,
      aa.full_name,
      COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.net_amount ELSE 0 END), 0) -
      COALESCE((
        SELECT SUM(bt.amount)
        FROM public.bank_transactions bt
        WHERE bt.account_id = aa.id 
          AND bt.trans_type = 'income'
          AND bt.is_deleted = false
      ), 0) AS undeposited
    FROM public.affiliate_accounts aa
    LEFT JOIN public.commissions c ON c.account_id = aa.id AND c.is_deleted = false
    WHERE aa.is_deleted = false AND aa.status = 'active'
    GROUP BY aa.id, aa.full_name
  ) aa
  WHERE aa.undeposited > 1000000

  UNION ALL

  -- ALERT 2: Đợt Shopee đã đến ngày thanh toán nhưng chưa được đánh dấu nhận
  SELECT
    'unreconciled'::TEXT,
    CASE 
      WHEN EXTRACT(DAY FROM NOW() - MIN(sp.payment_date)) > 5 THEN 'high'
      ELSE 'medium'
    END::TEXT,
    'Đợt Shopee chưa đánh dấu nhận'::TEXT,
    (aa.full_name || ' • ' || COUNT(sp.id) || ' đợt')::TEXT,
    aa.id,
    aa.full_name,
    SUM(sp.total_net)::DECIMAL(15, 2),
    COUNT(sp.id)::INTEGER,
    '/reconciliation'::TEXT
  FROM public.affiliate_accounts aa
  JOIN public.shopee_payments sp ON sp.account_id = aa.id
  WHERE sp.is_received = false 
    AND sp.is_deleted = false
    AND aa.is_deleted = false
    AND sp.payment_date <= CURRENT_DATE
  GROUP BY aa.id, aa.full_name;
END;
$$;

-- ============================================================================
-- RPC mới: Tổng thuế đã nộp + thuế cần nộp thêm của TẤT CẢ affiliate
-- (dùng YTD theo năm hiện tại)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_total_tax_ytd()
RETURNS TABLE(
  total_tax_withheld DECIMAL(15, 2),   -- Đã nộp/khấu trừ
  total_shopee_gross DECIMAL(15, 2),
  total_salary_gross DECIMAL(15, 2),
  affiliate_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH year_data AS (
    SELECT
      EXTRACT(YEAR FROM CURRENT_DATE)::INT AS y,
      EXTRACT(MONTH FROM CURRENT_DATE)::INT AS m
  ),
  active_affiliates AS (
    SELECT 
      id,
      monthly_salary_gross,
      monthly_salary_tax_withheld,
      has_company_salary
    FROM public.affiliate_accounts
    WHERE is_deleted = false AND status IN ('active', 'paused')
  ),
  shopee_ytd AS (
    SELECT
      COALESCE(SUM(gross_amount), 0) AS gross,
      COALESCE(SUM(tax_withheld), 0) AS tax
    FROM public.commissions c, year_data y
    WHERE c.is_deleted = false 
      AND c.period_year = y.y
      AND c.account_id IN (SELECT id FROM active_affiliates)
  ),
  salary_ytd AS (
    SELECT
      COALESCE(SUM(CASE WHEN has_company_salary THEN monthly_salary_gross * (SELECT m FROM year_data) ELSE 0 END), 0) AS gross,
      COALESCE(SUM(CASE WHEN has_company_salary THEN monthly_salary_tax_withheld * (SELECT m FROM year_data) ELSE 0 END), 0) AS tax
    FROM active_affiliates
  )
  SELECT
    (shopee_ytd.tax + salary_ytd.tax)::DECIMAL(15, 2),
    shopee_ytd.gross::DECIMAL(15, 2),
    salary_ytd.gross::DECIMAL(15, 2),
    (SELECT COUNT(*) FROM active_affiliates)::BIGINT
  FROM shopee_ytd, salary_ytd;
$$;
