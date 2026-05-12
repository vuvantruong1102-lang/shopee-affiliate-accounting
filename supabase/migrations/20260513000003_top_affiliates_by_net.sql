-- ============================================================================
-- PHASE 6 FIX 2:
-- 1. Top affiliates sort theo NET (đã trừ thuế) thay vì gross
-- 2. Không cần RPC mới cho Shopee đã chuyển - dùng query trực tiếp
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_top_affiliates(DATE, DATE, INT);

CREATE OR REPLACE FUNCTION public.get_top_affiliates(
  p_from_date DATE,
  p_to_date DATE,
  p_limit INT DEFAULT 5
)
RETURNS TABLE(
  affiliate_id UUID,
  affiliate_name TEXT,
  total_gross DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  commission_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    aa.id,
    aa.full_name,
    COALESCE(SUM(c.gross_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.net_amount), 0)::DECIMAL(15, 2),
    COUNT(c.id)::BIGINT
  FROM public.affiliate_accounts aa
  LEFT JOIN public.commissions c 
    ON c.account_id = aa.id
    AND c.earned_date BETWEEN p_from_date AND p_to_date
    AND c.is_deleted = false
  WHERE aa.is_deleted = false
  GROUP BY aa.id, aa.full_name
  HAVING COUNT(c.id) > 0
  ORDER BY SUM(c.net_amount) DESC NULLS LAST  -- Sort theo NET
  LIMIT p_limit;
$$;
