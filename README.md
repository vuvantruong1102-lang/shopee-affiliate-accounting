# Phase 6 Fix 2 — Sửa lại layout Dashboard chi tiết

## 🎨 Layout mới

```
┌─────────────────────────────────────────────────────────────┐
│ Hàng 1: 3 ô LỚN                                              │
│ [DT tháng NET] [Shopee đã chuyển] [Shopee chưa chuyển]      │
├─────────────────────────────────────────────────────────────┤
│ Hàng 2: 6 ô nhỏ                                              │
│ [DT Gross] [Thuế phải nộp] [Thuế đã nộp]                    │
│ [Thuế cần nộp thêm] [TM] [NH]                                │
├──────────────────────────────────┬──────────────────────────┤
│ Chart 12 tháng                   │ ⚠️ Cảnh báo               │
│                                  │                          │
│ ───────────────────────          ├──────────────────────────┤
│ Hoạt động gần đây                │ 🏆 Top affiliate (NET)   │
│ (recent commissions feed)        │                          │
└──────────────────────────────────┴──────────────────────────┘
```

## ✨ Tính năng mới/thay đổi

### Hàng KPI

| Vị trí | Tên | Logic |
|---|---|---|
| Lớn 1 | **Doanh thu tháng NET** | `total_net` của hoa hồng tháng này |
| Lớn 2 | **Shopee đã chuyển** | Tổng `total_net` các đợt Shopee đã đánh dấu received trong tháng |
| Lớn 3 | **Shopee chưa chuyển** | Tổng `total_net` các đợt chưa received (tất cả thời gian) |
| Nhỏ 1 | DT tháng Gross | `total_gross` của hoa hồng tháng này |
| Nhỏ 2 | **Tổng thuế phải nộp** | Sum `taxPayableYtd` tất cả affiliate (theo luật lũy tiến) |
| Nhỏ 3 | Thuế đã nộp | Sum `taxWithheldYtd` |
| Nhỏ 4 | Thuế cần nộp thêm | Sum `taxAdditional > 0` |
| Nhỏ 5 | Số dư tiền mặt | Như cũ |
| Nhỏ 6 | Số dư ngân hàng | Như cũ |

### Hoạt động gần đây (mới)

- Hiển thị 8 đợt hoa hồng được ghi nhận **mới nhất** (sort theo `created_at`)
- Mỗi dòng: tên affiliate, số tiền net (+ gross), ngày HH, "vừa xong / X phút trước"
- Click vào → đi đến trang affiliate đó

### Top affiliate theo NET (đổi từ Gross)

- RPC `get_top_affiliates` đã sửa: sort theo `SUM(net_amount)` thay vì gross
- Hiển thị giá trị net trong list (giá trị thực affiliate nhận)

## 📋 Triển khai

### Bước 1: Chạy SQL

Vào Supabase SQL Editor → paste `supabase/migrations/20260513000003_top_affiliates_by_net.sql` → Run.

### Bước 2: Upload 3 file

```
app/(dashboard)/dashboard/page.tsx                         ← GHI ĐÈ
components/dashboard/top-affiliates-list.tsx              ← GHI ĐÈ
components/dashboard/recent-commissions-feed.tsx          ← MỚI
```

### Bước 3: Commit + Push

Message: `Phase 6 Fix 2: Dashboard 3+6 KPI layout + activity feed + net top`

### Bước 4: Test

1. **Hàng 1**: 3 ô lớn ở đầu — DT tháng NET hiển thị **đã trừ thuế** (nhỏ hơn gross)
2. **Hàng 2**: 6 ô nhỏ theo đúng thứ tự
3. **Hoạt động gần đây**: thử thêm 1 hoa hồng → refresh → thấy nó xuất hiện ở đầu list
4. **Top affiliate**: số tiền hiển thị bây giờ là NET (không phải gross)

## 💡 Lưu ý

### Net vs Gross
- **Gross** = số trước thuế (số Shopee báo)
- **Net** = sau khi Shopee khấu trừ 10% PIT (số thực vào TK affiliate)
- KPI DT tháng NET và Top affiliate đều dùng net → phản ánh **số tiền thực** mà công ty/affiliate nhận được

### Shopee đã chuyển vs Doanh thu tháng
- "Shopee đã chuyển" tính theo `payment_date` của đợt Shopee
- "Doanh thu tháng NET" tính theo `earned_date` của commission
- **Hai số này có thể khác nhau**: ví dụ HH ngày 30/4 có thể được Shopee chuyển vào tháng 5
