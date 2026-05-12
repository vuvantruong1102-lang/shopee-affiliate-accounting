"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Printer, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

type Preset = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_year" | "last_year" | "custom";

interface Props {
  from: string;
  to: string;
  onExport?: () => void;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PRESETS: Array<{ value: Preset; label: string; range: () => { from: string; to: string } }> = [
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
    value: "this_quarter",
    label: "Quý này",
    range: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      return {
        from: toDateStr(new Date(now.getFullYear(), q * 3, 1)),
        to: toDateStr(new Date(now.getFullYear(), q * 3 + 3, 0)),
      };
    },
  },
  {
    value: "this_year",
    label: "Năm này",
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

export function ReportPeriodSelector({ from, to, onExport }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function applyPreset(preset: Preset) {
    const found = PRESETS.find((p) => p.value === preset);
    if (!found) return;
    const r = found.range();
    const params = new URLSearchParams(searchParams);
    params.set("from", r.from);
    params.set("to", r.to);
    router.push(`${pathname}?${params.toString()}`);
  }

  function changeDate(field: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(field, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handlePrint() {
    window.print();
  }

  // Detect preset hiện tại
  const currentPreset: Preset = (() => {
    for (const p of PRESETS) {
      const r = p.range();
      if (r.from === from && r.to === to) return p.value;
    }
    return "custom";
  })();

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-background">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => applyPreset(p.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                currentPreset === p.value
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

      <div className="flex items-center gap-2">
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Xuất Excel
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5" />
          In/PDF
        </Button>
      </div>
    </div>
  );
}
