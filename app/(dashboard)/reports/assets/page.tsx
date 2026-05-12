import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Wallet,
  Building2,
  HandCoins,
  Clock,
  TrendingUp,
  PieChart as PieChartIcon,
  Hourglass,
} from "lucide-react";
import Link from "next/link";
import { AssetsPieChart } from "@/components/reports/assets-pie-chart";
import { ShopeeProcessingTable } from "@/components/reports/shopee-processing-table";

interface AffiliateBreakdownItem {
  id: string;
  name: string;
  received: number;
  deposited: number;
  holding: number;
}

interface ProcessingItem {
  affiliate_id: string;
  affiliate_name: string;
  amount: number;
  snapshot_date: string | null;
  updated_at: string | null;
  notes: string | null;
}

export default async function AssetsReportPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_total_assets").single();

  if (error || !data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Tổng tài sản" />
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            Lỗi tải dữ liệu: {error?.message ?? "Không có dữ liệu"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = data as {
    cash_balance: number;
    bank_balance: number;
    affiliate_holding: number;
    shopee_pending: number;
    shopee_processing: number;
    total_assets: number;
    bank_breakdown: unknown[];
    affiliate_breakdown: AffiliateBreakdownItem[];
    processing_breakdown: ProcessingItem[];
  };

  const cash = Number(d.cash_balance);
  const bank = Number(d.bank_balance);
  const holding = Number(d.affiliate_holding);
  const pending = Number(d.shopee_pending);
  const processing = Number(d.shopee_processing);
  const total = Number(d.total_assets);

  function pct(part: number): string {
    if (total <= 0) return "0%";
    return ((part / total) * 100).toFixed(1) + "%";
  }

  // Data cho pie chart - 5 lát
  const pieData = [
    { name: "Tiền mặt", value: cash, color: "#10b981" },
    { name: "Tiền ngân hàng", value: bank, color: "#3b82f6" },
    { name: "Affiliate đang cầm", value: holding, color: "#f59e0b" },
    { name: "Shopee chưa chuyển", value: pending, color: "#6b7280" },
    { name: "Shopee đang xử lý", value: processing, color: "#a855f7" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tổng tài sản"
        description="Tổng quan tài sản của công ty tại thời điểm hiện tại"
      />

      {/* TỔNG TÀI SẢN */}
      <Card className="bg-gradient-to-br from-primary/5 to-success/5 border-primary/20">
        <CardContent className="p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-2">
                <TrendingUp className="w-4 h-4" />
                TỔNG TÀI SẢN
              </div>
              <p className="text-4xl font-bold tabular-nums text-success">
                {formatCurrency(total)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Cập nhật real-time từ dữ liệu hệ thống
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5 KPI thành phần */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <AssetCard
          icon={Wallet}
          label="Tiền mặt"
          value={cash}
          percent={pct(cash)}
          variant="success"
          subtitle="Sổ quỹ tiền mặt"
          href="/cash-book"
        />
        <AssetCard
          icon={Building2}
          label="Tiền ngân hàng"
          value={bank}
          percent={pct(bank)}
          variant="primary"
          subtitle="Sổ ngân hàng"
          href="/bank-book"
        />
        <AssetCard
          icon={HandCoins}
          label="Affiliate đang cầm"
          value={holding}
          percent={pct(holding)}
          variant="warning"
          subtitle="Đã nhận, chưa nộp"
          href="/affiliates"
        />
        <AssetCard
          icon={Clock}
          label="Shopee chưa chuyển"
          value={pending}
          percent={pct(pending)}
          variant="muted"
          subtitle="Đã đối soát, chờ thanh toán"
          href="/reconciliation"
        />
        <AssetCard
          icon={Hourglass}
          label="Shopee đang xử lý"
          value={processing}
          percent={pct(processing)}
          variant="purple"
          subtitle="Chưa đối soát thành đợt"
        />
      </div>

      {/* Pie chart cơ cấu + Affiliate đang cầm */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Cơ cấu tài sản
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tỷ trọng từng loại tài sản trên tổng số {formatCurrency(total)}
            </p>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu tài sản
              </div>
            ) : (
              <AssetsPieChart data={pieData} total={total} />
            )}
          </CardContent>
        </Card>

        {/* Affiliate đang cầm */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HandCoins className="w-4 h-4" />
              Affiliate đang cầm tiền
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {d.affiliate_breakdown.length} người · Tổng {formatCurrency(holding)}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {d.affiliate_breakdown.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Tất cả affiliate đã nộp đủ tiền 🎉
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto scrollbar-thin">
                {d.affiliate_breakdown.map((a) => (
                  <Link
                    key={a.id}
                    href={`/affiliates/${a.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Đã nhận {formatCurrency(Number(a.received))} · Đã nộp {formatCurrency(Number(a.deposited))}
                      </div>
                    </div>
                    <div className="text-sm font-bold tabular-nums text-warning">
                      {formatCurrency(Number(a.holding))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✨ Bảng nhập Shopee đang xử lý */}
      <ShopeeProcessingTable items={d.processing_breakdown ?? []} />

      {/* Note */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">📌 Công thức tính:</p>
          <p>• <strong>Tiền mặt</strong>: SUM(Thu) − SUM(Chi) của Sổ tiền mặt</p>
          <p>• <strong>Tiền ngân hàng</strong>: SUM(Thu) − SUM(Chi) của Sổ ngân hàng</p>
          <p>• <strong>Affiliate đang cầm</strong>: Σ (HH đã nhận − Tiền mặt đã nộp) của mỗi affiliate (chỉ tính khi &gt; 0)</p>
          <p>• <strong>Shopee chưa chuyển</strong>: SUM(commissions có status = pending) — đã đối soát thành đợt</p>
          <p>• <strong>Shopee đang xử lý</strong>: Số tiền nhập thủ công từ trang Shopee Affiliate (chưa đối soát thành đợt)</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AssetCard({
  icon: Icon,
  label,
  value,
  percent,
  variant,
  subtitle,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  percent: string;
  variant: "success" | "primary" | "warning" | "muted" | "purple";
  subtitle: string;
  href?: string;
}) {
  const colors: Record<
    "success" | "primary" | "warning" | "muted" | "purple",
    { bg: string; text: string; value: string }
  > = {
    success: { bg: "bg-success/10", text: "text-success", value: "text-success" },
    primary: { bg: "bg-primary/10", text: "text-primary", value: "text-foreground" },
    warning: { bg: "bg-warning/10", text: "text-warning", value: "text-warning" },
    muted: { bg: "bg-muted", text: "text-muted-foreground", value: "text-foreground" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-500", value: "text-purple-500" },
  };
  const c = colors[variant];

  const inner = (
    <Card
      className={cn(
        "h-full",
        href && "hover:border-primary/40 transition-colors cursor-pointer",
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={cn("w-9 h-9 rounded-md flex items-center justify-center", c.bg)}>
            <Icon className={cn("w-4 h-4", c.text)} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{percent}</span>
        </div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-xl font-bold mt-1 tabular-nums", c.value)}>
          {formatCurrency(value)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1.5">{subtitle}</p>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
