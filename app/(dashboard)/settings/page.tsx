import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BankAccountsManager } from "@/components/settings/bank-accounts-manager";

export default async function SettingsPage() {
  const supabase = await createClient();

  // Lấy bank accounts + đếm số giao dịch của từng TK
  const { data: bankAccountsData } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_number, account_holder, notes, created_at")
    .eq("is_deleted", false)
    .order("bank_name");

  const bankAccounts = bankAccountsData ?? [];

  // Đếm transactions cho mỗi TK (parallel)
  const transactionCounts: Record<string, number> = {};
  if (bankAccounts.length > 0) {
    const counts = await Promise.all(
      bankAccounts.map(async (b) => {
        const { count } = await supabase
          .from("bank_transactions")
          .select("*", { count: "exact", head: true })
          .eq("bank_account_id", b.id)
          .eq("is_deleted", false);
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
