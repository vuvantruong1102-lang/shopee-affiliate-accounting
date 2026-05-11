import { PageHeader } from "@/components/layout/page-header";
import { AffiliateForm } from "@/components/affiliates/affiliate-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewAffiliatePage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/affiliates">
            <ChevronLeft className="w-4 h-4" />
            Quay lại
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Thêm tài khoản affiliate"
        description="Thông tin người đứng tên cho tài khoản Shopee"
      />
      <AffiliateForm mode="create" />
    </div>
  );
}
