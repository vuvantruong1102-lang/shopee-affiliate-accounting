# Phase 5 Fix — Sửa lỗi "Đã nộp vào công ty" luôn = 0

## 🐛 Vấn đề

Trên trang chi tiết affiliate (`/affiliates/[id]`), KPI **"Đã nộp vào công ty"** luôn hiển thị **0đ** dù đã nộp tiền (ví dụ Trần Văn An nộp 70tr nhưng vẫn = 0).

## 🔍 Nguyên nhân

Từ Phase 3 Fix, khi affiliate nộp tiền vào TK công ty → chỉ ghi vào `bank_transactions`, **không** ghi vào `cash_transactions` nữa. Nhưng RPC `get_affiliate_summary` cũ vẫn đếm `total_deposited` từ `cash_transactions` → luôn = 0.

## ✅ Cách sửa (Phương án A)

1. Thêm cột `account_id` vào `bank_transactions` để link giao dịch với affiliate
2. **Backfill tự động**: chạy lệnh UPDATE để gán `account_id` cho các giao dịch cũ dựa trên `counterparty_name`
3. Sửa RPC `get_affiliate_summary` để đếm từ `bank_transactions`
4. Sửa `createDeposit` action để lưu `account_id` cho giao dịch mới
5. Bonus: thay đổi UI "Đã nộp" — hiển thị "Còn X chưa nộp" nếu có

## 📋 Các bước triển khai

### Bước 1: Chạy SQL migration

Vào Supabase SQL Editor → New query → paste toàn bộ nội dung `supabase/migrations/20260512000001_fix_affiliate_summary.sql` → Run.

Migration này sẽ:
- Thêm cột `account_id` vào `bank_transactions`
- Tự động backfill cho dữ liệu cũ (match theo `counterparty_name`)
- Sửa RPC `get_affiliate_summary`

### Bước 2: Kiểm tra backfill

Sau khi chạy migration, **kiểm tra xem giao dịch cũ đã được match đúng chưa**:

```sql
SELECT 
  aa.full_name,
  COUNT(bt.id) AS so_giao_dich,
  SUM(bt.amount) AS tong_tien
FROM public.affiliate_accounts aa
LEFT JOIN public.bank_transactions bt 
  ON bt.account_id = aa.id 
  AND bt.trans_type = 'income'
  AND bt.is_deleted = false
GROUP BY aa.id, aa.full_name
ORDER BY aa.full_name;
```

**Kỳ vọng**: Trần Văn An sẽ hiện 1 giao dịch, tổng = 70.000.000đ.

Nếu **không match được** (ví dụ tên trên giao dịch không khớp tên affiliate), bạn cần update thủ công:

```sql
-- Tìm ID của Trần Văn An
SELECT id, full_name FROM affiliate_accounts WHERE full_name LIKE '%Trần Văn An%';

-- Tìm các giao dịch chưa được match
SELECT id, trans_date, amount, counterparty_name, description 
FROM bank_transactions 
WHERE account_id IS NULL 
  AND trans_type = 'income' 
  AND is_deleted = false;

-- Gán thủ công (thay UUID vào)
UPDATE bank_transactions 
SET account_id = 'PASTE_UUID_AFFILIATE_HERE'
WHERE id = 'PASTE_UUID_TRANSACTION_HERE';
```

### Bước 3: Upload 3 file code lên GitHub

```
types/database.ts                                    [GHI ĐÈ]
app/(dashboard)/data-entry/actions.ts                [GHI ĐÈ]
app/(dashboard)/affiliates/[id]/page.tsx             [GHI ĐÈ]
```

### Bước 4: Commit & Push

Commit message: `Phase 5 Fix: Link bank deposits to affiliates`

### Bước 5: Test sau deploy

1. Vào `/affiliates/[id]` của Trần Văn An
2. KPI **"Đã nộp vào công ty"** phải hiển thị **70.000.000đ** (không còn 0)
3. Subtitle phải hiện "Còn X chưa nộp" nếu đã thực nhận > đã nộp, hoặc "Đã nộp đầy đủ" nếu khớp
4. Thử nộp thêm 1 giao dịch mới → kiểm tra số liệu tự cập nhật

## 💡 Lưu ý

- **Dữ liệu cũ (trước Phase 5 Fix)**: chỉ match được nếu `counterparty_name` chính xác = tên affiliate (không phân biệt hoa thường, có trim). Nếu trước đây bạn để trống hoặc gõ tên khác → cần update thủ công.

- **Giao dịch mới (sau Phase 5 Fix)**: tự động lưu `account_id` luôn → không cần lo nữa.

- **Cột "Đã rút"**: đã bị xóa khỏi UI vì bỏ module withdrawal từ Phase 3 Fix.
