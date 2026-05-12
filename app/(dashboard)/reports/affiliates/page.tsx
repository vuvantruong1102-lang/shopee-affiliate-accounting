import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPreviousPeriod, formatDateRangeLabel } from "@/lib/report-period";
import { AffiliatesReportView } from "@/components/reports/affiliates-report-view";

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

export default async function AffiliatesReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const def = defaultRange();
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;

  const supabase = await createClient();
  const comparison = getPreviousPeriod(from, to);

  const [currentRes, previousRes] = await Promise.all([
    supabase.rpc("get_affiliates_report", { p_from_date: from, p_to_date: to }),
    supabase.rpc("get_affiliates_report", {
      p_from_date: comparison.previous.from,
      p_to_date: comparison.previous.to,
    }),
  ]);

  type Row = {
    affiliate_id: string;
    affiliate_name: string;
    affiliate_status: string;
    total_gross: number;
    total_net: number;
    total_tax: number;
    received_net: number;
    pending_net: number;
    total_deposited: number;
    undeposited: number;
    commission_count: number;
  };

  const current = (currentRes.data ?? []) as Row[];
  const previous = (previousRes.data ?? []) as Row[];

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
        title="Báo cáo theo Affiliate"
        description={`${label} • So sánh với ${prevLabel}`}
      />

      <AffiliatesReportView
        from={from}
        to={to}
        current={current}
        previous={previous}
        periodLabel={label}
        previousLabel={prevLabel}
      />
    </div>
  );
}
