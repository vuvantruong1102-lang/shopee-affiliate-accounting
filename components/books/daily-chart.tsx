"use client";

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
import { formatDate } from "@/lib/utils";

interface DailyData {
  day: string;
  income: number;
  expense: number;
}

interface Props {
  data: DailyData[];
}

function compactCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}

function fullCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}

export function DailyChart({ data }: Props) {
  const chartData = data.map((d) => ({
    day: formatDate(d.day),
    Thu: Number(d.income),
    Chi: Number(d.expense),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="day"
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
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Bar dataKey="Thu" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Chi" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
