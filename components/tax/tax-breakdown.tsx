"use client";

import { formatCurrency } from "@/lib/utils";
import {
  PERSONAL_DEDUCTION_MONTHLY,
  DEPENDENT_DEDUCTION_MONTHLY,
  getAnnualBracketBreakdown,
} from "@/lib/tax-calculator";
import type { AffiliateAccount } from "@/types/database";
import type { YtdTaxResult } from "@/lib/ytd-tax";

interface Props {
  ytdResult: YtdTaxResult;
  monthsElapsed: number;             // kept for compat, not used in display
  affiliate: AffiliateAccount;
}

const MONTHS_PER_YEAR = 12;

export function TaxBreakdown({ ytdResult, affiliate }: Props) {
  const r = ytdResult;

  // ✨ Bậc theo NĂM (không chia/nhân tháng nữa)
  const brackets = getAnnualBracketBreakdown(r.taxableIncomeYtd);

  return (
    <div className="space-y-4">
      {/* Bước 1: Tổng thu nhập */}
      <Step number="1" title="Tổng thu nhập năm">
        <div className="space-y-1.5">
          {r.breakdown.salaryGross > 0 && (
            <Row
              label="Lương công ty (cả năm)"
              value={r.breakdown.salaryGross}
              sub={`12 tháng × ${formatCurrency(affiliate.monthly_salary_gross)}/tháng`}
            />
          )}
          <Row label="Hoa hồng Shopee (gross)" value={r.breakdown.shopeeGross} />
          <RowTotal label="Tổng thu nhập" value={r.totalIncomeYtd} />
        </div>
      </Step>

      {/* Bước 2: Giảm trừ */}
      <Step number="2" title="Các khoản giảm trừ gia cảnh (cả năm)">
        <div className="space-y-1.5">
          {affiliate.has_personal_deduction && (
            <Row
              label="Giảm trừ bản thân"
              value={r.breakdown.personalDeduction}
              sub={`${formatCurrency(PERSONAL_DEDUCTION_MONTHLY)} × 12 tháng`}
            />
          )}
          {affiliate.dependent_count > 0 && (
            <Row
              label={`Giảm trừ ${affiliate.dependent_count} người phụ thuộc`}
              value={r.breakdown.dependentDeduction}
              sub={`${formatCurrency(DEPENDENT_DEDUCTION_MONTHLY)} × ${affiliate.dependent_count} người × 12 tháng`}
            />
          )}
          {!affiliate.has_personal_deduction && affiliate.dependent_count === 0 && (
            <div className="text-sm text-muted-foreground italic">
              Không có khoản giảm trừ
            </div>
          )}
          <RowTotal label="Tổng giảm trừ" value={r.totalDeductionYtd} negative />
        </div>
      </Step>

      {/* Bước 3: TNTT */}
      <Step number="3" title="Thu nhập tính thuế năm">
        <div className="text-xs font-mono bg-muted/40 rounded p-2.5">
          TNTT năm = Tổng TN − Giảm trừ ={" "}
          <strong>{formatCurrency(r.totalIncomeYtd)}</strong> −{" "}
          <strong>{formatCurrency(r.totalDeductionYtd)}</strong> ={" "}
          <strong className="text-primary">{formatCurrency(r.taxableIncomeYtd)}</strong>
        </div>
      </Step>

      {/* Bước 4: Tính thuế lũy tiến theo NĂM */}
      {r.taxableIncomeYtd > 0 ? (
        <Step number="4" title="Thuế phải nộp năm (lũy tiến 5 bậc — theo NĂM)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium px-3 py-2">Bậc</th>
                  <th className="text-right font-medium px-3 py-2">TNTT trong bậc</th>
                  <th className="text-right font-medium px-3 py-2">Thuế suất</th>
                  <th className="text-right font-medium px-3 py-2">Thuế bậc này</th>
                </tr>
              </thead>
              <tbody>
                {brackets.map((b) => {
                  const isReached = b.incomeInBracket > 0;
                  return (
                    <tr
                      key={b.bracketIndex}
                      className={
                        "border-b border-border last:border-0 " +
                        (isReached ? "" : "text-muted-foreground/60")
                      }
                    >
                      <td className="px-3 py-2">
                        Bậc {b.bracketIndex} ({b.bracketRange})
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {isReached ? formatCurrency(b.incomeInBracket) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {(b.rate * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {isReached ? formatCurrency(b.taxInBracket) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold bg-muted/30">
                  <td className="px-3 py-2">Tổng thuế phải nộp năm</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(r.taxableIncomeYtd)}
                  </td>
                  <td></td>
                  <td className="px-3 py-2 text-right tabular-nums text-warning">
                    {formatCurrency(r.taxPayableYtd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Step>
      ) : (
        <Step number="4" title="Thuế phải nộp năm">
          <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted/40">
            Thu nhập tính thuế ≤ 0, <strong>không phát sinh thuế phải nộp</strong>.
          </div>
        </Step>
      )}

      {/* Bước 5: So sánh với đã khấu trừ */}
      <Step number="5" title="So sánh với thuế đã khấu trừ">
        <div className="space-y-1.5">
          {r.breakdown.salaryTaxWithheld > 0 && (
            <Row
              label="Thuế công ty đã khấu trừ (cả năm)"
              value={r.breakdown.salaryTaxWithheld}
              sub={`12 tháng × ${formatCurrency(affiliate.monthly_salary_tax_withheld)}/tháng`}
            />
          )}
          <Row
            label="Thuế Shopee đã khấu trừ (10% vãng lai)"
            value={r.breakdown.shopeeTaxWithheld}
          />
          <RowTotal label="Tổng đã khấu trừ" value={r.taxWithheldYtd} />

          <div className="pt-2 mt-2 border-t border-border">
            <div className="text-xs font-mono bg-muted/40 rounded p-2.5">
              Chênh lệch = Thuế phải nộp − Đã khấu trừ ={" "}
              <strong>{formatCurrency(r.taxPayableYtd)}</strong> −{" "}
              <strong>{formatCurrency(r.taxWithheldYtd)}</strong>
            </div>
            <div className="flex items-center justify-between mt-3 p-3 rounded-md bg-muted/40">
              <span className="text-sm font-medium">Kết luận:</span>
              {r.status === "owe" && (
                <span className="text-sm font-semibold text-warning">
                  Cần nộp thêm khi quyết toán: {formatCurrency(r.taxAdditional)}
                </span>
              )}
              {r.status === "refund" && (
                <span className="text-sm font-semibold text-success">
                  Được hoàn khi quyết toán: {formatCurrency(Math.abs(r.taxAdditional))}
                </span>
              )}
              {r.status === "even" && (
                <span className="text-sm font-semibold">Đã đóng đủ ~ 0đ</span>
              )}
              {r.status === "no_data" && (
                <span className="text-sm text-muted-foreground">Chưa có dữ liệu</span>
              )}
            </div>
          </div>
        </div>
      </Step>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm mb-2">{title}</h4>
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="flex-1 min-w-0">
        <div>{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      <div className="tabular-nums whitespace-nowrap">{formatCurrency(value)}</div>
    </div>
  );
}

function RowTotal({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm font-semibold pt-2 mt-1 border-t border-border">
      <div>{label}</div>
      <div className="tabular-nums whitespace-nowrap">
        {negative && "−"}
        {formatCurrency(value)}
      </div>
    </div>
  );
}
