# Phase 8 — Tính toán (Tax Calculator)

## 🎯 Tính năng

Trang **"Tính toán"** ở menu trái dưới "Báo cáo" — công cụ máy tính độc lập để **ước tính nhanh** thuế và lợi nhuận. Không cần dữ liệu từ DB.

### Mục đích sử dụng

- "Nếu tôi có affiliate mới với HH 50tr/tháng thì thuế bao nhiêu?"
- "Tôi nên chi bao nhiêu cho Ads để có lợi nhuận?"
- "1 năm tới nếu giữ mức này thì cuối năm phải nộp thêm bao nhiêu?"
- "Có nên thuê thêm nhân viên không?"

## 🎨 Layout

```
┌─────────────────────────────────────┬────────────────────────┐
│ Bên trái (3/5):                      │ Bên phải (2/5):         │
│                                      │                         │
│ 📝 Form nhập:                        │ 💰 Thuế theo bậc        │
│   - Phạm vi (1/3/6/12 tháng)         │   - TNTT tổng           │
│   - HH gross/tháng                   │   - TNTT/tháng          │
│   - Lương/tháng                      │   - Bậc 1: 5% (đến 10tr)│
│   - Chi phí Ads/khác                 │   - Bậc 2: 10% (10-30tr)│
│   - Giảm trừ bản thân                │   - Bậc 3: 20% (30-60tr)│
│   - Số NPT                           │   - Bậc 4: 30%...       │
│                                      │   - Bậc 5: 35%...       │
│ 📊 Bảng kết quả:                     │   ─────────────         │
│   DOANH THU                          │   Tổng thuế             │
│     - HH Gross / Net                 │   Đã KT 10%             │
│     - Lương                          │   Còn phải nộp / hoàn   │
│   GIẢM TRỪ                           │                         │
│     - Bản thân / NPT                 │ (sticky khi scroll)     │
│   THUẾ TNCN                          │                         │
│     - Tạm nộp 10%                    │                         │
│     - Còn phải nộp thêm              │                         │
│   CHI PHÍ                            │                         │
│     - Ads / Khác                     │                         │
│   LỢI NHUẬN ⭐                        │                         │
│                                      │                         │
│ Cột bên phải có % so với HH gross    │                         │
└─────────────────────────────────────┴────────────────────────┘
```

## 🧮 Công thức

1. **Hoa hồng Net** = Gross × 90% (sau khi Shopee KT 10% vãng lai)
2. **Tổng thu nhập** = HH Gross + Lương
3. **Tổng giảm trừ** = (Bản thân 15.5tr + NPT × 6.2tr) × số tháng
4. **TNTT** = Tổng thu nhập − Tổng giảm trừ
5. **Thuế phải nộp** = TNTT/tháng → áp biểu lũy tiến 5 bậc → × số tháng
6. **Thuế tạm nộp** = HH Gross × 10%
7. **Còn phải nộp thêm** = max(0, Thuế phải nộp − Thuế tạm nộp)
8. **Được hoàn** = max(0, Thuế tạm nộp − Thuế phải nộp)
9. **Lợi nhuận** = HH Net + Lương − Tổng chi phí − Thuế còn phải nộp thêm

## ✨ Tính năng chi tiết

### Form input
- 4 preset thời gian: **1 / 3 / 6 / 12 tháng** (dropdown)
- Nhập số tiền theo tháng → tự nhân với số tháng
- Nút **"Đặt lại"** về mặc định
- Real-time: thay đổi input → kết quả cập nhật ngay

### Bảng kết quả (bên trái)
- 5 sections: Doanh thu / Giảm trừ / Thuế / Chi phí / Lợi nhuận
- Cột % so với HH Gross (để dễ so sánh tỷ trọng)
- Hàng "Lợi nhuận" highlight lớn với màu xanh nếu lãi, đỏ nếu lỗ

### Bảng thuế theo bậc (bên phải)
- Sticky position (luôn hiển thị khi scroll)
- Mỗi bậc có:
  - Khoảng thu nhập (Đến 10tr / 10-30tr...)
  - Thuế suất (5% / 10% / 20%...)
  - TN trong bậc + Thuế trong bậc
  - **Progress bar** thể hiện tỷ trọng thuế của bậc đó
- Cuối bảng tổng kết: Tổng thuế / Đã KT / Còn phải nộp hoặc Hoàn

### Nút "Đặt lại"
- Reset toàn bộ về giá trị mẫu (HH 30tr/tháng, Ads 5tr...)
- Hữu ích khi thử nhiều scenario

### Note hướng dẫn
- Giải thích công thức ngắn gọn cuối trang
- Lưu ý về các yếu tố ước tính (chưa tính BHXH...)

## 📋 Triển khai

### Bước 1: Upload 3 file

```
app/(dashboard)/calculator/page.tsx              [FILE MỚI]
components/calculator/calculator-form.tsx        [FILE MỚI]
components/layout/sidebar.tsx                    [GHI ĐÈ - thêm nút Tính toán]
```

**KHÔNG cần SQL migration** — trang này là tính toán client-side hoàn toàn.

### Bước 2: Commit + Push

Message: `Phase 8: Tax & profit calculator`

### Bước 3: Test

1. Vào menu trái → kiểm tra có nút **"Tính toán"** dưới "Báo cáo"
2. Click vào → trang hiển thị với 2 cột
3. **Test case 1**: HH 30tr/tháng, 12 tháng, 1 NPT
   - Tổng thuế phải nộp: **~4.98 triệu**
   - Đã KT 10%: **36 triệu**
   - **Được hoàn: ~31 triệu**
4. **Test case 2**: HH 100tr/tháng, 12 tháng, 0 NPT
   - Tổng thuế phải nộp: **~190 triệu**
   - Đã KT 10%: **120 triệu**
   - **Phải nộp thêm: ~70 triệu**
5. Thay đổi input → kết quả thay đổi realtime
6. Bấm "Đặt lại" → form về mặc định

## 💡 Mẹo sử dụng

### Tính ngược: tôi muốn lãi X, cần HH bao nhiêu?
Thử nhiều giá trị HH gross/tháng cho đến khi cột "Lợi nhuận" đạt mức mong muốn.

### So sánh kịch bản: thuê hay không thuê NV?
- Kịch bản 1: Chi phí khác = 0 → lợi nhuận
- Kịch bản 2: Chi phí khác = 15tr (lương 1 NV) → lợi nhuận
- So sánh chênh lệch

### Tối ưu Ads
Tăng/giảm Ads, xem điểm hòa vốn ở đâu.

### Test luật thuế
Thử HH cao để xem khi nào nhảy bậc thuế (>10tr/tháng → bậc 2, >30tr → bậc 3...)
