/**
 * TÍNH THUẾ TNCN THEO LUẬT VIỆT NAM
 * 
 * Tham chiếu:
 * - Luật Thuế TNCN 04/2007/QH12 và sửa đổi
 * - Thông tư 111/2013/TT-BTC
 * - Nghị quyết 954/2020/UBTVQH14 (mức giảm trừ gia cảnh)
 * 
 * Áp dụng cho phần mềm: Shopee đã khấu trừ 10% tại nguồn (thu nhập vãng lai).
 * Cuối năm cá nhân quyết toán bằng cách:
 *   1. Tổng hợp tổng thu nhập gross cả năm
 *   2. Tính theo biểu lũy tiến 7 bậc (sau khi trừ giảm trừ gia cảnh)
 *   3. So sánh với tổng 10% đã khấu trừ → nộp thêm hoặc được hoàn
 */

// ============================================================================
// HẰNG SỐ
// ============================================================================

/** Giảm trừ bản thân: 11 triệu/tháng = 132 triệu/năm */
export const PERSONAL_DEDUCTION_MONTHLY = 11_000_000;
export const PERSONAL_DEDUCTION_YEARLY = 132_000_000;

/** Giảm trừ người phụ thuộc: 4.4 triệu/tháng/người = 52.8 triệu/năm/người */
export const DEPENDENT_DEDUCTION_MONTHLY = 4_400_000;
export const DEPENDENT_DEDUCTION_YEARLY = 52_800_000;

/** Tỷ lệ khấu trừ thu nhập vãng lai: 10% nếu ≥ 2tr/lần */
export const VANG_LAI_TAX_RATE = 0.10;
export const VANG_LAI_THRESHOLD = 2_000_000;

/**
 * Biểu thuế lũy tiến 7 bậc - áp dụng cho thu nhập TÍNH THEO NĂM (chia 12).
 * Bậc thuế trên thu nhập tính thuế tháng (sau khi đã trừ giảm trừ gia cảnh).
 */
export const TAX_BRACKETS_MONTHLY = [
  { upTo: 5_000_000, rate: 0.05, base: 0 },
  { upTo: 10_000_000, rate: 0.10, base: 250_000 },
  { upTo: 18_000_000, rate: 0.15, base: 750_000 },
  { upTo: 32_000_000, rate: 0.20, base: 1_950_000 },
  { upTo: 52_000_000, rate: 0.25, base: 4_750_000 },
  { upTo: 80_000_000, rate: 0.30, base: 9_750_000 },
  { upTo: Infinity, rate: 0.35, base: 18_150_000 },
] as const;

/** Biểu thuế quy đổi sang NĂM (nhân 12 tất cả mức) */
export const TAX_BRACKETS_YEARLY = TAX_BRACKETS_MONTHLY.map((b) => ({
  upTo: b.upTo === Infinity ? Infinity : b.upTo * 12,
  rate: b.rate,
  base: b.base * 12,
}));

// ============================================================================
// TYPES
// ============================================================================

export interface TaxCalculationInput {
  /** Tổng thu nhập gross cả năm (trước thuế, trước giảm trừ) */
  grossIncome: number;
  /** Số người phụ thuộc */
  dependents: number;
  /** Số tháng được tính giảm trừ (mặc định 12) */
  months?: number;
  /** Tổng số tiền thuế Shopee đã khấu trừ 10% */
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
  /** Dương = phải nộp thêm, Âm = được hoàn */
  taxDifference: number;
  /** Chi tiết từng bậc thuế */
  bracketDetails: Array<{
    bracketRange: string;
    rate: number;
    incomeInBracket: number;
    taxInBracket: number;
  }>;
}

// ============================================================================
// HÀM TÍNH CHÍNH
// ============================================================================

/**
 * Tính thuế TNCN cho thu nhập tính thuế tháng (đã trừ giảm trừ gia cảnh).
 * Dùng biểu lũy tiến 7 bậc theo tháng.
 */
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

/**
 * Tính thuế TNCN cho cả năm - quyết toán cuối năm.
 * Đây là hàm dùng chính trong phần mềm.
 */
export function calculateAnnualTax(
  input: TaxCalculationInput,
): TaxCalculationResult {
  const months = input.months ?? 12;
  const grossIncome = input.grossIncome;

  // Giảm trừ gia cảnh
  const personalDeduction = PERSONAL_DEDUCTION_MONTHLY * months;
  const dependentDeduction =
    DEPENDENT_DEDUCTION_MONTHLY * input.dependents * months;
  const totalDeduction = personalDeduction + dependentDeduction;

  // Thu nhập tính thuế = Gross - Giảm trừ
  const taxableIncome = Math.max(0, grossIncome - totalDeduction);

  // Tính theo lũy tiến tháng (chia trung bình ra tháng)
  const taxableIncomeMonthly = taxableIncome / months;
  const taxPerMonth = calculateTaxMonthly(taxableIncomeMonthly);
  const taxPayable = Math.round(taxPerMonth * months);

  // Chi tiết từng bậc thuế
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

/**
 * Tính số thuế Shopee phải khấu trừ cho 1 đợt hoa hồng.
 * Theo TT 111: nếu ≥ 2tr/lần → khấu trừ 10%
 */
export function calculateWithholdingTax(grossAmount: number): number {
  if (grossAmount < VANG_LAI_THRESHOLD) return 0;
  return Math.round(grossAmount * VANG_LAI_TAX_RATE);
}

/**
 * Format mô tả số thuế phải nộp thêm / được hoàn.
 */
export function formatTaxDifference(diff: number): {
  text: string;
  status: "owe" | "refund" | "even";
} {
  if (Math.abs(diff) < 1000) {
    return { text: "Đã đóng đủ", status: "even" };
  }
  if (diff > 0) {
    return { text: `Phải nộp thêm`, status: "owe" };
  }
  return { text: `Được hoàn`, status: "refund" };
}
