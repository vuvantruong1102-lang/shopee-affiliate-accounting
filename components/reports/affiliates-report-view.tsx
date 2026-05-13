"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Hourglass,
} from "lucide-react";
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
  shopee_processing_gross?: number;
  shopee_processing_net?: number;
}

interface Props {
  from: string;
  to: string;
  current: Row[];
  previous: Row[];
  periodLabel: string;
  previousLabel: string;
  preset?: string;
}

type SortKey =
  | "name"
  | "count"
  | "totalNet"
  | "processing"
  | "pending"
  | "received"
  | "deposited"
  | "undeposited";
type SortDir = "asc" | "desc";

// Tổng HH Net = Đã nhận + Shopee chưa chuyển + Shopee đang xử lý (Net)
function computeTotalNet(r: Row): number {
  return (
    Number(r.received_net) +
    Number(r.pending_net) +
    Number(r.shopee_processing_net ?? 0)
  );
}

export function AffiliatesReportView({
  from,
  to,
  current,
  previous,
  periodLabel,
  previousLabel,
  preset = "custom",
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalNet");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ✨ Khi chọn "Tất cả" → hiển thị đầy đủ. Khác → ẩn KPI + cột "Đã nộp" & "Đang cầm"
  const isAllTime = preset === "all";

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
        case "count":
          return (Number(a.commission_count) - Number(b.commission_count)) * dir;
        case "totalNet":
          return (computeTotalNet(a) - computeTotalNet(b)) * dir;
        case "processing":
          return (
            (Number(a.shopee_processing_net ?? 0) -
              Number(b.shopee_processing_net ?? 0)) *
            dir
          );
        case "pending":
          return (Number(a.pending_net) - Number(b.pending_net)) * dir;
        case "received":
          return (Number(a.received_net) - Number(b.received_net)) * dir;
        case "deposited":
          return (Number(a.total_deposited) - Number(b.total_deposited)) * dir;
        case "undeposited":
          return (Number(a.undeposited) - Number(b.undeposited)) * dir;
      }
    });
    return result;
  }, [current, search, sortKey, sortDir]);

  // Totals
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        const processingNet = Number(r.shopee_processing_net ?? 0);
        const totalNet = computeTotalNet(r);
        return {
          count: acc.count + Number(r.commission_count),
          totalNet: acc.totalNet + totalNet,
          received: acc.received + Number(r.received_net),
          pending: acc.pending + Number(r.pending_net),
          processing: acc.processing + processingNet,
          deposited: acc.deposited + Number(r.total_deposited),
          undeposited: acc.undeposited + Number(r.undeposited),
        };
      },
      {
        count: 0,
        totalNet: 0,
        received: 0,
        pending: 0,
        processing: 0,
        deposited: 0,
        undeposited: 0,
      },
    );
  }, [filtered]);

  // Total period trước
  const previousTotals = useMemo(() => {
    return previous.reduce(
      (acc, r) => ({
        totalNet: acc.totalNet + computeTotalNet(r),
      }),
      { totalNet: 0 },
    );
  }, [previous]);

  const totalChange = formatChange(totals.totalNet, previousTotals.totalNet);

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
      "Tổng HH Net",
      "Shopee đang xử lý (Net)",
      "Shopee chưa chuyển",
      "Đã nhận",
      ...(isAllTime ? ["Đã nộp", "Đang cầm"] : []),
    ];
    const rows = filtered.map((a) => [
      a.affiliate_name,
      a.affiliate_status,
      Number(a.commission_count),
      computeTotalNet(a),
      Number(a.shopee_processing_net ?? 0),
      Number(a.pending_net),
      Number(a.received_net),
      ...(isAllTime
        ? [Number(a.total_deposited), Number(a.undeposited)]
        : []),
    ]);
    rows.push([]);
    rows.push([
      "TỔNG CỘNG",
      "",
      totals.count,
      totals.totalNet,
      totals.processing,
      totals.pending,
      totals.received,
      ...(isAllTime ? [totals.deposited, totals.undeposited] : []),
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

      {/* KPI tổng — số ô phụ thuộc preset */}
      <div
        className={cn(
          "grid gap-4",
          isAllTime ? "md:grid-cols-4" : "md:grid-cols-2",
        )}
      >
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">
              Tổng HH Net (kỳ này)
            </p>
            <p className="text-xl font-semibold mt-2 tabular-nums">
              {formatCurrency(totals.totalNet)}
            </p>
            {!isAllTime && (
              <p className={cn("text-xs mt-2 font-medium", totalChange.className)}>
                {totalChange.text} vs {previousLabel}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Đã nhận + Chưa chuyển + Đang xử lý
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
        {isAllTime && (
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground font-medium">Đã nộp công ty</p>
              <p className="text-xl font-semibold mt-2 tabular-nums">
                {formatCurrency(totals.deposited)}
              </p>
            </CardContent>
          </Card>
        )}
        {isAllTime && (
          <Card className={totals.undeposited > 1000000 ? "border-warning/30" : ""}>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground font-medium">
                Đang cầm chưa nộp
              </p>
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
        )}
      </div>

      {/* Bảng */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">
              {filtered.length} affiliate trong kỳ
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
                    label="Tổng HH Net"
                    sortKey="totalNet"
                    currentSort={sortKey}
                    currentDir={sortDir}
                    onClick={toggleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Shopee đang xử lý"
                    sortKey="processing"
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
                  {isAllTime && (
                    <SortableHeader
                      label="Đã nộp"
                      sortKey="deposited"
                      currentSort={sortKey}
                      currentDir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                  )}
                  {isAllTime && (
                    <SortableHeader
                      label="Đang cầm"
                      sortKey="undeposited"
                      currentSort={sortKey}
                      currentDir={sortDir}
                      onClick={toggleSort}
                      align="right"
                    />
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAllTime ? 8 : 6}
                      className="px-6 py-12 text-center text-muted-foreground"
                    >
                      Không có affiliate nào trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => {
                    const totalNet = computeTotalNet(a);
                    const processingNet = Number(a.shopee_processing_net ?? 0);

                    return (
                      <tr
                        key={a.affiliate_id}
                        className={cn(
                          "border-b border-border last:border-0 hover:bg-muted/40 transition-colors",
                          isAllTime &&
                            Number(a.undeposited) > 1000000 &&
                            "bg-warning/5",
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
                        <td className="px-6 py-3 text-right tabular-nums font-semibold">
                          {formatCurrency(totalNet)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {processingNet > 0 ? (
                            <span className="text-purple-500 font-medium inline-flex items-center gap-1">
                              <Hourglass className="w-3 h-3" />
                              {formatCurrency(processingNet)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
                        {isAllTime && (
                          <td className="px-6 py-3 text-right tabular-nums">
                            {Number(a.total_deposited) > 0 ? (
                              formatCurrency(a.total_deposited)
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                        {isAllTime && (
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
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td className="px-6 py-3">Tổng cộng</td>
                    <td className="px-6 py-3 text-center tabular-nums">
                      {totals.count}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(totals.totalNet)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-purple-500">
                      {formatCurrency(totals.processing)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-warning">
                      {formatCurrency(totals.pending)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-success">
                      {formatCurrency(totals.received)}
                    </td>
                    {isAllTime && (
                      <td className="px-6 py-3 text-right tabular-nums">
                        {formatCurrency(totals.deposited)}
                      </td>
                    )}
                    {isAllTime && (
                      <td className="px-6 py-3 text-right tabular-nums">
                        {formatCurrency(totals.undeposited)}
                      </td>
                    )}
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
