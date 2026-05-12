import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { BankBookView } from "@/components/books/bank-book-view";
import { BankBookActions } from "@/components/bank-book/bank-book-actions";
import { getDateRange, type PeriodType } from "@/lib/date-period";
import type {
  BankTransaction,
  BankAccount,
  ExpenseCategory,
  AffiliateAccount,
} from "@/types/database";

interface PageProps {
  searchParams: Promise<{
    period?: PeriodType;
    from?: string;
    to?: string;
    bank?: string;
  }>;
}

export default async function BankBookPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = params.period ?? "this_month";
  const range = getDateRange(period, params.from, params.to);

  const supabase = await createClient();

  const { data: banksData } = await supabase
    .from("bank_accounts")
    .select("*")
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at");
  const banks = (banksData ?? []) as BankAccount[];

  if (banks.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Sổ ngân hàng" description="Tài khoản gom tiền của công ty" />
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="w-10 h-10 text-warning mx-auto mb-3" />
            <p className="text-sm font-medium">
              Chưa có tài khoản ngân hàng
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Cần khai báo TK ngân hàng trước khi xem sổ
            </p>
            <Button asChild>
              <Link href="/settings">Khai báo ngay</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bankId = params.bank ?? banks[0].id;
  const selectedBank = banks.find((b) => b.id === bankId) ?? banks[0];

  const [transactionsRes, statsRes, dailyRes, categoriesRes, affiliatesRes] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("bank_account_id", selectedBank.id)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .gte("trans_date", range.from)
      .lte("trans_date", range.to)
      .order("trans_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .rpc("get_bank_book_stats", {
        p_bank_account_id: selectedBank.id,
        p_from_date: range.from,
        p_to_date: range.to,
      })
      .single(),
    supabase.rpc("get_bank_daily_stats", {
      p_bank_account_id: selectedBank.id,
      p_from_date: range.from,
      p_to_date: range.to,
    }),
    supabase
      .from("expense_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("affiliate_accounts")
      .select("id, full_name")
      .eq("is_deleted", false),
  ]);

  const transactions = (transactionsRes.data ?? []) as BankTransaction[];
  const stats = (statsRes.data ?? {
    total_income: 0,
    total_expense: 0,
    net_change: 0,
    transaction_count: 0,
    opening_balance: 0,
    closing_balance: 0,
  }) as {
    total_income: number;
    total_expense: number;
    net_change: number;
    transaction_count: number;
    opening_balance: number;
    closing_balance: number;
  };
  const dailyData = (dailyRes.data ?? []) as Array<{
    day: string;
    income: number;
    expense: number;
  }>;
  const categories = (categoriesRes.data ?? []) as ExpenseCategory[];
  const affiliates = (affiliatesRes.data ?? []) as Pick<AffiliateAccount, "id" | "full_name">[];

  const banksForActions = banks.map((b) => ({
    id: b.id,
    bank_name: b.bank_name,
    account_number: b.account_number,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sổ ngân hàng"
        description={`${selectedBank.bank_name} • ${range.label} • ${stats.transaction_count} giao dịch`}
        action={<BankBookActions bankAccounts={banksForActions} />}
      />

      <BankBookView
        transactions={transactions}
        stats={stats}
        dailyData={dailyData}
        categories={categories}
        affiliates={affiliates}
        banks={banks}
        selectedBank={selectedBank}
        period={period}
        range={range}
      />
    </div>
  );
}
