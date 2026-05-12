# Phase 8 Fix 2 — Sửa lại UI Calculator

## 🎯 Thay đổi

### 1. Form "Nhập thông số" — mỗi mục 1 hàng

Trước: 2 cột (HH Gross + Lương cùng hàng)
Sau: **Mỗi input 1 hàng riêng**, dễ nhìn hơn

| Hàng | Trường |
|---|---|
| 1 | Hoa hồng Gross |
| 2 | Lương |
| 3 | Giảm trừ gia cảnh (+ quick buttons) |
| 4 | Chi phí Facebook Ads |

**Font số đậm hơn**: `text-lg font-semibold tabular-nums` → số tiền dễ đọc

### 2. Giảm trừ — 1 ô tự điền

❌ Bỏ: checkbox "Có giảm trừ bản thân" + input "Số NPT"
✅ Mới: **1 ô CurrencyInput** để người dùng tự nhập số tiền

**Quick preset buttons** bên dưới (chọn nhanh):
- Bản thân: 15,500,000đ
- BT + 1 NPT: 21,700,000đ
- BT + 2 NPT: 27,900,000đ
- BT + 3 NPT: 34,100,000đ

Click button → tự fill vào ô. Hoặc nhập số tay tùy ý.

### 3. Kết quả ước tính — thêm % và giảm font

Layout dạng **MainRow** (mỗi hạng mục 1 hàng có icon + label + %, + số):

```
📈 Hoa hồng Gross              100.0%   30.000.000đ
💼 Lương                         0.0%            0đ  (ẩn nếu = 0)
➖ Giảm trừ                     51.7%  −15.500.000đ
┌─ 🧾 Thuế phải nộp              2.5%      725.000đ ──┐
│    Thuế tạm nộp (KT 10%)      10.0%    3.000.000đ  │
│    Được hoàn lại               7.6%   +2.275.000đ  │
└──────────────────────────────────────────────────────┘
📢 Chi phí Facebook Ads         16.7%   −5.000.000đ
═══════════════════════════════════════════════════
✨ Lợi nhuận                                  +XX,XXX,XXX đ
                                              % trên HH: 67%
```

- Font giảm từ `text-base/text-xl` → `text-sm/text-base`
- Mỗi hàng có **% trên HH Gross** ở cột giữa (làm cơ sở so sánh)
- Padding compact hơn

### 4. Layout 2 cột + 1 hàng dưới

```
┌──────────────────────┬──────────────────────┐
│ 📝 Nhập thông số      │ ✨ Kết quả ước tính   │
│   - HH Gross         │   - HH Gross + %     │
│   - Lương            │   - Lương + %        │
│   - Giảm trừ         │   - Giảm trừ + %     │
│   - Ads              │   - Thuế phải nộp +% │
│                      │   - Chi phí Ads + %  │
│                      │   ─────────          │
│                      │   ✨ LỢI NHUẬN + %    │
└──────────────────────┴──────────────────────┘
┌──────────────────────────────────────────────┐
│ 💰 Thuế theo từng bậc (full width)            │
│ Bậc | Khoảng TN | % | TN/bậc | Thuế | Tỷ trọng│
│ ...                                          │
└──────────────────────────────────────────────┘
```

- Form bên trái, Kết quả bên phải (2 cột cân đối)
- Thuế theo bậc **xuống dưới full-width** (bảng đầy đủ cột với progress bar)

## 📋 Triển khai

### Bước 1: Upload 1 file

```
components/calculator/calculator-form.tsx        ← GHI ĐÈ
```

### Bước 2: Commit + Push

Message: `Phase 8 Fix 2: Calculator UI redesign`

### Bước 3: Test

1. Vào `/calculator` → kiểm tra:
   - Form mỗi input 1 hàng riêng
   - Số tiền nhập vào hiển thị **đậm và to**
2. Trường Giảm trừ:
   - Mặc định: 15,500,000đ (Bản thân)
   - Click "BT + 1 NPT" → tự đổi thành 21,700,000đ
   - Có thể nhập tay 20,000,000đ (giá trị tùy ý)
3. Cột kết quả bên phải:
   - Mỗi hàng có % so với HH Gross
   - Font nhỏ hơn version cũ
   - Lợi nhuận nổi bật nhất ở cuối
4. Cuộn xuống → bảng "Thuế theo bậc" full-width với progress bar

## 💡 Lưu ý

### Quick buttons "Giảm trừ"

Mặc định preset Bản thân được active (highlight). Khi nhập tay số khác → không button nào active.

### % được tính trên HH Gross

Đây là cách phổ biến để xem tỷ trọng. Ví dụ:
- Giảm trừ 15.5tr / HH 30tr = 51.7%
- Chi phí Ads 5tr / HH 30tr = 16.7%
- Lợi nhuận sau cùng / HH = mức % thực bạn giữ lại

### Ẩn dòng "Lương" khi = 0

Để giao diện gọn, hàng Lương chỉ hiện khi > 0.
