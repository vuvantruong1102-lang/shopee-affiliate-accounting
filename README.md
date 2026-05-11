# Phase 3 Fix — Bỏ rút tiền mặt, đơn giản hóa quy trình nộp tiền

## 🎯 Thay đổi

### Quy trình MỚI

```
Shopee → TK cá nhân Affiliate → [Nộp tiền] → TK ngân hàng công ty
```

- ❌ **Bỏ** module "Rút tiền mặt"
- ✅ **Nộp tiền vào NH** chỉ ghi vào **sổ ngân hàng** (không qua sổ tiền mặt)
- ✅ **Sổ tiền mặt** giờ chỉ dùng cho chi tiêu tiền mặt (lương, văn phòng phẩm...)

### So sánh với Phase 2

| Module | Phase 2 (cũ) | Phase 3 Fix (mới) |
|---|---|---|
| Rút tiền mặt | ✓ Có | ✗ Bỏ |
| Nộp tiền vào NH | Ghi 2 bút toán (cash + bank) | Chỉ ghi 1 bút toán (bank) |
| Chi tiêu | Cash hoặc Bank | Cash hoặc Bank (không đổi) |
| Hoa hồng | Không đổi | Không đổi |

## 📋 Các bước triển khai

### Bước 1: Upload 3 file MỚI/CẬP NHẬT

```
app/(dashboard)/data-entry/actions.ts           [GHI ĐÈ — bỏ createWithdrawal, sửa createDeposit]
app/(dashboard)/data-entry/page.tsx             [GHI ĐÈ — bỏ card Rút tiền]
components/data-entry/deposit-form.tsx          [GHI ĐÈ — bỏ hiển thị "Tiền mặt → NH"]
```

### Bước 2: XÓA các file/thư mục KHÔNG CẦN

Vào github.dev, xóa:

```
app/(dashboard)/data-entry/withdrawal/         [XÓA CẢ THƯ MỤC]
components/data-entry/withdrawal-form.tsx      [XÓA]
```

**Cách xóa thư mục trong github.dev:**
1. Click chuột phải vào thư mục `withdrawal/`
2. Chọn **Delete**
3. Xác nhận

### Bước 3: Commit & Push

Commit message: `Phase 3 Fix: Remove withdrawal, simplify deposit flow`

### Bước 4: (Tùy chọn) Dọn dẹp dữ liệu cũ

Nếu trước đây bạn đã tạo các giao dịch rút tiền + nộp tiền theo logic cũ, dữ liệu vẫn nằm trong DB. Có 2 cách xử lý:

**Cách A — Giữ nguyên dữ liệu cũ** (đề xuất)
- Dữ liệu lịch sử vẫn xem được trong sổ tiền mặt + sổ ngân hàng
- Từ nay nhập mới sẽ theo logic mới

**Cách B — Xóa sạch dữ liệu test**
Vào Supabase → SQL Editor → chạy:

```sql
-- Soft delete tất cả giao dịch test
UPDATE cash_transactions SET is_deleted = true WHERE account_id IS NOT NULL;
UPDATE bank_transactions SET is_deleted = true WHERE cash_transaction_id IS NOT NULL;
DELETE FROM withdrawals;

-- Recompute lại balance
SELECT recompute_cash_balances();
-- (Bank balance sẽ tự tính lại nếu bạn vào trang bank-book)
```

## ⚠️ Lưu ý

1. **Bảng `withdrawals` trong DB** vẫn còn (không xóa schema) — chỉ ẩn UI thôi. Nếu sau này cần dùng lại, code vẫn tương thích.

2. **Trang `/affiliates/[id]` hiển thị "Đã rút" / "Đã nộp"**: con số "Đã rút" sẽ không còn cập nhật nữa (vì không nhập rút tiền). Có thể xem xét ẩn dòng này ở phase sau.

3. **Liên kết cash ↔ bank trong DB**: cột `cash_transaction_id` trong `bank_transactions` không còn được dùng cho giao dịch mới, nhưng vẫn giữ schema để tương thích với dữ liệu cũ.

## 🧪 Test sau khi deploy

1. Vào **Nhập liệu** → kỳ vọng: thấy **3 card** (Hoa hồng, Nộp tiền, Chi tiêu), KHÔNG còn card "Rút tiền mặt"
2. Bấm **"Nộp tiền vào ngân hàng"** → nhập thử 5tr → lưu
3. Vào **Sổ ngân hàng** → kỳ vọng: thấy giao dịch +5tr với người nộp = tên affiliate
4. Vào **Sổ tiền mặt** → kỳ vọng: KHÔNG thấy giao dịch nào liên quan đến nộp tiền (sổ tiền mặt giờ chỉ có giao dịch chi tiêu)
