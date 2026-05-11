/**
 * TÍNH THUẾ TNCN THEO LUẬT VIỆT NAM
 * 
 * Tham chiếu:
 * - Luật Thuế TNCN 04/2007/QH12 và sửa đổi
 * - Thông tư 111/2013/TT-BTC
 * - Nghị quyết 954/2020/UBTVQH14 (mức giảm trừ gia cảnh)
 * 
 * Áp dụng cho phần mềm: Shopee đã khấu trừ 10% tại nguồn (thu nhập vãng lai).
 */

export const PERSONAL_DEDUCTION_MONTHLY = 11_000_000;
export const PERSONAL_DEDUCTION_YEARLY = 132_000_000;
export const DEPENDENT_DEDUCTION_MONTHLY = 4_400_000;
export const DEPENDENT_DEDUCTION_YEARLY = 52_800_000;
export const VANG_LAI_TAX_RATE = 0.10;
export const VANG_LAI_THRESHOLD = 2_000_000;

export const TAX_BRACKETS_MONTHLY = [
  { upTo: 5_000_000, rate: 0.05, base: 0 },
  { upTo: 10_000_000, rate: 0.10, base: 250_000 },
  { upTo: 18_000_000, rate: 0.15, base: 750_000 },
  { upTo: 32_000_000, rate: 0.20, base: 1_950_000 },
  { upTo: 52_000_000, rate: 0.25, base: 4_750_000 },
  { upTo: 80_000_000, rate: 0.30, base: 9_750_000 },
  { upTo: Infinity, rate: 0.35, base: 18_150_000 },
] as const;

export interface TaxCalculationInput {
  grossIncome: number;
  dependents: number;
  months?: number;
  taxAlreadyWithheld?: number;
}

export interface TaxCalculationResult {
  grossIncome: number;
  personalDeduction: number;
  dependentDeduction: number;
  totalDeduction: number;
  taxableIncome: number;
  taxPayable: number;
  taxAlreadyWithheld: number;
  taxDifference: number;
  bracketDetails: Array<{
    bracketRange: string;
    rate: number;
    incomeInBracket: number;
    taxInBracket: number;
  }>;
}

export function calculateTaxMonthly(taxableIncomeMonthly: number): number {
  if (taxableIncomeMonthly <= 0) return 0;
  let tax = 0;
  let remaining = taxableIncomeMonthly;
  let prevUpTo = 0;
  for (const bracket of TAX_BRACKETS_MONTHLY) {
    if (remaining <= 0) break;
    const bracketSize = bracket.upTo - prevUpTo;
    const taxableInBracket = Math.min(remaining, bracketSize);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
    prevUpTo = bracket.upTo;
  }
  return Math.round(tax);
}

export function calculateAnnualTax(
  input: TaxCalculationInput,
): TaxCalculationResult {
  const months = input.months ?? 12;
  const grossIncome = input.grossIncome;
  const personalDeduction = PERSONAL_DEDUCTION_MONTHLY * months;
  const dependentDeduction =
    DEPENDENT_DEDUCTION_MONTHLY * input.dependents * months;
  const totalDeduction = personalDeduction + dependentDeduction;
  const taxableIncome = Math.max(0, grossIncome - totalDeduction);
  const taxableIncomeMonthly = taxableIncome / months;
  const taxPerMonth = calculateTaxMonthly(taxableIncomeMonthly);
  const taxPayable = Math.round(taxPerMonth * months);

  const bracketDetails: TaxCalculationResult["bracketDetails"] = [];
  let remaining = taxableIncomeMonthly;
  let prevUpTo = 0;
  for (const bracket of TAX_BRACKETS_MONTHLY) {
    if (remaining <= 0) break;
    const bracketSize = bracket.upTo - prevUpTo;
    const incomeInBracketMonthly = Math.min(remaining, bracketSize);
    const taxInBracketMonthly = incomeInBracketMonthly * bracket.rate;
    bracketDetails.push({
      bracketRange:
        bracket.upTo === Infinity
          ? `Trên ${(prevUpTo / 1_000_000).toFixed(0)} triệu`
          : `${(prevUpTo / 1_000_000).toFixed(0)} - ${(bracket.upTo / 1_000_000).toFixed(0)} triệu`,
      rate: bracket.rate,
      incomeInBracket: Math.round(incomeInBracketMonthly * months),
      taxInBracket: Math.round(taxInBracketMonthly * months),
    });
    remaining -= incomeInBracketMonthly;
    prevUpTo = bracket.upTo;
  }

  const taxAlreadyWithheld = input.taxAlreadyWithheld ?? 0;
  const taxDifference = taxPayable - taxAlreadyWithheld;

  return {
    grossIncome,
    personalDeduction,
    dependentDeduction,
    totalDeduction,
    taxableIncome,
    taxPayable,
    taxAlreadyWithheld,
    taxDifference,
    bracketDetails,
  };
}

export function calculateWithholdingTax(grossAmount: number): number {
  if (grossAmount < VANG_LAI_THRESHOLD) return 0;
  return Math.round(grossAmount * VANG_LAI_TAX_RATE);
}

/**
 * Tính ngược từ NET → GROSS + TAX
 * 
 * Logic:
 * - Nếu net đủ lớn (net ≥ 1.8tr, tức gross ≥ 2tr) → có khấu trừ 10%
 *   gross = net / 0.9, tax = gross - net = net / 9
 * - Nếu nhỏ hơn → không khấu trừ, gross = net, tax = 0
 */
export function calculateGrossFromNet(netAmount: number): {
  grossAmount: number;
  taxWithheld: number;
  hasWithholding: boolean;
} {
  if (netAmount <= 0) {
    return { grossAmount: 0, taxWithheld: 0, hasWithholding: false };
  }

  // Ngưỡng net = 1.8tr (vì gross 2tr → net 1.8tr sau khấu trừ 10%)
  const NET_THRESHOLD = VANG_LAI_THRESHOLD * (1 - VANG_LAI_TAX_RATE);

  if (netAmount < NET_THRESHOLD) {
    return {
      grossAmount: netAmount,
      taxWithheld: 0,
      hasWithholding: false,
    };
  }

  const grossAmount = Math.round(netAmount / (1 - VANG_LAI_TAX_RATE));
  const taxWithheld = grossAmount - netAmount;

  return {
    grossAmount,
    taxWithheld,
    hasWithholding: true,
  };
}

/**
 * Tính từ GROSS → TAX + NET (ngược chiều với hàm trên)
 */
export function calculateNetFromGross(grossAmount: number): {
  netAmount: number;
  taxWithheld: number;
  hasWithholding: boolean;
} {
  const taxWithheld = calculateWithholdingTax(grossAmount);
  return {
    netAmount: grossAmount - taxWithheld,
    taxWithheld,
    hasWithholding: taxWithheld > 0,
  };
}

export function formatTaxDifference(diff: number): {
  text: string;
  status: "owe" | "refund" | "even";
} {
  if (Math.abs(diff) < 1000) return { text: "Đã đóng đủ", status: "even" };
  if (diff > 0) return { text: "Phải nộp thêm", status: "owe" };
  return { text: "Được hoàn", status: "refund" };
}
