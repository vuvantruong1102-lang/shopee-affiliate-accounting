import { PageHeader } from "@/components/layout/page-header";
import { AffiliateForm } from "@/components/affiliates/affiliate-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { AffiliateAccount } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAffiliatePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const affiliate = data as AffiliateAccount;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/affiliates/${id}`}>
            <ChevronLeft className="w-4 h-4" />
            Quay lại
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Chỉnh sửa tài khoản"
        description={affiliate.full_name}
      />
      <AffiliateForm mode="edit" initialData={affiliate} />
    </div>
  );
}
