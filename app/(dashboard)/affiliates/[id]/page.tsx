import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Pencil, Phone, Mail, MapPin, CreditCard, FileText, TrendingUp, Wallet, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AffiliateDeleteButton } from "@/components/affiliates/affiliate-delete-button";
import { CommissionList } from "@/components/affiliates/commission-list";
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import { DEPENDENT_DEDUCTION_MONTHLY, PERSONAL_DEDUCTION_MONTHLY } from "@/lib/tax-calculator";
import type { AffiliateAccount, AffiliateStatus, Commission, AffiliateSummary } from "@/types/database";

const STATUS_LABEL: Record<AffiliateStatus, { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Đang hoạt động", variant: "success" },
  paused: { label: "Tạm dừng", variant: "warning" },
  closed: { label: "Đã đóng", variant: "neutral" },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AffiliateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: affiliate } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (!affiliate) notFound();
  const a = affiliate as AffiliateAccount;

  const { data: summaryData } = await supabase
    .rpc("get_affiliate_summary", { p_account_id: id })
    .single();
  const summary = (summaryData ?? {
    total_gross: 0,
    total_tax_withheld: 0,
    total_net: 0,
    received_net: 0,
    pending_net: 0,
    total_withdrawn: 0,
    total_deposited: 0,
  }) as AffiliateSummary;

  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;

  const { data: ytdCommissions } = await supabase
    .from("commissions")
    .select("gross_amount, tax_withheld")
    .eq("account_id", id)
    .eq("is_deleted", false)
    .eq("period_year", currentYear);

  const ytdShopeeGross =
    ytdCommissions?.reduce((s, c) => s + Number(c.gross_amount), 0) ?? 0;
  const ytdShopeeTaxWithheld =
    ytdCommissions?.reduce((s, c) => s + Number(c.tax_withheld), 0) ?? 0;

  const ytdTax = calculateYtdAdditionalTax({
    monthsElapsed,
    monthlySalaryGross: a.has_company_salary ? Number(a.monthly_salary_gross) : 0,
    monthlySalaryTaxWithheld: a.has_company_salary
      ? Number(a.monthly_salary_tax_withheld)
      : 0,
    ytdShopeeGross,
    ytdShopeeTaxWithheld,
    hasPersonalDeduction: a.has_personal_deduction,
    dependentCount: a.dependent_count,
  });

  const { data: commissions } = await supabase
    .from("commissions")
    .select("*")
    .eq("account_id", id)
    .eq("is_deleted", false)
    .order("earned_date", { ascending: false })
    .limit(20);

  const status = STATUS_LABEL[a.status];

  // Tính chênh lệch: số tiền chưa nộp = received_net - total_deposited
  const undeposited = Number(summary.received_net) - Number(summary.total_deposited);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/affiliates">
            <ChevronLeft className="w-4 h-4" />
            Tất cả tài khoản
          </Link>
        </Button>
      </div>

      <PageHeader
        title={a.full_name}
        description={`${status.label} • Bắt đầu ${formatDate(a.start_date)}`}
        action={
          <div className="flex items-center gap-2">
            <AffiliateDeleteButton id={a.id} name={a.full_name} />
            <Button variant="outline" asChild>
              <Link href={`/tax/${a.id}`}>
                <Receipt className="w-4 h-4" />
                Xem thuế chi tiết
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/affiliates/${a.id}/edit`}>
                <Pencil className="w-4 h-4" />
                Chỉnh sửa
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tổng hoa hồng"
          value={formatCurrency(summary.total_gross)}
          subtitle={`${formatCurrency(summary.total_tax_withheld)} thuế đã khấu trừ`}
          icon={TrendingUp}
        />
        <StatCard
          label="Đã thực nhận"
          value={formatCurrency(summary.received_net)}
          subtitle="Đã vào TK ngân hàng cá nhân"
          icon={Wallet}
          variant="success"
        />
        <StatCard
          label="Chưa nhận"
          value={formatCurrency(summary.pending_net)}
          subtitle="Đang chờ Shopee chuyển"
          icon={TrendingUp}
          variant={summary.pending_net > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Đã nộp vào công ty"
          value={formatCurrency(summary.total_deposited)}
          subtitle={
            undeposited > 0
              ? `Còn ${formatCurrency(undeposited)} chưa nộp`
              : "Đã nộp đầy đủ"
          }
          icon={Wallet}
          variant={undeposited > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Thông tin liên hệ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Mail} label="Email">
              {a.email}
            </InfoRow>
            {a.phone && (
              <InfoRow icon={Phone} label="Điện thoại">
                {a.phone}
              </InfoRow>
            )}
            {a.cccd && (
              <InfoRow icon={FileText} label="CCCD/CMND">
                <span className="font-mono">{a.cccd}</span>
              </InfoRow>
            )}
            {a.tax_code && (
              <InfoRow icon={FileText} label="MST cá nhân">
                <span className="font-mono">{a.tax_code}</span>
              </InfoRow>
            )}
            {a.address && (
              <InfoRow icon={MapPin} label="Địa chỉ">
                {a.address}
              </InfoRow>
            )}
            {a.bank_name && (
              <InfoRow icon={CreditCard} label="Tài khoản nhận tiền">
                <div>
                  <div>{a.bank_name}</div>
                  {a.bank_account_number && (
                    <div className="font-mono text-xs text-muted-foreground">
                      {a.bank_account_number}
                      {a.bank_account_holder && ` — ${a.bank_account_holder}`}
                    </div>
                  )}
                </div>
              </InfoRow>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thuế TNCN</CardTitle>
            <p className="text-xs text-muted-foreground">
              YTD năm {currentYear} (tháng 1-{monthsElapsed})
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Giảm trừ bản thân</div>
              <div className="font-medium mt-0.5">
                {a.has_personal_deduction
                  ? `Có (${(PERSONAL_DEDUCTION_MONTHLY / 1_000_000).toFixed(1)}tr/tháng)`
                  : "Không"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Người phụ thuộc</div>
              <div className="font-medium mt-0.5">
                {a.dependent_count} người
                {a.dependent_count > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({formatCurrency(a.dependent_count * DEPENDENT_DEDUCTION_MONTHLY)}/tháng)
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Shopee đã khấu trừ</div>
              <div className="font-medium mt-0.5 tabular-nums">
                {formatCurrency(ytdShopeeTaxWithheld)}
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Số thuế TNCN cần phải nộp thêm
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 mb-1">
                Tính theo bậc thu nhập lũy tiến (5 bậc - Luật 2026)
              </div>
              <TaxAdditionalDisplay ytdTax={ytdTax} hasSalary={a.has_company_salary} />
            </div>
          </CardContent>
        </Card>
      </div>

      {a.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{a.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Hoa hồng gần đây</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              20 đợt mới nhất
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/data-entry/commission?account=${a.id}`}>
              <Mail className="w-3.5 h-3.5" />
              Thêm hoa hồng
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <CommissionList data={(commissions ?? []) as Commission[]} />
        </CardContent>
      </Card>
    </div>
  );
}

function TaxAdditionalDisplay({
  ytdTax,
  hasSalary,
}: {
  ytdTax: ReturnType<typeof calculateYtdAdditionalTax>;
  hasSalary: boolean;
}) {
  if (ytdTax.status === "no_data") {
    return (
      <div className="text-sm text-muted-foreground italic mt-1">
        Chưa có dữ liệu thu nhập
      </div>
    );
  }
  if (ytdTax.status === "even") {
    return (
      <div className="mt-1">
        <div className="font-medium tabular-nums text-sm">~0 đ</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Đã đóng đủ thuế
        </div>
      </div>
    );
  }
  if (ytdTax.status === "refund") {
    return (
      <div className="mt-1">
        <div className="font-medium tabular-nums text-sm text-success">
          {formatCurrency(Math.abs(ytdTax.taxAdditional))}
        </div>
        <div className="text-xs text-success mt-0.5">
          Được hoàn (đã khấu trừ thừa)
        </div>
        {!hasSalary && (
          <div className="text-[10px] text-muted-foreground mt-1">
            Vì thu nhập chưa vượt mức giảm trừ
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1">
      <div className="font-medium tabular-nums text-sm text-warning">
        {formatCurrency(ytdTax.taxAdditional)}
      </div>
      <div className="text-xs text-warning mt-0.5">Phải nộp thêm</div>
    </div>
  );
}

function StatCard({
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
  variant?: "default" | "success" | "warning";
}) {
  const iconColor = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
  }[variant];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-semibold mt-2 tabular-nums tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
          </div>
          <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
