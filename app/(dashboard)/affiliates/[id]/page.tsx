import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Mail,
  Phone,
  CreditCard,
  MapPin,
  Building2,
  Activity,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import { CommissionList } from "@/components/affiliates/commission-list";
import { AffiliateActionsButton } from "@/components/affiliates/affiliate-actions-button";
import { AffiliatePeriodSelector } from "@/components/affiliates/affiliate-period-selector";
import { ActivityLog, type ActivityItem } from "@/components/affiliates/activity-log";
import type { AffiliateAccount, Commission } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}

type Preset = "all" | "this_week" | "this_month" | "last_month" | "this_year" | "custom";

// Shopee giữ 10% thuế TNCN → Net = Gross × 0.9
const NET_RATIO = 0.9;

export default async function AffiliateDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const search = await searchParams;
  const preset = (search.preset ?? "all") as Preset;
  const filterFrom = search.from;
  const filterTo = search.to;
  const hasFilter = preset !== "all" && filterFrom && filterTo;

  const supabase = await createClient();

  const { data: affiliate, error } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("id", id)
    .eq("is_deleted", false)
    .single();

  if (error || !affiliate) notFound();

  const aff = affiliate as AffiliateAccount;

  // ============ COMMISSIONS ============
  let commissionsQuery = supabase
    .from("commissions")
    .select("*, shopee_payments!commission_id(id)")
    .eq("account_id", id)
    .eq("is_deleted", false);

  if (hasFilter) {
    commissionsQuery = commissionsQuery
      .gte("earned_date", filterFrom)
      .lte("earned_date", filterTo);
  }

  const { data: commissionsData } = await commissionsQuery
    .order("earned_date", { ascending: false })
    .limit(100);

  type CommissionWithShopee = Commission & {
    shopee_payments?: { id: string }[];
  };

  const commissions = ((commissionsData ?? []) as CommissionWithShopee[]).map((c) => ({
    id: c.id,
    earned_date: c.earned_date,
    period_month: c.period_month,
    period_year: c.period_year,
    gross_amount: Number(c.gross_amount),
    tax_withheld: Number(c.tax_withheld),
    net_amount: Number(c.net_amount),
    status: c.status,
    received_date: c.received_date,
    description: c.description,
    is_from_shopee: (c.shopee_payments?.length ?? 0) > 0,
  }));

  const totalGross = commissions.reduce((s, c) => s + c.gross_amount, 0);
  const totalTax = commissions.reduce((s, c) => s + c.tax_withheld, 0);
  const totalReceived = commissions
    .filter((c) => c.status === "received")
    .reduce((s, c) => s + c.net_amount, 0);
  const totalPending = commissions
    .filter((c) => c.status === "pending")
    .reduce((s, c) => s + c.net_amount, 0);

  // ============ DEPOSITS ============
  let cashDepositsQuery = supabase
    .from("cash_transactions")
    .select("id, trans_date, amount, description, notes")
    .eq("account_id", id)
    .eq("trans_type", "income")
    .or("is_deleted.is.null,is_deleted.eq.false");

  if (hasFilter) {
    cashDepositsQuery = cashDepositsQuery
      .gte("trans_date", filterFrom)
      .lte("trans_date", filterTo);
  }

  const { data: cashDepositsData } = await cashDepositsQuery
    .order("trans_date", { ascending: false })
    .limit(100);

  const cashDeposits = (cashDepositsData ?? []).map((d) => ({
    id: d.id,
    date: d.trans_date,
    amount: Number(d.amount),
    description: d.description ?? null,
    notes: d.notes ?? null,
  }));

  const totalDeposited = cashDeposits.reduce((s, d) => s + d.amount, 0);
  const undeposited = totalReceived - totalDeposited;

  // ============ SHOPEE ĐANG XỬ LÝ ============
  const { data: processingData } = await supabase
    .from("shopee_processing_amounts")
    .select("amount, snapshot_date, updated_at")
    .eq("affiliate_id", id)
    .maybeSingle();

  // DB lưu Gross, hiển thị Net
  const shopeeProcessingGross = Number(processingData?.amount ?? 0);
  const shopeeProcessingNet = Math.round(shopeeProcessingGross * NET_RATIO);
  const processingUpdatedAt = (processingData?.updated_at ?? null) as string | null;
  const processingSnapshotDate = (processingData?.snapshot_date ?? null) as string | null;

  // ✨ Tổng hoa hồng (Net) = Đã nhận + Chưa nhận + Shopee đang xử lý (Net)
  const totalNet = totalReceived + totalPending + shopeeProcessingNet;

  // ============ Activity log ============
  const activityItems: ActivityItem[] = [
    ...commissions.map((c) => ({
      type: "commission" as const,
      id: c.id,
      date: c.earned_date,
      gross: c.gross_amount,
      tax: c.tax_withheld,
      net: c.net_amount,
      status: c.status as "received" | "pending",
      received_date: c.received_date,
      is_from_shopee: c.is_from_shopee,
      description: c.description,
    })),
    ...cashDeposits.map((d) => ({
      type: "deposit" as const,
      id: d.id,
      date: d.date,
      amount: d.amount,
      bank_name: "Tiền mặt",
      account_number: "—",
      description: d.description,
      notes: d.notes,
    })),
  ].sort((a, b) => {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return a.type === "deposit" ? 1 : -1;
  });

  // ============ YTD TAX ============
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;

  const { data: ytdCommissions } = await supabase
    .from("commissions")
    .select("gross_amount, tax_withheld")
    .eq("account_id", id)
    .eq("is_deleted", false)
    .eq("period_year", currentYear);

  const ytdGross = (ytdCommissions ?? []).reduce(
    (s, c) => s + Number(c.gross_amount),
    0,
  );
  const ytdTaxWithheld = (ytdCommissions ?? []).reduce(
    (s, c) => s + Number(c.tax_withheld),
    0,
  );

  const monthlySalaryTax = aff.has_company_salary
    ? Number(aff.monthly_salary_tax_withheld)
    : 0;
  const ytdSalaryTaxWithheld = monthlySalaryTax * monthsElapsed;
  const totalYtdTaxWithheld = ytdTaxWithheld + ytdSalaryTaxWithheld;

  const taxResult = calculateYtdAdditionalTax({
    monthsElapsed,
    monthlySalaryGross: aff.has_company_salary ? Number(aff.monthly_salary_gross) : 0,
    monthlySalaryTaxWithheld: monthlySalaryTax,
    ytdShopeeGross: ytdGross,
    ytdShopeeTaxWithheld: ytdTaxWithheld,
    hasPersonalDeduction: aff.has_personal_deduction,
    dependentCount: aff.dependent_count,
  });

  // ============ All-time totals ============
  const { data: allTimeCash } = await supabase
    .from("cash_transactions")
    .select("amount")
    .eq("account_id", id)
    .eq("trans_type", "income")
    .or("is_deleted.is.null,is_deleted.eq.false");
  const allTimeTotalDeposited = (allTimeCash ?? []).reduce(
    (s, t) => s + Number(t.amount),
    0,
  );

  const { data: allTimeCommissions } = await supabase
    .from("commissions")
    .select("net_amount, status")
    .eq("account_id", id)
    .eq("is_deleted", false)
    .eq("status", "received");
  const allTimeReceived = (allTimeCommissions ?? []).reduce(
    (s, c) => s + Number(c.net_amount),
    0,
  );

  const overDeposited = totalDeposited > totalReceived && totalReceived > 0;

  const statusLabel =
    aff.status === "active" ? "Đang hoạt động" :
    aff.status === "paused" ? "Tạm dừng" : "Đã đóng";

  const mstValue: string | null | undefined =
    (aff as unknown as Record<string, string | null | undefined>).personal_tax_code ??
    (aff as unknown as Record<string, string | null | undefined>).mst ??
    (aff as unknown as Record<string, string | null | undefined>).tax_code ??
    null;

  const taxResultAny = taxResult as unknown as Record<string, number>;
  const additionalTax = Number(
    taxResultAny.additionalTaxNeeded ??
    taxResultAny.additional_tax_needed ??
    taxResultAny.taxAdditional ??
    taxResultAny.additional ??
    0
  );

  const periodLabel = !hasFilter
    ? "Tất cả thời gian"
    : preset === "this_week"
      ? "Tuần này"
      : preset === "this_month"
        ? "Tháng này"
        : preset === "last_month"
          ? "Tháng trước"
          : preset === "this_year"
            ? "Năm này"
            : `${filterFrom} → ${filterTo}`;

  const processingSubtitle = (() => {
    if (shopeeProcessingGross === 0 && !processingUpdatedAt) {
      return "Chưa cập nhật · Nhập ở Đối soát Shopee";
    }
    const parts: string[] = [];
    parts.push(`Gross ${formatCurrency(shopeeProcessingGross)}`);
    if (processingSnapshotDate) {
      parts.push(`Snapshot ${formatDate(processingSnapshotDate)}`);
    }
    return parts.join(" · ");
  })();

  const totalNetSubtitle = shopeeProcessingNet > 0
    ? `Đã nhận + Chưa nhận + Đang xử lý (Net)`
    : `${formatCurrency(totalTax)} thuế đã KT · Gross ${formatCurrency(totalGross)}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/affiliates">
            <ChevronLeft className="w-4 h-4" />
            Tất cả tài khoản
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{aff.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {statusLabel} · Bắt đầu {formatDate(aff.start_date)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AffiliateActionsButton
            affiliate={{
              id: aff.id,
              full_name: aff.full_name,
              received_total: allTimeReceived,
              undeposited: allTimeReceived - allTimeTotalDeposited,
              status: aff.status,
            }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Lọc theo kỳ:</span>
              <span className="text-xs text-muted-foreground">
                Đang xem: <span className="font-semibold">{periodLabel}</span>
              </span>
            </div>
            <AffiliatePeriodSelector
              from={filterFrom}
              to={filterTo}
              preset={preset}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Tổng hoa hồng (Net)"
          value={formatCurrency(totalNet)}
          subtitle={totalNetSubtitle}
        />
        <KpiCard
          label="Đã thực nhận"
          value={formatCurrency(totalReceived)}
          subtitle="Đã vào TK ngân hàng cá nhân"
          variant="success"
          warning={overDeposited}
          warningText="Đã nộp vượt số đã nhận"
        />
        <KpiCard
          label="Chưa nhận"
          value={formatCurrency(totalPending)}
          subtitle="Đang chờ Shopee chuyển"
          variant="warning"
        />
        <KpiCard
          label="Đã nộp tiền mặt"
          value={formatCurrency(totalDeposited)}
          subtitle={
            undeposited > 0
              ? `Còn ${formatCurrency(undeposited)} chưa nộp`
              : undeposited < 0
                ? `Vượt ${formatCurrency(Math.abs(undeposited))}`
                : "Đã nộp đủ"
          }
          variant={undeposited > 1_000_000 ? "warning" : "default"}
        />
        <KpiCard
          label="Shopee đang xử lý"
          value={formatCurrency(shopeeProcessingNet)}
          subtitle={processingSubtitle}
          variant="purple"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin liên hệ</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <InfoRow icon={Mail} label="Email" value={aff.email} />
            <InfoRow icon={Phone} label="Điện thoại" value={aff.phone} />
            <InfoRow icon={CreditCard} label="CCCD/CMND" value={aff.cccd} mono />
            {mstValue && (
              <InfoRow icon={CreditCard} label="MST cá nhân" value={mstValue} mono />
            )}
            <InfoRow icon={MapPin} label="Địa chỉ" value={aff.address} />
            <InfoRow
              icon={Building2}
              label="TK nhận tiền"
              value={
                aff.bank_name
                  ? `${aff.bank_name} · ${aff.bank_account_number ?? ""}`
                  : null
              }
              extra={aff.bank_account_holder ?? undefined}
              isLast
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-base">Thuế TNCN</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                YTD năm {currentYear} (tháng 1-{monthsElapsed}) · Luôn tính cả năm
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <InfoRow
              label="Giảm trừ bản thân"
              value={aff.has_personal_deduction ? "Có (15.5tr/tháng)" : "Không"}
              compact
            />
            <InfoRow
              label="Người phụ thuộc"
              value={`${aff.dependent_count} người`}
              compact
            />
            {aff.has_company_salary && (
              <InfoRow
                label="Lương công ty"
                value={`${formatCurrency(Number(aff.monthly_salary_gross))}/tháng`}
                compact
              />
            )}
            <InfoRow
              label="Shopee đã khấu trừ"
              value={formatCurrency(ytdTaxWithheld)}
              compact
            />
            {aff.has_company_salary && (
              <InfoRow
                label="Lương đã KT"
                value={formatCurrency(ytdSalaryTaxWithheld)}
                compact
              />
            )}
            <InfoRow
              label="Tổng đã KT"
              value={formatCurrency(totalYtdTaxWithheld)}
              compact
            />

            <div className="px-6 py-4 border-t-2 border-border bg-muted/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">Số thuế cần nộp thêm</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Lũy tiến 5 bậc (Luật 2026)
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      additionalTax > 0 ? "text-warning" : "text-success",
                    )}
                  >
                    {formatCurrency(Math.abs(additionalTax))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {additionalTax > 0
                      ? "Phải nộp thêm"
                      : additionalTax < 0
                        ? "Được hoàn"
                        : "Đã đủ"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hoa hồng</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {commissions.length} đợt · {periodLabel}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <CommissionList affiliateId={aff.id} commissions={commissions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Hoạt động gần đây
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activityItems.length} hoạt động · {periodLabel} · gồm hoa hồng + nộp tiền mặt
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ActivityLog items={activityItems} />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  variant = "default",
  warning,
  warningText,
}: {
  label: string;
  value: string;
  subtitle: string;
  variant?: "default" | "success" | "warning" | "purple";
  warning?: boolean;
  warningText?: string;
}) {
  const valueColor = {
    default: "",
    success: "text-success",
    warning: "text-warning",
    purple: "text-purple-500",
  }[variant];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          {warning && (
            <Badge variant="danger" className="text-[9px]" title={warningText}>
              !
            </Badge>
          )}
        </div>
        <p className={cn("text-xl font-bold mt-2 tabular-nums", valueColor)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5 truncate">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  extra,
  mono,
  isLast,
  compact,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  extra?: string;
  mono?: boolean;
  isLast?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[110px_1fr] items-baseline gap-3 px-6",
        compact ? "py-2" : "py-2.5",
        !isLast && "border-b border-border",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
        <span>{label}</span>
      </div>
      <div className={cn("text-sm break-words", mono && "font-mono tabular-nums")}>
        {value || <span className="text-muted-foreground italic">—</span>}
        {extra && (
          <div className="text-xs text-muted-foreground mt-0.5">{extra}</div>
        )}
      </div>
    </div>
  );
}
