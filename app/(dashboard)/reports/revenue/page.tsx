import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPreviousPeriod, formatDateRangeLabel } from "@/lib/report-period";
import { RevenueReportView } from "@/components/reports/revenue-report-view";

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

export default async function RevenueReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const def = defaultRange();
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;

  const supabase = await createClient();

  // Tính kỳ trước để so sánh
  const comparison = getPreviousPeriod(from, to);

  const [currentRes, currentMonthlyRes, previousRes] = await Promise.all([
    supabase.rpc("get_revenue_report", { p_from_date: from, p_to_date: to }).single(),
    supabase.rpc("get_revenue_by_month", { p_from_date: from, p_to_date: to }),
    supabase
      .rpc("get_revenue_report", {
        p_from_date: comparison.previous.from,
        p_to_date: comparison.previous.to,
      })
      .single(),
  ]);

  const current = (currentRes.data ?? {
    total_gross: 0,
    total_net: 0,
    total_tax: 0,
    commission_count: 0,
    affiliate_count: 0,
    avg_per_commission: 0,
  }) as {
    total_gross: number;
    total_net: number;
    total_tax: number;
    commission_count: number;
    affiliate_count: number;
    avg_per_commission: number;
  };

  const previous = (previousRes.data ?? {
    total_gross: 0,
    total_net: 0,
    total_tax: 0,
    commission_count: 0,
    affiliate_count: 0,
    avg_per_commission: 0,
  }) as typeof current;

  const monthly = (currentMonthlyRes.data ?? []) as Array<{
    year_month: string;
    total_gross: number;
    total_net: number;
    total_tax: number;
    commission_count: number;
  }>;

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
        title="Báo cáo Doanh thu"
        description={`${label} • So sánh với ${prevLabel}`}
      />

      <RevenueReportView
        from={from}
        to={to}
        current={current}
        previous={previous}
        monthly={monthly}
        periodLabel={label}
        previousLabel={prevLabel}
      />
    </div>
  );
}
