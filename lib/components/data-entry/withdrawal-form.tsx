"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createWithdrawal } from "@/app/(dashboard)/data-entry/actions";
import type { AffiliateAccount, WithdrawalMethod } from "@/types/database";

interface Props {
  affiliates: AffiliateAccount[];
}

export function WithdrawalForm({ affiliates }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [accountId, setAccountId] = useState(affiliates[0]?.id ?? "");
  const [withdrawDate, setWithdrawDate] = useState(today);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<WithdrawalMethod>("atm");
  const [description, setDescription] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || amount <= 0) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      const result = await createWithdrawal({
        account_id: accountId,
        withdraw_date: withdrawDate,
        amount,
        method,
        description: description || undefined,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã ghi nhận rút tiền");
      router.push("/data-entry");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin giao dịch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              Affiliate rút tiền <span className="text-destructive">*</span>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">
                Ngày rút <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={withdrawDate}
                onChange={(e) => setWithdrawDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Hình thức</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as WithdrawalMethod)}
                className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="atm">Rút ATM</option>
                <option value="counter">Tại quầy</option>
                <option value="transfer">Chuyển khoản</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">
              Số tiền rút <span className="text-destructive">*</span>
            </Label>
            <CurrencyInput value={amount} onChange={setAmount} autoFocus required />
          </div>

          <div>
            <Label className="mb-1.5 block">Ghi chú</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder="Tùy chọn"
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
