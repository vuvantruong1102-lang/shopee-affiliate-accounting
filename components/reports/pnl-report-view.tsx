"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPeriodSelector } from "./period-selector";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { formatChange } from "@/lib/report-period";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface PnlData {
  revenue_gross: number;
  revenue_net: number;
  total_commission_tax_withheld: number;
  tax_payable: number;
  expense_marketing: number;
  expense_salary: number;
  expense_operating: number;
  expense_tax: number;
  expense_other: number;
  total_expense: number;
  profit_loss: number;
  profit_margin: number;
}

interface BreakdownRow {
  category_id: string | null;
  category_name: string;
  category_type: string;
  total_amount: number;
  transaction_count: number;
}

interface Props {
  from: string;
  to: string;
  current: PnlData;
  previous: PnlData;
  breakdown: BreakdownRow[];
  periodLabel: string;
  previousLabel: string;
}

const EXPENSE_TYPES = [
  { key: "expense_marketing" as const, label: "Marketing & Quảng cáo", color: "hsl(220 70% 50%)" },
  { key: "expense_salary" as const, label: "Lương nhân viên", color: "hsl(280 65% 60%)" },
  { key: "expense_operating" as const, label: "Vận hành", color: "hsl(30 80% 55%)" },
  { key: "expense_tax" as const, label: "Thuế, phí khác (chi trực tiếp)", color: "hsl(340 75% 55%)" },
  { key: "expense_other" as const, label: "Khác", color: "hsl(0 0% 60%)" },
];

export function PnlReportView({
  from,
  to,
  current,
  previous,
  breakdown,
  periodLabel,
  previousLabel,
}: Props) {
  const revenueChange = formatChange(Number(current.revenue_gross), Number(previous.revenue_gross));
  const taxChange = formatChange(Number(current.tax_payable), Number(previous.tax_payable));
  const expenseChange = formatChange(
    Number(current.total_expense),
    Number(previous.total_expense),
  );
  const profitChange = formatChange(Number(current.profit_loss), Number(previous.profit_loss));

  // Pie data: thêm thuế phải nộp vào cơ cấu chi phí (vì giờ thuế cũng được trừ)
  const pieData = [
    { name: "Thuế TNCN phải nộp", value: Number(current.tax_payable), color: "hsl(45 90% 50%)" },
    ...EXPENSE_TYPES.map((e) => ({
      name: e.label,
      value: Number(current[e.key]),
      color: e.color,
    })),
  ].filter((d) => d.value > 0);

  const totalDeduction = Number(current.tax_payable) + Number(current.total_expense);

  function handleExport() {
    const headers = ["Khoản mục", "Số tiền", "% trên DT Gross"];
    const rows: (string | number)[][] = [];

    const gross = Number(current.revenue_gross);
    const pctOf = (v: number) => (gross > 0 ? ((v / gross) * 100).toFixed(2) + "%" : "");

    rows.push(["=== DOANH THU ==="]);
    rows.push(["Doanh thu Gross", gross, "100%"]);
    rows.push(["Doanh thu Net (sau thuế tạm 10%)", Number(current.revenue_net), pctOf(Number(current.revenue_net))]);
    rows.push([]);
    rows.push(["=== THUẾ TNCN PHẢI NỘP ==="]);
    rows.push(["Tổng thuế phải nộp (lũy tiến 5 bậc)", Number(current.tax_payable), pctOf(Number(current.tax_payable))]);
    rows.push(["  Trong đó: thuế tạm Shopee đã KT", Number(current.total_commission_tax_withheld), pctOf(Number(current.total_commission_tax_withheld))]);
    rows.push([
      "  Còn phải nộp thêm",
      Math.max(0, Number(current.tax_payable) - Number(current.total_commission_tax_withheld)),
      "",
    ]);
    rows.push([]);
    rows.push(["=== CHI PHÍ ==="]);
    for (const e of EXPENSE_TYPES) {
      const v = Number(current[e.key]);
      rows.push([e.label, v, pctOf(v)]);
    }
    rows.push(["TỔNG CHI PHÍ", Number(current.total_expense), pctOf(Number(current.total_expense))]);
    rows.push([]);
    rows.push(["=== KẾT QUẢ ==="]);
    rows.push([
      Number(current.profit_loss) >= 0 ? "LÃI" : "LỖ",
      Number(current.profit_loss),
      Number(current.profit_margin).toFixed(2) + "%",
    ]);
    rows.push([]);
    rows.push(["=== BREAKDOWN CHI PHÍ THEO KHOẢN MỤC ==="]);
    for (const b of breakdown) {
      rows.push([
        b.category_name,
        Number(b.total_amount),
        Number(current.total_expense) > 0
          ? ((Number(b.total_amount) / Number(current.total_expense)) * 100).toFixed(2) + "%"
          : "",
      ]);
    }
    const csv = buildCsv(headers, rows);
    downloadCsv(`bao-cao-pnl-${from}-den-${to}.csv`, csv);
    toast.success("Đã tải xuống CSV");
  }

  const isProfit = Number(current.profit_loss) >= 0;
  const gross = Number(current.revenue_gross);
  const pctOf = (v: number) => (gross > 0 ? ((v / gross) * 100).toFixed(1) : "0");

  // Thuế còn phải nộp thêm
  const taxAdditional = Math.max(
    0,
    Number(current.tax_payable) - Number(current.total_commission_tax_withheld),
  );
  const taxRefund = Math.max(
    0,
    Number(current.total_commission_tax_withheld) - Number(current.tax_payable),
  );

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">BÁO CÁO LÃI/LỖ (P&L)</h1>
        <p className="text-sm">{periodLabel}</p>
        <p className="text-xs text-muted-foreground">So sánh với {previousLabel}</p>
        <hr className="my-3" />
      </div>

      <ReportPeriodSelector from={from} to={to} onExport={handleExport} />

      {/* 4 KPI lớn */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BigKpi
          label="Doanh thu Gross"
          value={Number(current.revenue_gross)}
          change={revenueChange}
          previousLabel={previousLabel}
          previousValue={Number(previous.revenue_gross)}
          variant="primary"
        />
        <BigKpi
          label="Tổng thuế phải nộp"
          value={Number(current.tax_payable)}
          change={taxChange}
          previousLabel={previousLabel}
          previousValue={Number(previous.tax_payable)}
          variant="warning"
          invertedColor
        />
        <BigKpi
          label="Tổng chi phí"
          value={Number(current.total_expense)}
          change={expenseChange}
          previousLabel={previousLabel}
          previousValue={Number(previous.total_expense)}
          variant="danger"
          invertedColor
        />
        <BigKpi
          label={isProfit ? "Lãi" : "Lỗ"}
          value={Math.abs(Number(current.profit_loss))}
          change={profitChange}
          previousLabel={previousLabel}
          previousValue={Number(previous.profit_loss)}
          variant={isProfit ? "success" : "danger"}
          extra={`Biên lợi nhuận: ${Number(current.profit_margin).toFixed(1)}%`}
        />
      </div>

      {/* Bảng P&L + Pie chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Bảng Lãi/Lỗ chi tiết</CardTitle>
            <p className="text-xs text-muted-foreground">
              Lãi = Doanh thu Gross − Tổng thuế phải nộp − Chi phí
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {/* DOANH THU */}
                <tr className="border-b border-border">
                  <td className="px-6 py-3 font-semibold uppercase text-xs text-muted-foreground">
                    Doanh thu
                  </td>
                  <td className="px-6 py-3"></td>
                  <td className="px-6 py-3"></td>
                </tr>
                <tr className="border-b border-border font-semibold">
                  <td className="px-6 py-2.5 pl-10">Doanh thu Gross</td>
                  <td className="px-6 py-2.5 text-right tabular-nums text-primary">
                    +{formatCurrency(current.revenue_gross)}
                  </td>
                  <td className="px-6 py-2.5 text-right text-xs text-muted-foreground">
                    100%
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-2.5 pl-10 text-muted-foreground text-xs">
                    Trong đó Net (sau Shopee KT 10%)
                  </td>
                  <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                    {formatCurrency(current.revenue_net)}
                  </td>
                  <td className="px-6 py-2.5 text-right text-xs text-muted-foreground">
                    {pctOf(Number(current.revenue_net))}%
                  </td>
                </tr>

                {/* THUẾ TNCN */}
                <tr className="border-b border-border">
                  <td className="px-6 py-3 font-semibold uppercase text-xs text-muted-foreground">
                    Thuế TNCN
                  </td>
                  <td className="px-6 py-3"></td>
                  <td className="px-6 py-3"></td>
                </tr>
                <tr className="border-b border-border font-semibold">
                  <td className="px-6 py-2.5 pl-10">Tổng thuế phải nộp</td>
                  <td className="px-6 py-2.5 text-right tabular-nums text-warning">
                    −{formatCurrency(current.tax_payable)}
                  </td>
                  <td className="px-6 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                    {pctOf(Number(current.tax_payable))}%
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-6 py-2 pl-14 text-muted-foreground text-xs">
                    Thuế tạm nộp (Shopee KT 10%)
                  </td>
                  <td className="px-6 py-2 text-right tabular-nums text-muted-foreground text-xs">
                    {formatCurrency(current.total_commission_tax_withheld)}
                  </td>
                  <td className="px-6 py-2 text-right text-xs text-muted-foreground tabular-nums">
                    {pctOf(Number(current.total_commission_tax_withheld))}%
                  </td>
                </tr>
                {taxAdditional > 0 && (
                  <tr className="border-b border-border">
                    <td className="px-6 py-2 pl-14 text-muted-foreground text-xs">
                      Thuế còn phải nộp thêm (quyết toán)
                    </td>
                    <td className="px-6 py-2 text-right tabular-nums text-warning text-xs">
                      {formatCurrency(taxAdditional)}
                    </td>
                    <td className="px-6 py-2 text-right text-xs text-muted-foreground tabular-nums">
                      {pctOf(taxAdditional)}%
                    </td>
                  </tr>
                )}
                {taxRefund > 0 && (
                  <tr className="border-b border-border">
                    <td className="px-6 py-2 pl-14 text-muted-foreground text-xs">
                      Được hoàn lại (quyết toán)
                    </td>
                    <td className="px-6 py-2 text-right tabular-nums text-success text-xs">
                      +{formatCurrency(taxRefund)}
                    </td>
                    <td className="px-6 py-2 text-right text-xs text-muted-foreground tabular-nums">
                      {pctOf(taxRefund)}%
                    </td>
                  </tr>
                )}

                {/* CHI PHÍ */}
                <tr className="border-b border-border">
                  <td className="px-6 py-3 font-semibold uppercase text-xs text-muted-foreground">
                    Chi phí
                  </td>
                  <td colSpan={2}></td>
                </tr>
                {EXPENSE_TYPES.map((e) => {
                  const v = Number(current[e.key]);
                  return (
                    <tr key={e.key} className="border-b border-border">
                      <td className="px-6 py-2.5 pl-10 text-muted-foreground">{e.label}</td>
                      <td className="px-6 py-2.5 text-right tabular-nums">
                        {v > 0 ? `−${formatCurrency(v)}` : "—"}
                      </td>
                      <td className="px-6 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                        {v > 0 ? `${pctOf(v)}%` : ""}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-b border-border font-semibold">
                  <td className="px-6 py-2.5 pl-10">Tổng chi phí</td>
                  <td className="px-6 py-2.5 text-right tabular-nums text-destructive">
                    −{formatCurrency(current.total_expense)}
                  </td>
                  <td className="px-6 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                    {pctOf(Number(current.total_expense))}%
                  </td>
                </tr>

                {/* LÃI/LỖ */}
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-6 py-4 font-bold uppercase text-sm">
                    {isProfit ? "Lãi" : "LỖ"}
                  </td>
                  <td
                    className={cn(
                      "px-6 py-4 text-right tabular-nums font-bold text-lg",
                      isProfit ? "text-success" : "text-destructive",
                    )}
                  >
                    {isProfit ? "+" : ""}
                    {formatCurrency(current.profit_loss)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums font-bold">
                    {Number(current.profit_margin).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cơ cấu trừ ra khỏi DT</CardTitle>
            <p className="text-xs text-muted-foreground">
              Thuế + Chi phí (tổng {formatCurrency(totalDeduction)})
            </p>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown chi tiết theo category */}
      {breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chi phí theo từng khoản mục</CardTitle>
            <p className="text-xs text-muted-foreground">
              Chi tiết hơn so với 5 nhóm ở trên (không tính thuế TNCN)
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left font-medium px-6 py-2.5">Khoản mục</th>
                    <th className="text-left font-medium px-6 py-2.5">Loại</th>
                    <th className="text-center font-medium px-6 py-2.5">Số GD</th>
                    <th className="text-right font-medium px-6 py-2.5">Số tiền</th>
                    <th className="text-right font-medium px-6 py-2.5">% tổng chi</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b, i) => {
                    const pct =
                      Number(current.total_expense) > 0
                        ? ((Number(b.total_amount) / Number(current.total_expense)) * 100).toFixed(1)
                        : "0";
                    return (
                      <tr key={b.category_id ?? i} className="border-b border-border last:border-0">
                        <td className="px-6 py-2.5 font-medium">{b.category_name}</td>
                        <td className="px-6 py-2.5 text-xs text-muted-foreground">
                          {b.category_type}
                        </td>
                        <td className="px-6 py-2.5 text-center tabular-nums text-muted-foreground">
                          {b.transaction_count}
                        </td>
                        <td className="px-6 py-2.5 text-right tabular-nums">
                          {formatCurrency(b.total_amount)}
                        </td>
                        <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cảnh báo */}
      {!isProfit && Number(current.profit_loss) < 0 && (
        <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/5 border border-destructive/20 print:hidden">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              Kỳ này lỗ {formatCurrency(Math.abs(Number(current.profit_loss)))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Doanh thu ({formatCurrency(current.revenue_gross)}) không đủ bù thuế (
              {formatCurrency(current.tax_payable)}) + chi phí (
              {formatCurrency(current.total_expense)}).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BigKpi({
  label,
  value,
  change,
  previousLabel,
  previousValue,
  variant,
  extra,
  invertedColor,
}: {
  label: string;
  value: number;
  change: ReturnType<typeof formatChange>;
  previousLabel: string;
  previousValue: number;
  variant: "primary" | "success" | "warning" | "danger";
  extra?: string;
  invertedColor?: boolean;
}) {
  const valueColor = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[variant];

  let changeClassName = change.className;
  if (invertedColor) {
    changeClassName =
      change.direction === "up"
        ? "text-destructive"
        : change.direction === "down"
          ? "text-success"
          : "text-muted-foreground";
  }

  const Icon =
    change.direction === "up" ? TrendingUp : change.direction === "down" ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-2xl font-bold mt-2 tabular-nums", valueColor)}>
          {formatCurrency(value)}
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <Icon className={cn("w-3 h-3", changeClassName)} />
          <span className={cn("text-xs font-medium tabular-nums", changeClassName)}>
            {change.text}
          </span>
          <span className="text-xs text-muted-foreground truncate">vs {previousLabel}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
          Kỳ trước: {formatCurrency(previousValue)}
        </p>
        {extra && (
          <p className="text-xs font-medium mt-2 pt-2 border-t border-border">{extra}</p>
        )}
      </CardContent>
    </Card>
  );
}
