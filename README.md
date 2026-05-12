# Phase 12 — Export Excel năm + Global Search (Ctrl+K)

## 🎯 2 tính năng mới

### 1️⃣ Export Excel năm cho từng affiliate

Nút **"📥 Xuất Excel năm"** trên header trang affiliate. Bấm vào → modal chọn năm → tải file CSV.

**File CSV gồm 8 section** (mở bằng Excel/Google Sheets):
1. Thông tin chung affiliate (CCCD, MST, TK ngân hàng, NPT, lương)
2. Tổng kết doanh thu năm
3. Bảng kê hoa hồng theo từng tháng (12 tháng)
4. Chi tiết từng đợt hoa hồng (có mã thanh toán Shopee)
5. Chi tiết các lượt nộp tiền vào công ty
6. Tính thuế TNCN chi tiết
7. Thuế theo 5 bậc lũy tiến (chi tiết từng bậc)
8. Kết quả quyết toán (phải nộp / được hoàn)

Tên file: `quyettoan-thue-{năm}-{tên-affiliate}.csv`

### 2️⃣ Global Search (Ctrl+K / Cmd+K)

Phím tắt **Ctrl+K** (Windows/Linux) hoặc **Cmd+K** (Mac) — hoạt động ở mọi trang trong dashboard.

Tìm được:
- **Affiliate** theo tên / SĐT / CCCD / email
- **Đợt thanh toán Shopee** theo mã thanh toán
- **Giao dịch ngân hàng** theo số tiền (vd: 20000000) hoặc mô tả

Features:
- Debounce 300ms (không gọi API mỗi lần gõ)
- Arrow keys ↑↓ để di chuyển
- Enter để mở
- Esc để đóng
- Mouse hover cũng select item

---

## 📁 Files trong gói (7 files)

```
lib/csv-multi-section.ts                                   ← MỚI
app/(dashboard)/affiliates/[id]/export/actions.ts          ← MỚI
components/affiliates/annual-export-modal.tsx              ← MỚI
components/affiliates/affiliate-actions-button.tsx         ← GHI ĐÈ (thêm nút Export)
components/global-search/actions.ts                        ← MỚI
components/global-search/search-modal.tsx                  ← MỚI
components/global-search/search-trigger.tsx                ← MỚI
```

**KHÔNG cần SQL migration**.

---

## 📋 Triển khai

### Bước 1: Upload 7 file

Sao chép đúng cấu trúc folder vào repo.

### Bước 2: Tích hợp GlobalSearchTrigger vào layout

Mở file `app/(dashboard)/layout.tsx` (hoặc component `Topbar`/`Header` nếu có), thêm import và đặt button vào header.

**Ví dụ tích hợp** (vị trí cụ thể tùy layout của bạn):

```tsx
// Trên cùng file
import { GlobalSearchTrigger } from "@/components/global-search/search-trigger";

// Trong topbar/header, ví dụ bên cạnh thông báo / avatar:
<header className="flex items-center justify-between ...">
  <div>{/* logo / breadcrumb */}</div>

  <div className="flex items-center gap-3">
    <GlobalSearchTrigger />     {/* ✨ thêm dòng này */}
    {/* notification icon */}
    {/* user avatar */}
  </div>
</header>
```

**Hoặc đơn giản hơn**: nếu không muốn sửa layout, chỉ cần phím tắt Ctrl+K hoạt động ở mọi trang, đặt component này 1 lần trong dashboard layout — phím tắt sẽ bắt được toàn cục.

> 💡 Nếu chưa biết file layout ở đâu, search: "topbar" hoặc "header" trong project.

### Bước 3: Commit + Push

Message: `Phase 12: annual export + global search Ctrl+K`

### Bước 4: Test

#### Test Export Excel năm

1. Vào trang affiliate `/affiliates/[id]` (vd: Trần Văn An)
2. Bấm nút **"📥 Xuất Excel năm"** trên header
3. Modal hiện → chọn năm 2026 → bấm "Tải xuống"
4. File `quyettoan-thue-2026-tran-van-an.csv` được tải về
5. Mở bằng Excel → kiểm tra:
   - 8 section đầy đủ
   - Tiếng Việt hiển thị đúng (không bị mã hóa)
   - Số liệu khớp với trang web

#### Test Global Search

1. Ở bất kỳ trang nào, bấm **Ctrl+K** (hoặc Cmd+K trên Mac)
2. Modal mở với input focus
3. Gõ "Trần" → thấy "Trần Văn An" trong group "Affiliates"
4. Bấm Enter → đi tới trang chi tiết affiliate
5. Mở lại Ctrl+K, gõ "17351120" (mã thanh toán) → thấy đợt Shopee
6. Mở lại, gõ "20000000" → thấy giao dịch ngân hàng số tiền 20tr
7. Test Arrow keys ↑↓ + Enter
8. Test Esc đóng modal

---

## 💡 Lưu ý kỹ thuật

### File CSV xuất ra

- Format: **UTF-8 BOM CSV** (mở bằng Excel hỗ trợ tiếng Việt)
- Có thể đặt tên file `.csv` thành `.xls` để Excel mở mặc định nếu muốn
- Mỗi section ngăn cách bằng 2 dòng trống — Excel sẽ tự nhận dạng từng bảng

### Global Search performance

- Mỗi tìm kiếm gọi tối đa **3 query song song** (affiliates, shopee_payments, bank_transactions)
- Mỗi query LIMIT 5-10 records
- Tổng kết quả cap ở 25 items
- Debounce 300ms tránh spam API

### Phím tắt xung đột

- **Ctrl+K** đôi khi xung đột với phím tắt browser (Firefox = search bar)
- Cmd+K trên Mac OK
- Nếu xung đột: vẫn có nút trong topbar để click

### Khi search không có kết quả

- Có thể là query < 2 ký tự → hiện hint
- Có thể là không match → hiện "Không tìm thấy"
- Loading indicator hiện khi đang query

---

## 🎬 Demo workflow

### Sử dụng cuối năm

```
1. Mở Ctrl+K → gõ "Trần"
2. Chọn affiliate Trần Văn An
3. Trên trang chi tiết, bấm "Xuất Excel năm"
4. Chọn năm 2026 → Tải xuống
5. Mở file CSV → gửi email cho affiliate
6. Lặp lại cho từng affiliate
```

### Sử dụng hàng ngày

```
1. Affiliate gọi báo "Em vừa nhận tiền đợt 17351120532..."
2. Ctrl+K → paste mã → Enter
3. Mở thẳng trang Đối soát Shopee → tìm đợt → bấm "Đã nhận"
```

→ Tiết kiệm nhiều click hơn so với navigate qua menu.
