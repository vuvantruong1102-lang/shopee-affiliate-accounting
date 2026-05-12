import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  Wallet,
  Building2,
  TrendingUp,
  Receipt,
  Coins,
  CircleDollarSign,
  Banknote,
  Inbox,
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
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import type {
  DashboardAlert,
  MonthlyRevenue,
  TopAffiliate,
} from "@/types/audit";
import type { AffiliateAccount, Commission } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [
    alertsRes,
    trendRes,
    topRes,
    affiliatesRes,
    cashBalanceRes,
    bankAccountsRes,
    shopeeReceivedRes,
    shopeePendingRes,
    ytdCommissionsRes,
    recentCommissionsRes,
    adsExpenseRes,
  ] = await Promise.all([
    supabase.rpc("get_dashboard_alerts"),
    supabase.rpc("get_monthly_revenue_trend"),
    supabase.rpc("get_top_affiliates", {
      p_from_date: startOfMonth,
      p_to_date: endOfMonth,
      p_limit: 5,
    }),
    supabase
      .from("affiliate_accounts")
      .select("*")
      .eq("is_deleted", false)
      .in("status", ["active", "paused"]),
    supabase.rpc("get_cash_balance"),
    supabase.from("bank_accounts").select("id").eq("is_active", true),
    supabase
      .from("shopee_payments")
      .select("total_net")
      .eq("is_received", true)
      .eq("is_deleted", false)
      .gte("payment_date", startOfMonth)
      .lte("payment_date", endOfMonth),
    supabase
      .from("shopee_payments")
      .select("total_net")
      .eq("is_received", false)
      .eq("is_deleted", false),
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
    // ✨ NEW: chi phí ads tháng này
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

  const shopeeReceivedTotal = (shopeeReceivedRes.data ?? []).reduce(
    (s, p) => s + Number(p.total_net),
    0,
  );
  const shopeePendingTotal = (shopeePendingRes.data ?? []).reduce(
    (s, p) => s + Number(p.total_net),
    0,
  );

  const thisMonthData = monthlyTrend[monthlyTrend.length - 1];
  const thisMonthGross = thisMonthData?.total_gross ?? 0;
  const thisMonthNet = thisMonthData?.total_net ?? 0;

  // Chi phí Facebook Ads/Marketing tháng này
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

  // Tính thuế tổng
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
  let totalTaxPayable = 0;

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
    totalTaxPayable += result.taxPayableYtd;
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

      {/* HÀNG 1: 3 KPI lớn */}
      <div className="grid gap-4 md:grid-cols-3">
        <BigKpiCard
          label="Doanh thu tháng này (NET)"
          value={formatCurrency(thisMonthNet)}
          subtitle={`Sau khi trừ thuế khấu trừ • ${thisMonthData?.commission_count ?? 0} đợt`}
          icon={CircleDollarSign}
          variant="primary"
        />
        <BigKpiCard
          label="Shopee đã chuyển tháng này"
          value={formatCurrency(shopeeReceivedTotal)}
          subtitle={`${shopeeReceivedRes.data?.length ?? 0} đợt thanh toán`}
          icon={Banknote}
          variant="success"
          href="/reconciliation"
        />
        <BigKpiCard
          label="Shopee chưa chuyển"
          value={formatCurrency(shopeePendingTotal)}
          subtitle={`${shopeePendingRes.data?.length ?? 0} đợt đang chờ`}
          icon={Inbox}
          variant={shopeePendingTotal > 0 ? "warning" : "default"}
          href="/reconciliation"
        />
      </div>

      {/* HÀNG 2: 7 KPI nhỏ */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        <SmallKpiCard
          label="Doanh thu tháng (Gross)"
          value={formatCurrency(thisMonthGross)}
          icon={TrendingUp}
        />
        <SmallKpiCard
          label="Tổng thuế phải nộp"
          value={formatCurrency(totalTaxPayable)}
          subtitle="YTD theo lũy tiến"
          icon={Receipt}
          href="/tax"
        />
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
        {/* ✨ NEW: Chi phí Facebook Ads */}
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
              <CardTitle className="text-base">Top affiliate tháng này</CardTitle>
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
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  href?: string;
}) {
  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[variant];

  const valueColor = {
    default: "",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
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
