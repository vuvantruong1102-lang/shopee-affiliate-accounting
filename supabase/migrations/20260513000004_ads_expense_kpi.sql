-- ============================================================================
-- PHASE 6 FIX 3:
-- RPC tính chi phí marketing/Facebook Ads trong tháng
-- 
-- Match smart theo tên category (ILIKE):
-- - "facebook ads"
-- - "fb ads" 
-- - "marketing"
-- - "quảng cáo" / "quang cao"
-- - "ads"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ads_expense_this_month()
RETURNS TABLE(
  total_ads_expense DECIMAL(15, 2),
  transaction_count BIGINT,
  category_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
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
      AND bt.is_deleted = false
      AND bt.expense_category_id IN (SELECT id FROM matching_categories)
      AND bt.trans_date BETWEEN v_start AND v_end
  ),
  cash_expenses AS (
    SELECT amount
    FROM public.cash_transactions ct
    WHERE ct.trans_type = 'expense'
      AND ct.is_deleted = false
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
$$;

-- ============================================================================
-- (TÙY CHỌN) Tạo khoản mục "Facebook Ads" nếu chưa có
-- Nếu bạn đã có khoản tương tự thì có thể bỏ qua đoạn này
-- ============================================================================
INSERT INTO public.expense_categories (name, type, description, is_active, display_order)
SELECT 'Facebook Ads', 'marketing', 'Chi phí quảng cáo Facebook', true, 10
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_categories 
  WHERE name ILIKE '%facebook ads%' OR name ILIKE '%fb ads%'
);
