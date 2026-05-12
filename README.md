# Phase 15 — Shopee Đang Xử Lý

## 🎯 Thêm KPI thứ 5: "Shopee đang xử lý"

Số tiền Shopee đã ghi nhận hoa hồng theo ngày nhưng chưa nhóm thành đợt đối soát.
Kế toán **nhập thủ công** số liệu từ trang Shopee Affiliate vào bảng trong /reports/assets.

---

## 📋 Files (4 files)

```
supabase/migrations/20260514000013_phase15_shopee_processing.sql   ← SQL
app/(dashboard)/reports/assets/page.tsx                            ← GHI ĐÈ (5 KPI)
app/(dashboard)/reports/assets/actions.ts                          ← MỚI
components/reports/shopee-processing-table.tsx                     ← MỚI
```

---

## 🚀 Triển khai

### Bước 1: Chạy SQL migration

Supabase SQL Editor → paste file `20260514000013_phase15_shopee_processing.sql` → Run

Migration tạo:
- Bảng `shopee_processing_amounts` (1 dòng/affiliate)
- RPC `upsert_shopee_processing` (kế toán dùng để cập nhật)
- Update RPC `get_total_assets` (cộng thêm `shopee_processing`)

### Bước 2: Upload 3 files code

```
app/(dashboard)/reports/assets/page.tsx
app/(dashboard)/reports/assets/actions.ts
components/reports/shopee-processing-table.tsx
```

### Bước 3: Commit + Push

Message: `Phase 15: track Shopee processing amount per affiliate`

### Bước 4: Test

1. Vào `/reports/assets`
2. KPI top giờ có **5 ô** (thêm "Shopee đang xử lý" màu tím)
3. Cuộn xuống → thấy bảng "Shopee đang xử lý" với danh sách affiliate
4. Sửa số tiền cho Vũ Văn Trường: 28.122.446
5. Đổi ngày snapshot
6. Bấm "Lưu" → toast xanh
7. **Pie chart và Tổng tài sản tự cập nhật** sau khi lưu (page tự revalidate)

---

## 💡 Workflow hàng ngày của kế toán

```
1. Mở Shopee Affiliate của Trần Văn An
2. Vào "Thanh toán" → "Hóa đơn đối soát"
3. Copy số "Khoản thanh toán đang xử lý" (vd: 28.122.446đ)
4. Vào app /reports/assets
5. Tìm Trần Văn An trong bảng → paste số → Lưu
6. Lặp lại cho mỗi affiliate (5 phút)
7. Pie chart cập nhật ngay, Tổng tài sản đúng 100%
```

---

## ✨ Features đặc biệt

### Cảnh báo "đã cũ"
Nếu số liệu cập nhật cuối **> 7 ngày trước** và amount > 0:
- Dòng đó có nền xám
- Hiển thị "Đã cũ — nên cập nhật"

### Chỉ báo "có thay đổi chưa lưu"
Khi sửa số, dòng đó có nền cam → nhắc nhở bấm Lưu

### Snapshot date
Lưu ngày Shopee tính số liệu (KHÁC với ngày kế toán nhập). Hữu ích để biết "28tr này là tính đến ngày nào".

### Audit log
Mỗi lần sửa được ghi vào audit_log → trace được lịch sử thay đổi.

### Có thể thu gọn
Bấm header của bảng → thu gọn/mở rộng để không chiếm chỗ.
