import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Inbox } from "lucide-react";
import type { Commission, CommissionStatus } from "@/types/database";

const STATUS_LABEL: Record<CommissionStatus, { label: string; variant: "success" | "warning" | "neutral" | "danger" }> = {
  pending: { label: "Chờ nhận", variant: "warning" },
  received: { label: "Đã nhận", variant: "success" },
  cancelled: { label: "Đã hủy", variant: "danger" },
  adjusted: { label: "Đã điều chỉnh", variant: "neutral" },
};

export function CommissionList({ data }: { data: Commission[] }) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-3">
          <Inbox className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Chưa có hoa hồng nào được ghi nhận
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left font-medium px-6 py-3">Ngày chốt</th>
            <th className="text-left font-medium px-6 py-3">Kỳ</th>
            <th className="text-right font-medium px-6 py-3">Gross</th>
            <th className="text-right font-medium px-6 py-3">Thuế (10%)</th>
            <th className="text-right font-medium px-6 py-3">Thực nhận</th>
            <th className="text-center font-medium px-6 py-3">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c) => {
            const status = STATUS_LABEL[c.status];
            return (
              <tr
                key={c.id}
                className="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td className="px-6 py-3 tabular-nums">
                  {formatDate(c.earned_date)}
                </td>
                <td className="px-6 py-3 text-muted-foreground">
                  T{c.period_month}/{c.period_year}
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {formatCurrency(c.gross_amount)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                  {c.tax_withheld > 0 ? formatCurrency(c.tax_withheld) : "—"}
                </td>
                <td className="px-6 py-3 text-right tabular-nums font-medium">
                  {formatCurrency(c.net_amount)}
                </td>
                <td className="px-6 py-3 text-center">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
