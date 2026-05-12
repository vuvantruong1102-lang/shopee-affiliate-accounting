import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  AlertTriangle,
  Wallet,
  Building2,
  TrendingUp,
  Receipt,
  Coins,
  ArrowRight,
  Users,
  Database,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { TopAffiliatesList } from "@/components/dashboard/top-affiliates-list";
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
    pendingShopeeRes,
    ytdCommissionsRes,
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
      .eq("is_received", false)
      .eq("is_deleted", false),
    supabase
      .from("commissions")
      .select("account_id, gross_amount, tax_withheld, net_amount, status")
      .eq("is_deleted", false)
      .eq("period_year", currentYear),
  ]);

  const alerts = (alertsRes.data ?? []) as DashboardAlert[];
  const monthlyTrend = (trendRes.data ?? []) as MonthlyRevenue[];
  const topAffiliates = (topRes.data ?? []) as TopAffiliate[];
  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const cashBalance = (cashBalanceRes.data as number) ?? 0;

  // Tính tổng bank balance
  let totalBankBalance = 0;
  for (const bank of bankAccountsRes.data ?? []) {
    const { data } = await supabase.rpc("get_bank_balance", {
      p_bank_account_id: bank.id,
    });
    totalBankBalance += (data as number) ?? 0;
  }

  const pendingShopeeTotal = (pendingShopeeRes.data ?? []).reduce(
    (s, p) => s + Number(p.total_net),
    0,
  );

  const thisMonthData = monthlyTrend[monthlyTrend.length - 1];

  // ============================================================================
  // Tính tổng Thuế đã nộp + Thuế cần nộp thêm cho TẤT CẢ affiliate
  // ============================================================================
  const ytdCommissions = (ytdCommissionsRes.data ?? []) as Pick<
    Commission,
    "account_id" | "gross_amount" | "tax_withheld" | "net_amount" | "status"
  >[];

  // Map gross + tax theo affiliate
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

  const highAlerts = alerts.filter((a) => a.severity === "high").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tổng quan"
        description={`${affiliates.length} affiliate đang hoạt động • ${
          highAlerts > 0 ? `${highAlerts} cảnh báo quan trọng` : "Mọi thứ ổn"
        }`}
      />

      {/* 6 KPI Cards ở đầu */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Số dư tiền mặt"
          value={formatCurrency(cashBalance)}
          subtitle="Quỹ TM công ty"
          icon={Wallet}
          href="/cash-book"
        />
        <KpiCard
          label="Số dư ngân hàng"
          value={formatCurrency(totalBankBalance)}
          subtitle={`${bankAccountsRes.data?.length ?? 0} TK`}
          icon={Building2}
          href="/bank-book"
        />
        <KpiCard
          label="Doanh thu tháng"
          value={formatCurrency(thisMonthData?.total_gross ?? 0)}
          subtitle={`${thisMonthData?.commission_count ?? 0} đợt HH`}
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          label="Shopee chưa chuyển"
          value={formatCurrency(pendingShopeeTotal)}
          subtitle={`${pendingShopeeRes.data?.length ?? 0} đợt`}
          icon={AlertTriangle}
          variant={pendingShopeeTotal > 0 ? "warning" : "default"}
          href="/reconciliation"
        />
        <KpiCard
          label="Thuế đã nộp"
          value={formatCurrency(totalTaxWithheld)}
          subtitle={`YTD ${currentYear} (${affiliates.length} affiliate)`}
          icon={Receipt}
          href="/tax"
        />
        <KpiCard
          label="Thuế cần nộp thêm"
          value={formatCurrency(totalTaxAdditional)}
          subtitle={
            totalTaxRefund > 0
              ? `Hoàn ${formatCurrency(totalTaxRefund)}`
              : "Khi quyết toán cuối năm"
          }
          icon={Coins}
          variant={totalTaxAdditional > 0 ? "warning" : "default"}
          href="/tax"
        />
      </div>

      {/* Layout 2 cột: Bên trái Chart 12 tháng, Bên phải Alerts + Top */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bên trái: Chart 12 tháng (chiếm 2 cột) */}
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

        {/* Bên phải: Alerts + Top affiliate */}
        <div className="space-y-6">
          <DashboardAlerts alerts={alerts} />

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
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              {subtitle}
            </p>
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
