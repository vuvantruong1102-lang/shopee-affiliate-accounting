"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  hasPersonalDeduction: true,
  dependentCount: 0,
};

export function CalculatorForm() {
  const [hhGross, setHhGross] = useState(DEFAULT_VALUES.hhGross);
  const [salaryGross, setSalaryGross] = useState(DEFAULT_VALUES.salaryGross);
  const [adsExpense, setAdsExpense] = useState(DEFAULT_VALUES.adsExpense);
  const [hasPersonalDeduction, setHasPersonalDeduction] = useState(DEFAULT_VALUES.hasPersonalDeduction);
  const [dependentCount, setDependentCount] = useState(DEFAULT_VALUES.dependentCount);

  function handleReset() {
    setHhGross(DEFAULT_VALUES.hhGross);
    setSalaryGross(DEFAULT_VALUES.salaryGross);
    setAdsExpense(DEFAULT_VALUES.adsExpense);
    setHasPersonalDeduction(DEFAULT_VALUES.hasPersonalDeduction);
    setDependentCount(DEFAULT_VALUES.dependentCount);
  }

  const calc = useMemo(() => {
    // 1. Doanh thu
    const totalIncome = hhGross + salaryGross;

    // 2. Thuế tạm nộp 10% trên HH gross
    const taxWithholding = Math.round(hhGross * VANG_LAI_TAX_RATE);

    // 3. Giảm trừ (theo tháng, vì người dùng nhập số/tháng)
    const personalDeduction = hasPersonalDeduction ? PERSONAL_DEDUCTION_MONTHLY : 0;
    const dependentDeduction = DEPENDENT_DEDUCTION_MONTHLY * dependentCount;
    const totalDeduction = personalDeduction + dependentDeduction;

    // 4. TNTT
    const taxableIncome = Math.max(0, totalIncome - totalDeduction);

    // 5. Thuế phải nộp theo lũy tiến
    const taxPayable = calculateTaxMonthly(taxableIncome);

    // 6. Chênh
    const taxAdditional = Math.max(0, taxPayable - taxWithholding);
    const taxRefund = Math.max(0, taxWithholding - taxPayable);

    // 7. Lợi nhuận
    // HH Net = HH Gross - 10% tạm KT
    const hhNet = hhGross - taxWithholding;
    // Lợi nhuận = HH Net + Lương - Ads - Thuế còn phải nộp thêm
    const profit = hhNet + salaryGross - adsExpense - taxAdditional;

    // 8. Bracket details
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
      personalDeduction,
      dependentDeduction,
      totalDeduction,
      taxableIncome,
      adsExpense,
      profit,
      brackets,
    };
  }, [hhGross, salaryGross, adsExpense, hasPersonalDeduction, dependentCount]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* CỘT TRÁI: Form input + Kết quả (3/5) */}
      <div className="lg:col-span-3 space-y-6">
        {/* Form input */}
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
              Nhập số liệu tùy ý để ước tính nhanh thuế và lợi nhuận
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">
                  Hoa hồng Gross
                </Label>
                <CurrencyInput value={hhGross} onChange={setHhGross} />
              </div>
              <div>
                <Label className="mb-1.5 block">Lương</Label>
                <CurrencyInput value={salaryGross} onChange={setSalaryGross} />
                <p className="text-xs text-muted-foreground mt-1">
                  Để 0 nếu không có
                </p>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">Chi phí Facebook Ads</Label>
              <CurrencyInput value={adsExpense} onChange={setAdsExpense} />
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
                Có giảm trừ bản thân ({formatCurrency(PERSONAL_DEDUCTION_MONTHLY)})
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
                Mỗi người được giảm trừ {formatCurrency(DEPENDENT_DEDUCTION_MONTHLY)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ====================== KẾT QUẢ ====================== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Kết quả ước tính
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 1. Hoa hồng Gross - card lớn */}
            <MainRow
              icon={TrendingUp}
              label="Hoa hồng Gross"
              value={calc.hhGross}
              variant="primary"
            />

            {/* 2. Giảm trừ - card với 2 sub items */}
            <SectionCard label="Giảm trừ" totalValue={calc.totalDeduction}>
              {hasPersonalDeduction && (
                <SubRow
                  label="Giảm trừ bản thân"
                  value={calc.personalDeduction}
                />
              )}
              {dependentCount > 0 && (
                <SubRow
                  label={`Giảm trừ ${dependentCount} người phụ thuộc`}
                  value={calc.dependentDeduction}
                />
              )}
              {!hasPersonalDeduction && dependentCount === 0 && (
                <div className="text-xs text-muted-foreground italic px-1 py-1">
                  Chưa chọn giảm trừ
                </div>
              )}
            </SectionCard>

            {/* 3. Thuế phải nộp - card lớn với 2 sub */}
            <SectionCardMain
              icon={Receipt}
              label="Thuế phải nộp"
              totalValue={calc.taxPayable}
              variant="warning"
            >
              <SubRow
                label="Thuế tạm nộp (Shopee khấu trừ 10%)"
                value={calc.taxWithholding}
              />
              <SubRow
                label={calc.taxAdditional > 0 ? "Thuế còn phải nộp thêm" : "Đã đóng đủ"}
                value={calc.taxAdditional}
                emphasized={calc.taxAdditional > 0}
                variantText={calc.taxAdditional > 0 ? "warning" : undefined}
              />
              {calc.taxRefund > 0 && (
                <SubRow
                  label="Được hoàn lại"
                  value={calc.taxRefund}
                  emphasized
                  variantText="success"
                  prefix="+"
                />
              )}
            </SectionCardMain>

            {/* 4. Chi phí Ads - card lớn */}
            <MainRow
              icon={Megaphone}
              label="Chi phí Facebook Ads"
              value={calc.adsExpense}
              variant="danger"
              isExpense
            />

            {/* 5. Lợi nhuận - card NỔI BẬT NHẤT */}
            <ProfitCard profit={calc.profit} />
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
            <p>• Đây là ước tính sơ bộ theo Luật Thuế TNCN 2025 (số 109/2025/QH15).</p>
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
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Thu nhập tính thuế:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(calc.taxableIncome)}
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
                    <div key={i} className="py-2.5 border-b border-border last:border-0">
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
// MAIN ROW - 1 hàng lớn không có sub-items (HH Gross, Chi phí Ads)
// ============================================================================
function MainRow({
  icon: Icon,
  label,
  value,
  variant,
  isExpense,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  variant: "primary" | "warning" | "success" | "danger";
  isExpense?: boolean;
}) {
  const styles = {
    primary: {
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-primary",
      borderColor: "border-primary/20",
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
        "flex items-center justify-between gap-3 p-4 rounded-lg border-2",
        styles.borderColor,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            styles.iconBg,
          )}
        >
          <Icon className={cn("w-5 h-5", styles.iconColor)} />
        </div>
        <div className="font-bold text-base">{label}</div>
      </div>
      <div className={cn("text-xl font-bold tabular-nums", styles.valueColor)}>
        {isExpense && value > 0 ? "−" : ""}
        {formatCurrency(value)}
      </div>
    </div>
  );
}

// ============================================================================
// SECTION CARD - giảm trừ (label thường, có sub-items)
// ============================================================================
function SectionCard({
  label,
  totalValue,
  children,
}: {
  label: string;
  totalValue: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="font-bold text-base">{label}</div>
        <div className="text-base font-bold tabular-nums text-muted-foreground">
          −{formatCurrency(totalValue)}
        </div>
      </div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}

// ============================================================================
// SECTION CARD MAIN - thuế phải nộp (label đậm, icon, border đậm)
// ============================================================================
function SectionCardMain({
  icon: Icon,
  label,
  totalValue,
  variant,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  totalValue: number;
  variant: "warning" | "primary";
  children: React.ReactNode;
}) {
  const styles = {
    warning: {
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      valueColor: "text-warning",
      borderColor: "border-warning/20",
    },
    primary: {
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-primary",
      borderColor: "border-primary/20",
    },
  }[variant];

  return (
    <div className={cn("rounded-lg border-2", styles.borderColor)}>
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              styles.iconBg,
            )}
          >
            <Icon className={cn("w-5 h-5", styles.iconColor)} />
          </div>
          <div className="font-bold text-base">{label}</div>
        </div>
        <div className={cn("text-xl font-bold tabular-nums", styles.valueColor)}>
          {formatCurrency(totalValue)}
        </div>
      </div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}

// ============================================================================
// SUB ROW - dòng con bên trong SectionCard
// ============================================================================
function SubRow({
  label,
  value,
  emphasized,
  variantText,
  prefix,
}: {
  label: string;
  value: number;
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
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-muted/40">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-sm tabular-nums",
          emphasized ? "font-semibold" : "",
          colorClass,
        )}
      >
        {prefix ?? ""}
        {formatCurrency(value)}
      </div>
    </div>
  );
}

// ============================================================================
// PROFIT CARD - nổi bật nhất, có gradient
// ============================================================================
function ProfitCard({ profit }: { profit: number }) {
  const isProfit = profit >= 0;
  return (
    <div
      className={cn(
        "rounded-lg border-2 p-5 relative overflow-hidden",
        isProfit
          ? "border-success/30 bg-success/5"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
              isProfit ? "bg-success/15" : "bg-destructive/15",
            )}
          >
            <Sparkles
              className={cn(
                "w-6 h-6",
                isProfit ? "text-success" : "text-destructive",
              )}
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              {isProfit ? "Lợi nhuận" : "Lỗ"}
            </div>
            <div
              className={cn(
                "text-2xl font-bold tabular-nums mt-0.5",
                isProfit ? "text-success" : "text-destructive",
              )}
            >
              {isProfit ? "+" : ""}
              {formatCurrency(profit)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
