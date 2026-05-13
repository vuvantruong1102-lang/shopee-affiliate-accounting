-- ============================================================================
-- FIX get_affiliates_report
-- 
-- Bug cũ:
-- - Query SAI bảng: dùng `bank_transactions` nhưng nộp tiền mặt từ affiliate 
--   lại ghi vào `cash_transactions`
-- - Filter `is_deleted = false` strict equality không match khi cột null
-- 
-- Thêm mới:
-- - Cột `shopee_processing_gross`: số tiền user nhập (DB gốc)
-- - Cột `shopee_processing_net`: × 0.9 (sau thuế 10%)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_affiliates_report(DATE, DATE);

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
  commission_count BIGINT,
  shopee_processing_gross DECIMAL(15, 2),
  shopee_processing_net DECIMAL(15, 2)
)
LANGUAGE sql
STABLE
AS $$
  WITH affiliate_commissions AS (
    SELECT
      aa.id,
      aa.full_name,
      aa.status::TEXT AS status,
      COALESCE(SUM(c.gross_amount), 0)::DECIMAL(15, 2) AS total_gross,
      COALESCE(SUM(c.net_amount), 0)::DECIMAL(15, 2) AS total_net,
      COALESCE(SUM(c.tax_withheld), 0)::DECIMAL(15, 2) AS total_tax,
      COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.net_amount ELSE 0 END), 0)::DECIMAL(15, 2) AS received_net,
      COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.net_amount ELSE 0 END), 0)::DECIMAL(15, 2) AS pending_net,
      COUNT(c.id)::BIGINT AS commission_count
    FROM public.affiliate_accounts aa
    LEFT JOIN public.commissions c
      ON c.account_id = aa.id
      AND c.earned_date BETWEEN p_from_date AND p_to_date
      AND COALESCE(c.is_deleted, false) = false
    WHERE COALESCE(aa.is_deleted, false) = false
    GROUP BY aa.id, aa.full_name, aa.status
  ),
  affiliate_deposits AS (
    -- ✨ FIX: Query CASH transactions thay vì BANK
    -- Khi user nộp tiền mặt từ affiliate → ghi vào cash_transactions (income)
    -- với account_id = affiliate_id
    SELECT
      ct.account_id AS aff_id,
      COALESCE(SUM(ct.amount), 0)::DECIMAL(15, 2) AS deposited
    FROM public.cash_transactions ct
    WHERE ct.account_id IS NOT NULL
      AND ct.trans_type = 'income'
      AND COALESCE(ct.is_deleted, false) = false
      AND COALESCE(ct.is_internal_transfer, false) = false  -- bỏ giao dịch internal (nộp cash → bank)
      AND ct.trans_date BETWEEN p_from_date AND p_to_date
    GROUP BY ct.account_id
  ),
  affiliate_processing AS (
    -- Shopee đang xử lý (DB lưu Gross, tính Net = × 0.9)
    SELECT
      sp.affiliate_id AS aff_id,
      sp.amount AS processing_gross,
      ROUND(sp.amount * 0.9, 2) AS processing_net
    FROM public.shopee_processing_amounts sp
  )
  SELECT
    ac.id,
    ac.full_name,
    ac.status,
    ac.total_gross,
    ac.total_net,
    ac.total_tax,
    ac.received_net,
    ac.pending_net,
    COALESCE(ad.deposited, 0)::DECIMAL(15, 2),
    (ac.received_net - COALESCE(ad.deposited, 0))::DECIMAL(15, 2),
    ac.commission_count,
    COALESCE(ap.processing_gross, 0)::DECIMAL(15, 2),
    COALESCE(ap.processing_net, 0)::DECIMAL(15, 2)
  FROM affiliate_commissions ac
  LEFT JOIN affiliate_deposits ad ON ad.aff_id = ac.id
  LEFT JOIN affiliate_processing ap ON ap.aff_id = ac.id
  ORDER BY ac.total_net DESC NULLS LAST;
$$;
