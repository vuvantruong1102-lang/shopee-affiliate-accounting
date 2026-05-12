# Phase 13 — Refactor dòng tiền + Tích hợp nhập liệu vào sổ

## 🎯 3 thay đổi lớn

### 1. Workflow dòng tiền mới (2 bước thay vì 1)

**Trước**:
```
Affiliate → TK ngân hàng công ty (1 bước)
```

**Sau**:
```
Affiliate → Kế toán (tiền mặt) → TK ngân hàng công ty (2 bước)
            ↓                     ↓
      cash_transactions     bank_transactions
```

→ **Affiliate nộp tiền** giờ chỉ tạo `cash_transactions.income` (sổ tiền mặt), KHÔNG đụng đến bank.

### 2. Tích hợp nhập liệu vào sổ

- **Xóa menu "Nhập liệu"** ở sidebar (không cần nữa)
- **Sổ tiền mặt**: có 2 nút **Thu / Chi** ngay trên header
- **Sổ ngân hàng**: có 2 nút **Nộp tiền vào NH / Chi tiêu NH** ngay trên header

### 3. Modal "Nộp tiền vào NH" (trong Sổ ngân hàng)

2 lựa chọn:
- ✅ **"Nộp tiền Affiliate từ TK tiền mặt"** → chọn affiliate → tạo cùng lúc:
  - Bank `+X` (income, link affiliate)
  - Cash `−X` (expense, link affiliate)
- ✅ **"Nộp tiền khác"** → chỉ tạo bank income (vốn, hoàn tiền, vay...)
- Có ô **Diễn giải** tự ghi

---

## 📋 Triển khai

### Bước 1: Chạy SQL migration

```
supabase/migrations/20260514000009_phase13_cash_workflow.sql
```

Migration tạo:
- Cột `account_id`, `notes`, `updated_at`, `is_deleted` cho `cash_transactions`
- 4 RPC: `submit_affiliate_cash_deposit`, `submit_bank_from_cash`, `create_cash_transaction`, `create_bank_transaction`

### Bước 2: Upload các file code mới

**Affiliate** (sửa modal nộp tiền):
```
app/(dashboard)/affiliates/[id]/page.tsx                    ← GHI ĐÈ
app/(dashboard)/affiliates/[id]/actions.ts                  ← GHI ĐÈ
components/affiliates/deposit-modal.tsx                     ← GHI ĐÈ
components/affiliates/affiliate-actions-button.tsx          ← GHI ĐÈ
```

**Cash book** (thêm nút thu/chi):
```
app/(dashboard)/cash-book/actions.ts                        ← MỚI
components/cash-book/cash-transaction-modal.tsx             ← MỚI
components/cash-book/cash-book-actions.tsx                  ← MỚI
```

**Bank book** (thêm nút nộp/chi):
```
app/(dashboard)/bank-book/actions.ts                        ← MỚI
components/bank-book/bank-deposit-modal.tsx                 ← MỚI
components/bank-book/bank-expense-modal.tsx                 ← MỚI
components/bank-book/bank-book-actions.tsx                  ← MỚI
```

### Bước 3: Tích hợp nút vào trang Cash book + Bank book

#### Trang Cash book (`app/(dashboard)/cash-book/page.tsx`)

Mở file hiện tại, **thêm import + nút vào header**:

```tsx
import { CashBookActions } from "@/components/cash-book/cash-book-actions";

// Trong JSX, đặt cạnh title:
<div className="flex items-center justify-between gap-4">
  <PageHeader title="Sổ tiền mặt" description="..." />
  <CashBookActions />        {/* ✨ THÊM */}
</div>
```

#### Trang Bank book (`app/(dashboard)/bank-book/page.tsx`)

Tương tự, **server-side fetch thêm bank_accounts + affiliates**, rồi pass xuống:

```tsx
import { BankBookActions } from "@/components/bank-book/bank-book-actions";

// Trong page (server component), fetch:
const { data: bankAccountsData } = await supabase
  .from("bank_accounts")
  .select("id, bank_name, account_number")
  .or("is_deleted.is.null,is_deleted.eq.false")
  .order("bank_name");

const { data: affiliatesData } = await supabase
  .from("affiliate_accounts")
  .select("id, full_name")
  .eq("is_deleted", false)
  .in("status", ["active", "paused"])
  .order("full_name");

const bankAccounts = bankAccountsData ?? [];
const affiliates = affiliatesData ?? [];

// Trong JSX:
<div className="flex items-center justify-between gap-4">
  <PageHeader title="Sổ ngân hàng" description="..." />
  <BankBookActions bankAccounts={bankAccounts} affiliates={affiliates} />
</div>
```

### Bước 4: Xóa menu "Nhập liệu" ở Sidebar

Mở file `components/layout/sidebar.tsx` (hoặc tên tương tự), tìm dòng có `data-entry` hoặc "Nhập liệu" → **xóa entry đó**.

Ví dụ trước:
```tsx
const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: ... },
  { label: "Tài khoản affiliate", href: "/affiliates", icon: ... },
  { label: "Nhập liệu", href: "/data-entry", icon: ... },        // ← XÓA DÒNG NÀY
  { label: "Sổ quỹ tiền mặt", href: "/cash-book", icon: ... },
  // ...
];
```

Sau:
```tsx
const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: ... },
  { label: "Tài khoản affiliate", href: "/affiliates", icon: ... },
  { label: "Sổ quỹ tiền mặt", href: "/cash-book", icon: ... },
  // ...
];
```

⚠️ **Lưu ý**: Trang `/data-entry` vẫn truy cập được nếu gõ URL trực tiếp. Nếu muốn ẩn hoàn toàn, có thể xóa luôn folder `app/(dashboard)/data-entry/` — nhưng tôi khuyên **giữ lại** để tránh phá build trong giai đoạn chuyển tiếp.

### Bước 5: Commit + Push

Message: `Phase 13: cash workflow + integrate inputs into books`

---

## 🧪 Test scenarios

### Test 1: Affiliate nộp tiền mặt
1. Vào `/affiliates/[id]` → bấm "Nộp tiền mặt"
2. Modal mới: KHÔNG có dropdown TK NH nữa
3. Nhập số tiền + ngày + ghi chú → Xác nhận
4. Kỳ vọng:
   - Toast thành công
   - Vào `/cash-book` → có 1 giao dịch income mới
   - KPI "Đã nộp tiền mặt" trên trang affiliate tăng

### Test 2: Kế toán nộp tiền vào ngân hàng (từ TK tiền mặt)
1. Vào `/bank-book` → bấm "Nộp tiền vào NH"
2. Chọn "Nộp tiền Affiliate từ TK tiền mặt"
3. Chọn affiliate Trần Văn An, TK Vietcombank, số tiền 20tr
4. Xác nhận
5. Kỳ vọng:
   - Sổ ngân hàng: +20tr income
   - Sổ tiền mặt: −20tr expense (tự động)
   - Trang affiliate: KPI tiền mặt giảm 20tr

### Test 3: Nộp tiền khác (không liên quan affiliate)
1. Vào `/bank-book` → bấm "Nộp tiền vào NH"
2. Chọn "Nộp tiền khác"
3. Nhập diễn giải "Vốn góp tháng 5"
4. Xác nhận
5. Kỳ vọng: chỉ tạo 1 bank income, không động đến cash

### Test 4: Thu/Chi tiền mặt thủ công
1. Vào `/cash-book` → bấm "Thu tiền mặt" hoặc "Chi tiền mặt"
2. Nhập số tiền + diễn giải → Lưu
3. Kỳ vọng: giao dịch xuất hiện trong sổ

### Test 5: Chi tiêu ngân hàng
1. Vào `/bank-book` → bấm "Chi tiêu NH"
2. Chọn TK, số tiền, diễn giải → Lưu
3. Kỳ vọng: giao dịch expense xuất hiện trong sổ

### Test 6: Sidebar không còn "Nhập liệu"
1. Refresh trang → kiểm tra sidebar không có entry "Nhập liệu"

---

## 💡 Lưu ý quan trọng

### Dữ liệu cũ
- Các giao dịch `bank_transactions.income` cũ (từ thời affiliate nộp thẳng vào bank) vẫn còn nguyên trong DB
- KHÔNG bị xóa hay chuyển đổi tự động
- Hiển thị trong Sổ ngân hàng như bình thường

### KPI "Đã nộp tiền mặt" trên trang affiliate
- Giờ tính từ `cash_transactions.income` thay vì `bank_transactions.income`
- Các giao dịch nộp tiền cũ (trên bank) sẽ KHÔNG tính vào số này → có thể thấy số "Đang cầm" tăng lên

**Để fix dữ liệu cũ (nếu muốn)**: chạy SQL chuyển các `bank_transactions.income` cũ có `account_id` thành `cash_transactions.income`. Tôi có thể viết script chuyển nếu bạn cần.

### Bút toán đối ứng
Khi chọn "Nộp tiền Affiliate từ TK tiền mặt", hệ thống tạo 2 bản ghi **không thể tách rời nhau** về mặt logic. Nếu xóa 1 cái thủ công sẽ làm lệch sổ.

→ Khuyến nghị: chỉ xóa từ giao diện admin / audit log, hoặc viết RPC `delete_paired_transaction` nếu cần.
