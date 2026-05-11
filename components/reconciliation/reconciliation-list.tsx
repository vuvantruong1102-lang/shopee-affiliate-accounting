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
import { Search, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ShopeePayment } from "@/types/shopee-reconciliation";
import type { AffiliateAccount } from "@/types/database";

interface Props {
  payments: ShopeePayment[];
  affiliates: Pick<AffiliateAccount, "id" | "full_name">[];
}

export function ReconciliationList({ payments, affiliates }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "received" | "pending">("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const affiliateMap = new Map(affiliates.map((a) => [a.id, a.full_name]));

  const filtered = payments.filter((p) => {
    const matchSearch =
      search === "" ||
      p.payment_code.toLowerCase().includes(search.toLowerCase()) ||
      (affiliateMap.get(p.account_id) ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "received" && p.is_received) ||
      (statusFilter === "pending" && !p.is_received);
    const matchAccount = accountFilter === "all" || p.account_id === accountFilter;
    return matchSearch && matchStatus && matchAccount;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">Danh sách đợt thanh toán</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Mã thanh toán..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-56"
              />
            </div>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">Tất cả affiliate</option>
              {affiliates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              className="h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="received">Đã nhận</option>
              <option value="pending">Chưa nhận</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left font-medium px-6 py-3">Ngày TT</th>
                <th className="text-left font-medium px-6 py-3">Mã thanh toán</th>
                <th className="text-left font-medium px-6 py-3">Affiliate</th>
                <th className="text-right font-medium px-6 py-3">Gross</th>
                <th className="text-right font-medium px-6 py-3">Thuế</th>
                <th className="text-right font-medium px-6 py-3">Net</th>
                <th className="text-center font-medium px-6 py-3">Trạng thái</th>
                <th className="w-10 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Không có kết quả phù hợp
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors group"
                  >
                    <td className="px-6 py-3 tabular-nums whitespace-nowrap">
                      {formatDate(p.payment_date)}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">
                      <Link
                        href={`/reconciliation/${p.id}`}
                        className="hover:text-primary"
                      >
                        {p.payment_code}
                      </Link>
                    </td>
                    <td className="px-6 py-3">
                      {affiliateMap.get(p.account_id) ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(p.total_gross)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(p.total_tax)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(p.total_net)}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {p.is_received ? (
                        <Badge variant="success">
                          <CheckCircle2 className="w-3 h-3" />
                          Đã nhận
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <Clock className="w-3 h-3" />
                          Chưa nhận
                        </Badge>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        href={`/reconciliation/${p.id}`}
                        className="block p-1 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
