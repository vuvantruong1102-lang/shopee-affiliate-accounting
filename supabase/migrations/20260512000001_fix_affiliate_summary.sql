-- ============================================================================
-- PHASE 5 FIX: Sửa logic "Đã nộp vào công ty" trong trang affiliate
-- 
-- VẤN ĐỀ: 
-- Từ Phase 3 Fix, khi affiliate nộp tiền → chỉ ghi vào bank_transactions,
-- không còn ghi vào cash_transactions. Nhưng RPC get_affiliate_summary cũ
-- vẫn đếm "total_deposited" từ cash_transactions → luôn = 0.
-- 
-- GIẢI PHÁP:
-- 1. Thêm cột account_id vào bank_transactions (FK đến affiliate_accounts)
-- 2. Backfill account_id cho dữ liệu cũ dựa trên counterparty_name
-- 3. Sửa RPC get_affiliate_summary để đếm từ bank_transactions
-- ============================================================================

-- ============================================================================
-- 1. Thêm cột account_id vào bank_transactions (nullable - vì có giao dịch 
--    không phải nộp tiền của affiliate, ví dụ chi tiêu)
-- ============================================================================
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.affiliate_accounts(id) ON DELETE SET NULL;

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_bank_trans_account 
  ON public.bank_transactions(account_id) 
  WHERE account_id IS NOT NULL AND is_deleted = false;

-- ============================================================================
-- 2. BACKFILL dữ liệu cũ
-- 
-- Match các giao dịch income trong bank_transactions với affiliate dựa trên
-- counterparty_name = full_name. Chỉ áp dụng cho giao dịch chưa có account_id.
-- ============================================================================
UPDATE public.bank_transactions bt
SET account_id = aa.id
FROM public.affiliate_accounts aa
WHERE bt.account_id IS NULL
  AND bt.trans_type = 'income'
  AND bt.counterparty_name IS NOT NULL
  AND LOWER(TRIM(bt.counterparty_name)) = LOWER(TRIM(aa.full_name))
  AND aa.is_deleted = false;

-- ============================================================================
-- 3. Sửa RPC get_affiliate_summary
-- 
-- Tính total_deposited từ bank_transactions thay vì cash_transactions
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_affiliate_summary(UUID);

CREATE OR REPLACE FUNCTION public.get_affiliate_summary(p_account_id UUID)
RETURNS TABLE(
  total_gross DECIMAL(15, 2),
  total_tax_withheld DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  received_net DECIMAL(15, 2),
  pending_net DECIMAL(15, 2),
  total_withdrawn DECIMAL(15, 2),
  total_deposited DECIMAL(15, 2)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH commission_stats AS (
    SELECT
      COALESCE(SUM(c.gross_amount), 0) AS gross,
      COALESCE(SUM(c.tax_withheld), 0) AS tax,
      COALESCE(SUM(c.net_amount), 0) AS net,
      COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.net_amount ELSE 0 END), 0) AS received,
      COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.net_amount ELSE 0 END), 0) AS pending
    FROM public.commissions c
    WHERE c.account_id = p_account_id
      AND c.is_deleted = false
  ),
  deposit_stats AS (
    -- Tiền affiliate đã nộp vào TK ngân hàng công ty
    -- Match bằng account_id (mới) HOẶC counterparty_name (cũ, fallback)
    SELECT
      COALESCE(SUM(bt.amount), 0) AS deposited
    FROM public.bank_transactions bt
    WHERE bt.account_id = p_account_id
      AND bt.trans_type = 'income'
      AND bt.is_deleted = false
  )
  SELECT
    cs.gross::DECIMAL(15, 2),
    cs.tax::DECIMAL(15, 2),
    cs.net::DECIMAL(15, 2),
    cs.received::DECIMAL(15, 2),
    cs.pending::DECIMAL(15, 2),
    0::DECIMAL(15, 2) AS total_withdrawn,  -- Không còn module withdrawal
    ds.deposited::DECIMAL(15, 2)
  FROM commission_stats cs, deposit_stats ds;
END;
$$;

-- ============================================================================
-- 4. Kiểm tra kết quả backfill
-- Chạy query này để xem có bao nhiêu giao dịch đã được match
-- ============================================================================
-- SELECT 
--   aa.full_name,
--   COUNT(bt.id) AS so_giao_dich,
--   SUM(bt.amount) AS tong_tien
-- FROM public.affiliate_accounts aa
-- LEFT JOIN public.bank_transactions bt 
--   ON bt.account_id = aa.id 
--   AND bt.trans_type = 'income'
--   AND bt.is_deleted = false
-- GROUP BY aa.id, aa.full_name
-- ORDER BY aa.full_name;
