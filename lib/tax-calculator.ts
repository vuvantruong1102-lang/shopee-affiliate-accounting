/**
 * TÍNH THUẾ TNCN THEO LUẬT VIỆT NAM 2026
 * 
 * Căn cứ pháp lý:
 * - Luật Thuế TNCN 2025 (số 109/2025/QH15) — áp dụng từ kỳ tính thuế 2026
 * - Nghị quyết 110/2025/UBTVQH15 — điều chỉnh mức giảm trừ gia cảnh
 * 
 * Thay đổi quan trọng từ 01/01/2026:
 * - Biểu thuế: 7 bậc → 5 bậc (giãn cách rộng hơn)
 * - Giảm trừ bản thân: 11tr → 15.5tr/tháng (186tr/năm)
 * - Giảm trừ người phụ thuộc: 4.4tr → 6.2tr/tháng (74.4tr/năm)
 */

// ============================================================================
// HẰNG SỐ THEO LUẬT 2026
// ============================================================================
export const PERSONAL_DEDUCTION_MONTHLY = 15_500_000;
export const PERSONAL_DEDUCTION_YEARLY = 186_000_000;
export const DEPENDENT_DEDUCTION_MONTHLY = 6_200_000;
export const DEPENDENT_DEDUCTION_YEARLY = 74_400_000;

// Khấu trừ thuế vãng lai (không đổi theo luật mới)
export const VANG_LAI_TAX_RATE = 0.10;
export const VANG_LAI_THRESHOLD = 2_000_000;

// ============================================================================
// BIỂU THUẾ LŨY TIẾN 5 BẬC (LUẬT 2026)
// Theo Khoản 2, Điều 9 Luật Thuế TNCN 2025 (109/2025/QH15)
// ============================================================================
export const TAX_BRACKETS_MONTHLY = [
  { upTo: 10_000_000, rate: 0.05, base: 0 },
  { upTo: 30_000_000, rate: 0.10, base: 500_000 },        // 10tr×5%
  { upTo: 60_000_000, rate: 0.20, base: 2_500_000 },      // 500k + 20tr×10%
  { upTo: 100_000_000, rate: 0.30, base: 8_500_000 },     // 2.5tr + 30tr×20%
  { upTo: Infinity, rate: 0.35, base: 20_500_000 },       // 8.5tr + 40tr×30%
] as const;

// ============================================================================
// ✨ MỚI: BIỂU THUẾ LŨY TIẾN 5 BẬC THEO NĂM (= bậc tháng × 12)
// Dùng cho quyết toán cuối năm (luật VN: cá nhân quyết toán theo NĂM)
// ============================================================================
export const TAX_BRACKETS_ANNUAL = [
  { upTo: 120_000_000, rate: 0.05 },        // Đến 120tr
  { upTo: 360_000_000, rate: 0.10 },        // 120 - 360tr
  { upTo: 720_000_000, rate: 0.20 },        // 360 - 720tr
  { upTo: 1_200_000_000, rate: 0.30 },      // 720tr - 1.2 tỷ
  { upTo: Infinity, rate: 0.35 },           // Trên 1.2 tỷ
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

// ============================================================================
// TÍNH THUẾ THEO BIỂU LŨY TIẾN (cho 1 tháng) - giữ nguyên cho legacy
// ============================================================================
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

// ============================================================================
// ✨ MỚI: TÍNH THUẾ THEO BẬC NĂM (áp trực tiếp lên TNTT năm)
// Đây là cách quyết toán chuẩn của luật VN
// ============================================================================
export function calculateTaxAnnualDirect(taxableIncomeAnnual: number): number {
  if (taxableIncomeAnnual <= 0) return 0;
  let tax = 0;
  let remaining = taxableIncomeAnnual;
  let prevUpTo = 0;
  for (const bracket of TAX_BRACKETS_ANNUAL) {
    if (remaining <= 0) break;
    const bracketSize = bracket.upTo - prevUpTo;
    const taxableInBracket = Math.min(remaining, bracketSize);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
    prevUpTo = bracket.upTo;
  }
  return Math.round(tax);
}

// ============================================================================
// ✨ MỚI: Bracket breakdown theo NĂM (cho UI hiển thị bảng bậc)
// ============================================================================
export interface AnnualBracketDetail {
  bracketIndex: number;          // 1-5
  bracketRange: string;           // "Đến 120 triệu" / "120-360 triệu"
  rate: number;                   // 0.05, 0.10, ...
  bracketMin: number;
  bracketMax: number;
  incomeInBracket: number;        // Phần TNTT năm rơi vào bậc này
  taxInBracket: number;           // Thuế của bậc này
}

export function getAnnualBracketBreakdown(
  taxableIncomeAnnual: number,
): AnnualBracketDetail[] {
  const details: AnnualBracketDetail[] = [];
  let remaining = Math.max(0, taxableIncomeAnnual);
  let prevUpTo = 0;

  for (let i = 0; i < TAX_BRACKETS_ANNUAL.length; i++) {
    const bracket = TAX_BRACKETS_ANNUAL[i];
    const bracketSize = bracket.upTo - prevUpTo;
    const incomeInBracket = Math.min(remaining, bracketSize);
    const taxInBracket = incomeInBracket * bracket.rate;

    details.push({
      bracketIndex: i + 1,
      bracketRange:
        bracket.upTo === Infinity
          ? `Trên ${(prevUpTo / 1_000_000).toFixed(0)} triệu`
          : `${(prevUpTo / 1_000_000).toFixed(0)} - ${(bracket.upTo / 1_000_000).toFixed(0)} triệu`,
      rate: bracket.rate,
      bracketMin: prevUpTo,
      bracketMax: bracket.upTo,
      incomeInBracket: Math.round(incomeInBracket),
      taxInBracket: Math.round(taxInBracket),
    });

    remaining -= incomeInBracket;
    prevUpTo = bracket.upTo;
  }

  return details;
}

// ============================================================================
// TÍNH THUẾ CẢ NĂM (cho quyết toán) - giữ cho code cũ, nhưng đã cập nhật để
// dùng calculateTaxAnnualDirect thay vì calculateTaxMonthly × 12
// ============================================================================
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

  // ✨ Dùng bậc năm trực tiếp (không chia/nhân tháng)
  const taxPayable = calculateTaxAnnualDirect(taxableIncome);

  // Breakdown theo bậc năm
  const annualBreakdown = getAnnualBracketBreakdown(taxableIncome);
  const bracketDetails: TaxCalculationResult["bracketDetails"] =
    annualBreakdown.map((b) => ({
      bracketRange: b.bracketRange,
      rate: b.rate,
      incomeInBracket: b.incomeInBracket,
      taxInBracket: b.taxInBracket,
    }));

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

// ============================================================================
// KHẤU TRỪ THUẾ VÃNG LAI (10% cho thu nhập ≥ 2tr/lần)
// ============================================================================
export function calculateWithholdingTax(grossAmount: number): number {
  if (grossAmount < VANG_LAI_THRESHOLD) return 0;
  return Math.round(grossAmount * VANG_LAI_TAX_RATE);
}

export function calculateGrossFromNet(netAmount: number): {
  grossAmount: number;
  taxWithheld: number;
  hasWithholding: boolean;
} {
  if (netAmount <= 0) {
    return { grossAmount: 0, taxWithheld: 0, hasWithholding: false };
  }
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
