"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, RotateCcw, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/types/audit";

interface Props {
  logs: AuditLog[];
  currentTableFilter?: string;
  currentActionFilter?: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  create: { label: "Tạo mới", icon: Plus, color: "text-success" },
  update: { label: "Sửa", icon: Pencil, color: "text-warning" },
  delete: { label: "Xóa", icon: Trash2, color: "text-destructive" },
  restore: { label: "Khôi phục", icon: RotateCcw, color: "text-primary" },
};

const TABLE_LABELS: Record<string, string> = {
  cash_transactions: "Sổ tiền mặt",
  bank_transactions: "Sổ ngân hàng",
  commissions: "Hoa hồng",
  affiliate_accounts: "Affiliate",
  shopee_payments: "Đợt Shopee",
};

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

function formatFullTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogList({ logs, currentTableFilter, currentActionFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Lấy unique tables và actions từ logs hiện có để render filter
  const uniqueTables = Array.from(new Set(logs.map((l) => l.table_name)));
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={currentTableFilter ?? ""}
              onChange={(e) => setFilter("table", e.target.value || null)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Tất cả bảng</option>
              {uniqueTables.map((t) => (
                <option key={t} value={t}>
                  {TABLE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
            <select
              value={currentActionFilter ?? ""}
              onChange={(e) => setFilter("action", e.target.value || null)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Tất cả hành động</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]?.label ?? a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {logs.map((log) => {
            const action = ACTION_LABELS[log.action] ?? {
              label: log.action,
              icon: Pencil,
              color: "text-muted-foreground",
            };
            const Icon = action.icon;

            return (
              <div
                key={log.id}
                className="px-6 py-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center",
                      action.color,
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{log.description}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <Badge variant="neutral" className="text-[10px]">
                        {TABLE_LABELS[log.table_name] ?? log.table_name}
                      </Badge>
                      <Badge variant="neutral" className="text-[10px]">
                        {action.label}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.user_email ?? "Không rõ"}
                      </span>
                      <span title={formatFullTime(log.created_at)}>
                        • {formatRelativeTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
