/**
 * Tính thuế TNCN cần nộp thêm theo NĂM (quyết toán cả năm)
 * 
 * Logic mới (luật VN 2026):
 * 1. Thu nhập Shopee: dùng YTD hiện tại (số thật, không dự báo)
 * 2. Lương công ty: monthly × 12 (cả năm)
 * 3. Giảm trừ: (15.5tr + 6.2tr × dependents) × 12
 * 4. Thu nhập tính thuế = max(0, Tổng TN - Tổng giảm trừ)
 * 5. Thuế phải nộp = áp bậc NĂM trực tiếp lên TNTT năm
 * 6. Thuế đã khấu trừ = (Công ty × 12) + Shopee đã KT
 * 7. Cần nộp thêm = Thuế phải nộp - Thuế đã khấu trừ
 * 
 * GIỮ TÊN HÀM CŨ `calculateYtdAdditionalTax` để không phá code khác đang gọi.
 * Tham số `monthsElapsed` được GIỮ NHƯNG BỎ QUA (always treat as 12).
 */
import {
  calculateTaxAnnualDirect,
  PERSONAL_DEDUCTION_MONTHLY,
  DEPENDENT_DEDUCTION_MONTHLY,
} from "./tax-calculator";

const MONTHS_PER_YEAR = 12;

export interface YtdTaxInput {
  // Số tháng đã qua trong năm (kept for backward compat, KHÔNG dùng để scale)
  monthsElapsed: number;
  // Lương trung bình tháng từ công ty (gross) — sẽ được nhân cho 12
  monthlySalaryGross: number;
  // Thuế công ty khấu trừ trung bình mỗi tháng — sẽ được nhân cho 12
  monthlySalaryTaxWithheld: number;
  // Tổng hoa hồng Shopee từ đầu năm (gross) — dùng số thật, không scale
  ytdShopeeGross: number;
  // Tổng thuế Shopee đã khấu trừ 10%
  ytdShopeeTaxWithheld: number;
  // Có được giảm trừ bản thân không
  hasPersonalDeduction: boolean;
  // Số người phụ thuộc
  dependentCount: number;
}

export interface YtdTaxResult {
  // Tổng năm (cho quyết toán)
  totalIncomeYtd: number;        // = lương 12 tháng + Shopee YTD
  totalDeductionYtd: number;     // = (15.5tr + 6.2tr × dep) × 12
  taxableIncomeYtd: number;      // = max(0, totalIncome - totalDeduction)

  // Phân tích thuế
  taxPayableYtd: number;          // = thuế áp bậc năm
  taxWithheldYtd: number;         // = lương KT × 12 + Shopee KT
  taxAdditional: number;          // > 0: phải nộp, < 0: được hoàn

  // Chi tiết để hiển thị/debug
  breakdown: {
    salaryGross: number;          // monthly × 12
    shopeeGross: number;          // ytdShopeeGross
    personalDeduction: number;    // 15.5tr × 12
    dependentDeduction: number;   // 6.2tr × dep × 12
    salaryTaxWithheld: number;    // monthly × 12
    shopeeTaxWithheld: number;
  };

  status: "owe" | "refund" | "even" | "no_data";
}

export function calculateYtdAdditionalTax(input: YtdTaxInput): YtdTaxResult {
  // ✨ Bỏ qua monthsElapsed, luôn tính cho cả năm (12 tháng)
  // Theo luật VN: cá nhân quyết toán theo năm
  const months = MONTHS_PER_YEAR;

  // 1. Tổng thu nhập NĂM
  const salaryGross = input.monthlySalaryGross * months;
  const shopeeGross = input.ytdShopeeGross;
  const totalIncomeYtd = salaryGross + shopeeGross;

  // 2. Tổng giảm trừ NĂM
  const personalDeduction = input.hasPersonalDeduction
    ? PERSONAL_DEDUCTION_MONTHLY * months
    : 0;
  const dependentDeduction =
    DEPENDENT_DEDUCTION_MONTHLY * input.dependentCount * months;
  const totalDeductionYtd = personalDeduction + dependentDeduction;

  // 3. Thu nhập tính thuế NĂM
  const taxableIncomeYtd = Math.max(0, totalIncomeYtd - totalDeductionYtd);

  // 4. ✨ Thuế phải nộp — áp BẬC NĂM trực tiếp (không chia/nhân tháng)
  const taxPayableYtd = calculateTaxAnnualDirect(taxableIncomeYtd);

  // 5. Thuế đã khấu trừ NĂM
  const salaryTaxWithheld = input.monthlySalaryTaxWithheld * months;
  const taxWithheldYtd = salaryTaxWithheld + input.ytdShopeeTaxWithheld;

  // 6. Số chênh lệch
  const taxAdditional = taxPayableYtd - taxWithheldYtd;

  // Status
  let status: YtdTaxResult["status"] = "even";
  if (totalIncomeYtd === 0) status = "no_data";
  else if (Math.abs(taxAdditional) < 1000) status = "even";
  else if (taxAdditional > 0) status = "owe";
  else status = "refund";

  return {
    totalIncomeYtd,
    totalDeductionYtd,
    taxableIncomeYtd,
    taxPayableYtd,
    taxWithheldYtd,
    taxAdditional,
    breakdown: {
      salaryGross,
      shopeeGross,
      personalDeduction,
      dependentDeduction,
      salaryTaxWithheld,
      shopeeTaxWithheld: input.ytdShopeeTaxWithheld,
    },
    status,
  };
}
