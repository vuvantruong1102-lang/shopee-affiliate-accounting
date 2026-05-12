import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPreviousPeriod, formatDateRangeLabel } from "@/lib/report-period";
import { PnlReportView } from "@/components/reports/pnl-report-view";

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

interface PnlData {
  revenue_net: number;
  revenue_gross: number;
  expense_marketing: number;
  expense_salary: number;
  expense_operating: number;
  expense_tax: number;
  expense_other: number;
  total_expense: number;
  profit_loss: number;
  profit_margin: number;
}

interface BreakdownRow {
  category_id: string | null;
  category_name: string;
  category_type: string;
  total_amount: number;
  transaction_count: number;
}

export default async function PnlReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const def = defaultRange();
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;

  const supabase = await createClient();
  const comparison = getPreviousPeriod(from, to);

  const [currentRes, previousRes, breakdownRes] = await Promise.all([
    supabase.rpc("get_pnl_report", { p_from_date: from, p_to_date: to }).single(),
    supabase
      .rpc("get_pnl_report", {
        p_from_date: comparison.previous.from,
        p_to_date: comparison.previous.to,
      })
      .single(),
    supabase.rpc("get_expense_breakdown", { p_from_date: from, p_to_date: to }),
  ]);

  const empty: PnlData = {
    revenue_net: 0,
    revenue_gross: 0,
    expense_marketing: 0,
    expense_salary: 0,
    expense_operating: 0,
    expense_tax: 0,
    expense_other: 0,
    total_expense: 0,
    profit_loss: 0,
    profit_margin: 0,
  };

  const current = (currentRes.data ?? empty) as PnlData;
  const previous = (previousRes.data ?? empty) as PnlData;
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
