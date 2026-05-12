# Phase 10 — Trang Affiliate cải tiến

## 🎯 4 thay đổi

### 1. Thông tin liên hệ + Thuế TNCN gọn lại

**Trước**: 2 card cao, mỗi field 1 dòng to với icon → tốn nhiều khoảng trắng

**Sau**: Grid 2 cột compact, label nhỏ 110px + value cùng dòng

```
Thông tin liên hệ                  Thuế TNCN · YTD 2026 (tháng 1-5)
─────────────────────              ──────────────────────────────────
📧 Email     abc@gmail.com         Giảm trừ BT      Có (15.5tr/tháng)
📞 ĐT        0981876287            Người phụ thuộc  0 người
💳 CCCD      024025603256          Shopee đã KT     122.222.222đ
📄 MST       024025603256          Tổng đã KT       122.222.222đ
📍 Địa chỉ   Bắc Giang             ─────────────────────────────
🏦 TK nhận   TCB · 19275023427     Số thuế phải nộp thêm
                                   205.930.558đ
                                   Phải nộp thêm (lũy tiến 5 bậc)
```

### 2. Nút Sửa/Xóa cho hoa hồng

Mỗi dòng hover → hiện 2 nút ✏️ 🗑

- **Hoa hồng nhập tay** (không link Shopee) → sửa/xóa được
- **Hoa hồng từ đợt Shopee** (có icon 🔗) → 2 nút **mờ + cursor not-allowed**, tooltip "Vào Đối soát Shopee để sửa/xóa"
  - Click vẫn báo toast hướng dẫn

Có footer note giải thích.

### 3. Nút "Nộp tiền" mới

Ở header bên cạnh các nút khác. Bấm vào → mở modal:

```
┌─ NỘP TIỀN VÀO TK CÔNG TY ──────────────────────┐
│ Trần Văn An                                      │
│                                                  │
│ ┌─ Đã thực nhận ─┐  ┌─ Đang cầm ──┐            │
│ │ 1.100.000.000  │  │ 1.030.000.000│           │
│ └────────────────┘  └──────────────┘           │
│                                                  │
│ Số tiền nộp *                                    │
│ [1.030.000.000 đ]   ← auto fill = đang cầm     │
│                                                  │
│ TK công ty nhận * [VCB ****1234 ▼]              │
│ Ngày nộp *        [12/05/2026]                  │
│ Ghi chú           [...]                         │
│                                                  │
│         [Hủy]   [💰 Xác nhận nộp tiền]         │
└─────────────────────────────────────────────────┘
```

**Auto fill mặc định** = "Đang cầm chưa nộp" (linh hoạt sửa)

**Không cảnh báo popup**: chỉ hiện **badge đỏ "!"** ở KPI "Đã thực nhận" khi tổng đã nộp > tổng đã nhận (nộp quá).

Bấm xác nhận → hệ thống **TỰ ĐỘNG**:
- Tạo `bank_transactions` (trans_type='income', account_id=affiliate)
- → Hiển thị ngay trong **Sổ ngân hàng**
- → KPI "Đã nộp vào công ty" tăng
- → KPI "Còn chưa nộp" giảm

### 4. Bỏ nút "Thêm hoa hồng"

Đã xóa hoàn toàn. Workflow mới: vào **Đối soát Shopee** → tạo đợt → commission tự sinh.

Nếu cần nhập hoa hồng cá biệt (không qua Shopee), vẫn có thể vào **Nhập liệu** (cũ).

## 📋 Triển khai

### Bước 1: Chạy SQL

Vào Supabase SQL Editor → paste `supabase/migrations/20260514000006_phase10_deposit_and_commission_actions.sql` → Run.

Migration tạo 3 RPC:
- `submit_affiliate_deposit` - nộp tiền
- `delete_commission` - xóa hoa hồng (chặn nếu link Shopee)
- `update_commission` - sửa hoa hồng (chặn nếu link Shopee)

### Bước 2: Upload 7 file code

```
app/(dashboard)/affiliates/[id]/page.tsx                ← GHI ĐÈ
app/(dashboard)/affiliates/[id]/actions.ts              ← MỚI

components/affiliates/deposit-modal.tsx                 ← MỚI
components/affiliates/edit-commission-modal.tsx         ← MỚI
components/affiliates/commission-list.tsx               ← MỚI
components/affiliates/affiliate-actions-button.tsx      ← MỚI
```

⚠️ **Nếu file `app/(dashboard)/affiliates/[id]/page.tsx` đã có nội dung khác** (form edit, tax button cũ...) thì cần backup trước khi ghi đè để chắc chắn không mất logic.

### Bước 3: Commit + Push

Message: `Phase 10: Affiliate detail redesign + deposit button + commission CRUD`

### Bước 4: Test

**Test 1 - Layout gọn**:
1. Vào `/affiliates/[id]` của 1 affiliate có data
2. Card "Thông tin liên hệ" và "Thuế TNCN" có 2 cột compact, mỗi field 1 hàng nhỏ
3. Card cao bằng nhau, gọn gàng

**Test 2 - Sửa hoa hồng nhập tay**:
1. Tìm 1 hoa hồng KHÔNG có icon 🔗 (không từ Shopee)
2. Hover → bấm ✏️ → modal mở
3. Sửa số tiền → Save
4. Kỳ vọng: số tiền cập nhật, KPI cũng đổi theo

**Test 3 - Xóa hoa hồng từ Shopee (chặn)**:
1. Tìm 1 hoa hồng có icon 🔗
2. Hover → bấm 🗑 → toast lỗi "Vào Đối soát Shopee để xóa"

**Test 4 - Nộp tiền**:
1. Bấm "💰 Nộp tiền" trên header
2. Modal hiện với 2 KPI: Đã thực nhận + Đang cầm
3. Số tiền auto-fill = đang cầm
4. Chọn TK công ty, ngày
5. Xác nhận → toast thành công
6. Vào `/bank-book` → có giao dịch income mới
7. Refresh trang affiliate → KPI "Đã nộp vào công ty" tăng

**Test 5 - Cảnh báo nộp quá**:
1. Nộp số tiền > đã thực nhận
2. Modal hiện cảnh báo đỏ
3. Sau khi xác nhận, KPI "Đã thực nhận" có badge đỏ "!"

## 💡 Lưu ý kỹ thuật

### Tại sao chặn xóa commission từ Shopee?

Để giữ **toàn vẹn dữ liệu**: nếu xóa commission mà không xóa shopee_payment tương ứng → DB sẽ có shopee_payment "mồ côi", không match với gì cả. Vào trang Đối soát Shopee xóa thì cả 2 cùng bị xóa (logic Phase 9).

### Format icon "link Shopee"

Dòng commission có icon 🔗 nhỏ màu primary bên cạnh kỳ. Hover icon → tooltip "Từ đợt Shopee".

### Auto fill modal nộp tiền

Logic: `Math.max(0, undeposited)` để khi đã nộp đủ/quá thì default = 0 (user phải tự nhập).

### "Đã nộp vào công ty" tính từ đâu?

`SUM(bank_transactions.amount)` với:
- `trans_type = 'income'`
- `account_id = affiliate.id`
- `is_deleted = false`

→ Đảm bảo mọi giao dịch "Nộp tiền" được link đúng affiliate.
