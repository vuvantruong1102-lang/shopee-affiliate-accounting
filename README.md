# Phase 6 Fix — Sửa layout Dashboard + Bug format số tiền

## 🐛 Vấn đề đã sửa

1. **Bug `###,###,###đ` trong alerts**: Postgres `to_char(amount, 'FM999,999,999')` không hỗ trợ dấu phẩy nghìn theo cú pháp này → format ở client TypeScript (`formatCurrency`) cho chính xác.

2. **Bỏ alert "Hoa hồng chậm về"** (không còn hợp lý sau khi có Phase 4 Đối soát Shopee — vì đã có alert "đợt Shopee chưa nhận" thay thế).

3. **Bỏ banner "Hoa hồng pending > 14 ngày"** vì đã có alert đợt Shopee chưa nhận từ Phase 4.

## 🎨 Layout mới

```
┌──────────────────────────────────────────────────────────────┐
│ 6 KPI Cards (TM, NH, DT tháng, Shopee chưa chuyển,           │
│              Thuế đã nộp, Thuế cần nộp thêm)                  │
├────────────────────────────────────┬─────────────────────────┤
│                                    │  ⚠️ Cảnh báo (sidebar)  │
│   📊 Chart 12 tháng                 │  - undeposited          │
│   (chiếm 2 cột, lg:col-span-2)     │  - unreconciled         │
│                                    │                          │
│                                    ├─────────────────────────┤
│                                    │  🏆 Top affiliate       │
│                                    │     tháng này           │
└────────────────────────────────────┴─────────────────────────┘
```

## ✨ Tính năng mới

### 2 KPI thuế tổng

- **Thuế đã nộp**: Tổng thuế đã khấu trừ YTD của tất cả affiliate (Shopee KT 10% + thuế lương công ty nếu có)
- **Thuế cần nộp thêm**: Tổng `taxAdditional > 0` của tất cả affiliate khi quyết toán
  - Subtitle hiện thêm "Hoàn X" nếu có affiliate được hoàn

Logic tính: sử dụng lại `calculateYtdAdditionalTax` (Phase 5) — tự cộng dồn cho tất cả affiliate.

## 📋 Triển khai

### Bước 1: Chạy SQL

Vào Supabase SQL Editor → paste `supabase/migrations/20260513000002_fix_alerts_and_tax_totals.sql` → Run.

Migration này:
- Fix lại `get_dashboard_alerts` (bỏ bug format, bỏ 1 alert không cần)
- Thêm RPC `get_total_tax_ytd` (tuy không dùng trực tiếp nhưng có sẵn để mở rộng)

### Bước 2: Upload 2 file code

```
app/(dashboard)/dashboard/page.tsx              ← GHI ĐÈ
components/dashboard/dashboard-alerts.tsx       ← GHI ĐÈ
```

### Bước 3: Commit + Push

Message: `Phase 6 Fix: Dashboard layout + alert format bug`

### Bước 4: Test sau deploy

1. **Bug số tiền**: Vào `/dashboard` → cảnh báo phải hiển thị "Trần Văn An đang cầm 70.000.000đ chưa nộp" (không còn `###,###,###`)

2. **6 KPI ở đầu**: Hiển thị đầy đủ 6 ô, responsive (xếp 2 cột ở mobile, 3 ở tablet, 6 ở desktop)

3. **Layout 2 cột**:
   - Bên trái rộng hơn: chart 12 tháng
   - Bên phải: trên là Cảnh báo, dưới là Top 5 affiliate

4. **Thuế tổng**:
   - Vào trang Thuế TNCN → ghi nhớ con số "Tổng phải nộp thêm" và "Tổng được hoàn"
   - So sánh với KPI ở Dashboard → phải khớp

## 💡 Lưu ý

- **Responsive**: Ở mobile (< 1024px), 2 cột tự xếp dọc (chart trên, alerts + top ở dưới)
- **Empty state cảnh báo**: Nếu không có cảnh báo → hiện "Mọi thứ ổn ✓" thay vì ẩn card
- **Số tiền compact**: KPI dùng `text-base` (1rem) thay vì `text-xl` để fit 6 ô trên 1 hàng, vẫn dễ đọc
