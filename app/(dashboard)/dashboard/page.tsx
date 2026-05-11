import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  Wallet,
  TrendingUp,
  CircleDollarSign,
  Receipt,
  Users,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import type {
  AffiliateAccount,
  AffiliateStatus,
  Commission,
} from "@/types/database";

const STATUS_LABEL: Record<AffiliateStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Hoạt động", variant: "success" },
  paused: { label: "Tạm dừng", variant: "warning" },
  closed: { label: "Đã đóng", variant: "neutral" },
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Tháng hiện tại
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, now.getMonth(), 1).toISOString().split("T")[0];

  // Lấy dữ liệu song song
  const [affiliatesRes, commissionsRes, monthCommissionsRes] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("commissions")
      .select("*")
      .eq("is_deleted", false)
      .order("earned_date", { ascending: false })
      .limit(10),
    supabase
      .from("commissions")
      .select("gross_amount, tax_withheld, net_amount, status")
      .eq("is_deleted", false)
      .eq("period_year", currentYear)
      .eq("period_month", currentMonth),
  ]);

  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const recentCommissions = (commissionsRes.data ?? []) as Commission[];
  const monthCommissions = monthCommissionsRes.data ?? [];

  // Tính KPIs
  const totalGross = monthCommissions.reduce((s, c) => s + Number(c.gross_amount), 0);
  const totalNet = monthCommissions.reduce((s, c) => s + Number(c.net_amount), 0);
  const totalTax = monthCommissions.reduce((s, c) => s + Number(c.tax_withheld), 0);
  const receivedNet = monthCommissions
    .filter((c) => c.status === "received")
    .reduce((s, c) => s + Number(c.net_amount), 0);
  const pendingNet = monthCommissions
    .filter((c) => c.status === "pending")
    .reduce((s, c) => s + Number(c.net_amount), 0);
  const pendingCount = monthCommissions.filter((c) => c.status === "pending").length;

  const activeCount = affiliates.filter((a) => a.status === "active").length;
  const isEmpty = affiliates.length === 0 && recentCommissions.length === 0;

  // Tên người cho commission list
  const affiliateMap = new Map(affiliates.map((a) => [a.id, a.full_name]));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tổng quan"
        description={`Tháng ${currentMonth}/${currentYear} • ${activeCount} affiliate đang hoạt động`}
        action={
          <Button asChild>
            <Link href="/data-entry">
              <Plus className="w-4 h-4" />
              Nhập liệu
            </Link>
          </Button>
        }
      />

      {isEmpty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Bắt đầu sử dụng phần mềm</p>
            <p className="text-xs text-muted-foreground mt-1 mb-6 max-w-md mx-auto">
              Để bắt đầu, hãy khai báo TK ngân hàng công ty và thêm affiliate đầu tiên
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/settings/bank-accounts">Khai báo TK ngân hàng</Link>
              </Button>
              <Button asChild>
                <Link href="/affiliates/new">
                  <Plus className="w-4 h-4" />
                  Thêm affiliate
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Tổng hoa hồng tháng"
              value={formatCurrency(totalGross)}
              subtitle="Trước thuế (gross)"
              icon={CircleDollarSign}
            />
            <KpiCard
              label="Đã thực nhận"
              value={formatCurrency(receivedNet)}
              subtitle={
                totalNet > 0
                  ? `${Math.round((receivedNet / totalNet) * 100)}% tổng net`
                  : "Chưa có dữ liệu"
              }
              icon={Wallet}
              variant="success"
            />
            <KpiCard
              label="Chưa nhận"
              value={formatCurrency(pendingNet)}
              subtitle={`${pendingCount} đợt chờ`}
              icon={TrendingUp}
              variant={pendingNet > 0 ? "warning" : "default"}
            />
            <KpiCard
              label="Thuế đã khấu trừ"
              value={formatCurrency(totalTax)}
              subtitle="10% Shopee giữ lại"
              icon={Receipt}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Hoa hồng gần đây</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    10 đợt mới nhất
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/data-entry/commission">
                    <Plus className="w-3.5 h-3.5" />
                    Thêm
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {recentCommissions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Chưa có hoa hồng nào được ghi nhận
                  </div>
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="text-left font-medium px-6 py-2.5">Ngày</th>
                          <th className="text-left font-medium px-6 py-2.5">Affiliate</th>
                          <th className="text-right font-medium px-6 py-2.5">Net</th>
                          <th className="text-center font-medium px-6 py-2.5">TT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentCommissions.map((c) => (
                          <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                            <td className="px-6 py-2.5 tabular-nums text-xs">
                              {formatDate(c.earned_date)}
                            </td>
                            <td className="px-6 py-2.5 text-xs">
                              <Link
                                href={`/affiliates/${c.account_id}`}
                                className="hover:text-primary"
                              >
                                {affiliateMap.get(c.account_id) ?? "—"}
                              </Link>
                            </td>
                            <td className="px-6 py-2.5 text-right tabular-nums text-xs font-medium">
                              {formatCurrency(c.net_amount)}
                            </td>
                            <td className="px-6 py-2.5 text-center">
                              {c.status === "received" ? (
                                <Badge variant="success">✓</Badge>
                              ) : (
                                <Badge variant="warning">...</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Affiliate</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {affiliates.length} tài khoản
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/affiliates">
                    Xem tất cả
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {affiliates.slice(0, 5).map((a) => {
                    const status = STATUS_LABEL[a.status];
                    return (
                      <Link
                        key={a.id}
                        href={`/affiliates/${a.id}`}
                        className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {a.full_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {a.email}
                          </div>
                        </div>
                        <Badge variant={status.variant} className="flex-shrink-0 ml-2">
                          {status.label}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "success";
}

function KpiCard({ label, value, subtitle, icon: Icon, variant = "default" }: KpiCardProps) {
  const iconColor = {
    default: "text-muted-foreground",
    warning: "text-warning",
    success: "text-success",
  }[variant];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums tracking-tight">
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
          </div>
          <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );
}
