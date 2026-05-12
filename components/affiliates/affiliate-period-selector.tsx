"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Preset = "all" | "this_week" | "this_month" | "last_month" | "this_year" | "custom";

interface Props {
  from?: string;
  to?: string;
  preset: Preset;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "this_week", label: "Tuần này" },
  { value: "this_month", label: "Tháng này" },
  { value: "last_month", label: "Tháng trước" },
  { value: "this_year", label: "Năm này" },
  { value: "custom", label: "Tùy chọn" },
];

export function AffiliatePeriodSelector({ from, to, preset }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function applyPreset(p: Preset) {
    const params = new URLSearchParams(searchParams);
    const now = new Date();

    if (p === "all") {
      params.delete("from");
      params.delete("to");
      params.delete("preset");
    } else if (p === "this_week") {
      const day = now.getDay(); // 0=CN, 1=T2
      const diff = day === 0 ? 6 : day - 1; // tính từ T2
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      params.set("from", toDateStr(monday));
      params.set("to", toDateStr(sunday));
      params.set("preset", "this_week");
    } else if (p === "this_month") {
      params.set("from", toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
      params.set("to", toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      params.set("preset", "this_month");
    } else if (p === "last_month") {
      params.set("from", toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      params.set("to", toDateStr(new Date(now.getFullYear(), now.getMonth(), 0)));
      params.set("preset", "last_month");
    } else if (p === "this_year") {
      params.set("from", `${now.getFullYear()}-01-01`);
      params.set("to", `${now.getFullYear()}-12-31`);
      params.set("preset", "this_year");
    } else if (p === "custom") {
      // Giữ from/to hiện tại, hoặc set tháng này nếu chưa có
      if (!params.get("from")) {
        params.set("from", toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
        params.set("to", toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      }
      params.set("preset", "custom");
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  function changeDate(field: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams);
    params.set(field, value);
    params.set("preset", "custom");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
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

      {preset !== "all" && (
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="date"
            value={from ?? ""}
            onChange={(e) => changeDate("from", e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={to ?? ""}
            onChange={(e) => changeDate("to", e.target.value)}
            className="h-8 w-auto text-xs"
          />
        </div>
      )}
    </div>
  );
}
