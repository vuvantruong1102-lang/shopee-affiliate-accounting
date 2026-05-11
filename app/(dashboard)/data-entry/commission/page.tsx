import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { CommissionForm } from "@/components/data-entry/commission-form";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { AffiliateAccount } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ account?: string }>;
}

export default async function CommissionEntryPage({ searchParams }: PageProps) {
  const params = await searchParams;
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
          <Link href="/data-entry">
            <ChevronLeft className="w-4 h-4" />
            Nhập liệu
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Nhập hoa hồng mới"
        description="Ghi nhận hoa hồng Shopee chuyển về tài khoản cá nhân"
      />
      <CommissionForm
        affiliates={affiliates}
        defaultAccountId={params.account}
      />
    </div>
  );
}
