import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { WithdrawalForm } from "@/components/data-entry/withdrawal-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { AffiliateAccount } from "@/types/database";

export default async function WithdrawalEntryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("is_deleted", false)
    .in("status", ["active", "paused"])
    .order("full_name");

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/data-entry">
            <ChevronLeft className="w-4 h-4" />
            Nhập liệu
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Rút tiền mặt"
        description="Ghi nhận khi affiliate rút tiền mặt từ TK ngân hàng cá nhân"
      />
      <WithdrawalForm affiliates={(data ?? []) as AffiliateAccount[]} />
    </div>
  );
}
