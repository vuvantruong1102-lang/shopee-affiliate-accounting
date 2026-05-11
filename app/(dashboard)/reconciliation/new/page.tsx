import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ShopeePaymentForm } from "@/components/reconciliation/shopee-payment-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { AffiliateAccount } from "@/types/database";

export default async function NewReconciliationPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("is_deleted", false)
    .in("status", ["active", "paused"])
    .order("full_name");

  const affiliates = (data ?? []) as AffiliateAccount[];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reconciliation">
            <ChevronLeft className="w-4 h-4" />
            Quay lại
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Thêm đợt thanh toán Shopee"
        description="Nhập thông tin từ trang đối soát của Shopee Affiliate"
      />
      <ShopeePaymentForm affiliates={affiliates} />
    </div>
  );
}
