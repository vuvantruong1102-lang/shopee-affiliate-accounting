# Phase 2 Update — Thêm trường lương công ty + Thuế YTD

## 🎯 Tính năng mới

1. **Trường "Thu nhập khác ngoài Shopee"** trong form affiliate:
   - Section collapsible, mặc định đóng (kín đáo, không gây nhiễu cho phần lớn affiliate không có lương)
   - Cho phép nhập: lương tháng (gross) + thuế công ty đã khấu trừ/tháng

2. **Hiển thị "Số thuế TNCN cần phải nộp thêm"** ở trang chi tiết affiliate:
   - Tính theo bậc lũy tiến năm hiện tại (YTD)
   - Cộng dồn lương công ty + hoa hồng Shopee
   - 3 trạng thái: Phải nộp thêm (vàng), Được hoàn (xanh), Đã đóng đủ (xám)

## 📋 Các bước cập nhật

### Bước 1: Chạy SQL migration mới

Vào Supabase Dashboard → SQL Editor → New query → paste file `supabase/migrations/20260511000004_add_salary_fields.sql` → Run.

Migration này thêm 3 cột vào bảng `affiliate_accounts`:
- `has_company_salary` (BOOLEAN)
- `monthly_salary_gross` (DECIMAL)
- `monthly_salary_tax_withheld` (DECIMAL)

### Bước 2: Cập nhật 5 file code

| File | Trạng thái |
|------|-----------|
| `types/database.ts` | Ghi đè (thêm 3 trường) |
| `lib/ytd-tax.ts` | File mới |
| `app/(dashboard)/affiliates/actions.ts` | Ghi đè |
| `app/(dashboard)/affiliates/[id]/page.tsx` | Ghi đè |
| `components/affiliates/affiliate-form.tsx` | Ghi đè |

### Bước 3: Commit & Push → Vercel auto-deploy

### Bước 4: Test

1. Vào 1 affiliate đã có → bấm Chỉnh sửa
2. Cuộn xuống section "Thông tin thuế TNCN"
3. Bấm **"Thu nhập khác ngoài Shopee"** (mặc định đóng) để mở
4. Tick "Nhận lương từ công ty" → nhập lương, lưu
5. Quay lại trang chi tiết → kiểm tra dòng "Số thuế TNCN cần phải nộp thêm" hiển thị đúng

## 🧮 Công thức tính

```
Tổng TN YTD = (Lương tháng × số tháng) + HH Shopee gross YTD
Giảm trừ YTD = (11tr + 4.4tr × người PT) × số tháng
TN chịu thuế = max(0, Tổng TN - Giảm trừ)
Bình quân tháng = TN chịu thuế / số tháng
Thuế/tháng = tính lũy tiến 7 bậc theo bình quân
Thuế phải nộp YTD = Thuế/tháng × số tháng
Đã khấu trừ = (Công ty × số tháng) + Shopee 10%
Cần nộp thêm = Thuế phải nộp − Đã khấu trừ
```

## 💡 Ví dụ

**Người A: lương 10tr/tháng, HH Shopee 50tr (sau 5 tháng)**
- Tổng TN: 100tr
- Giảm trừ: 55tr (11tr × 5)
- TN chịu thuế: 45tr → bình quân 9tr/tháng
- Thuế: ~3.25tr
- Shopee đã KT: 5tr → **được hoàn 1.75tr**

**Người B: lương 30tr/tháng, HH Shopee 60tr (sau 6 tháng), 1 người PT**
- Tổng TN: 240tr
- Giảm trừ: 92.4tr
- TN chịu thuế: 147.6tr → bình quân 24.6tr/tháng
- Thuế: ~19.62tr
- Đã KT: 18tr → **phải nộp thêm 1.62tr**
