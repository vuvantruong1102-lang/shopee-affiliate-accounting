# Phase 2 - CRUD Affiliate + Form nhập liệu

## 🆕 Tính năng mới

### Module Tài khoản Affiliate
- ✅ Danh sách affiliate với tìm kiếm + lọc theo trạng thái
- ✅ Form thêm/sửa đầy đủ: thông tin cá nhân, TK ngân hàng, Shopee, thuế TNCN
- ✅ Trang chi tiết với 4 KPI và lịch sử hoa hồng
- ✅ Soft delete (đóng tài khoản, không xóa data)

### Module Nhập liệu hàng ngày  
- ✅ **Hoa hồng mới**: nhập net → tự động tính ngược gross + thuế 10%
- ✅ **Rút tiền mặt**: ghi nhận khi affiliate rút tiền từ TK cá nhân
- ✅ **Nộp tiền vào ngân hàng**: tạo song song 2 bút toán (cash + bank)
- ✅ **Chi tiêu**: chọn nguồn (cash/bank) + khoản mục

### Module Cài đặt
- ✅ Khai báo TK ngân hàng công ty

### Dashboard
- ✅ Hiển thị số liệu thật từ database
- ✅ 4 KPI cards: Tổng HH, Đã nhận, Chưa nhận, Thuế khấu trừ
- ✅ Bảng hoa hồng gần đây + danh sách affiliate

## 📋 Cách cập nhật lên project hiện tại

### Bước 1: Chạy SQL migration mới trên Supabase

1. Vào Supabase Dashboard → SQL Editor → **+ New query**
2. Copy nội dung file `supabase/migrations/20260511000003_phase2_functions.sql`
3. Paste → **Run**
4. Đợi "Success"

### Bước 2: Update code lên GitHub

Có 2 cách:

**Cách A: github.dev (khuyến nghị)**

1. Vào repo → bấm phím `.` 
2. Mở từng file mới/cập nhật, paste nội dung
3. Source Control → Commit & Push

**Cách B: Upload qua web**

1. Vào repo GitHub → **Add file** → **Upload files**
2. Kéo thả các file/folder cần update
3. Commit

### Bước 3: Đợi Vercel auto-deploy

~2 phút sau khi push.

### Bước 4: Test theo thứ tự

1. **Cài đặt** → **TK ngân hàng** → khai báo TK đầu tiên
2. **Affiliate** → **Thêm tài khoản** → nhập 1 affiliate mẫu
3. **Nhập liệu** → **Hoa hồng mới**:
   - Chọn affiliate
   - Nhập net = 9,000,000
   - Kiểm tra: gross hiển thị 10,000,000, thuế 1,000,000 ✓
4. **Nhập liệu** → **Nộp tiền vào ngân hàng**:
   - Chọn affiliate + nhập số tiền
   - Sau khi lưu, vào Sổ tiền mặt + Sổ ngân hàng phải thấy giao dịch
5. Quay lại Dashboard → kiểm tra số liệu đã cập nhật

## 🗂️ Danh sách file thay đổi/mới

### File mới
```
types/database.ts                                           # Types TypeScript
supabase/migrations/20260511000003_phase2_functions.sql     # SQL mới
components/ui/badge.tsx                                     # Badge UI
components/shared/currency-input.tsx                        # Input tiền tệ
components/affiliates/affiliate-table.tsx                   # Bảng danh sách
components/affiliates/affiliate-form.tsx                    # Form thêm/sửa
components/affiliates/affiliate-delete-button.tsx           # Nút xóa
components/affiliates/commission-list.tsx                   # List HH
components/affiliates/bank-account-form.tsx                 # Form bank
components/data-entry/commission-form.tsx                   # Form HH
components/data-entry/withdrawal-form.tsx                   # Form rút tiền
components/data-entry/deposit-form.tsx                      # Form nộp tiền
components/data-entry/expense-form.tsx                      # Form chi tiêu
app/(dashboard)/affiliates/actions.ts                       # Server actions
app/(dashboard)/affiliates/new/page.tsx                     # Trang thêm mới
app/(dashboard)/affiliates/[id]/page.tsx                    # Trang chi tiết
app/(dashboard)/affiliates/[id]/edit/page.tsx               # Trang sửa
app/(dashboard)/data-entry/actions.ts                       # Server actions
app/(dashboard)/data-entry/commission/page.tsx              # Trang nhập HH
app/(dashboard)/data-entry/withdrawal/page.tsx              # Trang rút tiền
app/(dashboard)/data-entry/deposit/page.tsx                 # Trang nộp tiền
app/(dashboard)/data-entry/expense/page.tsx                 # Trang chi tiêu
app/(dashboard)/settings/bank-accounts/page.tsx             # Trang khai báo TK
lib/tax-calculator.ts                                       # MỞ RỘNG: thêm calculateGrossFromNet
```

### File cập nhật
```
app/(dashboard)/dashboard/page.tsx       # Dashboard với data thật
app/(dashboard)/affiliates/page.tsx      # List affiliate có data
app/(dashboard)/data-entry/page.tsx      # Hub nhập liệu (đã có 4 card)
app/(dashboard)/settings/page.tsx        # Trang settings (đã có menu)
```

## 🔄 Logic quan trọng

### Nhập hoa hồng (tính ngược net→gross)
```
User nhập: Net = 9.000.000đ
Hệ thống tính:
  - Gross = 9.000.000 / 0.9 = 10.000.000đ
  - Tax = 10.000.000 - 9.000.000 = 1.000.000đ (10%)
  
Lưu vào DB: gross=10M, tax=1M, net=9M

Trường hợp đặc biệt: nếu Net < 1.800.000đ
  → Không khấu trừ (gross < 2tr)
  → Gross = Net, Tax = 0
```

### Nộp tiền vào ngân hàng (transaction kép)
```
Khi affiliate nộp 10tr tiền mặt vào TK công ty:

1. Tạo bút toán Cash (INCOME):
   - Affiliate X nộp 10.000.000đ vào quỹ tiền mặt
   - balance_after tự tính bằng trigger
   
2. Tạo bút toán Bank (INCOME):
   - +10.000.000đ vào TK ngân hàng công ty
   - Liên kết với cash_transaction_id ở bước 1

Nếu bước 2 fail → rollback bước 1
```

## ⚠️ Lưu ý

- Dashboard chỉ hiển thị số liệu **tháng hiện tại**. Lọc tháng khác sẽ ở Phase 3.
- Module Sổ quỹ tiền mặt và Sổ ngân hàng vẫn là placeholder, sẽ làm ở Phase 3.
- Báo cáo và Thuế TNCN sẽ ở Phase 4.
