-- ============================================================================
-- PHASE 7: BÁO CÁO
-- 3 RPC cho 3 báo cáo cốt lõi:
--   1. get_revenue_report - Doanh thu theo kỳ
--   2. get_affiliates_report - Báo cáo từng affiliate
--   3. get_pnl_report - Lãi/Lỗ (P&L)
-- ============================================================================

-- ============================================================================
-- 1. BÁO CÁO DOANH THU theo khoảng thời gian
-- Trả về tổng + breakdown theo tháng
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_revenue_report(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  total_gross DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  commission_count BIGINT,
  affiliate_count BIGINT,
  avg_per_commission DECIMAL(15, 2)
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(c.gross_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.net_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.tax_withheld), 0)::DECIMAL(15, 2),
    COUNT(c.id)::BIGINT,
    COUNT(DISTINCT c.account_id)::BIGINT,
    COALESCE(AVG(c.gross_amount), 0)::DECIMAL(15, 2)
  FROM public.commissions c
  WHERE c.is_deleted = false
    AND c.earned_date BETWEEN p_from_date AND p_to_date;
$$;

-- ============================================================================
-- 2. Breakdown DOANH THU theo từng tháng trong khoảng thời gian
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_revenue_by_month(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  year_month TEXT,
  total_gross DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  commission_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    LPAD(c.period_month::TEXT, 2, '0') || '/' || c.period_year::TEXT,
    COALESCE(SUM(c.gross_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.net_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.tax_withheld), 0)::DECIMAL(15, 2),
    COUNT(c.id)::BIGINT
  FROM public.commissions c
  WHERE c.is_deleted = false
    AND c.earned_date BETWEEN p_from_date AND p_to_date
  GROUP BY c.period_year, c.period_month
  ORDER BY c.period_year, c.period_month;
$$;

-- ============================================================================
-- 3. BÁO CÁO AFFILIATE - tổng hợp theo từng người
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_affiliates_report(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  affiliate_id UUID,
  affiliate_name TEXT,
  affiliate_status TEXT,
  total_gross DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  received_net DECIMAL(15, 2),
  pending_net DECIMAL(15, 2),
  total_deposited DECIMAL(15, 2),
  undeposited DECIMAL(15, 2),
  commission_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    aa.id,
    aa.full_name,
    aa.status::TEXT,
    COALESCE(SUM(c.gross_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.net_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.tax_withheld), 0)::DECIMAL(15, 2),
    COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.net_amount ELSE 0 END), 0)::DECIMAL(15, 2),
    COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.net_amount ELSE 0 END), 0)::DECIMAL(15, 2),
    COALESCE((
      SELECT SUM(bt.amount)
      FROM public.bank_transactions bt
      WHERE bt.account_id = aa.id
        AND bt.trans_type = 'income'
        AND bt.is_deleted = false
        AND bt.trans_date BETWEEN p_from_date AND p_to_date
    ), 0)::DECIMAL(15, 2) AS deposited,
    (
      COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.net_amount ELSE 0 END), 0) -
      COALESCE((
        SELECT SUM(bt.amount)
        FROM public.bank_transactions bt
        WHERE bt.account_id = aa.id
          AND bt.trans_type = 'income'
          AND bt.is_deleted = false
          AND bt.trans_date BETWEEN p_from_date AND p_to_date
      ), 0)
    )::DECIMAL(15, 2) AS undeposited,
    COUNT(c.id)::BIGINT
  FROM public.affiliate_accounts aa
  LEFT JOIN public.commissions c
    ON c.account_id = aa.id
    AND c.earned_date BETWEEN p_from_date AND p_to_date
    AND c.is_deleted = false
  WHERE aa.is_deleted = false
  GROUP BY aa.id, aa.full_name, aa.status
  ORDER BY SUM(c.net_amount) DESC NULLS LAST;
$$;

-- ============================================================================
-- 4. BÁO CÁO P&L - Lãi/Lỗ
-- Doanh thu (net) - Chi phí theo loại = Lãi/Lỗ
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pnl_report(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  -- Doanh thu (net từ hoa hồng)
  revenue_net DECIMAL(15, 2),
  revenue_gross DECIMAL(15, 2),
  
  -- Chi phí theo type
  expense_marketing DECIMAL(15, 2),
  expense_salary DECIMAL(15, 2),
  expense_operating DECIMAL(15, 2),
  expense_tax DECIMAL(15, 2),
  expense_other DECIMAL(15, 2),
  total_expense DECIMAL(15, 2),
  
  -- Kết quả
  profit_loss DECIMAL(15, 2),
  profit_margin DECIMAL(5, 2)  -- %
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_revenue_net DECIMAL(15, 2);
  v_revenue_gross DECIMAL(15, 2);
  v_marketing DECIMAL(15, 2);
  v_salary DECIMAL(15, 2);
  v_operating DECIMAL(15, 2);
  v_tax DECIMAL(15, 2);
  v_other DECIMAL(15, 2);
  v_total_exp DECIMAL(15, 2);
  v_pl DECIMAL(15, 2);
  v_margin DECIMAL(5, 2);
BEGIN
  -- Doanh thu net từ hoa hồng
  SELECT 
    COALESCE(SUM(c.net_amount), 0),
    COALESCE(SUM(c.gross_amount), 0)
  INTO v_revenue_net, v_revenue_gross
  FROM public.commissions c
  WHERE c.is_deleted = false
    AND c.earned_date BETWEEN p_from_date AND p_to_date;

  -- Tổng hợp chi phí theo expense_category.type
  -- Chi phí từ CẢ bank + cash transactions
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
  v_pl := v_revenue_net - v_total_exp;
  v_margin := CASE 
    WHEN v_revenue_net > 0 THEN ROUND((v_pl / v_revenue_net * 100)::NUMERIC, 2)
    ELSE 0
  END;

  RETURN QUERY SELECT
    v_revenue_net, v_revenue_gross,
    v_marketing, v_salary, v_operating, v_tax, v_other, v_total_exp,
    v_pl, v_margin;
END;
$$;

-- ============================================================================
-- 5. BREAKDOWN chi phí chi tiết theo category cho P&L
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_expense_breakdown(
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE(
  category_id UUID,
  category_name TEXT,
  category_type TEXT,
  total_amount DECIMAL(15, 2),
  transaction_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH all_expenses AS (
    SELECT bt.amount, bt.expense_category_id
    FROM public.bank_transactions bt
    WHERE bt.trans_type = 'expense'
      AND bt.is_deleted = false
      AND bt.trans_date BETWEEN p_from_date AND p_to_date
    UNION ALL
    SELECT ct.amount, ct.expense_category_id
    FROM public.cash_transactions ct
    WHERE ct.trans_type = 'expense'
      AND ct.is_deleted = false
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
$$;
