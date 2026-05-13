"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Preset =
  | "all"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

interface Props {
  from: string;
  to: string;
  preset: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PRESETS: Array<{
  value: Preset;
  label: string;
  range: () => { from: string; to: string };
}> = [
  {
    value: "all",
    label: "Tất cả",
    range: () => ({ from: "2026-01-01", to: toDateStr(new Date()) }),
  },
  {
    value: "this_week",
    label: "Tuần này",
    range: () => {
      const now = new Date();
      const day = now.getDay() || 7; // Sun=0 → 7
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: toDateStr(monday), to: toDateStr(sunday) };
    },
  },
  {
    value: "this_month",
    label: "Tháng này",
    range: () => {
      const now = new Date();
      return {
        from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    },
  },
  {
    value: "last_month",
    label: "Tháng trước",
    range: () => {
      const now = new Date();
      return {
        from: toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toDateStr(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
  {
    value: "this_year",
    label: "Năm nay",
    range: () => {
      const y = new Date().getFullYear();
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    },
  },
  {
    value: "last_year",
    label: "Năm trước",
    range: () => {
      const y = new Date().getFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    },
  },
];

export function DashboardPeriodSelector({ from, to, preset }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function applyPreset(p: Preset) {
    const found = PRESETS.find((x) => x.value === p);
    if (!found) return;
    const r = found.range();
    const params = new URLSearchParams(searchParams);
    params.set("from", r.from);
    params.set("to", r.to);
    params.set("preset", p);
    router.push(`${pathname}?${params.toString()}`);
  }

  function changeDate(field: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(field, value);
    params.set("preset", "custom");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap print:hidden">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-background">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => applyPreset(p.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded transition-colors",
              preset === p.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <Input
          type="date"
          value={from}
          onChange={(e) => changeDate("from", e.target.value)}
          className="h-8 w-auto text-xs"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => changeDate("to", e.target.value)}
          className="h-8 w-auto text-xs"
        />
      </div>
    </div>
  );
}
