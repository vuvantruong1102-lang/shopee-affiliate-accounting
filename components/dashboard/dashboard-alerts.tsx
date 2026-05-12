"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardAlert } from "@/types/audit";

interface Props {
  alerts: DashboardAlert[];
}

const SEVERITY_STYLES = {
  high: {
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    label: "Quan trọng",
  },
  medium: {
    border: "border-warning/30",
    bg: "bg-warning/5",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    label: "Cần xem",
  },
  low: {
    border: "border-border",
    bg: "bg-muted/30",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    label: "Lưu ý",
  },
};

export function DashboardAlerts({ alerts }: Props) {
  const [expanded, setExpanded] = useState(true);

  // Sort by severity: high → medium → low
  const sorted = [...alerts].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const highCount = sorted.filter((a) => a.severity === "high").length;
  const mediumCount = sorted.filter((a) => a.severity === "medium").length;
  const lowCount = sorted.filter((a) => a.severity === "low").length;

  return (
    <Card className="border-warning/20">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-warning" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold">
                {alerts.length} cảnh báo cần xem
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {highCount > 0 && <span className="text-destructive">{highCount} quan trọng</span>}
                {highCount > 0 && mediumCount > 0 && " • "}
                {mediumCount > 0 && <span className="text-warning">{mediumCount} cần xem</span>}
                {(highCount > 0 || mediumCount > 0) && lowCount > 0 && " • "}
                {lowCount > 0 && <span>{lowCount} lưu ý</span>}
              </div>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="border-t border-border divide-y divide-border">
            {sorted.map((alert, idx) => {
              const style = SEVERITY_STYLES[alert.severity];
              return (
                <Link
                  key={idx}
                  href={alert.link_url}
                  className={cn(
                    "block px-5 py-3 hover:bg-muted/40 transition-colors group",
                    style.bg,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                        style.iconBg,
                      )}
                    >
                      <AlertTriangle className={cn("w-3.5 h-3.5", style.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{alert.title}</span>
                        <span
                          className={cn(
                            "text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
                            style.iconBg,
                            style.iconColor,
                          )}
                        >
                          {style.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {alert.description}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
