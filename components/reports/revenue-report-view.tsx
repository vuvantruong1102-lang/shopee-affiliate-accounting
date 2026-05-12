"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPeriodSelector } from "./period-selector";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { formatChange } from "@/lib/report-period";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RevenueStats {
  total_gross: number;
  total_net: number;
  total_tax: number;
  commission_count: number;
  affiliate_count: number;
  avg_per_commission: number;
}

interface MonthlyData {
  year_month: string;
  total_gross: number;
  total_net: number;
  total_tax: number;
  commission_count: number;
}

interface Props {
  from: string;
  to: string;
  current: RevenueStats;
  previous: RevenueStats;
  monthly: MonthlyData[];
  periodLabel: string;
  previousLabel: string;
}

function compactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}

export function RevenueReportView({
  from,
  to,
  current,
  previous,
  monthly,
  periodLabel,
  previousLabel,
}: Props) {
  function handleExport() {
    const headers = ["Kỳ", "Số đợt HH", "Gross", "Thuế KT", "Net"];
    const rows: (string | number)[][] = [];

    rows.push([
      "Tổng kỳ này",
      Number(current.commission_count),
      Number(current.total_gross),
      Number(current.total_tax),
      Number(current.total_net),
    ]);
    rows.push([
      "Tổng kỳ trước",
      Number(previous.commission_count),
      Number(previous.total_gross),
      Number(previous.total_tax),
      Number(previous.total_net),
    ]);
    rows.push([]);
    rows.push(["Breakdown theo tháng:"]);
    for (const m of monthly) {
      rows.push([
        `Tháng ${m.year_month}`,
        Number(m.commission_count),
        Number(m.total_gross),
        Number(m.total_tax),
        Number(m.total_net),
      ]);
    }

    const csv = buildCsv(headers, rows);
    downloadCsv(`bao-cao-doanh-thu-${from}-den-${to}.csv`, csv);
    toast.success("Đã tải xuống CSV");
  }

  const chartData = monthly.map((m) => ({
    month: m.year_month,
    Gross: Number(m.total_gross),
    Net: Number(m.total_net),
  }));

  return (
    <div className="space-y-6">
      {/* Print header - chỉ hiện khi in */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">BÁO CÁO DOANH THU</h1>
        <p className="text-sm">{periodLabel}</p>
        <p className="text-xs text-muted-foreground">So sánh với {previousLabel}</p>
        <hr className="my-3" />
      </div>

      <ReportPeriodSelector from={from} to={to} onExport={handleExport} />

      {/* 4 KPI có so sánh */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCardCompare
          label="Doanh thu Gross"
          value={current.total_gross}
          previous={previous.total_gross}
          previousLabel={previousLabel}
        />
        <KpiCardCompare
          label="Doanh thu Net"
          value={current.total_net}
          previous={previous.total_net}
          previousLabel={previousLabel}
          highlight
        />
        <KpiCardCompare
          label="Thuế đã khấu trừ"
          value={current.total_tax}
          previous={previous.total_tax}
          previousLabel={previousLabel}
        />
        <KpiCard
          label="Số đợt hoa hồng"
          value={current.commission_count.toString()}
          subtitle={`${current.affiliate_count} affiliate có HH`}
        />
      </div>

      {/* Chart */}
      {monthly.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Doanh thu theo từng tháng</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={compactCurrency}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Gross" fill="hsl(220 70% 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Net" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bảng chi tiết theo tháng */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết theo tháng</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left font-medium px-6 py-2.5">Tháng</th>
                  <th className="text-center font-medium px-6 py-2.5">Số đợt</th>
                  <th className="text-right font-medium px-6 py-2.5">Gross</th>
                  <th className="text-right font-medium px-6 py-2.5">Thuế KT</th>
                  <th className="text-right font-medium px-6 py-2.5">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthly.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      Không có doanh thu trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  monthly.map((m) => (
                    <tr key={m.year_month} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-2.5 font-medium">Tháng {m.year_month}</td>
                      <td className="px-6 py-2.5 text-center tabular-nums text-muted-foreground">
                        {m.commission_count}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums">
                        {formatCurrency(m.total_gross)}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(m.total_tax)}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums font-medium">
                        {formatCurrency(m.total_net)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {monthly.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td className="px-6 py-3">Tổng cộng</td>
                    <td className="px-6 py-3 text-center tabular-nums">
                      {current.commission_count}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(current.total_gross)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(current.total_tax)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(current.total_net)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCardCompare({
  label,
  value,
  previous,
  previousLabel,
  highlight,
}: {
  label: string;
  value: number;
  previous: number;
  previousLabel: string;
  highlight?: boolean;
}) {
  const change = formatChange(value, previous);
  const Icon =
    change.direction === "up" ? TrendingUp : change.direction === "down" ? TrendingDown : Minus;

  return (
    <Card className={highlight ? "border-primary/30" : ""}>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-xl font-semibold mt-2 tabular-nums", highlight && "text-primary")}>
          {formatCurrency(value)}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <Icon className={cn("w-3 h-3", change.className)} />
          <span className={cn("text-xs font-medium tabular-nums", change.className)}>
            {change.text}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            vs {previousLabel}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
          Kỳ trước: {formatCurrency(previous)}
        </p>
      </CardContent>
    </Card>
  );
}

function KpiCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-semibold mt-2 tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
