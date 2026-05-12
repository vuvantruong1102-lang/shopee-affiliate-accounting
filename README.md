# Phase 8 Fix — Đơn giản hóa Calculator

## 🎯 Thay đổi so với Phase 8

| Mục | Phase 8 (cũ) | Phase 8 Fix (mới) |
|---|---|---|
| Phạm vi tính toán (1/3/6/12 tháng) | ✅ Có | ❌ Bỏ |
| Chi phí khác | ✅ Có | ❌ Bỏ |
| Form nhập | Số/tháng × số tháng | Nhập trực tiếp số tiền |
| Layout kết quả | Bảng dài, nhiều dòng | **Card lớn**, dễ nhìn |
| In đậm các mục chính | Bình thường | **Bold + Border** |

## 📋 Layout kết quả mới

```
┌────────────────────────────────────────────────────┐
│ 📈 Hoa hồng Gross                  +XX,XXX,XXX đ    │ ← Card lớn, viền primary
├────────────────────────────────────────────────────┤
│ Giảm trừ                          −XX,XXX,XXX đ    │ ← Card thường
│   └─ Giảm trừ bản thân                X,XXX,XXX đ  │
│   └─ Giảm trừ N người phụ thuộc       X,XXX,XXX đ  │
├────────────────────────────────────────────────────┤
│ 🧾 Thuế phải nộp                   XX,XXX,XXX đ    │ ← Card lớn, viền warning
│   └─ Thuế tạm nộp (Shopee KT 10%)     X,XXX,XXX đ  │
│   └─ Thuế còn phải nộp thêm           X,XXX,XXX đ  │ (warning nếu > 0)
├────────────────────────────────────────────────────┤
│ 📢 Chi phí Facebook Ads            −X,XXX,XXX đ    │ ← Card lớn, viền destructive
├════════════════════════════════════════════════════┤
│ ✨ LỢI NHUẬN                       +XX,XXX,XXX đ    │ ← Card NỔI BẬT NHẤT
└────────────────────────────────────────────────────┘
```

### Hệ thống visual

- **Card lớn** (viền 2px màu): các mục chính (HH Gross / Thuế / Ads / Lợi nhuận)
- **Card nhỏ** (viền 1px): giảm trừ (có sub-items)
- **Sub-row** trong card: dòng con text nhỏ hơn
- **Lợi nhuận**: card lớn nhất, có background tint, gradient nhẹ

## 🧮 Công thức (giữ nguyên)

1. **Thuế tạm nộp** = HH Gross × 10%
2. **TNTT** = HH Gross + Lương − Giảm trừ
3. **Thuế phải nộp** = TNTT áp biểu lũy tiến 5 bậc
4. **Thuế còn phải nộp** = max(0, Thuế phải nộp − Thuế tạm nộp)
5. **Lợi nhuận** = (HH Gross − 10% tạm KT) + Lương − Chi phí Ads − Thuế còn phải nộp thêm

## 📋 Triển khai

### Bước 1: Upload 1 file

```
components/calculator/calculator-form.tsx        ← GHI ĐÈ
```

### Bước 2: Commit + Push

Message: `Phase 8 Fix: Simplify calculator UI`

### Bước 3: Test

1. Vào `/calculator` → kiểm tra:
   - Form chỉ có 5 input: HH Gross / Lương / Ads / Có giảm trừ bản thân / Số NPT
   - **Không còn** dropdown phạm vi, không còn ô "Chi phí khác"
2. Nhập HH Gross = 100,000,000 → kiểm tra:
   - Thuế tạm nộp = 10,000,000 (10%)
   - Giảm trừ bản thân = 15,500,000
   - Các card hiển thị to, rõ
3. Thay đổi số NPT → card "Giảm trừ" mở rộng thêm dòng phụ thuộc
4. Card "Lợi nhuận" cuối cùng nổi bật với màu xanh (lãi) hoặc đỏ (lỗ)

## 💡 Điểm nhấn UI

- 📈 **Icon to** (10x10) cho card lớn
- 🎨 **Border 2px màu sắc** phân biệt loại (primary/warning/danger/success)
- 💪 **Font bold** cho label và số tiền của card lớn (text-base/text-xl)
- 🌈 **Background tint nhẹ** cho card lợi nhuận
- ✨ **Sparkles icon** cho lợi nhuận → cảm giác "kết quả cuối cùng"
