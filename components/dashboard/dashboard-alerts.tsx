"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { DashboardAlert } from "@/types/audit";

interface Props {
  alerts: DashboardAlert[];
}

const SEVERITY_STYLES = {
  high: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    border: "border-l-destructive",
  },
  medium: {
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
    border: "border-l-warning",
  },
  low: {
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    border: "border-l-muted-foreground",
  },
};

const ALERT_DESCRIPTIONS: Record<string, (a: DashboardAlert) => string> = {
  undeposited: (a) => `${a.affiliate_name} đang cầm ${formatCurrency(Number(a.amount))} chưa nộp`,
  unreconciled: (a) =>
    `${a.affiliate_name} có ${a.count_value} đợt chưa đánh dấu, tổng ${formatCurrency(Number(a.amount))}`,
  pending_commission: (a) => a.description,
};

export function DashboardAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Cảnh báo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-success/10 mb-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <p className="text-sm font-medium">Mọi thứ ổn</p>
            <p className="text-xs text-muted-foreground mt-1">
              Không có cảnh báo nào
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...alerts].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const highCount = sorted.filter((a) => a.severity === "high").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          Cảnh báo
          <span className="ml-auto text-xs text-muted-foreground font-normal">
            {alerts.length} mục
            {highCount > 0 && (
              <span className="ml-1.5 text-destructive font-medium">
                ({highCount} quan trọng)
              </span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
          {sorted.map((alert, idx) => {
            const style = SEVERITY_STYLES[alert.severity];
            const renderer = ALERT_DESCRIPTIONS[alert.alert_type];
            const description = renderer ? renderer(alert) : alert.description;

            return (
              <Link
                key={idx}
                href={alert.link_url}
                className={cn(
                  "block px-4 py-3 hover:bg-muted/40 transition-colors group border-l-2",
                  style.border,
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                      style.iconBg,
                    )}
                  >
                    <AlertTriangle className={cn("w-3.5 h-3.5", style.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium mb-0.5">{alert.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {description}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
