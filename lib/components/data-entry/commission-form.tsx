"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Save, Info } from "lucide-react";
import { toast } from "sonner";
import {
  createCommission,
  type CommissionInput,
} from "@/app/(dashboard)/data-entry/actions";
import { calculateGrossFromNet } from "@/lib/tax-calculator";
import { formatCurrency } from "@/lib/utils";
import type { AffiliateAccount } from "@/types/database";

interface Props {
  affiliates: AffiliateAccount[];
  defaultAccountId?: string;
}

export function CommissionForm({ affiliates, defaultAccountId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [accountId, setAccountId] = useState(defaultAccountId ?? affiliates[0]?.id ?? "");
  const [netAmount, setNetAmount] = useState(0);
  const [earnedDate, setEarnedDate] = useState(today);
  const [receivedDate, setReceivedDate] = useState(today);
  const [isReceived, setIsReceived] = useState(true);
  const [description, setDescription] = useState("");
  const [shopeeOrderId, setShopeeOrderId] = useState("");

  // Tính ngược: net → gross + tax
  const calc = useMemo(() => calculateGrossFromNet(netAmount), [netAmount]);

  const selectedAffiliate = affiliates.find((a) => a.id === accountId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!accountId) {
      toast.error("Vui lòng chọn tài khoản affiliate");
      return;
    }
    if (netAmount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }

    const input: CommissionInput = {
      account_id: accountId,
      earned_date: earnedDate,
      received_date: isReceived ? receivedDate : undefined,
      gross_amount: calc.grossAmount,
      tax_withheld: calc.taxWithheld,
      net_amount: netAmount,
      status: isReceived ? "received" : "pending",
      description: description || undefined,
      shopee_order_id: shopeeOrderId || undefined,
    };

    setLoading(true);
    try {
      const result = await createCommission(input);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã ghi nhận hoa hồng");
      router.push(`/affiliates/${accountId}`);
    } catch {
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin hoa hồng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              Tài khoản affiliate <span className="text-destructive">*</span>
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
                  {a.full_name} ({a.email})
                </option>
              ))}
            </select>
            {selectedAffiliate?.bank_name && (
              <p className="text-xs text-muted-foreground mt-1.5">
                <Info className="inline w-3 h-3 mr-1" />
                Tiền sẽ chuyển về: {selectedAffiliate.bank_name} —{" "}
                <span className="font-mono">
                  {selectedAffiliate.bank_account_number}
                </span>
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">
                Ngày Shopee chốt hoa hồng{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={earnedDate}
                onChange={(e) => setEarnedDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Mã đơn Shopee (nếu có)</Label>
              <Input
                value={shopeeOrderId}
                onChange={(e) => setShopeeOrderId(e.target.value)}
                placeholder="ORDER_ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Số tiền</CardTitle>
          <p className="text-xs text-muted-foreground">
            Nhập số tiền <strong>thực nhận</strong> (đã trừ 10% thuế nếu có).
            Hệ thống tự tính ngược gross và thuế.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              Số tiền thực nhận (Net) <span className="text-destructive">*</span>
            </Label>
            <CurrencyInput
              value={netAmount}
              onChange={setNetAmount}
              placeholder="0"
              autoFocus
              required
            />
          </div>

          {netAmount > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="text-xs text-muted-foreground font-medium mb-2">
                Hệ thống tính ngược:
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Gross</div>
                  <div className="font-medium tabular-nums mt-0.5">
                    {formatCurrency(calc.grossAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Thuế (10%){" "}
                    {!calc.hasWithholding && (
                      <Badge variant="neutral" className="ml-1 text-[10px]">
                        Dưới 2tr
                      </Badge>
                    )}
                  </div>
                  <div className="font-medium tabular-nums mt-0.5 text-warning">
                    {formatCurrency(calc.taxWithheld)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Thực nhận</div>
                  <div className="font-medium tabular-nums mt-0.5 text-success">
                    {formatCurrency(netAmount)}
                  </div>
                </div>
              </div>
              {!calc.hasWithholding && netAmount > 0 && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  ℹ️ Thu nhập dưới 2 triệu/lần không bị khấu trừ 10% thuế tại nguồn.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trạng thái thanh toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
            <input
              type="checkbox"
              id="is_received"
              checked={isReceived}
              onChange={(e) => setIsReceived(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <label htmlFor="is_received" className="cursor-pointer flex-1">
              <div className="text-sm font-medium">
                Đã nhận tiền vào tài khoản
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bỏ tick nếu Shopee đã chốt nhưng chưa chuyển tiền
              </p>
            </label>
          </div>

          {isReceived && (
            <div>
              <Label className="mb-1.5 block">
                Ngày tiền về TK <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                required
              />
            </div>
          )}

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

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Hủy
        </Button>
        <Button type="submit" disabled={loading || !accountId || netAmount <= 0}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Lưu hoa hồng
        </Button>
      </div>
    </form>
  );
}
