# Phase 10 Fix Final — 3 vấn đề

## 🐛 Vấn đề & Giải pháp

### Vấn đề 1: "Đang cầm = 0" sai

**Nguyên nhân**: Trong DB đang có **70.000.000đ** `bank_transactions.income` link với affiliate Trần Văn An. Có thể là:
- Giao dịch test cũ từ Phase 5 fix backfill
- Giao dịch nộp tiền thật bạn đã nhập tay qua /data-entry trước Phase 10
- Cộng cả 2

**Giải pháp**: 
- Code đã sửa hiển thị "Vượt X đồng" thay vì "Đang cầm = 0" để rõ hơn
- File `diagnostic-queries.sql` cho phép bạn check + xóa giao dịch test nếu cần

### Vấn đề 2: TK công ty không hiện trong dropdown

**Nguyên nhân**: Query của tôi filter `WHERE is_company = true`, nhưng:
- Cột `is_company` có thể chưa tồn tại (Phase 1 không có)
- Hoặc TK của bạn có `is_company = false`

**Giải pháp**:
1. SQL migration **thêm cột `is_company` với default = true** cho tất cả TK hiện có
2. Bỏ filter `is_company` trong query → lấy tất cả TK không bị xóa
3. Trang `/settings` mới: tự động set `is_company = true` khi tạo

### Vấn đề 3: Không có nút xóa TK ngân hàng

**Giải pháp**: Trang `/settings` mới với:
- ➕ Form thêm TK
- ✏️ Sửa TK
- 🗑 Xóa TK (RPC thông minh: xóa mềm nếu có giao dịch, xóa cứng nếu không)
- Hiển thị số giao dịch của mỗi TK

## 📋 Triển khai

### Bước 1: Chạy SQL migration

Vào Supabase SQL Editor → paste nội dung file:
```
supabase/migrations/20260514000007_bank_accounts_is_company_and_delete.sql
```
→ Run.

Migration làm:
1. Thêm cột `is_company BOOLEAN DEFAULT true` vào `bank_accounts`
2. Tạo RPC `delete_bank_account` (xóa thông minh)
3. Thêm cột `updated_at` + trigger nếu chưa có

### Bước 2: (TÙY CHỌN) Chạy diagnostic để check 70tr

Mở file `diagnostic-queries.sql` → chạy **QUERY 1** trước → xem 70tr đó là giao dịch gì.

Nếu là giao dịch test cũ → uncomment QUERY 2 → paste ID → xóa.

### Bước 3: Upload 4 file code

```
app/(dashboard)/affiliates/[id]/page.tsx              ← GHI ĐÈ
app/(dashboard)/settings/page.tsx                     ← GHI ĐÈ (hoặc MỚI)
app/(dashboard)/settings/actions.ts                   ← MỚI
components/settings/bank-accounts-manager.tsx         ← MỚI
```

⚠️ **Lưu ý**: Nếu folder `app/(dashboard)/settings/` đã có nội dung khác (vd: cài đặt user, theme...), bạn copy thêm phần "Tài khoản ngân hàng công ty" từ file mới này vào file cũ, không ghi đè toàn bộ.

### Bước 4: Commit + Push

Message: `Phase 10 Fix: bank accounts management + fix deposit modal`

### Bước 5: Test

**Test 1 - TK hiện trong dropdown nộp tiền**:
1. Vào `/affiliates/[id]` của bất kỳ affiliate
2. Bấm "💰 Nộp tiền"
3. Modal hiện → dropdown "TK công ty nhận" có TK của bạn (Techcombank ****1234 hoặc gì đó)

**Test 2 - Trang cài đặt TK ngân hàng**:
1. Vào `/settings`
2. Thấy section "Tài khoản ngân hàng công ty" với danh sách
3. Bấm "Thêm tài khoản" → form hiện
4. Nhập VD: BIDV / 0123456789 / Công ty ABC → Lưu
5. Xuất hiện trong danh sách
6. Bấm ✏️ → sửa
7. Bấm 🗑 → confirm:
   - Nếu chưa có giao dịch: "Sẽ xóa hoàn toàn"
   - Nếu có giao dịch: "Sẽ xóa mềm, giữ lịch sử"

**Test 3 - Diagnostic 70tr**:
1. Chạy QUERY 1 trong `diagnostic-queries.sql`
2. Xem các giao dịch income đó là gì
3. Nếu sai → xóa bằng QUERY 2
4. Refresh trang affiliate → "Đang cầm" sẽ hiển thị đúng

## 💡 Lưu ý

### Sau khi xóa TK mềm

TK xóa mềm vẫn còn trong DB (chỉ ẩn khỏi danh sách). Các giao dịch cũ vẫn dùng được, vẫn xem được trong Sổ ngân hàng.

Nếu muốn khôi phục: chạy SQL:
```sql
UPDATE bank_accounts SET is_deleted = false WHERE id = 'xxx';
```

### Tại sao bỏ filter `is_company`?

Logic mới đơn giản hơn:
- Bảng `bank_accounts` = chỉ TK công ty
- TK affiliate cá nhân lưu trong `affiliate_accounts.bank_name / bank_account_number`

→ Không cần filter, lấy hết `bank_accounts` không bị xóa.

Cột `is_company` vẫn được tạo (default true) để tương thích về sau nếu cần phân biệt.
