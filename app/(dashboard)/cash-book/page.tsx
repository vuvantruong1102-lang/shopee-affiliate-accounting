import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { CashBookView } from "@/components/books/cash-book-view";
import { getDateRange, type PeriodType } from "@/lib/date-period";
import type {
  CashTransaction,
  ExpenseCategory,
  AffiliateAccount,
} from "@/types/database";

interface PageProps {
  searchParams: Promise<{
    period?: PeriodType;
    from?: string;
    to?: string;
  }>;
}

export default async function CashBookPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = params.period ?? "this_month";
  const range = getDateRange(period, params.from, params.to);

  const supabase = await createClient();

  const [transactionsRes, statsRes, dailyRes, categoriesRes, affiliatesRes] = await Promise.all([
    supabase
      .from("cash_transactions")
      .select("*")
      .eq("is_deleted", false)
      .gte("trans_date", range.from)
      .lte("trans_date", range.to)
      .order("trans_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .rpc("get_cash_book_stats", { p_from_date: range.from, p_to_date: range.to })
      .single(),
    supabase.rpc("get_cash_daily_stats", {
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

  const transactions = (transactionsRes.data ?? []) as CashTransaction[];
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sổ tiền mặt"
        description={`${range.label} • ${stats.transaction_count} giao dịch`}
        action={
          <Button asChild>
            <Link href="/data-entry">
              <Plus className="w-4 h-4" />
              Nhập giao dịch
            </Link>
          </Button>
        }
      />

      {transactions.length === 0 && stats.opening_balance === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <Wallet className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Chưa có giao dịch tiền mặt</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Vào Nhập liệu để thêm giao dịch đầu tiên
            </p>
            <Button asChild>
              <Link href="/data-entry">
                <Plus className="w-4 h-4" />
                Nhập giao dịch
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <CashBookView
          transactions={transactions}
          stats={stats}
          dailyData={dailyData}
          categories={categories}
          affiliates={affiliates}
          period={period}
          range={range}
        />
      )}
    </div>
  );
}
