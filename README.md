# Phase 9 — Đối soát Shopee đơn giản hóa + Auto link Commission

## 🎯 Thay đổi quan trọng

**Bỏ workflow cũ**: Đối soát Shopee (Phase 4) + Nhập hoa hồng (Phase 2) → 2 việc riêng

**Workflow mới**: Đối soát Shopee = Nhập hoa hồng (1 lần thao tác)

## 🔄 Workflow mới

```
1. Shopee thanh toán đợt mới
   ↓
2. Vào /reconciliation → "Thêm đợt thanh toán mới"
   - Chọn affiliate
   - Mã thanh toán (tùy chọn)
   - Ngày thanh toán
   - Gross / Thuế / Net (auto tính)
   - ☑ "Đã nhận tiền" (nếu đã thấy tiền về)
   ↓
3. Bấm "Xác nhận đợt thanh toán"
   ↓
4. Hệ thống TỰ ĐỘNG:
   ✓ Tạo bản ghi shopee_payments
   ✓ Tạo bản ghi commissions tương ứng
   ✓ Link 2 bản ghi qua commission_id
   ✓ Status:
     - Đã check "Đã nhận" → "received" (Shopee đã thanh toán)
     - Không check → "pending" (Shopee chưa thanh toán)
   ↓
5. Khi tiền về sau (nếu chưa check ở B3):
   - Bấm nút "Xác nhận đã nhận" trên item đó
   - → Cập nhật cả 2 bảng: payment.is_received=true + commission.status='received'
```

## 🎨 UI mới

### Layout 2 cột

```
┌─────────────────────────┬───────────────────────────────────┐
│ FORM bên trái (2/5)     │ DANH SÁCH bên phải (3/5)         │
│                         │                                   │
│ Affiliate [dropdown]    │ [Tất cả] [Chờ nhận] [Đã nhận]   │
│ Mã TT  + Ngày           │ ─────────────────────────         │
│ Gross   [text-lg bold]  │ • Nguyễn Văn A • [Chờ nhận]      │
│ Thuế    [text-lg bold]  │   📅 11/05/2026                   │
│ Net (auto)              │   Gross 15tr Thuế 1.5tr Net 13tr  │
│ ☑ Đã nhận tiền          │   [Xác nhận đã nhận] ↪️ ✏️ 🗑       │
│ Ghi chú                 │ ─────────────────────────         │
│ [Xác nhận đợt thanh    │ • Trần Văn B • [Đã thanh toán]   │
│  toán]                  │   ...                             │
└─────────────────────────┴───────────────────────────────────┘
```

### 3 KPI ở đầu

- **Đang chờ nhận**: số đợt chưa received
- **Đã nhận**: số đợt đã received
- **Tổng đợt**: tất cả

### Form tính năng thông minh

- ✅ **Auto tính Thuế** = 10% Gross (khi nhập Gross lần đầu)
- ✅ **Auto tính Net** = Gross − Thuế (có thể tắt nếu Shopee có rounding khác)
- ✅ **Cảnh báo trùng mã**: khi nhập mã đã tồn tại → hiện list các đợt trùng (vẫn cho tạo)
- ✅ **Disable đổi affiliate khi edit** (vì commission đã link với affiliate cũ)

### Danh sách payments

- Filter theo trạng thái (Tất cả / Chờ nhận / Đã nhận)
- Background tint: vàng nhẹ cho pending, xanh nhẹ cho received
- Mỗi item hiển thị:
  - Tên affiliate + Badge trạng thái
  - Mã + ngày
  - Gross / Thuế / Net inline
  - Nút "Xác nhận đã nhận" (hoặc "Hoàn tác") + nút Sửa/Xóa (ẩn, hiện khi hover)

## 📋 Triển khai

### Bước 1: Chạy SQL migration

Vào Supabase SQL Editor → paste `supabase/migrations/20260514000003_phase9_link_shopee_commission.sql` → Run.

Migration này tạo/sửa:
- Thêm cột `commission_id` vào `shopee_payments`
- Bỏ UNIQUE constraint trên `payment_code`
- 7 RPC: `confirm_shopee_payment`, `mark_shopee_payment_received`, `unmark_shopee_payment_received`, `update_shopee_payment`, `delete_shopee_payment`, `check_duplicate_payment_code`

### Bước 2: Upload 5 file code

```
app/(dashboard)/reconciliation/page.tsx              ← GHI ĐÈ
app/(dashboard)/reconciliation/actions.ts            ← GHI ĐÈ
components/reconciliation/reconciliation-view.tsx    ← MỚI hoặc GHI ĐÈ
components/reconciliation/confirm-payment-form.tsx   ← MỚI
components/reconciliation/payment-list.tsx           ← MỚI
```

⚠️ Đặt file đúng vị trí, không tạo `lib/components/...`

### Bước 3: Commit + Push

Message: `Phase 9: Link Shopee payment with auto-commission`

### Bước 4: Test

**Test 1 - Tạo đợt mới**:
1. Vào `/reconciliation`
2. Form bên trái: chọn affiliate, nhập mã + ngày + Gross 1.000.000đ
3. Tự tính: Thuế 100.000đ, Net 900.000đ
4. KHÔNG check "Đã nhận tiền"
5. Bấm "Xác nhận đợt thanh toán"
6. Kỳ vọng:
   - Toast "Đã xác nhận đợt thanh toán (chưa nhận tiền)"
   - Item xuất hiện bên phải với badge "Chưa thanh toán"
   - Vào `/affiliates/[id]` của affiliate đó → trong list "Hoa hồng gần đây" có 1 dòng mới với status pending
   - Vào Dashboard → KPI "Doanh thu tháng" tăng đúng

**Test 2 - Đánh dấu nhận**:
1. Bấm nút "Xác nhận đã nhận" trên item
2. Kỳ vọng:
   - Toast "Đã đánh dấu nhận tiền"
   - Badge đổi từ "Chưa thanh toán" → "Đã thanh toán"
   - Background đổi vàng → xanh
   - Trong trang affiliate, commission tương ứng status đổi pending → received

**Test 3 - Sửa đợt**:
1. Hover vào item → bấm nút ✏️
2. Form bên trái tự fill data
3. Sửa Gross thành 2.000.000đ
4. Bấm "Cập nhật đợt thanh toán"
5. Kỳ vọng: số tiền cập nhật cả 2 bảng (payment + commission)

**Test 4 - Cảnh báo trùng**:
1. Tạo mới, nhập payment_code đã tồn tại
2. Sau 0.5s → hiện box vàng "Mã này đã có X đợt trùng"
3. Vẫn cho tạo bình thường

**Test 5 - Xóa**:
1. Hover → 🗑
2. Confirm dialog
3. Cả payment và commission đều bị xóa mềm

## 💡 Lưu ý quan trọng

### Dữ liệu cũ

⚠️ **Các đợt thanh toán Shopee và commissions cũ (trước Phase 9) KHÔNG được tự động link với nhau**. Chúng sẽ tiếp tục hoạt động độc lập như cũ.

Chỉ các **đợt mới tạo sau Phase 9** mới có liên kết tự động.

Nếu muốn link dữ liệu cũ, chạy SQL thủ công:
```sql
-- Tham khảo - không tự động chạy
UPDATE shopee_payments sp
SET commission_id = c.id
FROM commissions c
WHERE c.account_id = sp.account_id
  AND c.earned_date = sp.payment_date
  AND ABS(c.net_amount - sp.total_net) < 1000
  AND sp.commission_id IS NULL;
```

### Tại sao bỏ breakdown theo ngày?

Bạn yêu cầu không cần nhập chi tiết hàng ngày → đơn giản hơn nhiều, đặc biệt khi có 10-20 affiliate × 2 đợt/tuần = 20-40 đợt/tuần. Mỗi đợt giờ chỉ cần 3 con số thay vì 5-7 dòng breakdown.

Nếu cần xem chi tiết theo ngày, bạn vẫn vào Shopee xem.

### Trùng mã payment_code

Trên Shopee, mỗi đợt thanh toán có mã riêng. Nhưng nhiều affiliate có thể chia sẻ cùng tài khoản Shopee (cùng `payment_code`), nên không phải trùng = lỗi. Hệ thống chỉ **cảnh báo** để bạn kiểm tra, vẫn cho tạo.

### Mối quan hệ DB

```
shopee_payments              commissions
─────────────────            ────────────
id                  ───┐     id
account_id             │     account_id  ← cùng affiliate
payment_code           │     earned_date
payment_date           └───→ ← commission_id (FK)
total_gross                  gross_amount  ← cùng số
total_tax                    tax_withheld  ← cùng số
total_net                    net_amount    ← cùng số
is_received      ←──────────→ status (pending/received)
received_date    ←──────────→ received_date
```

Mọi update trên payment đều auto cascade sang commission (trừ delete: delete mềm cả 2).
