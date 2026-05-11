-- ============================================================================
-- PHASE 2 UPDATE: Thêm trường lương từ công ty
-- 
-- Mục đích: Cho phép nhập lương cố định (gross) từ công ty của người đứng tên,
-- dùng để tính chính xác hơn số thuế TNCN cần nộp thêm cuối năm.
-- 
-- Logic: Người đứng tên có 2 nguồn thu nhập:
--   1. Lương từ công ty (đã được công ty khấu trừ thuế hàng tháng)
--   2. Hoa hồng từ Shopee (Shopee khấu trừ 10% vãng lai)
-- 
-- Khi quyết toán: cộng cả 2 nguồn → tính thuế lũy tiến → trừ phần đã khấu trừ
-- ============================================================================

ALTER TABLE public.affiliate_accounts
  ADD COLUMN IF NOT EXISTS has_company_salary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_salary_gross DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_salary_tax_withheld DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Comment cho rõ nghĩa
COMMENT ON COLUMN public.affiliate_accounts.has_company_salary IS 
  'Người này có nhận lương từ công ty không (ngoài hoa hồng Shopee)';
COMMENT ON COLUMN public.affiliate_accounts.monthly_salary_gross IS 
  'Lương tháng trung bình từ công ty - GROSS (trước thuế). Dùng để ước tính thuế cuối năm.';
COMMENT ON COLUMN public.affiliate_accounts.monthly_salary_tax_withheld IS 
  'Thuế TNCN trung bình mà công ty khấu trừ mỗi tháng. Dùng để trừ vào tổng thuế cần nộp.';
