"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  Save,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PeriodFilter } from "./period-filter";
import { TransactionEditDialog } from "./transaction-edit-dialog";
import { DailyChart } from "./daily-chart";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import { deleteCashTransaction } from "@/app/(dashboard)/cash-book/actions";
import { toast } from "sonner";
import type {
  CashTransaction,
  ExpenseCategory,
  AffiliateAccount,
  PeriodType,
} from "@/types/database";
import type { DateRange } from "@/lib/date-period";

interface CashBookStats {
  total_income: number;
  total_expense: number;
  net_change: number;
  transaction_count: number;
  opening_balance: number;
  closing_balance: number;
}

interface DailyData {
  day: string;
  income: number;
  expense: number;
}

interface Props {
  transactions: CashTransaction[];
  stats: CashBookStats;
  dailyData: DailyData[];
  categories: ExpenseCategory[];
  affiliates: Pick<AffiliateAccount, "id" | "full_name">[];
  period: PeriodType;
  range: DateRange;
}

export function CashBookView({
  transactions,
  stats,
  dailyData,
  categories,
  affiliates,
  period,
  range,
}: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [editing, setEditing] = useState<CashTransaction | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const affiliateMap = useMemo(
    () => new Map(affiliates.map((a) => [a.id, a.full_name])),
    [affiliates],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = typeFilter === "all" || t.trans_type === typeFilter;
      const matchSearch =
        search === "" ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        (t.depositor_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (affiliateMap.get(t.account_id ?? "") ?? "")
          .toLowerCase()
          .includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [transactions, search, typeFilter, affiliateMap]);

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa giao dịch này?\n\nNếu là giao dịch nộp tiền vào ngân hàng, cả giao dịch bên sổ ngân hàng cũng sẽ bị xóa.\n\nHành động này không thể hoàn tác.")) {
      return;
    }
    setDeleting(id);
    try {
      const result = await deleteCashTransaction(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã xóa giao dịch");
      }
    } finally {
      setDeleting(null);
    }
  }

  function handleExportCsv() {
    const headers = [
      "Ngày",
      "Loại",
      "Số tiền",
      "Diễn giải",
      "Affiliate/Người liên quan",
      "Khoản mục chi",
      "Số dư sau GD",
    ];
    const rows = filtered.map((t) => [
      formatDate(t.trans_date),
      t.trans_type === "income" ? "Thu" : "Chi",
      Number(t.amount),
      t.description,
      t.account_id ? affiliateMap.get(t.account_id) ?? "" : t.depositor_name ?? "",
      t.expense_category_id ? categoryMap.get(t.expense_category_id) ?? "" : "",
      Number(t.balance_after ?? 0),
    ]);
    const csv = buildCsv(headers, rows);
    const filename = `so-tien-mat-${range.from}-den-${range.to}.csv`;
    downloadCsv(filename, csv);
    toast.success("Đã tải xuống CSV");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Print header - chỉ hiện khi in */}
      <div className="hidden print:block print-header">
        <h1 className="text-xl font-bold">SỔ TIỀN MẶT</h1>
        <p className="text-sm">{range.label} ({range.from} - {range.to})</p>
        <p className="text-xs text-muted-foreground mt-1">In ngày {formatDate(new Date().toISOString().split("T")[0])}</p>
        <hr className="my-3" />
      </div>

      {/* Toolbar — ẩn khi in */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <PeriodFilter period={period} range={range} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" />
            In/PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tổng thu"
          value={formatCurrency(stats.total_income)}
          subtitle={`${filtered.filter((t) => t.trans_type === "income").length} giao dịch`}
          icon={ArrowDownCircle}
          variant="success"
        />
        <KpiCard
          label="Tổng chi"
          value={formatCurrency(stats.total_expense)}
          subtitle={`${filtered.filter((t) => t.trans_type === "expense").length} giao dịch`}
          icon={ArrowUpCircle}
          variant="danger"
        />
        <KpiCard
          label="Chênh lệch"
          value={formatCurrency(stats.net_change)}
          subtitle={stats.net_change >= 0 ? "Tăng" : "Giảm"}
          icon={stats.net_change >= 0 ? TrendingUp : TrendingDown}
          variant={stats.net_change >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Số dư cuối kỳ"
          value={formatCurrency(stats.closing_balance)}
          subtitle={`Đầu kỳ: ${formatCurrency(stats.opening_balance)}`}
          icon={Wallet}
        />
      </div>

      {/* Chart */}
      {dailyData.length > 0 && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Biến động theo ngày</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyChart data={dailyData} />
          </CardContent>
        </Card>
      )}

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base">Chi tiết giao dịch</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {filtered.length} / {transactions.length} giao dịch
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 w-56"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="income">Thu</option>
                <option value="expense">Chi</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left font-medium px-6 py-2.5">Ngày</th>
                  <th className="text-left font-medium px-6 py-2.5">Diễn giải</th>
                  <th className="text-left font-medium px-6 py-2.5">Liên quan</th>
                  <th className="text-right font-medium px-6 py-2.5">Thu</th>
                  <th className="text-right font-medium px-6 py-2.5">Chi</th>
                  <th className="text-right font-medium px-6 py-2.5">Số dư</th>
                  <th className="w-20 px-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      Không có giao dịch trong khoảng thời gian này
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const relatedName = t.account_id
                      ? affiliateMap.get(t.account_id) ?? t.depositor_name
                      : t.depositor_name;
                    const categoryName = t.expense_category_id
                      ? categoryMap.get(t.expense_category_id)
                      : null;

                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors group"
                      >
                        <td className="px-6 py-3 tabular-nums whitespace-nowrap">
                          {formatDate(t.trans_date)}
                        </td>
                        <td className="px-6 py-3">
                          <div>{t.description}</div>
                          {categoryName && (
                            <Badge variant="neutral" className="mt-1 text-[10px]">
                              {categoryName}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {relatedName ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {t.trans_type === "income" ? (
                            <span className="text-success font-medium">
                              +{formatCurrency(t.amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">
                          {t.trans_type === "expense" ? (
                            <span className="text-destructive font-medium">
                              -{formatCurrency(t.amount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums font-medium">
                          {formatCurrency(t.balance_after ?? 0)}
                        </td>
                        <td className="px-2 py-3 print:hidden">
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditing(t)}
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Sửa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              disabled={deleting === t.id}
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Xóa"
                            >
                              {deleting === t.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td colSpan={3} className="px-6 py-3 text-sm">
                      Tổng cộng ({filtered.length} giao dịch)
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-success">
                      +{formatCurrency(
                        filtered
                          .filter((t) => t.trans_type === "income")
                          .reduce((s, t) => s + Number(t.amount), 0),
                      )}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-destructive">
                      -{formatCurrency(
                        filtered
                          .filter((t) => t.trans_type === "expense")
                          .reduce((s, t) => s + Number(t.amount), 0),
                      )}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {formatCurrency(stats.closing_balance)}
                    </td>
                    <td className="print:hidden"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {editing && (
        <TransactionEditDialog
          transaction={editing}
          type="cash"
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "danger" | "warning";
}) {
  const iconColor = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[variant];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-semibold mt-2 tabular-nums tracking-tight">
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
          </div>
          <Icon className={cn("w-4 h-4 flex-shrink-0", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}
