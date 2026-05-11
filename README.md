# Phase 4 — Đối soát Shopee

## 🎯 Tính năng

Mỗi tuần Shopee chuyển hoa hồng **2 lần** (mỗi đợt gộp 3-4 ngày). Module này giúp:

1. **Ghi nhận từng đợt thanh toán** (mã thanh toán + ngày + tổng tiền + chi tiết từng ngày)
2. **Tự động đối soát** với hoa hồng đã nhập tay → highlight các ngày lệch/thiếu
3. **Track trạng thái** đã nhận / chưa nhận tiền
4. **Tổng quan** số đợt đã nhận + chưa nhận

## 📋 Các bước triển khai

### Bước 1: Chạy SQL migration

Vào Supabase SQL Editor → New query → paste `supabase/migrations/20260511000006_shopee_reconciliation.sql` → Run.

Tạo 2 bảng mới + 2 RPC.

### Bước 2: Upload 9 file lên GitHub

**Lưu ý vị trí đặt file** (như đã gặp lỗi nhiều lần ở các phase trước):

```
types/shopee-reconciliation.ts                              [FILE MỚI]
app/(dashboard)/reconciliation/actions.ts                   [FILE MỚI]
app/(dashboard)/reconciliation/page.tsx                     [GHI ĐÈ placeholder]
app/(dashboard)/reconciliation/new/page.tsx                 [FILE MỚI]
app/(dashboard)/reconciliation/[id]/page.tsx                [FILE MỚI]
components/reconciliation/reconciliation-list.tsx           [FILE MỚI]
components/reconciliation/shopee-payment-form.tsx           [FILE MỚI]
components/reconciliation/reconcile-table.tsx               [FILE MỚI]
components/reconciliation/received-toggle.tsx               [FILE MỚI]
components/reconciliation/payment-delete-button.tsx         [FILE MỚI]
```

⚠️ **KHÔNG** tạo các thư mục `components/` bên trong `lib/` (lỗi đã gặp trước đây).

### Bước 3: Commit & Push → Vercel auto-deploy

Commit message: `Phase 4: Shopee payment reconciliation`

### Bước 4: Test theo thứ tự

1. Vào **Đối soát Shopee** (menu trái) → kỳ vọng thấy trang rỗng + 2 KPI card
2. Bấm **"Thêm đợt thanh toán"**
3. Nhập theo dữ liệu mẫu (từ screenshot bạn gửi):
   - Affiliate: chọn 1
   - Mã thanh toán: `17393600530260504`
   - Ngày đối soát: `2026-05-04`
   - Ngày thanh toán: `2026-05-07`
   - Bấm **+ Thêm ngày** 3 lần để có 4 dòng:
     - 29/04/2026 — 32.455.013đ
     - 30/04/2026 — 23.333.110đ
     - 01/05/2026 — 40.638.401đ (chính xác là 40.638.401)
     - 02/05/2026 — 52.566.939đ (chính xác là 52.566.939)
   - Bấm nút **"↓ Điền vào Tổng gross"** để tự fill: 148.993.463đ
     - (Hoặc gõ thủ công 148.963.459đ theo Shopee — số trong screenshot là tổng đã làm tròn)
   - Thuế PIT: 15.043.775đ
   - Net: 133.919.684đ
   - 2 dòng validation phải có dấu ✓ xanh
   - Ngân hàng nhận: `Tien Phong Bank`, 4 số cuối: `2549`
   - Bấm **Lưu**
4. Vào trang chi tiết → kiểm tra bảng đối soát:
   - Nếu chưa nhập hoa hồng ngày 29/04 → hiện badge đỏ "Thiếu"
   - Nếu đã nhập đúng → hiện badge xanh "Khớp"
   - Nếu lệch số → hiện badge vàng "Lệch"
5. Bấm **"Đánh dấu đã nhận"** → trạng thái chuyển

## 💡 Lưu ý

1. **Mã thanh toán unique theo affiliate**: nếu nhập trùng mã cùng 1 affiliate → báo lỗi
2. **Validation real-time**: form kiểm tra Tổng ngày = Gross + Gross - Tax = Net
3. **Auto-fill thông minh**:
   - Gõ Gross → tự tính Net (nếu đã có Tax)
   - Gõ Net → tự tính Tax (Tax = Gross - Net)
   - Có nút "↓ Điền vào Tổng gross" để auto sum từ các ngày
4. **Click vào icon ↗ ở dòng "Thiếu"** → đi thẳng đến trang nhập hoa hồng cho affiliate đó
5. **Xóa đợt**: bấm nút "Xóa đợt này" hai lần để xác nhận (soft delete)

## 🔮 Phase 5 (gợi ý cho tương lai)

- Auto-link đợt thanh toán với giao dịch "Nộp tiền vào NH" 
- Báo cáo theo tháng / quý
- Module thuế TNCN quyết toán cuối năm
- Audit log đầy đủ
