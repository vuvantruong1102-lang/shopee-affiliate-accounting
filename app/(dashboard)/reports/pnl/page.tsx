import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPreviousPeriod, formatDateRangeLabel } from "@/lib/report-period";
import { PnlReportView } from "@/components/reports/pnl-report-view";
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import type { AffiliateAccount, Commission } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function defaultRange() {
  const now = new Date();
  return {
    from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

interface PnlRawData {
  revenue_gross: number;
  revenue_net: number;
  total_commission_tax_withheld: number;
  expense_marketing: number;
  expense_salary: number;
  expense_operating: number;
  expense_tax: number;
  expense_other: number;
  total_expense: number;
}

interface BreakdownRow {
  category_id: string | null;
  category_name: string;
  category_type: string;
  total_amount: number;
  transaction_count: number;
}

export interface PnlData extends PnlRawData {
  tax_payable: number;        // ✨ Tổng thuế phải nộp (lũy tiến)
  profit_loss: number;
  profit_margin: number;
}

/**
 * Tính tổng thuế phải nộp theo lũy tiến cho 1 khoảng thời gian.
 * 
 * Logic: với mỗi affiliate đang active, tính:
 *   - YTD shopee commission (gross + tax_withheld) trong khoảng
 *   - Lương (nếu có) × số tháng trong khoảng
 *   - Áp lũy tiến → ra tax_payable per affiliate
 * 
 * Sau đó cộng dồn tất cả affiliate.
 */
async function calculateTotalTaxPayable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromDate: string,
  toDate: string,
): Promise<number> {
  const [affiliatesRes, commissionsRes] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("*")
      .eq("is_deleted", false)
      .in("status", ["active", "paused"]),
    supabase
      .from("commissions")
      .select("account_id, gross_amount, tax_withheld")
      .eq("is_deleted", false)
      .gte("earned_date", fromDate)
      .lte("earned_date", toDate),
  ]);

  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const commissions = (commissionsRes.data ?? []) as Pick<
    Commission,
    "account_id" | "gross_amount" | "tax_withheld"
  >[];

  // Tính số tháng trong khoảng (1-12)
  const fromD = new Date(fromDate + "T00:00:00");
  const toD = new Date(toDate + "T00:00:00");
  const monthsInRange = Math.max(
    1,
    Math.min(
      12,
      Math.round(
        (toD.getTime() - fromD.getTime()) / (1000 * 60 * 60 * 24 * 30),
      ) + 1,
    ),
  );

  // Map gross + tax theo affiliate
  const ytdMap = new Map<string, { gross: number; tax: number }>();
  for (const c of commissions) {
    const entry = ytdMap.get(c.account_id) ?? { gross: 0, tax: 0 };
    entry.gross += Number(c.gross_amount);
    entry.tax += Number(c.tax_withheld);
    ytdMap.set(c.account_id, entry);
  }

  let totalTaxPayable = 0;
  for (const a of affiliates) {
    const ytd = ytdMap.get(a.id) ?? { gross: 0, tax: 0 };
    if (ytd.gross === 0 && !a.has_company_salary) continue;

    const result = calculateYtdAdditionalTax({
      monthsElapsed: monthsInRange,
      monthlySalaryGross: a.has_company_salary ? Number(a.monthly_salary_gross) : 0,
      monthlySalaryTaxWithheld: a.has_company_salary
        ? Number(a.monthly_salary_tax_withheld)
        : 0,
      ytdShopeeGross: ytd.gross,
      ytdShopeeTaxWithheld: ytd.tax,
      hasPersonalDeduction: a.has_personal_deduction,
      dependentCount: a.dependent_count,
    });

    totalTaxPayable += result.taxPayableYtd;
  }

  return Math.round(totalTaxPayable);
}

export default async function PnlReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const def = defaultRange();
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;

  const supabase = await createClient();
  const comparison = getPreviousPeriod(from, to);

  const [
    currentRawRes,
    previousRawRes,
    breakdownRes,
    currentTax,
    previousTax,
  ] = await Promise.all([
    supabase.rpc("get_pnl_report", { p_from_date: from, p_to_date: to }).single(),
    supabase
      .rpc("get_pnl_report", {
        p_from_date: comparison.previous.from,
        p_to_date: comparison.previous.to,
      })
      .single(),
    supabase.rpc("get_expense_breakdown", { p_from_date: from, p_to_date: to }),
    calculateTotalTaxPayable(supabase, from, to),
    calculateTotalTaxPayable(supabase, comparison.previous.from, comparison.previous.to),
  ]);

  const emptyRaw: PnlRawData = {
    revenue_gross: 0,
    revenue_net: 0,
    total_commission_tax_withheld: 0,
    expense_marketing: 0,
    expense_salary: 0,
    expense_operating: 0,
    expense_tax: 0,
    expense_other: 0,
    total_expense: 0,
  };

  function build(raw: PnlRawData, taxPayable: number): PnlData {
    // Lãi = Gross - Tổng thuế phải nộp - Chi phí
    const profit = Number(raw.revenue_gross) - taxPayable - Number(raw.total_expense);
    const margin =
      Number(raw.revenue_gross) > 0
        ? (profit / Number(raw.revenue_gross)) * 100
        : 0;
    return {
      ...raw,
      tax_payable: taxPayable,
      profit_loss: profit,
      profit_margin: Math.round(margin * 100) / 100,
    };
  }

  const current = build(
    (currentRawRes.data ?? emptyRaw) as PnlRawData,
    currentTax,
  );
  const previous = build(
    (previousRawRes.data ?? emptyRaw) as PnlRawData,
    previousTax,
  );
  const breakdown = (breakdownRes.data ?? []) as BreakdownRow[];

  const label = formatDateRangeLabel(from, to);
  const prevLabel = formatDateRangeLabel(comparison.previous.from, comparison.previous.to);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 -mb-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reports">
            <ChevronLeft className="w-4 h-4" />
            Tất cả báo cáo
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Báo cáo Lãi/Lỗ (P&L)"
        description={`${label} • So sánh với ${prevLabel}`}
      />

      <PnlReportView
        from={from}
        to={to}
        current={current}
        previous={previous}
        breakdown={breakdown}
        periodLabel={label}
        previousLabel={prevLabel}
      />
    </div>
  );
}
