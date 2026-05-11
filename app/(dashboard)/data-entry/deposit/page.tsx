import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { DepositForm } from "@/components/data-entry/deposit-form";
import Link from "next/link";
import { ChevronLeft, AlertCircle } from "lucide-react";
import type { AffiliateAccount, BankAccount } from "@/types/database";

export default async function DepositEntryPage() {
  const supabase = await createClient();

  const [affiliatesRes, banksRes] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("*")
      .eq("is_deleted", false)
      .in("status", ["active", "paused"])
      .order("full_name"),
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at"),
  ]);

  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const banks = (banksRes.data ?? []) as BankAccount[];

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
        title="Nộp tiền vào ngân hàng"
        description="Affiliate nộp tiền mặt vào TK ngân hàng công ty"
      />

      {banks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-10 h-10 text-warning mx-auto mb-3" />
            <p className="text-sm font-medium">
              Chưa có tài khoản ngân hàng công ty
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Vào phần Cài đặt để khai báo TK ngân hàng trước
            </p>
            <Button asChild>
              <Link href="/settings/bank-accounts">Khai báo ngay</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DepositForm affiliates={affiliates} banks={banks} />
      )}
    </div>
  );
}
