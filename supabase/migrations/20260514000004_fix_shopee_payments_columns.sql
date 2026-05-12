-- ============================================================================
-- PHASE 9 FIX: THÊM CỘT THIẾU VÀO shopee_payments
-- 
-- Lỗi: column "updated_at" / "received_date" does not exist
-- Nguyên nhân: bảng shopee_payments tạo từ Phase 4 chưa có 2 cột này,
--              nhưng RPC Phase 9 đang cần dùng.
-- ============================================================================

-- 1. Thêm cột received_date (ngày nhận tiền, khác payment_date là ngày Shopee thanh toán)
ALTER TABLE public.shopee_payments
  ADD COLUMN IF NOT EXISTS received_date DATE;

-- 2. Thêm cột updated_at
ALTER TABLE public.shopee_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Trigger tự cập nhật updated_at khi UPDATE (giống các bảng khác)
CREATE OR REPLACE FUNCTION public.set_shopee_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopee_payments_updated_at ON public.shopee_payments;
CREATE TRIGGER trg_shopee_payments_updated_at
  BEFORE UPDATE ON public.shopee_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shopee_payments_updated_at();

-- 4. Backfill received_date cho các bản ghi đã is_received = true
-- (Lấy payment_date làm ngày nhận luôn vì không có dữ liệu thực)
UPDATE public.shopee_payments
SET received_date = payment_date
WHERE is_received = true AND received_date IS NULL;
