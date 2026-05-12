-- ============================================================================
-- PHASE 10 FIX FINAL 3: ENSURE BANK_ACCOUNTS COLUMNS
-- 
-- Vấn đề: Đã thêm TK thành công nhưng trang /settings hiển thị rỗng
-- Nguyên nhân: cột is_deleted có thể NULL hoặc chưa tồn tại
-- ============================================================================

-- 1. Đảm bảo cột is_deleted tồn tại với default false
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill các records có is_deleted = NULL → false
-- (Trường hợp cột đã tồn tại nhưng default NULL)
UPDATE public.bank_accounts
SET is_deleted = false
WHERE is_deleted IS NULL;

-- 3. Đảm bảo cột is_company tồn tại với default true
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS is_company BOOLEAN NOT NULL DEFAULT true;

-- 4. Backfill is_company = NULL → true
UPDATE public.bank_accounts
SET is_company = true
WHERE is_company IS NULL;

-- 5. Kiểm tra kết quả - SELECT này để bạn xem có TK nào không
-- (chạy riêng để confirm sau khi chạy migrations ở trên)
-- SELECT id, bank_name, account_number, is_deleted, is_company, created_at 
-- FROM public.bank_accounts ORDER BY created_at DESC;
