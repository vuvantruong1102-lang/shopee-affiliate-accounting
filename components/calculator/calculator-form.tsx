"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import {
  TrendingUp,
  Receipt,
  Megaphone,
  Coins,
  Info,
  RotateCcw,
  Sparkles,
  Wallet,
  MinusCircle,
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
  hhGross: 30_000_000,
  salaryGross: 0,
  adsExpense: 5_000_000,
  deduction: PERSONAL_DEDUCTION_MONTHLY, // mặc định = giảm trừ bản thân
};

export function CalculatorForm() {
  const [hhGross, setHhGross] = useState(DEFAULT_VALUES.hhGross);
  const [salaryGross, setSalaryGross] = useState(DEFAULT_VALUES.salaryGross);
  const [adsExpense, setAdsExpense] = useState(DEFAULT_VALUES.adsExpense);
  const [deduction, setDeduction] = useState(DEFAULT_VALUES.deduction);

  function handleReset() {
    setHhGross(DEFAULT_VALUES.hhGross);
    setSalaryGross(DEFAULT_VALUES.salaryGross);
    setAdsExpense(DEFAULT_VALUES.adsExpense);
    setDeduction(DEFAULT_VALUES.deduction);
  }

  const calc = useMemo(() => {
    const totalIncome = hhGross + salaryGross;
    const taxWithholding = Math.round(hhGross * VANG_LAI_TAX_RATE);
    const hhNet = hhGross - taxWithholding;
    const taxableIncome = Math.max(0, totalIncome - deduction);
    const taxPayable = calculateTaxMonthly(taxableIncome);
    const taxAdditional = Math.max(0, taxPayable - taxWithholding);
    const taxRefund = Math.max(0, taxWithholding - taxPayable);
    const profit = hhNet + salaryGross - adsExpense - taxAdditional;

    // % so với hoa hồng gross (làm mẫu số chính)
    const base = hhGross > 0 ? hhGross : 1;
    const pct = (v: number) => ((v / base) * 100).toFixed(1) + "%";

    // Bracket details
    const brackets: Array<{
      label: string;
      rate: number;
      incomeInBracket: number;
      taxInBracket: number;
    }> = [];
    let remaining = taxableIncome;
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
        incomeInBracket: Math.round(incomeInBracket),
        taxInBracket: Math.round(taxInBracket),
      });
      remaining -= incomeInBracket;
      prevUpTo = b.upTo;
    }

    return {
      hhGross,
      hhNet,
      salaryGross,
      totalIncome,
      taxWithholding,
      taxAdditional,
      taxRefund,
      taxPayable,
      deduction,
      taxableIncome,
      adsExpense,
      profit,
      brackets,
      pct,
    };
  }, [hhGross, salaryGross, adsExpense, deduction]);

  return (
    <div className="space-y-6">
      {/* HÀNG TRÊN: 2 cột - Form bên trái, Kết quả bên phải */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ============== CỘT TRÁI: FORM ============== */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Nhập thông số</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nhập số liệu để ước tính nhanh thuế và lợi nhuận
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormRow label="Hoa hồng Gross">
              <CurrencyInput value={hhGross} onChange={setHhGross} className="text-lg font-semibold tabular-nums" />
            </FormRow>

            <FormRow label="Lương" hint="Để 0 nếu không có">
              <CurrencyInput value={salaryGross} onChange={setSalaryGross} className="text-lg font-semibold tabular-nums" />
            </FormRow>

            <FormRow
              label="Giảm trừ gia cảnh"
              hint={`Mặc định: ${formatCurrency(PERSONAL_DEDUCTION_MONTHLY)} (bản thân). Mỗi NPT thêm ${formatCurrency(DEPENDENT_DEDUCTION_MONTHLY)}`}
            >
              <CurrencyInput value={deduction} onChange={setDeduction} className="text-lg font-semibold tabular-nums" />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Nhanh:</span>
                <QuickButton
                  label="Bản thân"
                  value={PERSONAL_DEDUCTION_MONTHLY}
                  current={deduction}
                  onClick={setDeduction}
                />
                <QuickButton
                  label="BT + 1 NPT"
                  value={PERSONAL_DEDUCTION_MONTHLY + DEPENDENT_DEDUCTION_MONTHLY}
                  current={deduction}
                  onClick={setDeduction}
                />
                <QuickButton
                  label="BT + 2 NPT"
                  value={PERSONAL_DEDUCTION_MONTHLY + DEPENDENT_DEDUCTION_MONTHLY * 2}
                  current={deduction}
                  onClick={setDeduction}
                />
                <QuickButton
                  label="BT + 3 NPT"
                  value={PERSONAL_DEDUCTION_MONTHLY + DEPENDENT_DEDUCTION_MONTHLY * 3}
                  current={deduction}
                  onClick={setDeduction}
                />
              </div>
            </FormRow>

            <FormRow label="Chi phí Facebook Ads">
              <CurrencyInput value={adsExpense} onChange={setAdsExpense} className="text-lg font-semibold tabular-nums" />
            </FormRow>
          </CardContent>
        </Card>

        {/* ============== CỘT PHẢI: KẾT QUẢ ============== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Kết quả ước tính
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {/* Hoa hồng Gross - PRIMARY */}
            <MainRow
              icon={TrendingUp}
              label="Hoa hồng Gross"
              value={calc.hhGross}
              pct="100.0%"
              variant="primary"
            />

            {/* Lương - hiển thị nếu > 0 */}
            {calc.salaryGross > 0 && (
              <MainRow
                icon={Wallet}
                label="Lương"
                value={calc.salaryGross}
                pct={calc.pct(calc.salaryGross)}
                variant="info"
              />
            )}

            {/* Giảm trừ - default neutral */}
            <MainRow
              icon={MinusCircle}
              label="Giảm trừ"
              value={calc.deduction}
              pct={calc.pct(calc.deduction)}
              variant="neutral"
              isDeduction
            />

            {/* Thuế phải nộp - card có sub-items */}
            <SectionCardMain
              icon={Receipt}
              label="Thuế phải nộp"
              totalValue={calc.taxPayable}
              pct={calc.pct(calc.taxPayable)}
              variant="warning"
            >
              <SubRow
                label="Thuế tạm nộp (Shopee KT 10%)"
                value={calc.taxWithholding}
                pct={calc.pct(calc.taxWithholding)}
              />
              {calc.taxAdditional > 0 && (
                <SubRow
                  label="Thuế còn phải nộp thêm"
                  value={calc.taxAdditional}
                  pct={calc.pct(calc.taxAdditional)}
                  emphasized
                  variantText="warning"
                />
              )}
              {calc.taxRefund > 0 && (
                <SubRow
                  label="Được hoàn lại"
                  value={calc.taxRefund}
                  pct={calc.pct(calc.taxRefund)}
                  emphasized
                  variantText="success"
                  prefix="+"
                />
              )}
              {calc.taxAdditional === 0 && calc.taxRefund === 0 && (
                <SubRow
                  label="Đã đóng đủ"
                  value={0}
                  pct="0%"
                />
              )}
            </SectionCardMain>

            {/* Chi phí Ads */}
            <MainRow
              icon={Megaphone}
              label="Chi phí Facebook Ads"
              value={calc.adsExpense}
              pct={calc.pct(calc.adsExpense)}
              variant="danger"
              isExpense
            />

            {/* Lợi nhuận - NỔI BẬT NHẤT */}
            <ProfitCard profit={calc.profit} pct={calc.pct(calc.profit)} />
          </CardContent>
        </Card>
      </div>

      {/* HÀNG DƯỚI: Thuế theo bậc - full width */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="w-4 h-4 text-warning" />
                Thuế theo từng bậc
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Biểu lũy tiến 5 bậc - Luật 2026
              </p>
            </div>
            <div className="flex items-center gap-6 text-xs">
              <div>
                <div className="text-muted-foreground">Thu nhập tính thuế</div>
                <div className="font-semibold tabular-nums text-sm mt-0.5">
                  {formatCurrency(calc.taxableIncome)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Tổng thuế</div>
                <div className="font-semibold tabular-nums text-sm mt-0.5">
                  {formatCurrency(calc.taxPayable)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Đã KT 10%</div>
                <div className="font-semibold tabular-nums text-sm mt-0.5 text-muted-foreground">
                  −{formatCurrency(calc.taxWithholding)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {calc.taxAdditional > 0
                    ? "Còn phải nộp"
                    : calc.taxRefund > 0
                      ? "Được hoàn"
                      : "Đã đủ"}
                </div>
                <div
                  className={cn(
                    "font-bold tabular-nums text-sm mt-0.5",
                    calc.taxAdditional > 0 && "text-warning",
                    calc.taxRefund > 0 && "text-success",
                  )}
                >
                  {calc.taxAdditional > 0 && formatCurrency(calc.taxAdditional)}
                  {calc.taxRefund > 0 && `+${formatCurrency(calc.taxRefund)}`}
                  {calc.taxAdditional === 0 && calc.taxRefund === 0 && "0đ"}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {calc.taxableIncome === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              Thu nhập sau giảm trừ ≤ 0, không phát sinh thuế.
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left font-medium px-6 py-2.5 w-20">Bậc</th>
                    <th className="text-left font-medium px-6 py-2.5">Khoảng thu nhập</th>
                    <th className="text-right font-medium px-6 py-2.5 w-24">Thuế suất</th>
                    <th className="text-right font-medium px-6 py-2.5">TN trong bậc</th>
                    <th className="text-right font-medium px-6 py-2.5">Thuế trong bậc</th>
                    <th className="text-right font-medium px-6 py-2.5 w-32">Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.brackets.map((b, i) => {
                    const pctOfTotal =
                      calc.taxPayable > 0 ? (b.taxInBracket / calc.taxPayable) * 100 : 0;
                    return (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="px-6 py-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Bậc {i + 1}
                          </span>
                        </td>
                        <td className="px-6 py-2.5">{b.label}</td>
                        <td className="px-6 py-2.5 text-right font-medium tabular-nums">
                          {(b.rate * 100).toFixed(0)}%
                        </td>
                        <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(b.incomeInBracket)}
                        </td>
                        <td className="px-6 py-2.5 text-right tabular-nums font-semibold">
                          {formatCurrency(b.taxInBracket)}
                        </td>
                        <td className="px-6 py-2.5">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
                              {pctOfTotal.toFixed(0)}%
                            </span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${pctOfTotal}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td colSpan={3} className="px-6 py-3">Tổng cộng</td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(calc.taxableIncome)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(calc.taxPayable)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <div className="flex items-start gap-3 p-4 rounded-md bg-muted/40 text-xs text-muted-foreground">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Cách tính</p>
          <p>• <strong>Thuế tạm nộp</strong> = Hoa hồng Gross × 10% (Shopee khấu trừ tại nguồn)</p>
          <p>• <strong>Thuế phải nộp</strong> = (HH Gross + Lương − Giảm trừ) áp biểu lũy tiến 5 bậc</p>
          <p>• <strong>Lợi nhuận</strong> = HH Net + Lương − Chi phí Ads − Thuế còn phải nộp thêm</p>
          <p>• <strong>% tỷ lệ</strong> tính trên Hoa hồng Gross (làm cơ sở so sánh).</p>
          <p>• Đây là ước tính sơ bộ theo Luật Thuế TNCN 2025 (số 109/2025/QH15).</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FORM ROW - mỗi input 1 hàng
// ============================================================================
function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function QuickButton({
  label,
  value,
  current,
  onClick,
}: {
  label: string;
  value: number;
  current: number;
  onClick: (v: number) => void;
}) {
  const isActive = Math.abs(value - current) < 1;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        "px-2 py-0.5 text-[11px] rounded border transition-colors",
        isActive
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

// ============================================================================
// MAIN ROW - hàng kết quả với icon + label bold + value + %
// ============================================================================
function MainRow({
  icon: Icon,
  label,
  value,
  pct,
  variant,
  isExpense,
  isDeduction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  pct: string;
  variant: "primary" | "info" | "warning" | "success" | "danger" | "neutral";
  isExpense?: boolean;
  isDeduction?: boolean;
}) {
  const styles = {
    primary: {
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-primary",
      borderColor: "border-primary/20",
    },
    info: {
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: "",
      borderColor: "border-border",
    },
    neutral: {
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      valueColor: "text-muted-foreground",
      borderColor: "border-border",
    },
    warning: {
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      valueColor: "text-warning",
      borderColor: "border-warning/20",
    },
    success: {
      iconBg: "bg-success/10",
      iconColor: "text-success",
      valueColor: "text-success",
      borderColor: "border-success/20",
    },
    danger: {
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      valueColor: "text-destructive",
      borderColor: "border-destructive/20",
    },
  }[variant];

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border",
        styles.borderColor,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
            styles.iconBg,
          )}
        >
          <Icon className={cn("w-4 h-4", styles.iconColor)} />
        </div>
        <div className="font-semibold text-sm">{label}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground tabular-nums font-medium w-12 text-right">
          {pct}
        </span>
        <div className={cn("text-base font-bold tabular-nums whitespace-nowrap", styles.valueColor)}>
          {isExpense && value > 0 ? "−" : ""}
          {isDeduction && value > 0 ? "−" : ""}
          {formatCurrency(value)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION CARD MAIN - thuế phải nộp (có sub-items)
// ============================================================================
function SectionCardMain({
  icon: Icon,
  label,
  totalValue,
  pct,
  variant,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  totalValue: number;
  pct: string;
  variant: "warning";
  children: React.ReactNode;
}) {
  const styles = {
    warning: {
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      valueColor: "text-warning",
      borderColor: "border-warning/20",
    },
  }[variant];

  return (
    <div className={cn("rounded-lg border", styles.borderColor)}>
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
              styles.iconBg,
            )}
          >
            <Icon className={cn("w-4 h-4", styles.iconColor)} />
          </div>
          <div className="font-semibold text-sm">{label}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums font-medium w-12 text-right">
            {pct}
          </span>
          <div className={cn("text-base font-bold tabular-nums whitespace-nowrap", styles.valueColor)}>
            {formatCurrency(totalValue)}
          </div>
        </div>
      </div>
      <div className="p-2 space-y-0.5">{children}</div>
    </div>
  );
}

// ============================================================================
// SUB ROW
// ============================================================================
function SubRow({
  label,
  value,
  pct,
  emphasized,
  variantText,
  prefix,
}: {
  label: string;
  value: number;
  pct: string;
  emphasized?: boolean;
  variantText?: "success" | "warning";
  prefix?: string;
}) {
  const colorClass =
    variantText === "success"
      ? "text-success"
      : variantText === "warning"
        ? "text-warning"
        : "";

  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded hover:bg-muted/40">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
          {pct}
        </span>
        <div
          className={cn(
            "text-xs tabular-nums whitespace-nowrap",
            emphasized ? "font-semibold" : "",
            colorClass,
          )}
        >
          {prefix ?? ""}
          {formatCurrency(value)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROFIT CARD - NỔI BẬT NHẤT
// ============================================================================
function ProfitCard({ profit, pct }: { profit: number; pct: string }) {
  const isProfit = profit >= 0;
  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 mt-3",
        isProfit
          ? "border-success/40 bg-success/5"
          : "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              isProfit ? "bg-success/15" : "bg-destructive/15",
            )}
          >
            <Sparkles
              className={cn(
                "w-5 h-5",
                isProfit ? "text-success" : "text-destructive",
              )}
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {isProfit ? "Lợi nhuận" : "Lỗ"}
            </div>
            <div
              className={cn(
                "text-xl font-bold tabular-nums leading-tight",
                isProfit ? "text-success" : "text-destructive",
              )}
            >
              {isProfit ? "+" : ""}
              {formatCurrency(profit)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            % trên HH
          </div>
          <div
            className={cn(
              "text-sm font-bold tabular-nums mt-0.5",
              isProfit ? "text-success" : "text-destructive",
            )}
          >
            {pct}
          </div>
        </div>
      </div>
    </div>
  );
}
