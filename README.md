# Phase 14 — Fix P&L + Báo cáo Tổng tài sản

## 🎯 2 thay đổi

### 1. Fix P&L tính sai (loại trừ chuyển nội bộ)

**Vấn đề**: Trong P&L hiện tại, mục "Khác" −50.000.000đ là tiền **chuyển nội bộ** từ cash sang bank (kế toán nộp tiền mặt vào ngân hàng), không phải chi phí thực.

**Giải pháp**:
- Thêm cột `is_internal_transfer` vào `bank_transactions` và `cash_transactions`
- RPC `submit_bank_from_cash` set flag = true cho cả 2 bút toán
- Backfill flag cho dữ liệu cũ qua pattern description
- **CẦN SỬA RPC P&L hiện tại** để filter `is_internal_transfer = false`

### 2. Báo cáo Tổng tài sản

Trang `/reports/assets` mới với 4 thành phần:
- 💰 **Tiền mặt**: SUM(Thu) − SUM(Chi) sổ tiền mặt
- 🏦 **Tiền ngân hàng**: SUM(Thu) − SUM(Chi) tất cả TK NH
- 🤝 **Affiliate đang cầm**: Σ (HH đã nhận − Đã nộp) của mỗi affiliate (chỉ tính khi > 0)
- ⏳ **Shopee chưa chuyển**: SUM(commissions có status = 'pending')

Có chi tiết:
- Breakdown từng TK ngân hàng
- Breakdown từng affiliate đang cầm

---

## 📋 Triển khai

### Bước 1: Chạy SQL migration

Vào Supabase SQL Editor → paste file:
```
supabase/migrations/20260514000011_phase14_internal_transfer_and_assets.sql
```
→ Run

Migration làm:
1. Thêm cột `is_internal_transfer` cho 2 bảng
2. **BACKFILL** đánh dấu dữ liệu cũ (giao dịch 50tr của bạn sẽ được đánh dấu)
3. Update RPC `submit_bank_from_cash` tự set flag = true
4. Tạo RPC mới `get_total_assets`

### Bước 2: Upload file page báo cáo

```
app/(dashboard)/reports/assets/page.tsx        ← MỚI
```

### Bước 3: ⚠️ SỬA RPC P&L HIỆN TẠI

Đây là phần quan trọng nhất. P&L hiện tại đang dùng RPC `get_pnl_summary` hoặc tương tự. Bạn cần xem RPC nào tính chi phí từ `bank_transactions`/`cash_transactions` và **thêm filter** `is_internal_transfer = false`.

**Cách tìm**: vào Supabase → Database → Functions → tìm function có chữ `pnl` hoặc `profit` → xem định nghĩa.

**Sửa các dòng**:

```sql
-- Trước:
SUM(amount) FROM bank_transactions WHERE trans_type = 'expense' AND is_deleted = false

-- Sau:
SUM(amount) FROM bank_transactions 
WHERE trans_type = 'expense' 
  AND COALESCE(is_deleted, false) = false
  AND COALESCE(is_internal_transfer, false) = false  -- ✨ THÊM
```

Tương tự cho `cash_transactions`.

**Hoặc gửi tôi nội dung RPC P&L hiện tại, tôi sẽ sửa chính xác cho bạn.**

### Bước 4: Thêm link "Tổng tài sản" vào menu Báo cáo

Tìm file render menu báo cáo (có thể là `app/(dashboard)/reports/layout.tsx` hoặc `reports/page.tsx`), thêm entry:

```tsx
{
  label: "Tổng tài sản",
  href: "/reports/assets",
  description: "Tài sản công ty: tiền mặt + ngân hàng + affiliate đang cầm + Shopee pending",
}
```

### Bước 5: Commit + Push

Message: `Phase 14: fix P&L internal transfer + assets report`

---

## 🧪 Test scenarios

### Test 1: P&L không còn tính 50tr

1. Vào `/reports/pnl`
2. Kỳ vọng:
   - Mục "Khác" hoặc "Tổng chi phí" KHÔNG còn 50tr chuyển nội bộ
   - **Lãi tăng lên 50tr** (649tr thay vì 599tr)
   - Pie chart "Cơ cấu trừ ra khỏi DT" cũng update

### Test 2: Báo cáo Tổng tài sản

1. Vào `/reports/assets`
2. Xem 4 KPI lớn
3. Bấm vào "Affiliate đang cầm" → list từng affiliate
4. Bấm vào affiliate → đi tới trang chi tiết

### Test 3: Workflow mới không tính nhầm

1. Vào `/bank-book` → "Nộp tiền vào NH" → chọn "Từ TK tiền mặt" → nhập 10tr
2. Vào `/reports/pnl`
3. Kỳ vọng: P&L KHÔNG đổi (vì 10tr này là chuyển nội bộ)

---

## 💡 Lưu ý

### Báo cáo Tổng tài sản là "snapshot" hiện tại

Không có filter theo period vì:
- Số dư ngân hàng = real-time, không phải "tháng này"
- Affiliate đang cầm = hiện tại

Nếu cần xem lịch sử theo từng tháng, sau này có thể thêm tính năng "snapshot lịch sử".

### Tài sản công ty thật

Báo cáo này chỉ tính **tiền** (cash + bank + receivables). Không tính:
- Tài sản cố định (máy tính, văn phòng...)
- Hàng tồn kho
- Phải thu khác (loans, etc.)

Đây là **tài sản lưu động liên quan dòng tiền affiliate Shopee** — đủ cho mục đích quản lý hàng ngày.
