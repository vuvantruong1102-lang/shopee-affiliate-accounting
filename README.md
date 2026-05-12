# Phase 8 Fix 4 — Sửa công thức Báo cáo P&L

## 🐛 Vấn đề

Báo cáo P&L hiện đang tính sai:

```
Lãi (cũ) = Doanh thu Net − Chi phí (Marketing/Lương/Vận hành/Khác)
        = (Gross − thuế tạm 10%) − Chi phí
```

→ **Số thuế phải nộp thêm (theo lũy tiến)** không được trừ → lãi cao hơn thực tế.

Từ screenshot của bạn:
- Doanh thu Gross: 2.092.955.403đ
- Chi phí: 20.000.000đ (Marketing FB Ads)
- **Lãi đang hiển thị (sai)**: 1.863.659.862đ
- **Lãi thực tế** sẽ thấp hơn rất nhiều sau khi trừ thuế lũy tiến

## ✅ Sửa theo Phương án A

Đồng nhất với Calculator:

```
Lãi = Doanh thu Gross − Tổng thuế phải nộp − Chi phí
```

Trong đó:
- **Doanh thu Gross**: Tổng hoa hồng trước thuế (Shopee báo)
- **Tổng thuế phải nộp**: Tính theo lũy tiến 5 bậc cho từng affiliate (như Dashboard KPI "Tổng thuế phải nộp")
- **Chi phí**: Tổng chi phí thực tế (Marketing, Lương, Vận hành...)

## 🎨 UI thay đổi

### 4 KPI lớn ở đầu (thêm 1 cái)

| Trước | Sau |
|---|---|
| 3 KPI: Doanh thu Net / Chi phí / Lãi | **4 KPI**: Doanh thu Gross / **Tổng thuế phải nộp** / Chi phí / Lãi |

KPI "Thuế phải nộp" có color `warning`, tăng = xấu (invertedColor).

### Bảng P&L chi tiết — 3 sections

```
DOANH THU
  Doanh thu Gross                              +2.092.955.403đ   100%
    Trong đó Net (sau Shopee KT 10%)            1.883.659.862đ   90%

THUẾ TNCN
  Tổng thuế phải nộp                            −XXX.XXX.XXXđ    XX%
    Thuế tạm nộp (Shopee KT 10%)                209.295.541đ
    Thuế còn phải nộp thêm (quyết toán)         XX.XXX.XXXđ

CHI PHÍ
  Marketing & Quảng cáo                         −20.000.000đ     1.1%
  Lương nhân viên                                —
  Vận hành                                       —
  Thuế, phí khác                                 —
  Khác                                           —
  Tổng chi phí                                  −20.000.000đ     1.1%

═══════════════════════════════════════════════════════════════════
LÃI                                            +XXX.XXX.XXXđ    XX%
```

### Pie chart "Cơ cấu trừ ra khỏi DT"

Đổi từ "Cơ cấu chi phí" → bao gồm cả **Thuế TNCN** + Chi phí. Tổng (Thuế + Chi phí) là phần bị trừ khỏi Gross.

### % tính trên Gross

Tất cả % giờ tính trên **Doanh thu Gross** (100%), không phải Net như trước. Như vậy thuế và chi phí sẽ thấy rõ tỷ trọng so với tổng doanh thu.

## 📋 Triển khai

### Bước 1: Chạy SQL

Vào Supabase SQL Editor → paste `supabase/migrations/20260514000002_fix_pnl_use_gross.sql` → Run.

Migration này:
- DROP RPC `get_pnl_report` cũ
- CREATE lại với return type mới (thêm `total_commission_tax_withheld`, bỏ `profit_loss/profit_margin` — tính ở client)

### Bước 2: Upload 2 file

```
app/(dashboard)/reports/pnl/page.tsx                ← GHI ĐÈ
components/reports/pnl-report-view.tsx              ← GHI ĐÈ
```

### Bước 3: Commit + Push

Message: `Phase 8 Fix 4: P&L use Gross + total tax payable`

### Bước 4: Test

1. Vào `/reports/pnl` (cùng kỳ như screenshot)
2. Kỳ vọng thấy:
   - **4 KPI** ở đầu (thêm "Tổng thuế phải nộp")
   - KPI "Tổng thuế phải nộp" có số > 0 (tính từ lũy tiến)
   - Bảng P&L có section "THUẾ TNCN" với 2 dòng phụ (tạm nộp + nộp thêm)
   - **Lãi sẽ THẤP HƠN** so với 1.863.659.862đ (vì đã trừ thuế)
3. KPI **biên lợi nhuận** giảm xuống đáng kể
4. Pie chart "Cơ cấu" có thêm phần "Thuế TNCN phải nộp" (màu vàng)

## 💡 Lưu ý

### Tính tax_payable trong page (không phải SQL)

Logic lũy tiến 5 bậc phức tạp, đã có sẵn trong `lib/ytd-tax.ts` (TypeScript). Thay vì viết lại trong PL/pgSQL, page.tsx sẽ:
1. Lấy danh sách affiliate active
2. Lấy commissions trong khoảng
3. Với mỗi affiliate → gọi `calculateYtdAdditionalTax` → cộng dồn `taxPayableYtd`

Cách này đảm bảo logic thuế ở **một nơi duy nhất**, dễ maintain.

### "Số tháng trong khoảng"

Để áp lũy tiến đúng (tính TNTT/tháng), cần biết khoảng thời gian có bao nhiêu tháng. Logic:
```typescript
const monthsInRange = Math.max(1, Math.min(12, 
  Math.round((toD - fromD) / 30 days) + 1
));
```

- Tháng (30 ngày): 1 tháng
- Quý (90 ngày): 3 tháng  
- Năm (365 ngày): cap ở 12 tháng

### Khi có Lương

Affiliate có `has_company_salary = true` → tự cộng lương vào TNTT khi tính thuế (giống logic Calculator).
