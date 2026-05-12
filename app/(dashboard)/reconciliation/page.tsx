import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { ReconciliationView } from "@/components/reconciliation/reconciliation-view";
import type { AffiliateAccount } from "@/types/database";

interface ShopeePaymentRow {
  id: string;
  account_id: string;
  payment_code: string | null;
  payment_date: string;
  total_gross: number;
  total_tax: number;
  total_net: number;
  is_received: boolean;
  received_date: string | null;
  notes: string | null;
  commission_id: string | null;
  created_at: string;
  affiliate_name?: string;
}

export default async function ReconciliationPage() {
  const supabase = await createClient();

  const [affiliatesRes, paymentsRes] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("id, full_name, bank_name, bank_account_number, status")
      .eq("is_deleted", false)
      .in("status", ["active", "paused"])
      .order("full_name"),
    supabase
      .from("shopee_payments")
      .select("*, affiliate_accounts!inner(full_name)")
      .eq("is_deleted", false)
      .order("payment_date", { ascending: false })
      .limit(200),
  ]);

  const affiliates = (affiliatesRes.data ?? []) as Pick<
    AffiliateAccount,
    "id" | "full_name" | "bank_name" | "bank_account_number" | "status"
  >[];

  const payments: ShopeePaymentRow[] = (paymentsRes.data ?? []).map((p) => ({
    id: p.id,
    account_id: p.account_id,
    payment_code: p.payment_code,
    payment_date: p.payment_date,
    total_gross: Number(p.total_gross),
    total_tax: Number(p.total_tax),
    total_net: Number(p.total_net),
    is_received: p.is_received,
    received_date: p.received_date,
    notes: p.notes,
    commission_id: p.commission_id,
    created_at: p.created_at,
    affiliate_name: p.affiliate_accounts?.full_name,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Đối soát Shopee"
        description="Nhập đợt thanh toán Shopee - hệ thống tự ghi nhận hoa hồng tương ứng"
      />
      <ReconciliationView affiliates={affiliates} payments={payments} />
    </div>
  );
}
