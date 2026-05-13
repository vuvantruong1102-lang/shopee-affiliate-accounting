# Phase 16 — Move Shopee Processing to Reconciliation

## 📦 4 files trong zip này

```
components/reports/shopee-processing-table.tsx        ← GHI ĐÈ
components/reports/shopee-processing-section.tsx      ← MỚI
app/(dashboard)/reconciliation/page.tsx               ← GHI ĐÈ
app/(dashboard)/reports/assets/page.tsx               ← GHI ĐÈ
```

## 🎯 Thay đổi

### `/reconciliation` (Đối soát Shopee)
**Thêm** bảng "Khoản thanh toán Shopee đang xử lý" ở **cuối trang**, dưới `ReconciliationView` cũ.

### `/reports/assets` (Tổng tài sản)
**Bỏ** bảng `ShopeeProcessingTable` cũ ở dưới. Giữ:
- 5 KPI top (Tiền mặt / NH / Affiliate cầm / Shopee chưa chuyển / Shopee đang xử lý)
- Pie chart 5 lát
- Bảng Affiliate đang cầm tiền

### `/affiliates/[id]` (Chi tiết affiliate)
**Cần sửa tay** — xem hướng dẫn bên dưới.

---

## 🚀 Triển khai

### Bước 1: Upload 4 file trong zip

### Bước 2: Sửa thêm `app/(dashboard)/affiliates/[id]/page.tsx`

Mở file → thêm 2 đoạn code:

#### Đoạn A: Fetch shopee processing (trong server component, gần các fetch khác)

```tsx
// Fetch số tiền Shopee đang xử lý của affiliate này
const { data: processingData } = await supabase
  .from("shopee_processing_amounts")
  .select("amount, snapshot_date, updated_at")
  .eq("affiliate_id", id)
  .maybeSingle();

const shopeeProcessing = Number(processingData?.amount ?? 0);
const processingUpdatedAt = processingData?.updated_at as string | null;
```

#### Đoạn B: Thêm KPI thứ 5 vào grid

Tìm grid KPI hiện tại (4 ô: Tổng HH, Đã nhận, Chưa nhận, Đã nộp). Đổi class:
```tsx
// CŨ: grid-cols-2 lg:grid-cols-4
// MỚI: grid-cols-2 lg:grid-cols-5
<div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
```

Rồi **thêm KpiCard thứ 5** vào cuối grid, ngay sau "Đã nộp tiền mặt":

```tsx
<KpiCard
  label="Shopee đang xử lý"
  value={formatCurrency(shopeeProcessing)}
  subtitle={
    processingUpdatedAt
      ? `Cập nhật ${new Date(processingUpdatedAt).toLocaleDateString("vi-VN")}`
      : "Chưa cập nhật"
  }
  variant="purple"
/>
```

#### Đoạn C: Cập nhật `KpiCard` để hỗ trợ variant `purple`

Tìm function `KpiCard` trong cùng file. Sửa:

```tsx
function KpiCard({
  label,
  value,
  subtitle,
  variant = "default",
  warning,
  warningText,
}: {
  label: string;
  value: string;
  subtitle: string;
  variant?: "default" | "success" | "warning" | "purple";  // ← thêm "purple"
  warning?: boolean;
  warningText?: string;
}) {
  const valueColor = {
    default: "",
    success: "text-success",
    warning: "text-warning",
    purple: "text-purple-500",  // ← thêm dòng này
  }[variant];

  // ... phần còn lại giữ nguyên
}
```

---

## ✅ Test sau deploy

### Test 1: `/reconciliation`
1. Vào `/reconciliation`
2. Cuộn xuống dưới → thấy bảng "Khoản thanh toán Shopee đang xử lý"
3. Nhập số tiền cho 1 affiliate (vd: 15.000.000)
4. Bấm Lưu → toast xanh
5. Refresh → số mới hiển thị + "Cập nhật vừa xong"

### Test 2: `/reports/assets`
1. Vào `/reports/assets`
2. KPI thứ 5 "Shopee đang xử lý" tăng lên 15tr (số vừa nhập)
3. Pie chart có slice tím
4. Cuộn xuống → **KHÔNG còn** bảng nhập (đã chuyển sang reconciliation)
5. Note ở dưới cùng có link "Đối soát Shopee"

### Test 3: `/affiliates/[id]` (sau khi sửa tay)
1. Vào trang affiliate đã nhập 15tr
2. KPI grid có 5 ô thay vì 4
3. Ô "Shopee đang xử lý" màu tím, hiện 15.000.000 đ
4. Subtitle: "Cập nhật DD/MM/YYYY"

---

## 💡 Logic ghi đè

Bảng `shopee_processing_amounts` có `PRIMARY KEY = affiliate_id` → mỗi affiliate chỉ có **1 dòng duy nhất**. RPC `upsert_shopee_processing` dùng `ON CONFLICT DO UPDATE` → khi nhập số mới sẽ **ghi đè** số cũ (không cộng dồn). Đúng yêu cầu của bạn.
