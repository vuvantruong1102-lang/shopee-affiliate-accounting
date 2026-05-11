"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { AffiliateAccount, AffiliateStatus } from "@/types/database";

interface Props {
  data: AffiliateAccount[];
}

const STATUS_LABEL: Record<AffiliateStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Hoạt động", variant: "success" },
  paused: { label: "Tạm dừng", variant: "warning" },
  closed: { label: "Đã đóng", variant: "neutral" },
};

export function AffiliateTable({ data }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AffiliateStatus | "all">("all");

  const filtered = data.filter((a) => {
    const matchSearch =
      search === "" ||
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      (a.shopee_account_email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">Danh sách</CardTitle>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AffiliateStatus | "all")}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="active">Hoạt động</option>
              <option value="paused">Tạm dừng</option>
              <option value="closed">Đã đóng</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left font-medium px-6 py-3">Họ và tên</th>
                <th className="text-left font-medium px-6 py-3">Email</th>
                <th className="text-left font-medium px-6 py-3">Ngân hàng</th>
                <th className="text-center font-medium px-6 py-3">Người PT</th>
                <th className="text-left font-medium px-6 py-3">Ngày bắt đầu</th>
                <th className="text-center font-medium px-6 py-3">Trạng thái</th>
                <th className="w-10 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const status = STATUS_LABEL[a.status];
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors group"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/affiliates/${a.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {a.full_name}
                      </Link>
                      {a.cccd && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          CCCD: {a.cccd}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{a.email}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {a.bank_name ? (
                        <div>
                          <div>{a.bank_name}</div>
                          {a.bank_account_number && (
                            <div className="text-xs font-mono">
                              {a.bank_account_number}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center tabular-nums">
                      {a.dependent_count}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground tabular-nums">
                      {formatDate(a.start_date)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        href={`/affiliates/${a.id}`}
                        className="block p-1 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Không tìm thấy kết quả phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
