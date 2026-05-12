"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet, Link2, ArrowDownToLine } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export type ActivityItem =
  | {
      type: "commission";
      id: string;
      date: string; // earned_date
      gross: number;
      tax: number;
      net: number;
      status: "received" | "pending";
      received_date: string | null;
      is_from_shopee: boolean;
      description: string | null;
    }
  | {
      type: "deposit";
      id: string;
      date: string; // trans_date
      amount: number;
      bank_name: string;
      account_number: string;
      description: string | null;
      notes: string | null;
    };

interface Props {
  items: ActivityItem[];
}

export function ActivityLog({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Không có hoạt động nào trong khoảng thời gian này
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item) =>
        item.type === "commission" ? (
          <CommissionItem key={`c-${item.id}`} item={item} />
        ) : (
          <DepositItem key={`d-${item.id}`} item={item} />
        ),
      )}
    </div>
  );
}

function CommissionItem({
  item,
}: {
  item: Extract<ActivityItem, { type: "commission" }>;
}) {
  return (
    <div className="flex items-start gap-3 px-6 py-3 hover:bg-muted/30">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <TrendingUp className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium">Hoa hồng</span>
            {item.is_from_shopee && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] text-primary"
                title="Từ đợt Shopee"
              >
                <Link2 className="w-2.5 h-2.5" />
                Đợt Shopee
              </span>
            )}
            {item.status === "received" ? (
              <Badge variant="success" className="text-[10px]">
                Đã nhận
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px]">
                Chờ nhận
              </Badge>
            )}
          </div>
          <div className="text-right tabular-nums">
            <div className="text-sm font-semibold">
              +{formatCurrency(item.net)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Gross {formatCurrency(item.gross)} − Thuế {formatCurrency(item.tax)}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          📅 {formatDate(item.date)}
          {item.received_date && (
            <span className="ml-2">· Nhận {formatDate(item.received_date)}</span>
          )}
          {item.description && (
            <span className="ml-2 italic">· {item.description}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DepositItem({
  item,
}: {
  item: Extract<ActivityItem, { type: "deposit" }>;
}) {
  return (
    <div className="flex items-start gap-3 px-6 py-3 hover:bg-muted/30">
      <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
        <ArrowDownToLine className="w-4 h-4 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium">Nộp tiền vào công ty</span>
            <Badge variant="success" className="text-[10px]">
              <Wallet className="w-2.5 h-2.5 mr-0.5" />
              Đã nộp
            </Badge>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-sm font-semibold text-success">
              +{formatCurrency(item.amount)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              → Vào TK công ty
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          📅 {formatDate(item.date)}
          <span className="ml-2">
            🏦 {item.bank_name} · <span className="font-mono">{item.account_number}</span>
          </span>
          {item.notes && (
            <span className="ml-2 italic">· {item.notes}</span>
          )}
        </div>
      </div>
    </div>
  );
}
