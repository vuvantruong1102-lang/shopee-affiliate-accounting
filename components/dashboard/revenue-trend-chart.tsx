"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyRevenue } from "@/types/audit";

interface Props {
  data: MonthlyRevenue[];
}

function compactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}

function fullCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}

export function RevenueTrendChart({ data }: Props) {
  if (data.length === 0 || data.every((d) => Number(d.total_gross) === 0)) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
        Chưa có dữ liệu doanh thu
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: d.year_month,
    "Doanh thu (gross)": Number(d.total_gross),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="month"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          tickFormatter={compactCurrency}
        />
        <Tooltip
          formatter={(value: number) => fullCurrency(value)}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
        />
        <Bar dataKey="Doanh thu (gross)" fill="hsl(220 70% 50%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
