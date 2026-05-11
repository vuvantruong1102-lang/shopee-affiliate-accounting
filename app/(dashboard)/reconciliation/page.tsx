import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Plus, FileCheck, Inbox, Clock } from "lucide-react";
import Link from "next/link";
import { ReconciliationList } from "@/components/reconciliation/reconciliation-list";
import { formatCurrency } from "@/lib/utils";
import type { ShopeePayment } from "@/types/shopee-reconciliation";
import type { AffiliateAccount } from "@/types/database";

export default async function ReconciliationPage() {
  const supabase = await createClient();

  const [paymentsRes, affiliatesRes] = await Promise.all([
    supabase
      .from("shopee_payments")
      .select("*")
      .eq("is_deleted", false)
      .order("payment_date", { ascending: false })
      .limit(100),
    supabase
      .from("affiliate_accounts")
      .select("id, full_name")
      .eq("is_deleted", false),
  ]);

  const payments = (paymentsRes.data ?? []) as ShopeePayment[];
  const affiliates = (affiliatesRes.data ?? []) as Pick<
    AffiliateAccount,
    "id" | "full_name"
  >[];

  // Tính tổng tiền đã nhận vs chưa nhận (theo gross)
  const totalReceivedNet = payments
    .filter((p) => p.is_received)
    .reduce((s, p) => s + Number(p.total_net), 0);
  const totalPendingNet = payments
    .filter((p) => !p.is_received)
    .reduce((s, p) => s + Number(p.total_net), 0);
  const receivedCount = payments.filter((p) => p.is_received).length;
  const pendingCount = payments.filter((p) => !p.is_received).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Đối soát Shopee"
        description={`${payments.length} đợt thanh toán đã ghi nhận`}
        action={
          <Button asChild>
            <Link href="/reconciliation/new">
              <Plus className="w-4 h-4" />
              Thêm đợt thanh toán
            </Link>
          </Button>
        }
      />

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <Inbox className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Chưa có đợt thanh toán nào</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Mỗi tuần Shopee chuyển hoa hồng 2 lần. Thêm đợt đầu tiên để đối soát.
            </p>
            <Button asChild>
              <Link href="/reconciliation/new">
                <Plus className="w-4 h-4" />
                Thêm đợt thanh toán
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium">
                      Đã nhận
                    </p>
                    <p className="text-xl font-semibold mt-1 tabular-nums">
                      {formatCurrency(totalReceivedNet)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {receivedCount} đợt • Số tiền net (sau thuế)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground font-medium">
                      Chưa nhận
                    </p>
                    <p className="text-xl font-semibold mt-1 tabular-nums">
                      {formatCurrency(totalPendingNet)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pendingCount} đợt • Đang chờ Shopee chuyển
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <ReconciliationList payments={payments} affiliates={affiliates} />
        </>
      )}
    </div>
  );
}
