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
} from "lucide-react";
import Link from "next/link";

interface BankBreakdownItem {
  id: string;
  bank_name: string;
  account_number: string;
  balance: number;
}

interface AffiliateBreakdownItem {
  id: string;
  name: string;
  received: number;
  deposited: number;
  holding: number;
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
    total_assets: number;
    bank_breakdown: BankBreakdownItem[];
    affiliate_breakdown: AffiliateBreakdownItem[];
  };

  const cash = Number(d.cash_balance);
  const bank = Number(d.bank_balance);
  const holding = Number(d.affiliate_holding);
  const pending = Number(d.shopee_pending);
  const total = Number(d.total_assets);

  function pct(part: number): string {
    if (total <= 0) return "0%";
    return ((part / total) * 100).toFixed(1) + "%";
  }

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

      {/* 4 KPI thành phần */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AssetCard
          icon={Wallet}
          label="Tiền mặt"
          value={cash}
          percent={pct(cash)}
          variant="success"
          subtitle="Số dư sổ quỹ tiền mặt"
          href="/cash-book"
        />
        <AssetCard
          icon={Building2}
          label="Tiền ngân hàng"
          value={bank}
          percent={pct(bank)}
          variant="primary"
          subtitle={`${d.bank_breakdown.length} tài khoản`}
          href="/bank-book"
        />
        <AssetCard
          icon={HandCoins}
          label="Affiliate đang cầm"
          value={holding}
          percent={pct(holding)}
          variant="warning"
          subtitle="Đã nhận, chưa nộp công ty"
          href="/affiliates"
        />
        <AssetCard
          icon={Clock}
          label="Shopee chưa chuyển"
          value={pending}
          percent={pct(pending)}
          variant="muted"
          subtitle="HH đã đối soát, chờ thanh toán"
          href="/reconciliation"
        />
      </div>

      {/* Chi tiết các TK ngân hàng */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Chi tiết số dư ngân hàng
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {d.bank_breakdown.length} tài khoản · Tổng {formatCurrency(bank)}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {d.bank_breakdown.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Chưa có tài khoản ngân hàng nào
              </div>
            ) : (
              <div className="divide-y divide-border">
                {d.bank_breakdown.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {b.bank_name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {b.account_number}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        Number(b.balance) >= 0 ? "" : "text-destructive",
                      )}
                    >
                      {formatCurrency(Number(b.balance))}
                    </div>
                  </div>
                ))}
              </div>
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

      {/* Note */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">📌 Công thức tính:</p>
          <p>• <strong>Tiền mặt</strong>: SUM(Thu) − SUM(Chi) của Sổ tiền mặt</p>
          <p>• <strong>Tiền ngân hàng</strong>: SUM(Thu) − SUM(Chi) của Sổ ngân hàng</p>
          <p>• <strong>Affiliate đang cầm</strong>: Σ (HH đã nhận − Tiền mặt đã nộp) của mỗi affiliate (chỉ tính khi &gt; 0)</p>
          <p>• <strong>Shopee chưa chuyển</strong>: SUM(commissions có status = pending)</p>
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
  variant: "success" | "primary" | "warning" | "muted";
  subtitle: string;
  href: string;
}) {
  const colors = {
    success: { bg: "bg-success/10", text: "text-success", value: "text-success" },
    primary: { bg: "bg-primary/10", text: "text-primary", value: "text-foreground" },
    warning: { bg: "bg-warning/10", text: "text-warning", value: "text-warning" },
    muted: { bg: "bg-muted", text: "text-muted-foreground", value: "text-foreground" },
  }[variant];

  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className={cn("w-9 h-9 rounded-md flex items-center justify-center", colors.bg)}>
              <Icon className={cn("w-4 h-4", colors.text)} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{percent}</span>
          </div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={cn("text-xl font-bold mt-1 tabular-nums", colors.value)}>
            {formatCurrency(value)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1.5">{subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
