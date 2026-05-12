import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BankAccountsManager } from "@/components/settings/bank-accounts-manager";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: bankAccountsData, error } = await supabase
    .from("bank_accounts")
    .select(
      "id, bank_name, account_number, account_holder, notes, opening_balance, created_at, is_deleted",
    )
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("bank_name");

  if (error) {
    console.error("[Settings] Error loading bank accounts:", error);
  }

  const bankAccounts = bankAccountsData ?? [];

  const transactionCounts: Record<string, number> = {};
  if (bankAccounts.length > 0) {
    const counts = await Promise.all(
      bankAccounts.map(async (b) => {
        const { count } = await supabase
          .from("bank_transactions")
          .select("*", { count: "exact", head: true })
          .eq("bank_account_id", b.id)
          .or("is_deleted.is.null,is_deleted.eq.false");
        return { id: b.id, count: count ?? 0 };
      }),
    );
    for (const c of counts) {
      transactionCounts[c.id] = c.count;
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Cài đặt"
        description="Quản lý tài khoản ngân hàng công ty và các thiết lập hệ thống"
      />

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          Lỗi tải danh sách: {error.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản ngân hàng công ty</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Các tài khoản này dùng để nhận tiền từ affiliate nộp về và các giao dịch trong Sổ ngân hàng
          </p>
        </CardHeader>
        <CardContent>
          <BankAccountsManager
            bankAccounts={bankAccounts}
            transactionCounts={transactionCounts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
