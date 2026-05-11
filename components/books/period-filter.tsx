"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeriodType, DateRange } from "@/lib/date-period";

interface Props {
  period: PeriodType;
  range: DateRange;
}

const PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: "this_month", label: "Tháng này" },
  { value: "last_month", label: "Tháng trước" },
  { value: "this_quarter", label: "Quý này" },
  { value: "this_year", label: "Năm này" },
  { value: "custom", label: "Tùy chỉnh" },
];

export function PeriodFilter({ period, range }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function changePeriod(newPeriod: PeriodType) {
    const params = new URLSearchParams(searchParams);
    params.set("period", newPeriod);
    if (newPeriod !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function changeCustomDate(field: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("period", "custom");
    params.set(field, value);
    if (!params.get("from")) params.set("from", range.from);
    if (!params.get("to")) params.set("to", range.to);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-border bg-background">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => changePeriod(opt.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded transition-colors",
              period === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="date"
            value={range.from}
            onChange={(e) => changeCustomDate("from", e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={range.to}
            onChange={(e) => changeCustomDate("to", e.target.value)}
            className="h-8 w-auto text-xs"
          />
        </div>
      )}
    </div>
  );
}
