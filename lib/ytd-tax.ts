/**
 * Tính thuế TNCN cần nộp thêm theo Year-To-Date
 * 
 * Logic:
 * 1. Tổng thu nhập YTD = (Lương tháng × số tháng đã qua) + (Hoa hồng Shopee gross YTD)
 * 2. Tổng giảm trừ YTD = (Bản thân + người phụ thuộc) × số tháng đã qua
 * 3. Thu nhập chịu thuế = max(0, Tổng TN - Tổng giảm trừ)
 * 4. Thuế phải nộp YTD = tính lũy tiến theo bậc (dùng thu nhập chịu thuế bình quân tháng × số tháng)
 * 5. Thuế đã khấu trừ YTD = (Công ty khấu trừ × số tháng) + (Shopee khấu trừ 10% YTD)
 * 6. Thuế cần nộp thêm = Thuế phải nộp - Thuế đã khấu trừ
 */

import {
  calculateTaxMonthly,
  PERSONAL_DEDUCTION_MONTHLY,
  DEPENDENT_DEDUCTION_MONTHLY,
} from "./tax-calculator";

export interface YtdTaxInput {
  // Số tháng đã qua trong năm (1-12)
  monthsElapsed: number;
  // Lương trung bình tháng từ công ty (gross)
  monthlySalaryGross: number;
  // Thuế công ty khấu trừ trung bình mỗi tháng
  monthlySalaryTaxWithheld: number;
  // Tổng hoa hồng Shopee từ đầu năm (gross)
  ytdShopeeGross: number;
  // Tổng thuế Shopee đã khấu trừ 10%
  ytdShopeeTaxWithheld: number;
  // Có được giảm trừ bản thân không
  hasPersonalDeduction: boolean;
  // Số người phụ thuộc
  dependentCount: number;
}

export interface YtdTaxResult {
  // Year-to-date breakdown
  totalIncomeYtd: number;
  totalDeductionYtd: number;
  taxableIncomeYtd: number;
  
  // Phân tích thuế
  taxPayableYtd: number;
  taxWithheldYtd: number;
  taxAdditional: number; // > 0: phải nộp thêm, < 0: được hoàn
  
  // Chi tiết để debug/hiển thị
  breakdown: {
    salaryGross: number;
    shopeeGross: number;
    personalDeduction: number;
    dependentDeduction: number;
    salaryTaxWithheld: number;
    shopeeTaxWithheld: number;
  };
  
  status: "owe" | "refund" | "even" | "no_data";
}

export function calculateYtdAdditionalTax(input: YtdTaxInput): YtdTaxResult {
  const months = Math.max(1, Math.min(12, input.monthsElapsed));

  // 1. Tổng thu nhập YTD
  const salaryGross = input.monthlySalaryGross * months;
  const shopeeGross = input.ytdShopeeGross;
  const totalIncomeYtd = salaryGross + shopeeGross;

  // 2. Tổng giảm trừ YTD
  const personalDeduction = input.hasPersonalDeduction
    ? PERSONAL_DEDUCTION_MONTHLY * months
    : 0;
  const dependentDeduction =
    DEPENDENT_DEDUCTION_MONTHLY * input.dependentCount * months;
  const totalDeductionYtd = personalDeduction + dependentDeduction;

  // 3. Thu nhập chịu thuế
  const taxableIncomeYtd = Math.max(0, totalIncomeYtd - totalDeductionYtd);

  // 4. Thuế phải nộp YTD (theo công thức bình quân tháng × số tháng)
  const taxableIncomeMonthly = taxableIncomeYtd / months;
  const taxPerMonth = calculateTaxMonthly(taxableIncomeMonthly);
  const taxPayableYtd = Math.round(taxPerMonth * months);

  // 5. Thuế đã khấu trừ YTD
  const salaryTaxWithheld = input.monthlySalaryTaxWithheld * months;
  const taxWithheldYtd = salaryTaxWithheld + input.ytdShopeeTaxWithheld;

  // 6. Số chênh lệch
  const taxAdditional = taxPayableYtd - taxWithheldYtd;

  // Xác định status
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
