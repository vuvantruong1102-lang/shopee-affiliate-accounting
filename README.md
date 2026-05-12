# Phase 6 — Audit Log + Dashboard cải tiến + Backup

## 🎯 Tính năng

### 1. Audit Log (Lịch sử thay đổi)
- Tự động ghi lại mọi hành động sửa/xóa giao dịch
- Lưu: ai làm, lúc nào, sửa cái gì, từ giá trị cũ → mới
- Trang `/audit-log` với filter theo bảng + hành động
- **Immutable**: không ai có thể sửa/xóa audit log (RLS chặn)

### 2. Dashboard cải tiến (`/dashboard`)
- **Banner cảnh báo** ở đầu: hiển thị các vấn đề cần chú ý:
  - 🔴 Affiliate đang cầm tiền > 50tr chưa nộp (severity: high)
  - 🟠 Hoa hồng pending > 14 ngày chưa nhận (severity: high)
  - 🟡 Đợt Shopee chưa đánh dấu nhận sau 5 ngày (severity: medium)
- **4 KPI cards** clickable: Số dư tiền mặt, Số dư NH, DT tháng, Shopee chưa chuyển
- **Biểu đồ 12 tháng gần đây**: doanh thu gross theo tháng
- **Top 5 affiliate** tháng này (có progress bar)
- 3 nút quick link: Audit log, Backup, Báo cáo

### 3. Backup dữ liệu (`/backup`)
- Hiển thị stats tổng quan
- 2 nút download:
  - **CSV**: gộp tất cả bảng vào 1 file (cho người dùng đọc trên Excel)
  - **JSON**: dữ liệu thô, đầy đủ (cho mục đích khôi phục)
- Có khuyến nghị về tần suất backup

## 📋 Các bước triển khai

### Bước 1: Chạy SQL migration

Vào Supabase SQL Editor → paste toàn bộ `supabase/migrations/20260513000001_phase6_audit_dashboard.sql` → Run.

Migration tạo:
- Bảng `audit_log` + RLS
- RPC `log_audit`, `get_dashboard_alerts`, `get_monthly_revenue_trend`, `get_top_affiliates`

### Bước 2: Upload 11 file code

```
types/audit.ts                                       [FILE MỚI]
lib/audit-log.ts                                     [FILE MỚI]
app/(dashboard)/cash-book/actions.ts                 [GHI ĐÈ - thêm audit log]
app/(dashboard)/dashboard/page.tsx                   [GHI ĐÈ - dashboard mới]
app/(dashboard)/audit-log/page.tsx                   [FILE MỚI]
app/(dashboard)/backup/page.tsx                      [FILE MỚI]
components/layout/sidebar.tsx                        [GHI ĐÈ - thêm 2 link mới]
components/dashboard/dashboard-alerts.tsx            [FILE MỚI]
components/dashboard/revenue-trend-chart.tsx         [FILE MỚI]
components/dashboard/top-affiliates-list.tsx         [FILE MỚI]
components/audit/audit-log-list.tsx                  [FILE MỚI]
components/backup/backup-client.tsx                  [FILE MỚI]
```

⚠️ Đặt file đúng vị trí, không tạo `lib/components/...`

### Bước 3: Commit & Push

Message: `Phase 6: Audit log + Dashboard alerts + Backup`

### Bước 4: Test theo thứ tự

**Test 1 - Audit log**:
1. Vào Sổ tiền mặt → sửa 1 giao dịch (ví dụ đổi số tiền)
2. Vào `/audit-log` → kỳ vọng thấy 1 dòng mới ghi lại thay đổi
3. Filter theo bảng/hành động → hoạt động

**Test 2 - Dashboard alerts**:
1. Vào `/dashboard`
2. Nếu có affiliate đang cầm tiền (received > deposited) → thấy alert
3. Click vào alert → đi tới trang affiliate đó

**Test 3 - Chart + Top**:
1. Trên dashboard, biểu đồ 12 tháng hiển thị (nếu có dữ liệu)
2. Top affiliates hiển thị 5 người có doanh thu cao nhất tháng

**Test 4 - Backup**:
1. Vào `/backup` → thấy stats
2. Bấm **Tải CSV** → file mở được bằng Excel
3. Bấm **Tải JSON** → file JSON đầy đủ data

## 💡 Lưu ý quan trọng

### Về Audit log

- **Chỉ log update/delete** cho cash_transactions và bank_transactions ở phiên bản này. Có thể mở rộng cho commissions, affiliates ở phase sau nếu cần.
- **Không log create** (vì create không gây mất dữ liệu, ít quan trọng hơn).
- **Audit log không bao giờ bị xóa** → có thể tốn dung lượng sau vài năm. Cân nhắc thêm cron job xóa log > 2 năm trong tương lai.

### Về Backup

- **CSV gộp**: tất cả bảng trong 1 file, có header phân cách. Mở bằng Excel xem được nhưng không phải multi-sheet thực sự.
- **JSON**: đầy đủ nhất, dùng để khôi phục dữ liệu nếu cần. Bạn có thể parse JSON bằng Python/Node để import lại vào DB.
- **Khuyến nghị**: tải backup **đầu mỗi tháng**, lưu vào Google Drive với tên `backup-YYYY-MM-DD.json`.

### Về Dashboard alerts

- **Alerts tự cập nhật** khi vào trang (server-side render)
- Nếu không có alerts → banner tự ẩn
- Có thể expand/collapse banner để gọn

## 🐛 Troubleshooting

**Lỗi "function get_dashboard_alerts does not exist"?**
→ Chạy lại SQL migration ở Bước 1.

**Trang `/dashboard` báo lỗi khi load?**
→ Có thể do dữ liệu cũ chưa có `account_id` trong bank_transactions. Đã chạy migration Phase 5 Fix chưa?

**Audit log không hiện gì sau khi sửa giao dịch?**
→ Kiểm tra Supabase: bảng `audit_log` có dòng mới không? Nếu không → có thể RLS policy chưa đúng. Chạy lại migration.

## 🔮 Có thể làm tiếp ở Phase 7

- Báo cáo tháng/quý/năm chính thức (P&L, theo affiliate, theo khoản mục)
- Quản lý người phụ thuộc chi tiết (cho quyết toán thuế)
- Mobile responsive (nếu hay dùng điện thoại)
- Multi-year filter (xem dữ liệu năm trước)
