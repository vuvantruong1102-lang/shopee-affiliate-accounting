import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { BankAccountForm } from "@/components/affiliates/bank-account-form";
import Link from "next/link";
import { ChevronLeft, Building2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BankAccount } from "@/types/database";

export default async function BankAccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("created_at");
  const banks = (data ?? []) as BankAccount[];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ChevronLeft className="w-4 h-4" />
            Cài đặt
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Tài khoản ngân hàng công ty"
        description="Tài khoản gom tiền từ các affiliate"
      />

      {banks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Danh sách tài khoản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {banks.map((b) => (
              <div
                key={b.id}
                className="flex items-start gap-4 p-3 rounded-md border border-border"
              >
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{b.bank_name}</span>
                    {b.is_active ? (
                      <Badge variant="success">Đang dùng</Badge>
                    ) : (
                      <Badge variant="neutral">Đã đóng</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <div className="font-mono">{b.account_number} — {b.account_holder}</div>
                    <div>
                      Số dư ban đầu: {formatCurrency(b.opening_balance)} ({formatDate(b.opening_date)})
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {banks.length === 0 ? "Khai báo tài khoản đầu tiên" : "Thêm tài khoản mới"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Nhập đúng số dư hiện có tại ngày khai báo để hệ thống tính sổ chính xác
          </p>
        </CardHeader>
        <CardContent>
          <BankAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
