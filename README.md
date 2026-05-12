# Phase 11 — Period filter + Activity log

## 🎯 2 thay đổi

### 1. Hoạt động gần đây — gộp commission + deposit

Card mới ở cuối trang affiliate hiển thị log thống nhất:
- 📈 Hoa hồng (icon xanh primary)
- 💰 Nộp tiền vào công ty (icon xanh success)

Sắp xếp theo ngày, mới nhất trước. Mỗi item có:
- Icon + tên hoạt động + badge trạng thái
- Số tiền lớn bên phải
- Ngày + chi tiết (TK ngân hàng, ghi chú...)

### 2. Period filter

Filter bar ở đầu trang với 6 preset:
- **Tất cả** (mặc định, không filter)
- **Tuần này** (T2 - CN)
- **Tháng này**
- **Tháng trước**
- **Năm này**
- **Tùy chọn** (chọn from/to ngày)

Filter **lọc cả**:
- ✅ 4 KPI ở đầu trang
- ✅ Bảng "Hoa hồng"
- ✅ "Hoạt động gần đây"

**KHÔNG lọc**:
- ❌ Phần Thuế TNCN (luôn tính YTD cả năm để đúng luật)
- ❌ Thông tin liên hệ
- ❌ Modal "Nộp tiền" (vẫn dùng số tổng tất cả thời gian)

## 🎨 UI

### Period filter ở đầu trang

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Lọc theo kỳ: Đang xem: Tháng này                          │
│                                                              │
│ [Tất cả][Tuần này][Tháng này][Tháng trước][Năm này][Tùy chọn]│
│                                                              │
│ 📅 [01/05/2026] → [31/05/2026]   (hiện khi không phải All)  │
└─────────────────────────────────────────────────────────────┘
```

### Activity log

```
┌─ Hoạt động gần đây ──────────────────────────────────────────┐
│ X hoạt động · Tháng này · gồm hoa hồng + nộp tiền            │
├──────────────────────────────────────────────────────────────┤
│ 📈 Hoa hồng [Đợt Shopee] [Đã nhận]      +13.738.004đ        │
│    📅 07/05/2026 · Nhận 11/05/2026       Gross 15tr − Thuế 1.5tr│
├──────────────────────────────────────────────────────────────┤
│ 💰 Nộp tiền vào công ty [Đã nộp]        +20.000.000đ        │
│    📅 11/05/2026  🏦 Vietcombank · 942829421                 │
├──────────────────────────────────────────────────────────────┤
│ 📈 Hoa hồng [Đã nhận]                    +28.432.690đ        │
│    📅 04/05/2026                         Gross 31tr − Thuế 3tr│
└──────────────────────────────────────────────────────────────┘
```

## 📋 Triển khai

### Bước 1: Upload 3 file

```
app/(dashboard)/affiliates/[id]/page.tsx                  ← GHI ĐÈ
components/affiliates/affiliate-period-selector.tsx       ← MỚI
components/affiliates/activity-log.tsx                    ← MỚI
```

**KHÔNG cần SQL migration**.

### Bước 2: Commit + Push

Message: `Phase 11: period filter + activity log on affiliate page`

### Bước 3: Test

**Test 1 - Period filter**:
1. Vào `/affiliates/[id]`
2. Mặc định: hiển thị "Tất cả thời gian"
3. Bấm "Tháng này" → URL có `?from=2026-05-01&to=2026-05-31&preset=this_month`
4. 4 KPI cập nhật theo tháng
5. Bảng hoa hồng + Activity log cũng cập nhật

**Test 2 - Custom period**:
1. Bấm "Tùy chọn" → 2 input date hiện ra
2. Chọn from = 01/03/2026, to = 31/03/2026
3. Tất cả dữ liệu lọc theo Q1/Tháng 3

**Test 3 - Activity log**:
1. Cuộn xuống "Hoạt động gần đây"
2. Thấy mix giữa hoa hồng + nộp tiền
3. Sắp xếp theo ngày, mới nhất trước
4. Hoa hồng từ Shopee có icon 🔗

**Test 4 - Thuế vẫn YTD**:
1. Chuyển sang "Tháng trước"
2. KPI thay đổi nhưng card "Thuế TNCN" vẫn hiển thị số YTD cả năm
3. Có note nhỏ "Luôn tính cả năm" để rõ

## 💡 Lưu ý

### Modal Nộp tiền — số đúng

Modal "Nộp tiền" cần biết tổng "Đã thực nhận" và "Đang cầm" của **tất cả thời gian** để gợi ý số nộp đúng. Phase 11 fix điều này:
- KPI trên trang lọc theo period
- Modal vẫn dùng `allTimeReceived` và `allTimeTotalDeposited`

### Tuần bắt đầu T2

Logic preset "Tuần này" tính từ Thứ 2 đến Chủ nhật (chuẩn Việt Nam), không phải CN-T7.

### URL có state

Khi bấm preset, URL update với `?from=...&to=...&preset=...`. Có thể bookmark hoặc share link với filter cụ thể.

### Performance

- Query commissions giới hạn 100 records
- Query deposits giới hạn 100 records
- Bank info được fetch 1 lần với `IN (...)` thay vì N+1
