"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Save, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createDeposit } from "@/app/(dashboard)/data-entry/actions";
import type { AffiliateAccount, BankAccount } from "@/types/database";

interface Props {
  affiliates: AffiliateAccount[];
  banks: BankAccount[];
}

export function DepositForm({ affiliates, banks }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [accountId, setAccountId] = useState(affiliates[0]?.id ?? "");
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [transDate, setTransDate] = useState(today);
  const [amount, setAmount] = useState(0);
  const [depositorName, setDepositorName] = useState("");
  const [description, setDescription] = useState("");

  const selectedAffiliate = affiliates.find((a) => a.id === accountId);
  const selectedBank = banks.find((b) => b.id === bankId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !bankId || amount <= 0) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      const result = await createDeposit({
        account_id: accountId,
        bank_account_id: bankId,
        trans_date: transDate,
        amount,
        depositor_name: depositorName || selectedAffiliate?.full_name,
        description: description || undefined,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã ghi nhận nộp tiền");
      router.push("/data-entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-sm">
            <div className="flex-1 text-center">
              <div className="text-xs text-muted-foreground">Từ</div>
              <div className="font-medium mt-0.5 truncate">
                {selectedAffiliate?.full_name ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Tiền mặt
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground mx-4 flex-shrink-0" />
            <div className="flex-1 text-center">
              <div className="text-xs text-muted-foreground">Đến</div>
              <div className="font-medium mt-0.5 truncate">
                {selectedBank?.bank_name ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                {selectedBank?.account_number ?? "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin nộp tiền</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              Affiliate nộp tiền <span className="text-destructive">*</span>
            </Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value="">— Chọn affiliate —</option>
              {affiliates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>

          {banks.length > 1 && (
            <div>
              <Label className="mb-1.5 block">Nộp vào tài khoản</Label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} - {b.account_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">
                Ngày nộp <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={transDate}
                onChange={(e) => setTransDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">
                Số tiền <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput value={amount} onChange={setAmount} required />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Tên người nộp</Label>
            <Input
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              placeholder={selectedAffiliate?.full_name ?? "Để trống nếu là chính affiliate"}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Nội dung</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder="VD: Nộp HH tháng 5/2026"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Hủy
        </Button>
        <Button type="submit" disabled={loading || !accountId || amount <= 0}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Lưu giao dịch
        </Button>
      </div>
    </form>
  );
}
