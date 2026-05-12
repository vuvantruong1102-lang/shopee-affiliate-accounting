# Phase 8 Fix 3 — Sửa công thức lợi nhuận + gọn UI

## 🐛 Bug đã sửa

### Công thức lợi nhuận sai

**Trước (sai)**:
```
Lợi nhuận = HH Net + Lương − Ads − Thuế còn phải nộp thêm
         = (HH Gross − 10%) + Lương − Ads − Thuế còn phải nộp thêm
```

**Sau (đúng)**:
```
Lợi nhuận = HH Gross − Tổng thuế phải nộp − Chi phí Ads
```

**Tại sao**:
- Lương là **thu nhập cá nhân riêng** của người đứng tên affiliate (từ công ty khác), không thuộc lợi nhuận của bạn
- Lương chỉ là **tham số** để tính chính xác mức thuế lũy tiến (vì thuế tính trên tổng thu nhập)
- "Tổng thuế phải nộp" đã bao gồm cả thuế tạm + thuế phải nộp thêm → không cần trừ riêng

## 🎨 UI thay đổi

### Bảng "Kết quả ước tính" gọn lại — chỉ 4 mục

❌ Bỏ: Lương, Giảm trừ (đã hiển thị trong form rồi, không cần lặp)
✅ Giữ:
1. **Hoa hồng Gross** (card lớn primary)
2. **Thuế phải nộp** (card lớn warning + 2 sub-items: tạm nộp / nộp thêm)
3. **Chi phí Facebook Ads** (card lớn danger)
4. **Lợi nhuận** (card nổi bật nhất)

Bên dưới có dòng nhỏ ghi công thức: "Lợi nhuận = HH Gross − Tổng thuế phải nộp − Chi phí Ads"

### Bảng "Thuế theo từng bậc" — thiết kế lại

**Trước**: Bảng truyền thống với cột Bậc / Khoảng / Thuế suất / TN / Thuế / Tỷ trọng — cột "Bậc" quá hẹp, chữ nhảy dòng.

**Sau**: Mỗi bậc là **1 hàng grid 12 cột cân đối**:

```
┌─────────────────────────────────────────────────────────────────┐
│ [1] Bậc 1            5%      TN trong bậc:    Thuế:    Tỷ trọng│
│     Đến 10tr                  10,000,000đ  500,000đ   ███░ 53%│
├─────────────────────────────────────────────────────────────────┤
│ [2] Bậc 2           10%      TN trong bậc:    Thuế:    Tỷ trọng│
│     10-30tr                    4,500,000đ  450,000đ   █░░░ 47%│
└─────────────────────────────────────────────────────────────────┘
```

- **Số bậc to (badge tròn)** ở đầu hàng
- **Mỗi cột có label nhỏ** ở trên ("SUẤT", "TN TRONG BẬC", "THUẾ", "TỶ TRỌNG") → dễ đọc
- **Khoảng thu nhập** hiển thị dưới "Bậc N" → không bị nhảy dòng
- **Progress bar tỷ trọng** to hơn, có % bên cạnh
- **Responsive**: ở mobile (< sm) tự xếp lại thành nhiều hàng

### 4 stat tổng ở đầu bảng bậc thuế

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ TNTT         │ Tổng thuế   │ Đã KT 10%   │ Còn phải nộp│
│ 14,500,000đ  │ 950,000đ    │ −3,000,000đ │ 0đ          │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

4 card vuông gọn, đồng đều, không bị tràn.

## ✅ Verify công thức

Test case 1: HH 30tr, Lương 0, Ads 5tr, Giảm trừ 15.5tr
- Thuế tạm: 3.000.000đ
- Thuế phải nộp: 950.000đ
- Được hoàn: 2.050.000đ
- **Lợi nhuận** = 30.000.000 − 950.000 − 5.000.000 = **24.050.000đ** (80.2% / HH)

Test case 2: HH 100tr, Lương 20tr (cộng dồn để tính thuế), Ads 10tr, Giảm trừ 15.5tr
- TNTT = 100tr + 20tr − 15.5tr = 104.5tr
- Thuế phải nộp (5 bậc): 22.075.000đ
- **Lợi nhuận** = 100.000.000 − 22.075.000 − 10.000.000 = **67.925.000đ**

→ Lương 20tr không vào lợi nhuận, nhưng làm tăng thuế phải nộp.

## 📋 Triển khai

### Bước 1: Upload 1 file

```
components/calculator/calculator-form.tsx        ← GHI ĐÈ
```

### Bước 2: Commit + Push

Message: `Phase 8 Fix 3: Correct profit formula + redesign tax bracket table`

### Bước 3: Test

1. Vào `/calculator` → kiểm tra:
   - Bảng "Kết quả ước tính" chỉ còn 4 mục (HH Gross / Thuế / Ads / Lợi nhuận)
   - Không còn dòng Lương, không còn dòng Giảm trừ
   - Có ghi chú công thức nhỏ ở cuối
2. Thử nhập **Lương = 20.000.000đ**:
   - Tổng thuế phải nộp **TĂNG**
   - Lợi nhuận **GIẢM** (vì thuế tăng)
   - Nhưng lương KHÔNG cộng vào lợi nhuận
3. Cuộn xuống xem **bảng thuế theo bậc**:
   - 4 stat tổng ở đầu (TNTT / Tổng thuế / Đã KT / Còn phải nộp)
   - Mỗi bậc là 1 hàng đẹp, có badge số bậc to + khoảng + suất + TN + thuế + tỷ trọng
   - Không còn chữ nhảy dòng lung tung

## 💡 Phân biệt rõ vai trò "Lương"

| Vai trò | Có | Không |
|---|---|---|
| Vào lợi nhuận | ❌ | ✅ |
| Vào TNCT (tính thuế) | ✅ | ❌ |
| Vào TNTT (tính thuế) | ✅ | ❌ |

Lương là thu nhập cá nhân của affiliate (họ làm việc cho công ty khác), không phải doanh thu của bạn. Bạn chỉ cần lương để tính chính xác mức thuế lũy tiến áp dụng cho affiliate này.
