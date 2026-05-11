import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/data-entry/expense-form";
import Link from "next/link";
import { ChevronLeft, AlertCircle } from "lucide-react";
import type { BankAccount, ExpenseCategory } from "@/types/database";

export default async function ExpenseEntryPage() {
  const supabase = await createClient();

  const [catRes, bankRes] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at"),
  ]);

  const categories = (catRes.data ?? []) as ExpenseCategory[];
  const banks = (bankRes.data ?? []) as BankAccount[];

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
        title="Ghi nhận chi tiêu"
        description="Khoản chi từ tiền mặt hoặc tài khoản ngân hàng"
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
        <ExpenseForm categories={categories} banks={banks} />
      )}
    </div>
  );
}
