# Phase 7 — Báo cáo cốt lõi

## 🎯 Tính năng

### 3 báo cáo cốt lõi

| Báo cáo | URL | Mục đích |
|---|---|---|
| **Doanh thu** | `/reports/revenue` | Tổng doanh thu, breakdown theo tháng, so sánh kỳ trước |
| **Theo Affiliate** | `/reports/affiliates` | Bảng tổng hợp từng affiliate, ai đang cầm tiền chưa nộp |
| **Lãi/Lỗ (P&L)** | `/reports/pnl` | Doanh thu - Chi phí = Lãi, có pie chart cơ cấu chi phí |

### Tính năng chung 3 báo cáo

- ✅ **Filter linh hoạt**: Tháng / Tháng trước / Quý / Năm / Năm trước / Tùy chỉnh ngày
- ✅ **So sánh kỳ trước**: tự động tính khoảng thời gian cùng độ dài và hiển thị % tăng/giảm
- ✅ **Xuất Excel/CSV** (UTF-8 BOM, đọc được tiếng Việt)
- ✅ **In/Lưu PDF** qua Ctrl+P (print CSS sẵn từ Phase 3)
- ✅ **Recharts** cho biểu đồ (cột + pie)

### Đặc biệt từng báo cáo

**Báo cáo Doanh thu**:
- 4 KPI: Gross / Net (highlight) / Thuế KT / Số đợt
- Biểu đồ cột theo tháng (Gross + Net)
- Bảng chi tiết từng tháng

**Báo cáo theo Affiliate**:
- 4 KPI tổng: Net / Đã nhận / Đã nộp / **Đang cầm chưa nộp** (highlight)
- Bảng có **sort được mọi cột** (gross, net, đã nhận, đang cầm, số đợt)
- Tìm kiếm affiliate
- Highlight đỏ nhẹ dòng có > 1tr đang cầm chưa nộp
- Hiển thị % thay đổi net vs kỳ trước cho từng affiliate

**Báo cáo P&L**:
- 3 KPI lớn: Doanh thu / Tổng chi phí / Lãi-Lỗ (with margin %)
- Bảng P&L style kế toán: doanh thu - chi phí từng loại - lãi/lỗ
- Pie chart cơ cấu chi phí (Marketing, Lương, Vận hành, Thuế, Khác)
- Bảng breakdown chi tiết theo category
- Cảnh báo đỏ nếu lỗ

## 📋 Triển khai

### Bước 1: Chạy SQL

Vào Supabase SQL Editor → paste `supabase/migrations/20260514000001_phase7_reports.sql` → Run.

Tạo 5 RPC: `get_revenue_report`, `get_revenue_by_month`, `get_affiliates_report`, `get_pnl_report`, `get_expense_breakdown`.

### Bước 2: Upload 9 file code

```
lib/report-period.ts                                       [FILE MỚI]
app/(dashboard)/reports/page.tsx                           [GHI ĐÈ placeholder]
app/(dashboard)/reports/revenue/page.tsx                   [FILE MỚI - folder mới]
app/(dashboard)/reports/affiliates/page.tsx                [FILE MỚI - folder mới]
app/(dashboard)/reports/pnl/page.tsx                       [FILE MỚI - folder mới]
components/reports/period-selector.tsx                     [FILE MỚI]
components/reports/revenue-report-view.tsx                 [FILE MỚI]
components/reports/affiliates-report-view.tsx              [FILE MỚI]
components/reports/pnl-report-view.tsx                     [FILE MỚI]
```

⚠️ Đặt file đúng vị trí, không tạo `lib/components/...`

### Bước 3: Commit + Push

Message: `Phase 7: Revenue + Affiliates + P&L reports`

### Bước 4: Test

**Test Báo cáo Doanh thu**:
1. Vào `/reports/revenue` → mặc định là tháng này
2. Đổi sang "Tháng trước" → data đổi, % so sánh cập nhật
3. Chọn ngày custom → check kết quả
4. Bấm "Xuất Excel" → file CSV mở được trên Excel
5. Bấm "In/PDF" → Ctrl+P, kiểm tra trang in chỉ có header + bảng

**Test Báo cáo Affiliate**:
1. Vào `/reports/affiliates`
2. Click vào header cột → sort tăng/giảm
3. Tìm kiếm affiliate → filter đúng
4. Affiliate nào đang cầm > 1tr → có dòng highlight + icon cảnh báo
5. Bấm Xuất Excel → kiểm tra format

**Test Báo cáo P&L**:
1. Trước khi test, nhập vài chi tiêu test (Marketing, Lương)
2. Vào `/reports/pnl`
3. Kiểm tra Doanh thu Net hiển thị đúng
4. Bảng P&L: doanh thu - chi phí - lãi/lỗ
5. Pie chart hiển thị cơ cấu chi phí
6. Nếu lỗ → có cảnh báo đỏ

## 💡 Lưu ý

### Logic so sánh kỳ trước

Hệ thống tự tính khoảng thời gian cùng độ dài. Ví dụ:
- Kỳ này: 01/05/2026 → 31/05/2026 (31 ngày)
- Kỳ trước: 31/03/2026 → 30/04/2026 (31 ngày)
- Năm này: 01/01/2026 → 31/12/2026 (365 ngày)
- Kỳ trước: 01/01/2025 → 31/12/2025

### Chi phí trong P&L

Lấy từ **cả** `bank_transactions` và `cash_transactions` (loại `expense`), nhóm theo `expense_categories.type`:
- `marketing` → "Marketing & Quảng cáo"
- `salary` → "Lương nhân viên"
- `operating` → "Vận hành"
- `tax` → "Thuế, phí"
- `other` hoặc NULL → "Khác"

⚠️ **Chi phí chưa có khoản mục** (`expense_category_id = NULL`) sẽ rơi vào "Khác".

### Tại sao Doanh thu trong P&L dùng NET

P&L tính lãi thực, nên dùng **net** (sau khi Shopee đã khấu trừ 10% thuế). Đây là số tiền thực mà công ty được hưởng.

### "Đã nộp" trong Báo cáo Affiliate

Chỉ tính giao dịch trong khoảng thời gian báo cáo. Nếu affiliate có hoa hồng tháng 5 nhưng nộp tháng 6 → tháng 5 sẽ hiện "đang cầm", tháng 6 sẽ hiện "đã nộp".

## 🔮 Có thể mở rộng

- **Báo cáo tổng hợp tháng/quý**: gộp 3 báo cáo vào 1 trang
- **Email báo cáo tự động**: cuối tháng auto gửi PDF
- **Báo cáo theo category cụ thể**: chi tiết hơn cho từng khoản
- **Forecast**: dự báo doanh thu/lãi tháng sau dựa trên xu hướng
