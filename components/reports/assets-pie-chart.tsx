"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface PieDataItem {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: PieDataItem[];
  total: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: PieDataItem;
}

function CustomTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  total: number;
}) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";

  return (
    <div className="bg-card border border-border rounded-md shadow-md px-3 py-2 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: item.payload.color }}
        />
        <span className="font-medium">{item.name}</span>
      </div>
      <div className="tabular-nums font-semibold">{formatCurrency(item.value)}</div>
      <div className="text-muted-foreground">{percent}% tổng tài sản</div>
    </div>
  );
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string; payload: PieDataItem }> }) {
  if (!payload) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 px-2">
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground truncate">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AssetsPieChart({ data, total }: Props) {
  return (
    <div className="w-full">
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--card)" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
            <Legend content={<CustomLegend />} verticalAlign="bottom" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
