# Phase 5 — Thuế TNCN (Cập nhật Luật 2026)

## 🎯 Tính năng

1. **Cập nhật toàn bộ logic thuế theo Luật mới 2026**:
   - Biểu thuế 5 bậc (thay 7 bậc cũ)
   - Giảm trừ bản thân 15,5tr/tháng (thay 11tr)
   - Giảm trừ phụ thuộc 6,2tr/tháng (thay 4,4tr)

2. **Trang `/tax` — Tổng quan thuế**:
   - 2 KPI: Tổng phải nộp thêm / Tổng được hoàn
   - Bảng danh sách tất cả affiliate với trạng thái thuế
   - Phần **Căn cứ pháp lý** đầy đủ (luật, nghị quyết, biểu thuế, công thức)

3. **Trang `/tax/[id]` — Chi tiết thuế từng affiliate**:
   - 4 KPI: Tổng TN, TN tính thuế, Thuế phải nộp, Cần nộp thêm/Được hoàn
   - **Breakdown step-by-step** chi tiết 5 bước tính thuế
   - Bảng thu nhập từng tháng trong năm
   - 2 nút xuất file: **Excel (CSV)** và **HTML quyết toán**

4. **File quyết toán HTML**:
   - Tự thiết kế (không phải mẫu 02/QTT-TNCN chuẩn)
   - Có thể chỉnh sửa trước khi in
   - Ctrl+P trong file HTML để in/Save as PDF

## 📋 Các bước triển khai

### Bước 1: Upload các file MỚI/CẬP NHẬT lên GitHub

```
lib/tax-calculator.ts                                  [GHI ĐÈ]
lib/ytd-tax.ts                                         [GHI ĐÈ]
components/affiliates/affiliate-form.tsx               [GHI ĐÈ - đổi label]
app/(dashboard)/affiliates/[id]/page.tsx               [GHI ĐÈ - đổi label + thêm nút]
app/(dashboard)/tax/page.tsx                           [GHI ĐÈ - thay placeholder]
app/(dashboard)/tax/[id]/page.tsx                      [FILE MỚI]
components/tax/tax-breakdown.tsx                       [FILE MỚI]
components/tax/tax-export-buttons.tsx                  [FILE MỚI]
```

⚠️ **KHÔNG** tạo các file trong `lib/components/` (lỗi đã gặp). 
- File `tax-breakdown.tsx` phải ở `components/tax/`, KHÔNG ở `lib/components/tax/`.
- File `affiliate-form.tsx` phải ở `components/affiliates/`, KHÔNG ở `lib/components/affiliates/`.

### Bước 2: KHÔNG cần chạy SQL migration

Phase 5 chỉ sửa logic tính thuế và thêm UI, không thay đổi database schema. Dữ liệu cũ (hoa hồng, lương) đã có sẵn sẽ tự được tính lại bằng luật mới.

### Bước 3: Commit & Push

Commit message: `Phase 5: Tax TNCN module with 2026 law update`

### Bước 4: Đợi Vercel deploy → Test

1. Vào **Thuế TNCN** (menu trái) — kỳ vọng thấy:
   - 2 KPI tổng (phải nộp / được hoàn)
   - Bảng danh sách affiliate
   - Phần "Căn cứ pháp lý" có biểu thuế 5 bậc
2. Click vào 1 affiliate → trang chi tiết `/tax/[id]`
3. Kiểm tra **Breakdown chi tiết** có đủ 5 bước
4. Bấm **"Tải Excel"** → mở file CSV bằng Excel, có dữ liệu hàng tháng + bảng tính thuế
5. Bấm **"Tải mẫu quyết toán"** → mở file HTML trong browser:
   - File hiển thị đẹp, có chữ ký
   - Ctrl+P → "Save as PDF" để lưu PDF
   - Có thể mở file HTML bằng Word để chỉnh sửa rồi in

## ⚠️ Lưu ý quan trọng

### Số liệu được cập nhật

| Mục | Trước (cũ) | Phase 5 (mới) |
|---|---|---|
| Giảm trừ bản thân/tháng | 11.000.000đ | **15.500.000đ** |
| Giảm trừ phụ thuộc/tháng | 4.400.000đ | **6.200.000đ** |
| Số bậc thuế | 7 bậc | **5 bậc** |
| Thuế suất bậc 1 | 5% (đến 5tr) | **5% (đến 10tr)** |
| Thuế suất bậc 2 | 10% (5-10tr) | **10% (10-30tr)** |
| Thuế suất cao nhất | 35% (trên 80tr) | **35% (trên 100tr)** |

### Sau khi deploy

- **Trang affiliate cũ**: tất cả tính toán "Số thuế cần nộp thêm" sẽ được tính lại theo luật mới → con số có thể THẤP HƠN trước
- Form affiliate sẽ hiển thị label mới (15,5tr và 6,2tr)

### Khấu trừ vãng lai 10% (KHÔNG ĐỔI)

Vẫn áp dụng cho hoa hồng Shopee ≥ 2.000.000đ/lần. Logic tính `gross → net` không thay đổi.

## 🐛 Troubleshooting

**Trang `/tax` báo lỗi build "Module not found"?**
→ Kiểm tra file `components/tax/tax-breakdown.tsx` và `components/tax/tax-export-buttons.tsx` đặt đúng chỗ.

**Bấm "Tải mẫu quyết toán" không có gì xảy ra?**
→ Kiểm tra browser console (F12) xem có lỗi không. Có thể browser chặn pop-up — cho phép trong cài đặt.

**Số thuế hiển thị khác trước khi cập nhật?**
→ Đúng rồi. Luật mới có giảm trừ cao hơn → thuế thấp hơn. Đây là tính năng, không phải bug.

## 🔮 Có thể làm tiếp ở Phase 6 (nếu cần)

- Tải file mẫu 02/QTT-TNCN chính thức (rất phức tạp, 70+ ô)
- Tính chi tiết các khoản BHXH/BHYT/BHTN nếu có
- Module dependents (đăng ký người phụ thuộc)
- So sánh thuế năm này vs năm trước
