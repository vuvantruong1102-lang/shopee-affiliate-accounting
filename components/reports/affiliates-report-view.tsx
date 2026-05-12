"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { ReportPeriodSelector } from "./period-selector";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { formatChange } from "@/lib/report-period";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import { toast } from "sonner";

interface Row {
  affiliate_id: string;
  affiliate_name: string;
  affiliate_status: string;
  total_gross: number;
  total_net: number;
  total_tax: number;
  received_net: number;
  pending_net: number;
  total_deposited: number;
  undeposited: number;
  commission_count: number;
}

interface Props {
  from: string;
  to: string;
  current: Row[];
  previous: Row[];
  periodLabel: string;
  previousLabel: string;
}

type SortKey = "name" | "gross" | "net" | "pending" | "received" | "deposited" | "undeposited" | "count";
type SortDir = "asc" | "desc";

export function AffiliatesReportView({
  from,
  to,
  current,
  previous,
  periodLabel,
  previousLabel,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("net");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Map previous theo affiliate_id
  const previousMap = useMemo(
    () => new Map(previous.map((p) => [p.affiliate_id, p])),
    [previous],
  );

  // Filter + sort
  const filtered = useMemo(() => {
    let result = current.filter((a) =>
      a.affiliate_name.toLowerCase().includes(search.toLowerCase()),
    );

    result = [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.affiliate_name.localeCompare(b.affiliate_name) * dir;
        case "gross":
          return (Number(a.total_gross) - Number(b.total_gross)) * dir;
        case "net":
          return (Number(a.total_net) - Number(b.total_net)) * dir;
        case "pending":
          return (Number(a.pending_net) - Number(b.pending_net)) * dir;
        case "received":
          return (Number(a.received_net) - Number(b.received_net)) * dir;
        case "deposited":
          return (Number(a.total_deposited) - Number(b.total_deposited)) * dir;
        case "undeposited":
          return (Number(a.undeposited) - Number(b.undeposited)) * dir;
        case "count":
          return (Number(a.commission_count) - Number(b.commission_count)) * dir;
      }
    });
    return result;
  }, [current, search, sortKey, sortDir]);

  // Totals
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        gross: acc.gross + Number(r.total_gross),
        net: acc.net + Number(r.total_net),
        tax: acc.tax + Number(r.total_tax),
        received: acc.received + Number(r.received_net),
        pending: acc.pending + Number(r.pending_net),
        deposited: acc.deposited + Number(r.total_deposited),
        undeposited: acc.undeposited + Number(r.undeposited),
        count: acc.count + Number(r.commission_count),
      }),
      {
        gross: 0,
        net: 0,
        tax: 0,
        received: 0,
        pending: 0,
        deposited: 0,
        undeposited: 0,
        count: 0,
      },
    );
  }, [filtered]);

  // Total period trước
  const previousTotals = useMemo(() => {
    return previous.reduce(
      (acc, r) => ({
        gross: acc.gross + Number(r.total_gross),
        net: acc.net + Number(r.total_net),
      }),
      { gross: 0, net: 0 },
    );
  }, [previous]);

  const totalChange = formatChange(totals.net, previousTotals.net);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handleExport() {
    const headers = [
      "Affiliate",
      "Trạng thái",
      "Số đợt",
      "Gross",
      "Thuế KT",
      "Net",
      "Shopee chưa chuyển",
      "Đã nhận",
      "Đã nộp",
      "Đang cầm",
    ];
    const rows = filtered.map((a) => [
      a.affiliate_name,
      a.affiliate_status,
      Number(a.commission_count),
      Number(a.total_gross),
      Number(a.total_tax),
      Number(a.total_net),
      Number(a.pending_net),
      Number(a.received_net),
      Number(a.total_deposited),
      Number(a.undeposited),
    ]);
    rows.push([]);
    rows.push([
      "TỔNG CỘNG",
      "",
      totals.count,
      totals.gross,
      totals.tax,
      totals.net,
      totals.pending,
      totals.received,
      totals.deposited,
      totals.undeposited,
    ]);
    const csv = buildCsv(headers, rows);
    downloadCsv(`bao-cao-affiliate-${from}-den-${to}.csv`, csv);
    toast.success("Đã tải xuống CSV");
  }

  return (
    <div className="space-y-6">
      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">BÁO CÁO THEO AFFILIATE</h1>
        <p className="text-sm">{periodLabel}</p>
        <hr className="my-3" />
      </div>

      <ReportPeriodSelector from={from} to={to} onExport={handleExport} />

      {/* KPI tổng */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">Tổng Net (kỳ này)</p>
            <p className="text-xl font-semibold mt-2 tabular-nums">
              {formatCurrency(totals.net)}
            </p>
            <p className={cn("text-xs mt-2 font-medium", totalChange.className)}>
              {totalChange.text} vs {previousLabel}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">Đã nhận về</p>
            <p className="text-xl font-semibold mt-2 tabular-nums text-success">
              {formatCurrency(totals.received)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Đang chờ {formatCurrency(totals.pending)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">Đã nộp công ty</p>
            <p className="text-xl font-semibold mt-2 tabular-nums">
              {formatCurrency(totals.deposited)}
            </p>
          </CardContent>
        </Card>
        <Card className={totals.undeposited > 1000000 ? "border-warning/30" : ""}>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">Đang cầm chưa nộp</p>
            <p
              className={cn(
                "text-xl font-semibold mt-2 tabular-nums",
                totals.undeposited > 1000000 ? "text-warning" : "",
              )}
            >
              {formatCurrency(totals.undeposited)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {filtered.filter((a) => a.undeposited > 1000000).length} người
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bảng */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">
              {filtered.length} affiliate có hoa hồng trong kỳ
            </CardTitle>
            <div className="relative print:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Tìm affiliate..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-56"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <SortableHeader
                    label="Affiliate"
                    sortKey="name"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="left"
                  />
                  <SortableHeader
                    label="Số đợt"
                    sortKey="count"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="center"
                  />
                  <SortableHeader
                    label="Gross"
                    sortKey="gross"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Net"
                    sortKey="net"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Shopee chưa chuyển"
                    sortKey="pending"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Đã nhận"
                    sortKey="received"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Đã nộp"
                    sortKey="deposited"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Đang cầm"
                    sortKey="undeposited"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      Không có affiliate nào có hoa hồng trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => {
                    const prev = previousMap.get(a.affiliate_id);
                    const netChange = prev
                      ? formatChange(Number(a.total_net), Number(prev.total_net))
                      : null;

                    return (
                      <tr
                        key={a.affiliate_id}
                        className={cn(
                          "border-b border-border last:border-0 hover:bg-muted/40 transition-colors",
                          Number(a.undeposited) > 1000000 && "bg-warning/5",
                        )}
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`/affiliates/${a.affiliate_id}`}
                            className="font-medium hover:text-primary"
                          >
                            {a.affiliate_name}
                          </Link>
                          {a.affiliate_status !== "active" && (
                            <Badge variant="neutral" className="ml-2 text-[10px]">
                              {a.affiliate_status === "paused" ? "Tạm dừng" : "Đã đóng"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center tabular-nums text-muted-foreground">
                          {a.commission_count}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {formatCurrency(a.total_gross)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums font-medium">
                          <div>{formatCurrency(a.total_net)}</div>
                          {netChange && (
                            <div className={cn("text-[10px] mt-0.5", netChange.className)}>
                              {netChange.text}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {Number(a.pending_net) > 0 ? (
                            <span className="text-warning font-medium inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatCurrency(a.pending_net)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-success">
                          {formatCurrency(a.received_net)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {formatCurrency(a.total_deposited)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {Number(a.undeposited) > 1000000 ? (
                            <span className="text-warning font-medium inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {formatCurrency(a.undeposited)}
                            </span>
                          ) : Number(a.undeposited) > 0 ? (
                            <span className="text-muted-foreground">
                              {formatCurrency(a.undeposited)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td className="px-6 py-3">Tổng cộng</td>
                    <td className="px-6 py-3 text-center tabular-nums">{totals.count}</td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(totals.gross)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(totals.net)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-warning">
                      {formatCurrency(totals.pending)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-success">
                      {formatCurrency(totals.received)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(totals.deposited)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(totals.undeposited)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onClick: (key: SortKey) => void;
  align: "left" | "center" | "right";
}) {
  const isActive = currentSort === sortKey;
  const Icon = !isActive ? ArrowUpDown : currentDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn(
        `font-medium px-6 py-2.5 cursor-pointer hover:text-foreground select-none`,
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-right",
        isActive && "text-foreground",
      )}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className="w-3 h-3 opacity-50" />
      </span>
    </th>
  );
}
