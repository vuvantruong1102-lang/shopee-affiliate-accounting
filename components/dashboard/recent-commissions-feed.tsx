"use client";

import Link from "next/link";
import { CircleDollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface RecentCommission {
  id: string;
  account_id: string;
  affiliate_name: string;
  earned_date: string;
  gross_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
}

interface Props {
  commissions: RecentCommission[];
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

export function RecentCommissionsFeed({ commissions }: Props) {
  if (commissions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Chưa có hoa hồng nào được ghi nhận gần đây
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {commissions.map((c) => (
        <Link
          key={c.id}
          href={`/affiliates/${c.account_id}`}
          className="block px-5 py-3 hover:bg-muted/40 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <CircleDollarSign className="w-4 h-4 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium truncate">
                  <span className="text-muted-foreground">Ghi nhận hoa hồng • </span>
                  {c.affiliate_name}
                </div>
                <div className="text-sm font-semibold tabular-nums text-success whitespace-nowrap">
                  +{formatCurrency(c.net_amount)}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>Ngày HH: {formatDate(c.earned_date)}</span>
                <span>•</span>
                <span>Gross {formatCurrency(c.gross_amount)}</span>
                <span>•</span>
                <span title={new Date(c.created_at).toLocaleString("vi-VN")}>
                  {formatRelativeTime(c.created_at)}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
