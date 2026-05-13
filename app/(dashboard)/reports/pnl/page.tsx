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
  revenue_gross_received: number;
  revenue_gross_pending: number;
  revenue_gross_processing: number;
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
  tax_payable: number;
  tax_additional: number;        // ✨ Thuế còn thiếu (luôn ≥ 0)
  profit_loss: number;
  profit_margin: number;
}

/**
 * Tính tổng thuế phải nộp CẢ NĂM cho tất cả affiliate active.
 * 
 * Logic:
 * - Với mỗi affiliate active/paused:
 *   - Gross năm = SUM(commissions trong CẢ NĂM) + shopee_processing_amount
 *   - Lương năm = monthly × 12 (nếu has_company_salary)
 *   - Giảm trừ năm = (15.5tr + 6.2tr × dep) × 12
 *   - Áp lũy tiến 5 bậc THEO NĂM
 *   - tax_aff = thuế phải nộp năm
 * - Tổng = SUM(tax_aff)
 * 
 * KHÔNG phụ thuộc period (luôn lấy thuế cả năm hiện tại).
 */
async function calculateTotalTaxPayable(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const [affiliatesRes, commissionsRes, processingRes] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("*")
      .eq("is_deleted", false)
      .in("status", ["active", "paused"]),
    supabase
      .from("commissions")
      .select("account_id, gross_amount, tax_withheld")
      .eq("is_deleted", false)
      .gte("earned_date", yearStart)
      .lte("earned_date", yearEnd),
    supabase
      .from("shopee_processing_amounts")
      .select("affiliate_id, amount"),
  ]);

  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const commissions = (commissionsRes.data ?? []) as Pick<
    Commission,
    "account_id" | "gross_amount" | "tax_withheld"
  >[];
  const processing = (processingRes.data ?? []) as Array<{
    affiliate_id: string;
    amount: number | string;
  }>;

  // Map gross + tax theo affiliate (từ commissions cả năm)
  const ytdMap = new Map<string, { gross: number; tax: number }>();
  for (const c of commissions) {
    const entry = ytdMap.get(c.account_id) ?? { gross: 0, tax: 0 };
    entry.gross += Number(c.gross_amount);
    entry.tax += Number(c.tax_withheld);
    ytdMap.set(c.account_id, entry);
  }

  // Map processing (Gross) theo affiliate
  const processingMap = new Map<string, number>();
  for (const p of processing) {
    processingMap.set(p.affiliate_id, Number(p.amount));
  }

  let totalTaxPayable = 0;
  for (const a of affiliates) {
    const ytd = ytdMap.get(a.id) ?? { gross: 0, tax: 0 };
    const processingGross = processingMap.get(a.id) ?? 0;
    // Thuế Shopee đã KT 10% trên processing
    const processingTax = Math.round(processingGross * 0.10);

    // ✨ Gross năm = commissions + processing
    const totalShopeeGross = ytd.gross + processingGross;
    const totalShopeeTax = ytd.tax + processingTax;

    if (totalShopeeGross === 0 && !a.has_company_salary) continue;

    const result = calculateYtdAdditionalTax({
      monthsElapsed: 12,  // bỏ qua, hàm luôn tính 12
      monthlySalaryGross: a.has_company_salary ? Number(a.monthly_salary_gross) : 0,
      monthlySalaryTaxWithheld: a.has_company_salary
        ? Number(a.monthly_salary_tax_withheld)
        : 0,
      ytdShopeeGross: totalShopeeGross,
      ytdShopeeTaxWithheld: totalShopeeTax,
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

  // ✨ Thuế cả năm: tính 1 lần, dùng cho cả current và previous (số cố định)
  const annualTaxPayable = await calculateTotalTaxPayable(supabase);

  const [
    currentRawRes,
    previousRawRes,
    breakdownRes,
  ] = await Promise.all([
    supabase.rpc("get_pnl_report", { p_from_date: from, p_to_date: to }).single(),
    supabase
      .rpc("get_pnl_report", {
        p_from_date: comparison.previous.from,
        p_to_date: comparison.previous.to,
      })
      .single(),
    supabase.rpc("get_expense_breakdown", { p_from_date: from, p_to_date: to }),
  ]);

  const emptyRaw: PnlRawData = {
    revenue_gross: 0,
    revenue_net: 0,
    revenue_gross_received: 0,
    revenue_gross_pending: 0,
    revenue_gross_processing: 0,
    total_commission_tax_withheld: 0,
    expense_marketing: 0,
    expense_salary: 0,
    expense_operating: 0,
    expense_tax: 0,
    expense_other: 0,
    total_expense: 0,
  };

  function build(raw: PnlRawData, taxPayable: number): PnlData {
    // Thuế còn thiếu = max(0, Tổng phải nộp - Tạm nộp Shopee KT)
    const taxAdditional = Math.max(
      0,
      taxPayable - Number(raw.total_commission_tax_withheld),
    );
    // Lãi = Gross - Tổng thuế phải nộp - Chi phí
    const profit = Number(raw.revenue_gross) - taxPayable - Number(raw.total_expense);
    const margin =
      Number(raw.revenue_gross) > 0
        ? (profit / Number(raw.revenue_gross)) * 100
        : 0;
    return {
      ...raw,
      tax_payable: taxPayable,
      tax_additional: taxAdditional,
      profit_loss: profit,
      profit_margin: Math.round(margin * 100) / 100,
    };
  }

  const current = build(
    (currentRawRes.data ?? emptyRaw) as PnlRawData,
    annualTaxPayable,
  );
  const previous = build(
    (previousRawRes.data ?? emptyRaw) as PnlRawData,
    annualTaxPayable,  // ✨ giống current vì thuế cả năm cố định
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
        description={`${label} • So sánh với ${prevLabel} · Thuế tính cả năm ${new Date().getFullYear()}`}
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
