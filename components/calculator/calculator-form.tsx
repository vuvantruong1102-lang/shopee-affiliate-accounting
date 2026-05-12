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
  deduction: PERSONAL_DEDUCTION_MONTHLY,
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
    const taxableIncome = Math.max(0, totalIncome - deduction);
    const taxPayable = calculateTaxMonthly(taxableIncome);
    const taxAdditional = Math.max(0, taxPayable - taxWithholding);
    const taxRefund = Math.max(0, taxWithholding - taxPayable);

    // ✅ CÔNG THỨC ĐÚNG: Lương không tham gia vào lợi nhuận
    const profit = hhGross - taxPayable - adsExpense;

    const base = hhGross > 0 ? hhGross : 1;
    const pct = (v: number) => ((v / base) * 100).toFixed(1) + "%";

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
      <div className="grid gap-6 lg:grid-cols-2">
        {/* FORM */}
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

            <FormRow label="Lương" hint="Để 0 nếu không có. Chỉ dùng để tính thuế (không vào lợi nhuận).">
              <CurrencyInput value={salaryGross} onChange={setSalaryGross} className="text-lg font-semibold tabular-nums" />
            </FormRow>

            <FormRow
              label="Giảm trừ gia cảnh"
              hint={`Bản thân: ${formatCurrency(PERSONAL_DEDUCTION_MONTHLY)} • Mỗi NPT: ${formatCurrency(DEPENDENT_DEDUCTION_MONTHLY)}`}
            >
              <CurrencyInput value={deduction} onChange={setDeduction} className="text-lg font-semibold tabular-nums" />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Nhanh:</span>
                <QuickButton label="Bản thân" value={PERSONAL_DEDUCTION_MONTHLY} current={deduction} onClick={setDeduction} />
                <QuickButton label="BT + 1 NPT" value={PERSONAL_DEDUCTION_MONTHLY + DEPENDENT_DEDUCTION_MONTHLY} current={deduction} onClick={setDeduction} />
                <QuickButton label="BT + 2 NPT" value={PERSONAL_DEDUCTION_MONTHLY + DEPENDENT_DEDUCTION_MONTHLY * 2} current={deduction} onClick={setDeduction} />
                <QuickButton label="BT + 3 NPT" value={PERSONAL_DEDUCTION_MONTHLY + DEPENDENT_DEDUCTION_MONTHLY * 3} current={deduction} onClick={setDeduction} />
              </div>
            </FormRow>

            <FormRow label="Chi phí Facebook Ads">
              <CurrencyInput value={adsExpense} onChange={setAdsExpense} className="text-lg font-semibold tabular-nums" />
            </FormRow>
          </CardContent>
        </Card>

        {/* KẾT QUẢ - 4 MỤC */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Kết quả ước tính
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <MainRow
              icon={TrendingUp}
              label="Hoa hồng Gross"
              value={calc.hhGross}
              pct="100.0%"
              variant="primary"
            />

            <SectionCardMain
              icon={Receipt}
              label="Thuế phải nộp"
              totalValue={calc.taxPayable}
              pct={calc.pct(calc.taxPayable)}
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
                <SubRow label="Đã đóng đủ" value={0} pct="0%" />
              )}
            </SectionCardMain>

            <MainRow
              icon={Megaphone}
              label="Chi phí Facebook Ads"
              value={calc.adsExpense}
              pct={calc.pct(calc.adsExpense)}
              variant="danger"
              isExpense
            />

            <ProfitCard profit={calc.profit} pct={calc.pct(calc.profit)} />

            <div className="text-[11px] text-muted-foreground italic pt-1 px-1">
              Lợi nhuận = HH Gross − Tổng thuế phải nộp − Chi phí Ads
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BẢNG THUẾ THEO BẬC - thiết kế lại gọn gàng */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="w-4 h-4 text-warning" />
            Thuế theo từng bậc
            <span className="text-xs text-muted-foreground font-normal ml-2">
              Biểu lũy tiến 5 bậc - Luật 2026
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 4 stat tổng */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 pb-4 border-b border-border">
            <StatBlock label="Thu nhập tính thuế" value={formatCurrency(calc.taxableIncome)} />
            <StatBlock label="Tổng thuế" value={formatCurrency(calc.taxPayable)} />
            <StatBlock label="Đã khấu trừ 10%" value={`−${formatCurrency(calc.taxWithholding)}`} muted />
            <StatBlock
              label={
                calc.taxAdditional > 0
                  ? "Còn phải nộp thêm"
                  : calc.taxRefund > 0
                    ? "Được hoàn"
                    : "Đã đủ"
              }
              value={
                calc.taxAdditional > 0
                  ? formatCurrency(calc.taxAdditional)
                  : calc.taxRefund > 0
                    ? `+${formatCurrency(calc.taxRefund)}`
                    : "0đ"
              }
              variant={calc.taxAdditional > 0 ? "warning" : calc.taxRefund > 0 ? "success" : "default"}
            />
          </div>

          {/* Danh sách bậc thuế */}
          {calc.taxableIncome === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Thu nhập sau giảm trừ ≤ 0, không phát sinh thuế.
            </div>
          ) : (
            <div className="space-y-1.5">
              {calc.brackets.map((b, i) => {
                const pctOfTotal =
                  calc.taxPayable > 0 ? (b.taxInBracket / calc.taxPayable) * 100 : 0;
                return (
                  <BracketRow
                    key={i}
                    index={i + 1}
                    range={b.label}
                    rate={b.rate}
                    incomeInBracket={b.incomeInBracket}
                    taxInBracket={b.taxInBracket}
                    pctOfTotal={pctOfTotal}
                  />
                );
              })}
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
          <p>• <strong>Tổng thuế phải nộp</strong> = (HH Gross + Lương − Giảm trừ) áp biểu lũy tiến 5 bậc</p>
          <p>• <strong>Lợi nhuận</strong> = HH Gross − Tổng thuế phải nộp − Chi phí Ads</p>
          <p>• <strong>Lương</strong> không ảnh hưởng đến lợi nhuận, chỉ dùng tính thuế (vì cộng dồn thu nhập).</p>
          <p>• Đây là ước tính sơ bộ theo Luật Thuế TNCN 2025 (số 109/2025/QH15).</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
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

function MainRow({
  icon: Icon,
  label,
  value,
  pct,
  variant,
  isExpense,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  pct: string;
  variant: "primary" | "warning" | "danger";
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
          {formatCurrency(value)}
        </div>
      </div>
    </div>
  );
}

function SectionCardMain({
  icon: Icon,
  label,
  totalValue,
  pct,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  totalValue: number;
  pct: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-warning/20">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-warning" />
          </div>
          <div className="font-semibold text-sm">{label}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums font-medium w-12 text-right">
            {pct}
          </span>
          <div className="text-base font-bold tabular-nums whitespace-nowrap text-warning">
            {formatCurrency(totalValue)}
          </div>
        </div>
      </div>
      <div className="p-2 space-y-0.5">{children}</div>
    </div>
  );
}

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

function StatBlock({
  label,
  value,
  muted,
  variant = "default",
}: {
  label: string;
  value: string;
  muted?: boolean;
  variant?: "default" | "warning" | "success";
}) {
  const colorClass =
    variant === "warning"
      ? "text-warning"
      : variant === "success"
        ? "text-success"
        : muted
          ? "text-muted-foreground"
          : "";

  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-bold tabular-nums mt-1 truncate",
          colorClass,
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================================
// BRACKET ROW - Layout mới gọn gàng
// Grid 12 cột với tỷ lệ cân đối, mỗi block có label rõ ràng
// ============================================================================
function BracketRow({
  index,
  range,
  rate,
  incomeInBracket,
  taxInBracket,
  pctOfTotal,
}: {
  index: number;
  range: string;
  rate: number;
  incomeInBracket: number;
  taxInBracket: number;
  pctOfTotal: number;
}) {
  return (
    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2.5 rounded-md border border-border hover:bg-muted/40 transition-colors">
      {/* Bậc + Khoảng - 4 cột */}
      <div className="col-span-12 sm:col-span-4 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
          {index}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">
            Bậc {index}
          </div>
          <div className="text-sm font-medium leading-tight whitespace-nowrap">
            {range}
          </div>
        </div>
      </div>

      {/* Thuế suất - 1 cột */}
      <div className="col-span-3 sm:col-span-1 text-center">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Suất
        </div>
        <div className="text-sm font-bold tabular-nums">{(rate * 100).toFixed(0)}%</div>
      </div>

      {/* TN trong bậc - 3 cột */}
      <div className="col-span-4 sm:col-span-3 text-right">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          TN trong bậc
        </div>
        <div className="text-sm tabular-nums text-muted-foreground">
          {formatCurrency(incomeInBracket)}
        </div>
      </div>

      {/* Thuế - 2 cột */}
      <div className="col-span-5 sm:col-span-2 text-right">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Thuế
        </div>
        <div className="text-sm font-bold tabular-nums">
          {formatCurrency(taxInBracket)}
        </div>
      </div>

      {/* Tỷ trọng - 2 cột */}
      <div className="col-span-12 sm:col-span-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-right sm:text-left">
          Tỷ trọng
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pctOfTotal}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">
            {pctOfTotal.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
