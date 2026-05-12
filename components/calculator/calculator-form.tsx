"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import {
  TrendingUp,
  Receipt,
  Wallet,
  Users,
  Megaphone,
  Coins,
  Info,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  PERSONAL_DEDUCTION_MONTHLY,
  DEPENDENT_DEDUCTION_MONTHLY,
  TAX_BRACKETS_MONTHLY,
  calculateTaxMonthly,
  VANG_LAI_TAX_RATE,
} from "@/lib/tax-calculator";

const DEFAULT_VALUES = {
  monthsCount: 1,
  hhGrossMonthly: 30_000_000,
  salaryGrossMonthly: 0,
  hasPersonalDeduction: true,
  dependentCount: 0,
  adsExpenseMonthly: 5_000_000,
  otherExpenseMonthly: 0,
};

export function CalculatorForm() {
  const [monthsCount, setMonthsCount] = useState(DEFAULT_VALUES.monthsCount);
  const [hhGrossMonthly, setHhGrossMonthly] = useState(DEFAULT_VALUES.hhGrossMonthly);
  const [salaryGrossMonthly, setSalaryGrossMonthly] = useState(DEFAULT_VALUES.salaryGrossMonthly);
  const [hasPersonalDeduction, setHasPersonalDeduction] = useState(DEFAULT_VALUES.hasPersonalDeduction);
  const [dependentCount, setDependentCount] = useState(DEFAULT_VALUES.dependentCount);
  const [adsExpenseMonthly, setAdsExpenseMonthly] = useState(DEFAULT_VALUES.adsExpenseMonthly);
  const [otherExpenseMonthly, setOtherExpenseMonthly] = useState(DEFAULT_VALUES.otherExpenseMonthly);

  function handleReset() {
    setMonthsCount(DEFAULT_VALUES.monthsCount);
    setHhGrossMonthly(DEFAULT_VALUES.hhGrossMonthly);
    setSalaryGrossMonthly(DEFAULT_VALUES.salaryGrossMonthly);
    setHasPersonalDeduction(DEFAULT_VALUES.hasPersonalDeduction);
    setDependentCount(DEFAULT_VALUES.dependentCount);
    setAdsExpenseMonthly(DEFAULT_VALUES.adsExpenseMonthly);
    setOtherExpenseMonthly(DEFAULT_VALUES.otherExpenseMonthly);
  }

  const calc = useMemo(() => {
    const months = monthsCount;

    // 1. Doanh thu
    const hhGross = hhGrossMonthly * months;
    const salaryGross = salaryGrossMonthly * months;
    const totalIncome = hhGross + salaryGross;

    // 2. Thuế tạm nộp 10% (vãng lai trên hoa hồng)
    const taxWithholding = Math.round(hhGross * VANG_LAI_TAX_RATE);
    const hhNet = hhGross - taxWithholding;

    // 3. Giảm trừ
    const personalDeduction = hasPersonalDeduction ? PERSONAL_DEDUCTION_MONTHLY * months : 0;
    const dependentDeduction = DEPENDENT_DEDUCTION_MONTHLY * dependentCount * months;
    const totalDeduction = personalDeduction + dependentDeduction;

    // 4. Thu nhập tính thuế (TNTT)
    const taxableIncome = Math.max(0, totalIncome - totalDeduction);
    const taxableMonthly = taxableIncome / months;

    // 5. Thuế phải nộp theo lũy tiến (tính cho 1 tháng × số tháng)
    const taxPerMonth = calculateTaxMonthly(taxableMonthly);
    const taxPayable = Math.round(taxPerMonth * months);

    // 6. Thuế còn phải nộp thêm (sau quyết toán)
    const taxAdditional = Math.max(0, taxPayable - taxWithholding);
    const taxRefund = Math.max(0, taxWithholding - taxPayable);

    // 7. Tổng số thuế thực sự phải nộp = max(taxPayable, taxWithholding)
    // Vì 10% đã nộp rồi nên nếu được hoàn thì giảm tổng đi
    const totalTaxFinal = taxPayable; // Số cuối cùng sau quyết toán

    // 8. Chi phí và lợi nhuận
    const adsExpense = adsExpenseMonthly * months;
    const otherExpense = otherExpenseMonthly * months;
    const totalExpense = adsExpense + otherExpense;

    // Lợi nhuận = Doanh thu net - chi phí - thuế còn phải nộp thêm
    // (hhNet đã trừ 10%, cần trừ thêm phần thuế nộp thêm)
    const profit = hhNet + salaryGross - totalExpense - taxAdditional;

    // 9. Bracket details (cho bảng bên phải)
    const brackets: Array<{
      label: string;
      rate: number;
      incomeInBracket: number;
      taxInBracket: number;
    }> = [];
    let remaining = taxableMonthly;
    let prevUpTo = 0;
    for (const b of TAX_BRACKETS_MONTHLY) {
      if (remaining <= 0) break;
      const bracketSize = b.upTo - prevUpTo;
      const incomeInBracket = Math.min(remaining, bracketSize);
      const taxInBracket = incomeInBracket * b.rate;
      brackets.push({
        label:
          b.upTo === Infinity
            ? `Trên ${(prevUpTo / 1_000_000).toFixed(0)}tr`
            : prevUpTo === 0
              ? `Đến ${(b.upTo / 1_000_000).toFixed(0)}tr`
              : `${(prevUpTo / 1_000_000).toFixed(0)} - ${(b.upTo / 1_000_000).toFixed(0)}tr`,
        rate: b.rate,
        incomeInBracket: Math.round(incomeInBracket * months),
        taxInBracket: Math.round(taxInBracket * months),
      });
      remaining -= incomeInBracket;
      prevUpTo = b.upTo;
    }

    return {
      months,
      hhGross,
      hhNet,
      salaryGross,
      totalIncome,
      taxWithholding,
      taxAdditional,
      taxRefund,
      taxPayable,
      totalTaxFinal,
      personalDeduction,
      dependentDeduction,
      totalDeduction,
      taxableIncome,
      taxableMonthly,
      adsExpense,
      otherExpense,
      totalExpense,
      profit,
      brackets,
    };
  }, [
    monthsCount,
    hhGrossMonthly,
    salaryGrossMonthly,
    hasPersonalDeduction,
    dependentCount,
    adsExpenseMonthly,
    otherExpenseMonthly,
  ]);

  // Tỷ lệ % trên hoa hồng gross (mẫu số chính)
  function pct(value: number): string {
    if (calc.hhGross === 0) return "—";
    return `${((value / calc.hhGross) * 100).toFixed(1)}%`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* CỘT TRÁI: Form input + Kết quả tổng quan (3/5) */}
      <div className="lg:col-span-3 space-y-6">
        {/* Form input */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Nhập thông số ước tính</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nhập số liệu trung bình hàng tháng. Hệ thống sẽ nhân với số tháng để ước tính.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Phạm vi tính toán</Label>
              <select
                value={monthsCount}
                onChange={(e) => setMonthsCount(parseInt(e.target.value))}
                className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value={1}>1 tháng</option>
                <option value={3}>3 tháng (1 quý)</option>
                <option value={6}>6 tháng (nửa năm)</option>
                <option value={12}>12 tháng (cả năm)</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">
                  Hoa hồng Gross / tháng
                </Label>
                <CurrencyInput value={hhGrossMonthly} onChange={setHhGrossMonthly} />
                <p className="text-xs text-muted-foreground mt-1">
                  Trung bình Shopee chuyển mỗi tháng
                </p>
              </div>
              <div>
                <Label className="mb-1.5 block">Lương công ty / tháng</Label>
                <CurrencyInput value={salaryGrossMonthly} onChange={setSalaryGrossMonthly} />
                <p className="text-xs text-muted-foreground mt-1">
                  Để 0 nếu không có lương khác
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Chi phí Facebook Ads / tháng</Label>
                <CurrencyInput value={adsExpenseMonthly} onChange={setAdsExpenseMonthly} />
              </div>
              <div>
                <Label className="mb-1.5 block">Chi phí khác / tháng</Label>
                <CurrencyInput value={otherExpenseMonthly} onChange={setOtherExpenseMonthly} />
                <p className="text-xs text-muted-foreground mt-1">
                  Vận hành, lương NV, văn phòng phẩm...
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/40">
              <input
                type="checkbox"
                id="has_personal"
                checked={hasPersonalDeduction}
                onChange={(e) => setHasPersonalDeduction(e.target.checked)}
                className="mt-0.5 w-4 h-4"
              />
              <label htmlFor="has_personal" className="cursor-pointer flex-1 text-sm">
                Có giảm trừ bản thân ({formatCurrency(PERSONAL_DEDUCTION_MONTHLY)}/tháng)
              </label>
            </div>

            <div>
              <Label className="mb-1.5 block">Số người phụ thuộc</Label>
              <Input
                type="number"
                min="0"
                max="20"
                value={dependentCount}
                onChange={(e) => setDependentCount(parseInt(e.target.value) || 0)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mỗi người được giảm trừ {formatCurrency(DEPENDENT_DEDUCTION_MONTHLY)}/tháng
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Kết quả tổng quan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Kết quả ước tính cho {monthsCount} tháng
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left font-medium px-6 py-2.5">Hạng mục</th>
                  <th className="text-right font-medium px-6 py-2.5">Số tiền</th>
                  <th className="text-right font-medium px-6 py-2.5 w-20">% / HH</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="DOANH THU" />
                <Row
                  icon={TrendingUp}
                  label="Hoa hồng Gross"
                  value={calc.hhGross}
                  pct="100%"
                  bold
                />
                <Row
                  label="Thuế tạm nộp 10% (vãng lai)"
                  value={-calc.taxWithholding}
                  pct={pct(calc.taxWithholding)}
                  indent
                  muted
                />
                <Row
                  icon={Wallet}
                  label="Hoa hồng Net (thực nhận)"
                  value={calc.hhNet}
                  pct={pct(calc.hhNet)}
                  bold
                  variant="success"
                />
                {calc.salaryGross > 0 && (
                  <Row
                    label="Lương công ty"
                    value={calc.salaryGross}
                    pct={pct(calc.salaryGross)}
                  />
                )}

                <SectionHeader label="GIẢM TRỪ" />
                {hasPersonalDeduction && (
                  <Row
                    label={`Giảm trừ bản thân (${monthsCount} tháng)`}
                    value={calc.personalDeduction}
                    pct={pct(calc.personalDeduction)}
                    muted
                  />
                )}
                {dependentCount > 0 && (
                  <Row
                    icon={Users}
                    label={`Giảm trừ ${dependentCount} người phụ thuộc`}
                    value={calc.dependentDeduction}
                    pct={pct(calc.dependentDeduction)}
                    muted
                  />
                )}
                <Row
                  label="Tổng giảm trừ"
                  value={calc.totalDeduction}
                  pct={pct(calc.totalDeduction)}
                  bold
                />

                <SectionHeader label="THUẾ TNCN" />
                <Row
                  icon={Receipt}
                  label="Thuế tạm nộp (đã KT 10%)"
                  value={calc.taxWithholding}
                  pct={pct(calc.taxWithholding)}
                />
                {calc.taxAdditional > 0 && (
                  <Row
                    label="Thuế còn phải nộp thêm (quyết toán)"
                    value={calc.taxAdditional}
                    pct={pct(calc.taxAdditional)}
                    variant="warning"
                  />
                )}
                {calc.taxRefund > 0 && (
                  <Row
                    label="Được hoàn thuế (quyết toán)"
                    value={-calc.taxRefund}
                    pct={pct(calc.taxRefund)}
                    variant="success"
                  />
                )}
                <Row
                  label="Tổng thuế phải nộp"
                  value={calc.taxPayable}
                  pct={pct(calc.taxPayable)}
                  bold
                />

                <SectionHeader label="CHI PHÍ" />
                {calc.adsExpense > 0 && (
                  <Row
                    icon={Megaphone}
                    label="Chi phí Facebook Ads"
                    value={calc.adsExpense}
                    pct={pct(calc.adsExpense)}
                    muted
                  />
                )}
                {calc.otherExpense > 0 && (
                  <Row label="Chi phí khác" value={calc.otherExpense} pct={pct(calc.otherExpense)} muted />
                )}
                <Row
                  label="Tổng chi phí"
                  value={calc.totalExpense}
                  pct={pct(calc.totalExpense)}
                  bold
                />

                <SectionHeader label="LỢI NHUẬN" />
                <ProfitRow profit={calc.profit} pctText={pct(calc.profit)} />
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Note */}
        <div className="flex items-start gap-3 p-4 rounded-md bg-muted/40 text-xs text-muted-foreground">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Lưu ý về cách tính</p>
            <p>
              • <strong>Hoa hồng Net</strong> = Gross − 10% thuế tạm nộp (theo TT 111/2013)
            </p>
            <p>
              • <strong>Thuế phải nộp</strong> tính theo lũy tiến 5 bậc (Luật 109/2025) trên thu nhập tính thuế
            </p>
            <p>
              • <strong>Lợi nhuận</strong> = Hoa hồng Net + Lương − Chi phí − Thuế nộp thêm (nếu có)
            </p>
            <p>
              • Đây là ước tính sơ bộ. Số liệu thực có thể khác do BHXH, phụ cấp, các khoản miễn thuế khác...
            </p>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: Chi tiết thuế theo bậc (2/5) */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-warning" />
              Thuế theo từng bậc
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Biểu lũy tiến 5 bậc - Luật 2026
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-0">
            <div className="px-6 pb-3 border-b border-border">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Thu nhập tính thuế:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(calc.taxableIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">TB/tháng:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(calc.taxableMonthly)}
                </span>
              </div>
            </div>

            {calc.taxableIncome === 0 ? (
              <div className="px-6 py-4 text-center text-sm text-muted-foreground">
                Thu nhập sau giảm trừ ≤ 0, không phát sinh thuế.
              </div>
            ) : (
              <div className="px-6">
                {calc.brackets.map((b, i) => {
                  const totalTax = calc.taxPayable;
                  const pctOfTotal =
                    totalTax > 0 ? ((b.taxInBracket / totalTax) * 100).toFixed(0) : "0";
                  return (
                    <div
                      key={i}
                      className="py-2.5 border-b border-border last:border-0"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Bậc {i + 1}
                          </span>
                          <span className="text-xs font-medium">{b.label}</span>
                          <span className="text-xs text-muted-foreground">
                            × {(b.rate * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs ml-1">
                        <span className="text-muted-foreground tabular-nums">
                          TN: {formatCurrency(b.incomeInBracket)}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(b.taxInBracket)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pctOfTotal}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="px-6 pt-3 pb-1 border-t-2 border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Tổng thuế</span>
                <span className="text-base font-bold tabular-nums">
                  {formatCurrency(calc.taxPayable)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                <span>Trong đó đã KT 10%:</span>
                <span className="tabular-nums">
                  -{formatCurrency(calc.taxWithholding)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-border">
                <span className="font-medium">
                  {calc.taxAdditional > 0
                    ? "Còn phải nộp thêm"
                    : calc.taxRefund > 0
                      ? "Được hoàn"
                      : "Đã đóng đủ"}
                </span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    calc.taxAdditional > 0 && "text-warning",
                    calc.taxRefund > 0 && "text-success",
                  )}
                >
                  {calc.taxAdditional > 0 && formatCurrency(calc.taxAdditional)}
                  {calc.taxRefund > 0 && `+${formatCurrency(calc.taxRefund)}`}
                  {calc.taxAdditional === 0 && calc.taxRefund === 0 && "0đ"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================
function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="border-b border-border bg-muted/30">
      <td colSpan={3} className="px-6 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  pct,
  bold,
  indent,
  muted,
  variant,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  pct: string;
  bold?: boolean;
  indent?: boolean;
  muted?: boolean;
  variant?: "success" | "warning" | "danger";
}) {
  const variantColor = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };
  const valueClass = variant ? variantColor[variant] : "";
  const labelClass = muted ? "text-muted-foreground" : "";
  const sign = value < 0 ? "" : "";

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40">
      <td className={cn("px-6 py-2.5", indent && "pl-12", bold && "font-semibold", labelClass)}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
          <span>{label}</span>
        </div>
      </td>
      <td
        className={cn(
          "px-6 py-2.5 text-right tabular-nums",
          bold && "font-semibold",
          valueClass,
        )}
      >
        {sign}
        {formatCurrency(value)}
      </td>
      <td className="px-6 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
        {pct}
      </td>
    </tr>
  );
}

function ProfitRow({ profit, pctText }: { profit: number; pctText: string }) {
  const isProfit = profit >= 0;
  return (
    <tr className="border-t-2 border-border bg-muted/30">
      <td className="px-6 py-3.5 font-bold text-base">
        {isProfit ? "Lợi nhuận" : "Lỗ"}
      </td>
      <td
        className={cn(
          "px-6 py-3.5 text-right tabular-nums font-bold text-lg",
          isProfit ? "text-success" : "text-destructive",
        )}
      >
        {isProfit ? "+" : ""}
        {formatCurrency(profit)}
      </td>
      <td className="px-6 py-3.5 text-right tabular-nums text-xs font-medium">
        {pctText}
      </td>
    </tr>
  );
}
