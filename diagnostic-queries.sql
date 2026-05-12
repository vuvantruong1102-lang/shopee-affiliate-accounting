-- ============================================================================
-- DIAGNOSTIC: Tại sao "Đã nộp vào công ty" = 70tr cho Trần Văn An?
-- 
-- Chạy các query này trong Supabase SQL Editor để xem dữ liệu chi tiết.
-- KHÔNG CHẠY HẾT FILE - chạy từng query để xem kết quả.
-- ============================================================================

-- ============================================================================
-- QUERY 1: Xem các giao dịch income đang link với affiliate Trần Văn An
-- ============================================================================
SELECT 
  bt.id,
  bt.trans_date,
  bt.amount,
  bt.description,
  bt.notes,
  ba.bank_name || ' ' || ba.account_number as bank_account,
  bt.created_at,
  bt.is_deleted
FROM public.bank_transactions bt
LEFT JOIN public.bank_accounts ba ON ba.id = bt.bank_account_id
LEFT JOIN public.affiliate_accounts aa ON aa.id = bt.account_id
WHERE aa.full_name LIKE '%Trần Văn An%'
  AND bt.trans_type = 'income'
ORDER BY bt.trans_date DESC;

-- → Sẽ thấy các giao dịch tổng 70tr. Xem:
--   * description: có phải "Affiliate ... nộp tiền" không?
--   * Nếu là giao dịch test cũ → có thể xóa bằng QUERY 2

-- ============================================================================
-- QUERY 2: (TÙY CHỌN) XÓA MỀM các giao dịch test cũ
-- 
-- ⚠️ CẨN THẬN: chỉ chạy nếu chắc chắn các giao dịch đó là test/sai
-- Thay 'XXX' bằng ID cụ thể từ QUERY 1
-- ============================================================================
-- UPDATE public.bank_transactions
-- SET is_deleted = true, updated_at = NOW()
-- WHERE id IN (
--   'paste-id-1',
--   'paste-id-2'
-- );

-- ============================================================================
-- QUERY 3: Kiểm tra cấu trúc bảng bank_accounts xem có cột is_company không
-- ============================================================================
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bank_accounts'
ORDER BY ordinal_position;

-- ============================================================================
-- QUERY 4: Nếu cột is_company tồn tại nhưng TK có is_company=false 
-- → set lại = true để TK hiện trong dropdown nộp tiền
-- ============================================================================
-- UPDATE public.bank_accounts
-- SET is_company = true
-- WHERE is_company IS NULL OR is_company = false;

-- ============================================================================
-- QUERY 5: Đếm tất cả TK ngân hàng hiện có
-- ============================================================================
SELECT 
  id,
  bank_name,
  account_number,
  account_holder,
  is_deleted,
  created_at
FROM public.bank_accounts
ORDER BY created_at DESC;

-- → Nếu thấy TK đã tạo nhưng is_deleted=true → set lại false
-- UPDATE public.bank_accounts SET is_deleted = false WHERE id = 'paste-id';
