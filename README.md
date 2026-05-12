# Phase 6 Fix 3 — Thêm ô "Chi phí Facebook Ads" vào dashboard

## 🎯 Thay đổi

Thêm **ô KPI nhỏ thứ 7** ở cuối hàng nhỏ: **"Chi phí Facebook Ads"**.

```
Hàng 2 (7 ô nhỏ):
[DT Gross] [Thuế PN] [Thuế đã nộp] [Thuế thêm] [TM] [NH] [Chi phí FB Ads ✨]
```

## 🧠 Logic tính

Query tổng `amount` của các giao dịch `expense` trong tháng này, có `expense_category_id` thuộc danh sách category match theo tên:

- `Facebook Ads`
- `FB Ads` / `fbads`
- `Marketing`
- `Quảng cáo` / `Quang cao`
- `Ads` (chuẩn xác hoặc có khoảng trắng xung quanh)

Tính từ **CẢ** `bank_transactions` + `cash_transactions`. Lấy giao dịch trong khoảng `[đầu tháng → cuối tháng]` hiện tại.

## 📋 Triển khai

### Bước 1: Chạy SQL

Vào Supabase SQL Editor → paste `supabase/migrations/20260513000004_ads_expense_kpi.sql` → Run.

Migration sẽ:
1. Tạo RPC `get_ads_expense_this_month`
2. **Tự động tạo category "Facebook Ads"** nếu chưa có category nào tương tự

### Bước 2: Kiểm tra category

Sau khi chạy SQL, kiểm tra danh sách category:

```sql
SELECT id, name, type, is_active 
FROM expense_categories 
WHERE is_active = true 
ORDER BY display_order;
```

Bạn nên thấy:
- Có category tên "Facebook Ads", "Marketing", hoặc tương tự
- Nếu chưa có → migration đã tự tạo "Facebook Ads"

### Bước 3: Upload 1 file code

```
app/(dashboard)/dashboard/page.tsx                ← GHI ĐÈ
```

### Bước 4: Commit + Push

Message: `Phase 6 Fix 3: Add Facebook Ads expense KPI`

### Bước 5: Test

1. Vào `/dashboard` → kiểm tra hàng KPI nhỏ có **7 ô** (cuối là Facebook Ads)
2. Vào **Nhập liệu → Chi tiêu** → thêm 1 chi phí thử nghiệm:
   - Khoản mục: chọn "Facebook Ads" (hoặc category tương tự)
   - Số tiền: ví dụ 5.000.000đ
   - Nguồn: TK ngân hàng
3. Refresh dashboard → KPI "Chi phí Facebook Ads" phải hiện 5.000.000đ
4. Subtitle: "1 giao dịch tháng này"

## 💡 Lưu ý

### Match nhiều category

RPC tự gom các category có tên chứa "Marketing" / "Facebook Ads" / "Ads" / "Quảng cáo". 

Nếu bạn có **nhiều category** cùng loại (vd: "Facebook Ads", "Google Ads", "Marketing chung") → tất cả sẽ được tính chung vào KPI này.

### Phân biệt với category khác

Nếu bạn muốn **chỉ riêng Facebook Ads** (không gộp Marketing chung), hãy:
1. Tạo category tên cụ thể: "Facebook Ads"  
2. Khi nhập chi tiêu, chọn đúng category này
3. Đổi RPC để chỉ match `name = 'Facebook Ads'` exact (báo tôi nếu cần)

### Subtitle khi chưa có category match

Nếu `category_count = 0` → subtitle hiện "Chưa có khoản mục Ads" để bạn biết phải tạo.

### Tính chi phí cũ?

KPI này **chỉ tính tháng này**. Nếu muốn theo dõi cả năm hoặc theo quý, có thể mở rộng sau.
