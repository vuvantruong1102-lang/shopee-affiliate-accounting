import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  AlertTriangle,
  Wallet,
  Building2,
  TrendingUp,
  Users,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { TopAffiliatesList } from "@/components/dashboard/top-affiliates-list";
import type {
  DashboardAlert,
  MonthlyRevenue,
  TopAffiliate,
} from "@/types/audit";

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
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
    affiliateCountRes,
    cashBalanceRes,
    bankBalanceRes,
    pendingShopeeRes,
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
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false)
      .eq("status", "active"),
    supabase.rpc("get_cash_balance"),
    supabase
      .from("bank_accounts")
      .select("id")
      .eq("is_active", true),
    supabase
      .from("shopee_payments")
      .select("total_net")
      .eq("is_received", false)
      .eq("is_deleted", false),
  ]);

  const alerts = (alertsRes.data ?? []) as DashboardAlert[];
  const monthlyTrend = (trendRes.data ?? []) as MonthlyRevenue[];
  const topAffiliates = (topRes.data ?? []) as TopAffiliate[];
  const affiliateCount = affiliateCountRes.count ?? 0;
  const cashBalance = (cashBalanceRes.data as number) ?? 0;

  // Tính tổng bank balance từ recompute
  let totalBankBalance = 0;
  for (const bank of bankBalanceRes.data ?? []) {
    const { data } = await supabase.rpc("get_bank_balance", { p_bank_account_id: bank.id });
    totalBankBalance += (data as number) ?? 0;
  }

  const pendingShopeeTotal = (pendingShopeeRes.data ?? []).reduce(
    (s, p) => s + Number(p.total_net),
    0,
  );

  // Tổng tháng này
  const thisMonthData = monthlyTrend[monthlyTrend.length - 1];

  const highAlerts = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tổng quan"
        description={`${affiliateCount} affiliate đang hoạt động • ${highAlerts > 0 ? `${highAlerts} cảnh báo quan trọng` : "Mọi thứ ổn"}`}
      />

      {/* Alerts banner */}
      {alerts.length > 0 && <DashboardAlerts alerts={alerts} />}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Số dư tiền mặt"
          value={formatCurrency(cashBalance)}
          subtitle="Quỹ tiền mặt công ty"
          icon={Wallet}
          href="/cash-book"
        />
        <KpiCard
          label="Số dư ngân hàng"
          value={formatCurrency(totalBankBalance)}
          subtitle={`${bankBalanceRes.data?.length ?? 0} tài khoản`}
          icon={Building2}
          href="/bank-book"
        />
        <KpiCard
          label="Doanh thu tháng này"
          value={formatCurrency(thisMonthData?.total_gross ?? 0)}
          subtitle={`${thisMonthData?.commission_count ?? 0} đợt hoa hồng`}
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          label="Shopee chưa chuyển"
          value={formatCurrency(pendingShopeeTotal)}
          subtitle={`${pendingShopeeRes.data?.length ?? 0} đợt đang chờ`}
          icon={AlertTriangle}
          variant={pendingShopeeTotal > 0 ? "warning" : "default"}
          href="/reconciliation"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart 12 tháng */}
        <Card className="lg:col-span-2">
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

        {/* Top affiliates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top affiliate tháng này</CardTitle>
            <p className="text-xs text-muted-foreground">
              Theo doanh thu hoa hồng (gross)
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <TopAffiliatesList data={topAffiliates} />
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink
          href="/audit-log"
          icon={Users}
          title="Lịch sử thay đổi"
          desc="Xem ai đã sửa/xóa gì gần đây"
        />
        <QuickLink
          href="/backup"
          icon={Building2}
          title="Backup dữ liệu"
          desc="Xuất toàn bộ data ra Excel để lưu trữ"
        />
        <QuickLink
          href="/reports"
          icon={TrendingUp}
          title="Báo cáo"
          desc="Tổng hợp theo tháng / quý"
        />
      </div>
    </div>
  );
}

function KpiCard({
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
    <Card className={href ? "hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-semibold mt-2 tabular-nums tracking-tight">
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
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
