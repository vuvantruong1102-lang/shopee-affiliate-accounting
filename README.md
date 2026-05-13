# Phase 21 — Tính thuế TNCN theo CẢ NĂM (12 tháng)

## 🎯 Thay đổi cốt lõi

Theo luật VN, cá nhân quyết toán thuế TNCN cuối năm. Cách cũ tính YTD theo tháng đã trôi qua → SAI. Cách mới tính cả năm:

```
Tổng TN năm = Lương × 12 + Shopee YTD (số thật, không scale)
Giảm trừ năm = (15.5tr + 6.2tr × dependents) × 12
TNTT năm = max(0, Tổng TN - Giảm trừ)
Thuế phải nộp = áp BẬC NĂM trực tiếp lên TNTT năm
Cần nộp thêm = Thuế phải nộp - Thuế đã KT (Shopee + Lương × 12)
```

## 📊 Bậc thuế NĂM (= bậc tháng × 12)

| Bậc | TNTT năm | Rate |
|---|---|---|
| 1 | Đến 120tr | 5% |
| 2 | 120 - 360tr | 10% |
| 3 | 360 - 720tr | 20% |
| 4 | 720tr - 1.2 tỷ | 30% |
| 5 | Trên 1.2 tỷ | 35% |

## 📦 Files

```
lib/tax-calculator.ts                     ← GHI ĐÈ (thêm bậc năm + calculateTaxAnnualDirect)
lib/ytd-tax.ts                            ← GHI ĐÈ (đổi sang tính 12 tháng)
app/(dashboard)/tax/[id]/page.tsx         ← GHI ĐÈ (UI text + KPI labels)
```

⚠️ **Thiếu**: nếu khối "Thuế phải nộp (lũy tiến 5 bậc)" trong screenshot là từ `components/tax/tax-breakdown.tsx` thì cần thêm file đó. Bạn gửi tôi sau để tôi sửa nốt.

## 🧪 Test sau deploy

Với affiliate Vũ Văn Trường (ytdGross = 879.773.739, không lương, 0 dependents):

### Cách CŨ (sai):
- Cần nộp thêm: **119.447.726đ**

### Cách MỚI (đúng):
```
Tổng TN năm: 879.773.739
Giảm trừ:    186.000.000 (15.5tr × 12)
TNTT năm:    693.773.739

Bậc 1 (đến 120tr):    120tr × 5%  = 6.000.000
Bậc 2 (120-360tr):    240tr × 10% = 24.000.000
Bậc 3 (360-720tr):    333.773.739 × 20% = 66.754.748
─────────────────────────────────────
Thuế phải nộp:        96.754.748

Thuế Shopee đã KT:    87.977.374 (10% của 879.773.739)
─────────────────────────────────────
Cần nộp thêm:         8.777.374 ✅
```

→ Giảm 13.6 lần so với cách cũ.
