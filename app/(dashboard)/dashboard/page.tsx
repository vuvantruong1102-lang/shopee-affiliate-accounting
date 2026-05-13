import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  Wallet,
  Building2,
  CircleDollarSign,
  Banknote,
  Inbox,
  Hourglass,
  Receipt,
  Coins,
  ArrowRight,
  History,
  Database,
  FileText,
  Megaphone,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { TopAffiliatesList } from "@/components/dashboard/top-affiliates-list";
import { RecentCommissionsFeed } from "@/components/dashboard/recent-commissions-feed";
import { DashboardPeriodSelector } from "@/components/dashboard/dashboard-period-selector";
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import type {
  DashboardAlert,
  MonthlyRevenue,
  TopAffiliate,
} from "@/types/audit";
import type { AffiliateAccount, Commission } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Mặc định: tháng này (giữ behavior cũ)
function defaultRange() {
  const now = new Date();
  return {
    from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    preset: "this_month" as const,
  };
}

// Label động cho KPI doanh thu theo period
function getPeriodLabel(preset: string): string {
  switch (preset) {
    case "all": return "tất cả";
    case "this_week": return "tuần này";
    case "this_month": return "tháng này";
    case "last_month": return "tháng trước";
    case "this_year": return "năm nay";
    case "last_year": return "năm trước";
    default: return "kỳ này";
  }
}

const NET_RATIO = 0.9;

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const def = defaultRange();
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;
  const preset = params.preset ?? def.preset;

  const supabase = await createClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;

  // ✨ Shopee processing chỉ hiện khi "Tất cả" hoặc "Năm nay"
  const showProcessing = preset === "all" || preset === "this_year";

  const periodLabel = getPeriodLabel(preset);

  const [
    alertsRes,
    trendRes,
    topRes,
    affiliatesRes,
    cashBalanceRes,
    bankAccountsRes,
    commissionsReceivedRes,
    commissionsPendingRes,
    processingRes,
    ytdCommissionsRes,
    recentCommissionsRes,
    adsExpenseRes,
  ] = await Promise.all([
    supabase.rpc("get_dashboard_alerts"),
    supabase.rpc("get_monthly_revenue_trend"),
    supabase.rpc("get_top_affiliates", {
      p_from_date: from,
      p_to_date: to,
      p_limit: 5,
    }),
    supabase
      .from("affiliate_accounts")
      .select("*")
      .eq("is_deleted", false)
      .in("status", ["active", "paused"]),
    supabase.rpc("get_cash_balance"),
    supabase.from("bank_accounts").select("id").eq("is_active", true),
    // ✨ Đã chuyển trong period (gross + net của commissions status=received)
    supabase
      .from("commissions")
      .select("gross_amount, net_amount")
      .eq("is_deleted", false)
      .eq("status", "received")
      .gte("earned_date", from)
      .lte("earned_date", to),
    // ✨ Chưa chuyển — KHÔNG filter period vì pending là snapshot hiện tại
    supabase
      .from("commissions")
      .select("gross_amount, net_amount")
      .eq("is_deleted", false)
      .eq("status", "pending"),
    // ✨ Shopee đang xử lý — snapshot hiện tại
    supabase
      .from("shopee_processing_amounts")
      .select("amount"),
    supabase
      .from("commissions")
      .select("account_id, gross_amount, tax_withheld, net_amount, status")
      .eq("is_deleted", false)
      .eq("period_year", currentYear),
    supabase
      .from("commissions")
      .select("id, account_id, earned_date, gross_amount, net_amount, status, created_at")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.rpc("get_ads_expense_this_month").single(),
  ]);

  const alerts = (alertsRes.data ?? []) as DashboardAlert[];
  const monthlyTrend = (trendRes.data ?? []) as MonthlyRevenue[];
  const topAffiliates = (topRes.data ?? []) as TopAffiliate[];
  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const cashBalance = (cashBalanceRes.data as number) ?? 0;

  let totalBankBalance = 0;
  for (const bank of bankAccountsRes.data ?? []) {
    const { data } = await supabase.rpc("get_bank_balance", {
      p_bank_account_id: bank.id,
    });
    totalBankBalance += (data as number) ?? 0;
  }

  // ✨ Tính từng nguồn doanh thu
  const receivedRows = (commissionsReceivedRes.data ?? []) as Array<{
    gross_amount: number | string;
    net_amount: number | string;
  }>;
  const pendingRows = (commissionsPendingRes.data ?? []) as Array<{
    gross_amount: number | string;
    net_amount: number | string;
  }>;
  const processingRows = (processingRes.data ?? []) as Array<{
    amount: number | string;
  }>;

  const shopeeReceivedNet = receivedRows.reduce(
    (s, r) => s + Number(r.net_amount),
    0,
  );
  const shopeeReceivedCount = receivedRows.length;
  const shopeePendingNet = pendingRows.reduce(
    (s, r) => s + Number(r.net_amount),
    0,
  );
  const shopeePendingCount = pendingRows.length;

  const shopeeProcessingGross = processingRows.reduce(
    (s, r) => s + Number(r.amount),
    0,
  );
  // ✨ Net = Gross × 0.9
  const shopeeProcessingNet = Math.round(shopeeProcessingGross * NET_RATIO);
  // Chỉ tính vào doanh thu khi preset cho phép
  const processingNetForRevenue = showProcessing ? shopeeProcessingNet : 0;

  // ✨ Doanh thu Net = Đã chuyển + Chưa chuyển + Shopee đang xử lý (Net, nếu showProcessing)
  const totalRevenueNet =
    shopeeReceivedNet + shopeePendingNet + processingNetForRevenue;

  // Chi phí Facebook Ads
  const adsData = (adsExpenseRes.data ?? {
    total_ads_expense: 0,
    transaction_count: 0,
    category_count: 0,
  }) as {
    total_ads_expense: number;
    transaction_count: number;
    category_count: number;
  };
  const adsExpense = Number(adsData.total_ads_expense);

  // Tính thuế (giữ logic cũ — cả năm)
  const ytdCommissions = (ytdCommissionsRes.data ?? []) as Pick<
    Commission,
    "account_id" | "gross_amount" | "tax_withheld" | "net_amount" | "status"
  >[];

  const ytdMap = new Map<string, { gross: number; tax: number }>();
  for (const c of ytdCommissions) {
    const entry = ytdMap.get(c.account_id) ?? { gross: 0, tax: 0 };
    entry.gross += Number(c.gross_amount);
    entry.tax += Number(c.tax_withheld);
    ytdMap.set(c.account_id, entry);
  }

  let totalTaxWithheld = 0;
  let totalTaxAdditional = 0;
  let totalTaxRefund = 0;

  for (const a of affiliates) {
    const ytd = ytdMap.get(a.id) ?? { gross: 0, tax: 0 };
    const result = calculateYtdAdditionalTax({
      monthsElapsed,
      monthlySalaryGross: a.has_company_salary ? Number(a.monthly_salary_gross) : 0,
      monthlySalaryTaxWithheld: a.has_company_salary
        ? Number(a.monthly_salary_tax_withheld)
        : 0,
      ytdShopeeGross: ytd.gross,
      ytdShopeeTaxWithheld: ytd.tax,
      hasPersonalDeduction: a.has_personal_deduction,
      dependentCount: a.dependent_count,
    });

    totalTaxWithheld += result.taxWithheldYtd;
    if (result.status === "owe") totalTaxAdditional += result.taxAdditional;
    if (result.status === "refund") totalTaxRefund += Math.abs(result.taxAdditional);
  }

  const affiliateNameMap = new Map(affiliates.map((a) => [a.id, a.full_name]));
  const recentCommissions = (recentCommissionsRes.data ?? []).map((c) => ({
    id: c.id,
    account_id: c.account_id,
    affiliate_name: affiliateNameMap.get(c.account_id) ?? "Không rõ",
    earned_date: c.earned_date,
    gross_amount: Number(c.gross_amount),
    net_amount: Number(c.net_amount),
    status: c.status,
    created_at: c.created_at,
  }));

  const highAlerts = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tổng quan"
        description={`${affiliates.length} affiliate đang hoạt động • ${
          highAlerts > 0 ? `${highAlerts} cảnh báo quan trọng` : "Mọi thứ ổn"
        }`}
      />

      {/* ✨ Period selector */}
      <DashboardPeriodSelector from={from} to={to} preset={preset} />

      {/* HÀNG 1: 3 KPI lớn (đầu) */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <BigKpiCard
          label={`Doanh thu ${periodLabel} (NET)`}
          value={formatCurrency(totalRevenueNet)}
          subtitle={
            showProcessing
              ? "Đã chuyển + Chưa chuyển + Đang xử lý"
              : "Đã chuyển + Chưa chuyển"
          }
          icon={CircleDollarSign}
          variant="primary"
        />
        <BigKpiCard
          label={`Shopee đã chuyển ${periodLabel}`}
          value={formatCurrency(shopeeReceivedNet)}
          subtitle={`${shopeeReceivedCount} đợt thanh toán`}
          icon={Banknote}
          variant="success"
          href="/reconciliation"
        />
        <BigKpiCard
          label="Shopee chưa chuyển"
          value={formatCurrency(shopeePendingNet)}
          subtitle={`${shopeePendingCount} đợt đang chờ`}
          icon={Inbox}
          variant={shopeePendingNet > 0 ? "warning" : "default"}
          href="/reconciliation"
        />
        {/* ✨ KPI Shopee đang xử lý */}
        <BigKpiCard
          label="Shopee đang xử lý"
          value={
            showProcessing
              ? formatCurrency(shopeeProcessingNet)
              : "—"
          }
          subtitle={
            showProcessing
              ? `Net (Gross × 0.9) · Gross ${formatCurrency(shopeeProcessingGross)}`
              : "Chỉ hiện khi chọn Tất cả / Năm nay"
          }
          icon={Hourglass}
          variant={showProcessing && shopeeProcessingNet > 0 ? "purple" : "default"}
          href="/reconciliation"
        />
      </div>

      {/* HÀNG 2: 5 KPI nhỏ (đã bỏ "Tổng thuế phải nộp" + "Doanh thu Gross") */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <SmallKpiCard
          label="Thuế đã nộp"
          value={formatCurrency(totalTaxWithheld)}
          subtitle="YTD đã khấu trừ"
          icon={Receipt}
          variant="success"
          href="/tax"
        />
        <SmallKpiCard
          label="Thuế cần nộp thêm"
          value={formatCurrency(totalTaxAdditional)}
          subtitle={
            totalTaxRefund > 0
              ? `Hoàn ${formatCurrency(totalTaxRefund)}`
              : "Quyết toán cuối năm"
          }
          icon={Coins}
          variant={totalTaxAdditional > 0 ? "warning" : "default"}
          href="/tax"
        />
        <SmallKpiCard
          label="Số dư tiền mặt"
          value={formatCurrency(cashBalance)}
          icon={Wallet}
          href="/cash-book"
        />
        <SmallKpiCard
          label="Số dư ngân hàng"
          value={formatCurrency(totalBankBalance)}
          subtitle={`${bankAccountsRes.data?.length ?? 0} TK`}
          icon={Building2}
          href="/bank-book"
        />
        <SmallKpiCard
          label="Chi phí Facebook Ads"
          value={formatCurrency(adsExpense)}
          subtitle={
            adsData.category_count === 0
              ? "Chưa có khoản mục Ads"
              : `${adsData.transaction_count} giao dịch tháng này`
          }
          icon={Megaphone}
          variant={adsExpense > 0 ? "warning" : "default"}
        />
      </div>

      {/* Layout 2 cột */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Doanh thu 12 tháng gần đây</CardTitle>
              <p className="text-xs text-muted-foreground">
                Tổng hoa hồng gross theo tháng (tất cả affiliate)
              </p>
            </CardHeader>
            <CardContent>
              <RevenueTrendChart data={monthlyTrend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
              <p className="text-xs text-muted-foreground">
                {recentCommissions.length} đợt hoa hồng mới được ghi nhận
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <RecentCommissionsFeed commissions={recentCommissions} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <DashboardAlerts alerts={alerts} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top affiliate {periodLabel}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Theo doanh thu net (đã trừ thuế)
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <TopAffiliatesList data={topAffiliates} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink
          href="/audit-log"
          icon={History}
          title="Lịch sử thay đổi"
          desc="Xem ai đã sửa/xóa gì gần đây"
        />
        <QuickLink
          href="/backup"
          icon={Database}
          title="Backup dữ liệu"
          desc="Xuất toàn bộ data ra Excel để lưu trữ"
        />
        <QuickLink
          href="/tax"
          icon={FileText}
          title="Thuế TNCN"
          desc="Bảng theo dõi thuế từng affiliate"
        />
      </div>
    </div>
  );
}

function BigKpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  href,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "purple";
  href?: string;
}) {
  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
    purple: "bg-purple-500/10 text-purple-500",
  }[variant];

  const valueColor = {
    default: "",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    purple: "text-purple-500",
  }[variant];

  const content = (
    <Card
      className={
        href
          ? "hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full"
          : "h-full"
      }
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
              iconStyles,
            )}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p
              className={cn(
                "text-2xl font-semibold mt-1.5 tabular-nums tracking-tight",
                valueColor,
              )}
            >
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function SmallKpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  href,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "danger";
  href?: string;
}) {
  const iconColor = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[variant];

  const content = (
    <Card
      className={
        href
          ? "hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full"
          : "h-full"
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground font-medium leading-tight">
              {label}
            </p>
            <p className="text-base font-semibold mt-1.5 tabular-nums tracking-tight break-all">
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 hover:shadow-sm transition-all">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
