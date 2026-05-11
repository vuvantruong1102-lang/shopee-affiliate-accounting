import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Hash,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ReconcileTable } from "@/components/reconciliation/reconcile-table";
import { ReceivedToggle } from "@/components/reconciliation/received-toggle";
import { PaymentDeleteButton } from "@/components/reconciliation/payment-delete-button";
import type {
  ShopeePayment,
  ReconcileDay,
} from "@/types/shopee-reconciliation";
import type { AffiliateAccount } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReconciliationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: paymentData } = await supabase
    .from("shopee_payments")
    .select("*")
    .eq("id", id)
    .single();

  if (!paymentData) notFound();
  const payment = paymentData as ShopeePayment;

  // Lấy thông tin affiliate
  const { data: affiliateData } = await supabase
    .from("affiliate_accounts")
    .select("id, full_name, email, bank_name, bank_account_number")
    .eq("id", payment.account_id)
    .single();
  const affiliate = affiliateData as Pick<
    AffiliateAccount,
    "id" | "full_name" | "email" | "bank_name" | "bank_account_number"
  > | null;

  // Đối soát từng ngày
  const { data: reconcileData } = await supabase.rpc("reconcile_shopee_payment", {
    p_payment_id: id,
  });
  const reconcileDays = (reconcileData ?? []) as ReconcileDay[];

  const matchedCount = reconcileDays.filter((d) => d.status === "matched").length;
  const mismatchedCount = reconcileDays.filter((d) => d.status === "mismatched").length;
  const missingCount = reconcileDays.filter((d) => d.status === "missing").length;

  const totalManualGross = reconcileDays.reduce(
    (s, d) => s + Number(d.manual_gross),
    0,
  );
  const totalDifference = Number(payment.total_gross) - totalManualGross;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reconciliation">
            <ChevronLeft className="w-4 h-4" />
            Đối soát Shopee
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Đợt thanh toán ${formatDate(payment.payment_date)}`}
        description={
          affiliate
            ? `${affiliate.full_name} • Mã: ${payment.payment_code}`
            : payment.payment_code
        }
        action={
          <div className="flex items-center gap-2">
            <PaymentDeleteButton id={payment.id} />
            <ReceivedToggle id={payment.id} isReceived={payment.is_received} />
          </div>
        }
      />

      {/* KPI tổng quan */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground font-medium">
              Tổng Gross (theo Shopee)
            </div>
            <div className="text-2xl font-semibold mt-2 tabular-nums tracking-tight">
              {formatCurrency(payment.total_gross)}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {reconcileDays.length} ngày
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground font-medium">
              Thuế TNCN bị khấu trừ
            </div>
            <div className="text-2xl font-semibold mt-2 tabular-nums tracking-tight text-warning">
              -{formatCurrency(payment.total_tax)}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {payment.total_gross > 0
                ? `${((payment.total_tax / payment.total_gross) * 100).toFixed(2)}% trên gross`
                : ""}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground font-medium">
              Net thực nhận
            </div>
            <div className="text-2xl font-semibold mt-2 tabular-nums tracking-tight text-success">
              {formatCurrency(payment.total_net)}
            </div>
            <div className="text-xs mt-1.5">
              {payment.is_received ? (
                <Badge variant="success">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã nhận
                </Badge>
              ) : (
                <Badge variant="warning">
                  <Clock className="w-3 h-3" />
                  Chưa nhận
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Thông tin chuyển tiền */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin đợt thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Hash} label="Mã thanh toán">
              <span className="font-mono">{payment.payment_code}</span>
            </InfoRow>
            <InfoRow icon={Clock} label="Ngày khởi tạo đối soát">
              {formatDate(payment.reconcile_date)}
            </InfoRow>
            <InfoRow icon={CheckCircle2} label="Ngày thanh toán">
              {formatDate(payment.payment_date)}
            </InfoRow>
            {payment.bank_name && (
              <InfoRow icon={Building2} label="Ngân hàng nhận">
                <div>
                  {payment.bank_name}
                  {payment.bank_account_last4 && (
                    <span className="font-mono text-xs text-muted-foreground ml-2">
                      ****{payment.bank_account_last4}
                    </span>
                  )}
                </div>
              </InfoRow>
            )}
            {payment.notes && (
              <div className="pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">Ghi chú</div>
                <p className="text-sm whitespace-pre-wrap">{payment.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kết quả đối soát</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow
              icon={CheckCircle2}
              label="Số ngày khớp"
              value={matchedCount}
              total={reconcileDays.length}
              variant="success"
            />
            <SummaryRow
              icon={AlertTriangle}
              label="Số ngày lệch"
              value={mismatchedCount}
              total={reconcileDays.length}
              variant="warning"
            />
            <SummaryRow
              icon={AlertTriangle}
              label="Chưa nhập hoa hồng"
              value={missingCount}
              total={reconcileDays.length}
              variant="danger"
            />

            <div className="pt-3 border-t border-border space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tổng đã nhập:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(totalManualGross)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Chênh lệch:</span>
                <span
                  className={`font-medium tabular-nums ${Math.abs(totalDifference) < 1 ? "text-success" : "text-warning"}`}
                >
                  {totalDifference >= 0 ? "+" : ""}
                  {formatCurrency(totalDifference)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bảng đối soát chi tiết */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đối soát từng ngày</CardTitle>
          <p className="text-xs text-muted-foreground">
            So sánh số tiền Shopee báo với hoa hồng đã nhập trong phần mềm
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ReconcileTable
            days={reconcileDays}
            accountId={payment.account_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  total,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  total: number;
  variant: "success" | "warning" | "danger";
}) {
  const colors = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className={`w-4 h-4 ${colors[variant]} flex-shrink-0`} />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${value > 0 ? colors[variant] : "text-muted-foreground"}`}>
        {value}/{total}
      </span>
    </div>
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
