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
  tax_progressive: number;
  tax_payable: number;
  tax_additional: number;
  profit_loss: number;
  profit_margin: number;
}

/**
 * ✨ FIX BUG: tính taxAdditional ở mức TỪNG AFFILIATE rồi cộng lại.
 * 
 * Lý do: trước đây tính tổng global → bù trừ "lũy tiến của người A" với
 * "tạm nộp của người B" → ra số sai.
 * 
 * Logic đúng:
 *   for each affiliate:
 *     aff_progressive = lũy tiến của riêng người này
 *     aff_withheld    = thuế Shopee KT của riêng người này
 *     aff_additional  = max(0, aff_progressive - aff_withheld)  ← KHÔNG bù trừ
 *   
 *   tổng_additional = SUM(aff_additional)
 *   tổng_withheld   = SUM(aff_withheld)
 *   tổng_payable    = tổng_withheld + tổng_additional
 */
async function calculateTotalTax(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{
  taxProgressive: number;
  taxWithheld: number;
  taxAdditional: number;
}> {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

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
      .gte("earned_date", yearStart)
      .lte("earned_date", yearEnd),
  ]);

  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const commissions = (commissionsRes.data ?? []) as Pick<
    Commission,
    "account_id" | "gross_amount" | "tax_withheld"
  >[];

  const ytdMap = new Map<string, { gross: number; tax: number }>();
  for (const c of commissions) {
    const entry = ytdMap.get(c.account_id) ?? { gross: 0, tax: 0 };
    entry.gross += Number(c.gross_amount);
    entry.tax += Number(c.tax_withheld);
    ytdMap.set(c.account_id, entry);
  }

  let totalTaxProgressive = 0;
  let totalTaxWithheld = 0;
  let totalTaxAdditional = 0;  // ✨ MỚI: tổng additional tính per-aff

  for (const a of affiliates) {
    const ytd = ytdMap.get(a.id) ?? { gross: 0, tax: 0 };

    // Withheld cộng tất cả (kể cả affiliate không có lương + không có commission)
    totalTaxWithheld += ytd.tax;

    // Skip nếu không có doanh thu và không có lương (lũy tiến = 0)
    if (ytd.gross === 0 && !a.has_company_salary) continue;

    const result = calculateYtdAdditionalTax({
      monthsElapsed: 12,
      monthlySalaryGross: a.has_company_salary ? Number(a.monthly_salary_gross) : 0,
      monthlySalaryTaxWithheld: a.has_company_salary
        ? Number(a.monthly_salary_tax_withheld)
        : 0,
      ytdShopeeGross: ytd.gross,
      ytdShopeeTaxWithheld: ytd.tax,
      hasPersonalDeduction: a.has_personal_deduction,
      dependentCount: a.dependent_count,
    });

    const affProgressive = result.taxPayableYtd;
    const affWithheld = ytd.tax;
    // ✨ Tính additional CHO TỪNG NGƯỜI (không cho phép âm)
    const affAdditional = Math.max(0, affProgressive - affWithheld);

    totalTaxProgressive += affProgressive;
    totalTaxAdditional += affAdditional;
  }

  return {
    taxProgressive: Math.round(totalTaxProgressive),
    taxWithheld: Math.round(totalTaxWithheld),
    taxAdditional: Math.round(totalTaxAdditional),
  };
}

export default async function PnlReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const def = defaultRange();
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;

  const supabase = await createClient();
  const comparison = getPreviousPeriod(from, to);

  const annualTax = await calculateTotalTax(supabase);

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

  function build(raw: PnlRawData): PnlData {
    // ✨ Dùng số tạm nộp TRONG PERIOD (từ RPC) làm số hiển thị
    // Nhưng dùng số additional CẢ NĂM (đã tính per-aff)
    const taxWithheldInPeriod = Number(raw.total_commission_tax_withheld);

    // Thuế còn thiếu = SUM(max(0, progressive - withheld)) cho từng aff CẢ NĂM
    const taxAdditional = annualTax.taxAdditional;

    // Tổng thuế phải nộp = Tạm nộp (period) + Thiếu (cả năm)
    const taxPayable = taxWithheldInPeriod + taxAdditional;

    const profit = Number(raw.revenue_gross) - taxPayable - Number(raw.total_expense);
    const margin =
      Number(raw.revenue_gross) > 0
        ? (profit / Number(raw.revenue_gross)) * 100
        : 0;

    return {
      ...raw,
      tax_progressive: annualTax.taxProgressive,
      tax_payable: taxPayable,
      tax_additional: taxAdditional,
      profit_loss: profit,
      profit_margin: Math.round(margin * 100) / 100,
    };
  }

  const current = build((currentRawRes.data ?? emptyRaw) as PnlRawData);
  const previous = build((previousRawRes.data ?? emptyRaw) as PnlRawData);
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
