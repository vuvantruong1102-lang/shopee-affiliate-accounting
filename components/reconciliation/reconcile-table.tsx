"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ReconcileDay } from "@/types/shopee-reconciliation";

interface Props {
  days: ReconcileDay[];
  accountId: string;
}

export function ReconcileTable({ days, accountId }: Props) {
  if (days.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Chưa có chi tiết ngày nào
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left font-medium px-6 py-3">Ngày hoa hồng</th>
            <th className="text-right font-medium px-6 py-3">Shopee báo (Gross)</th>
            <th className="text-right font-medium px-6 py-3">Đã nhập tay (Gross)</th>
            <th className="text-right font-medium px-6 py-3">Chênh lệch</th>
            <th className="text-center font-medium px-6 py-3">Trạng thái</th>
            <th className="w-10 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const isOk = d.status === "matched";
            const isMismatch = d.status === "mismatched";
            const isMissing = d.status === "missing";

            return (
              <tr
                key={d.earned_date}
                className={cn(
                  "border-b border-border last:border-0 transition-colors",
                  isMismatch && "bg-warning/5 hover:bg-warning/10",
                  isMissing && "bg-destructive/5 hover:bg-destructive/10",
                  isOk && "hover:bg-muted/40",
                )}
              >
                <td className="px-6 py-3 tabular-nums whitespace-nowrap">
                  {formatDate(d.earned_date)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {formatCurrency(d.shopee_gross)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {isMissing ? (
                    <span className="text-muted-foreground italic">Chưa nhập</span>
                  ) : (
                    formatCurrency(d.manual_gross)
                  )}
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {isOk ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={cn(
                        "font-medium",
                        isMissing ? "text-destructive" : "text-warning",
                      )}
                    >
                      {d.difference > 0 ? "+" : ""}
                      {formatCurrency(d.difference)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-center">
                  {isOk && (
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3" />
                      Khớp
                    </Badge>
                  )}
                  {isMismatch && (
                    <Badge variant="warning">
                      <AlertTriangle className="w-3 h-3" />
                      Lệch
                    </Badge>
                  )}
                  {isMissing && (
                    <Badge variant="danger">
                      <XCircle className="w-3 h-3" />
                      Thiếu
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-3">
                  {(isMismatch || isMissing) && (
                    <Link
                      href={
                        isMissing
                          ? `/data-entry/commission?account=${accountId}`
                          : `/affiliates/${accountId}`
                      }
                      className="block p-1 text-muted-foreground hover:text-foreground"
                      title={isMissing ? "Nhập hoa hồng" : "Đến trang affiliate"}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold bg-muted/30">
            <td className="px-6 py-3">Tổng cộng</td>
            <td className="px-6 py-3 text-right tabular-nums">
              {formatCurrency(days.reduce((s, d) => s + Number(d.shopee_gross), 0))}
            </td>
            <td className="px-6 py-3 text-right tabular-nums">
              {formatCurrency(days.reduce((s, d) => s + Number(d.manual_gross), 0))}
            </td>
            <td className="px-6 py-3 text-right tabular-nums">
              {(() => {
                const diff = days.reduce((s, d) => s + Number(d.difference), 0);
                const ok = Math.abs(diff) < 1;
                return (
                  <span className={ok ? "text-success" : "text-warning"}>
                    {diff > 0 ? "+" : ""}
                    {formatCurrency(diff)}
                  </span>
                );
              })()}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
