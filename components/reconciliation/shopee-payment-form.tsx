"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Save, Plus, Trash2, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { createShopeePayment } from "@/app/(dashboard)/reconciliation/actions";
import type { AffiliateAccount } from "@/types/database";

interface Props {
  affiliates: AffiliateAccount[];
}

interface DayRow {
  earned_date: string;
  gross_amount: number;
}

export function ShopeePaymentForm({ affiliates }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [accountId, setAccountId] = useState(affiliates[0]?.id ?? "");
  const [paymentCode, setPaymentCode] = useState("");
  const [reconcileDate, setReconcileDate] = useState(today);
  const [paymentDate, setPaymentDate] = useState(today);
  const [totalGross, setTotalGross] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [totalNet, setTotalNet] = useState(0);
  const [bankName, setBankName] = useState("");
  const [bankLast4, setBankLast4] = useState("");
  const [isReceived, setIsReceived] = useState(false);
  const [notes, setNotes] = useState("");

  const [days, setDays] = useState<DayRow[]>([{ earned_date: today, gross_amount: 0 }]);

  // Auto-calculate net from gross & tax
  function updateGross(v: number) {
    setTotalGross(v);
    if (totalTax > 0) setTotalNet(v - totalTax);
  }

  function updateTax(v: number) {
    setTotalTax(v);
    if (totalGross > 0) setTotalNet(totalGross - v);
  }

  function updateNet(v: number) {
    setTotalNet(v);
    // Auto fill tax = gross - net
    if (totalGross > 0) setTotalTax(totalGross - v);
  }

  // Auto-fill totalGross từ tổng các ngày
  function autoFillTotalFromDays() {
    const sum = days.reduce((s, d) => s + d.gross_amount, 0);
    if (sum > 0) {
      setTotalGross(sum);
      // Nếu có thuế nhập rồi thì tự tính lại net
      if (totalTax > 0) setTotalNet(sum - totalTax);
    }
  }

  function addDay() {
    // Lấy ngày kế tiếp sau ngày cuối cùng
    const lastDate = days[days.length - 1]?.earned_date;
    const nextDate = lastDate
      ? new Date(new Date(lastDate).getTime() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      : today;
    setDays([...days, { earned_date: nextDate, gross_amount: 0 }]);
  }

  function removeDay(index: number) {
    setDays(days.filter((_, i) => i !== index));
  }

  function updateDay(index: number, field: keyof DayRow, value: string | number) {
    setDays(
      days.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );
  }

  // Validation realtime
  const sumOfDays = useMemo(() => days.reduce((s, d) => s + d.gross_amount, 0), [days]);
  const daysSumMatch = Math.abs(sumOfDays - totalGross) < 1;
  const grossTaxNetMatch = Math.abs(totalGross - totalTax - totalNet) < 1;
  const canSubmit =
    accountId &&
    paymentCode.trim() &&
    totalGross > 0 &&
    totalNet > 0 &&
    days.length > 0 &&
    days.every((d) => d.gross_amount > 0 && d.earned_date) &&
    daysSumMatch &&
    grossTaxNetMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Vui lòng kiểm tra lại thông tin");
      return;
    }

    setLoading(true);
    try {
      const result = await createShopeePayment({
        account_id: accountId,
        payment_code: paymentCode.trim(),
        reconcile_date: reconcileDate,
        payment_date: paymentDate,
        total_gross: totalGross,
        total_tax: totalTax,
        total_net: totalNet,
        bank_name: bankName.trim() || undefined,
        bank_account_last4: bankLast4.trim() || undefined,
        is_received: isReceived,
        notes: notes.trim() || undefined,
        days,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Đã ghi nhận đợt thanh toán");
      if (result.data) {
        router.push(`/reconciliation/${result.data.id}`);
      } else {
        router.push("/reconciliation");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin chung</CardTitle>
          <p className="text-xs text-muted-foreground">
            Lấy từ trang &quot;Đối soát&quot; của Shopee Affiliate
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">
              Affiliate <span className="text-destructive">*</span>
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

          <div>
            <Label className="mb-1.5 block">
              Mã thanh toán <span className="text-destructive">*</span>
            </Label>
            <Input
              value={paymentCode}
              onChange={(e) => setPaymentCode(e.target.value)}
              placeholder="VD: 17393600530260504"
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mã duy nhất từ Shopee để tránh nhập trùng
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">
                Ngày đối soát <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={reconcileDate}
                onChange={(e) => setReconcileDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ngày khởi tạo đối soát trên Shopee
              </p>
            </div>
            <div>
              <Label className="mb-1.5 block">
                Ngày Shopee thanh toán <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ngày Shopee chuyển tiền (thường sau 2-3 ngày)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Chi tiết hoa hồng từng ngày</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Mỗi đợt thanh toán gộp nhiều ngày. Thêm từng ngày với số tiền gross.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addDay}>
              <Plus className="w-3.5 h-3.5" />
              Thêm ngày
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {days.map((d, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs">
                  Ngày {i + 1}
                </Label>
                <Input
                  type="date"
                  value={d.earned_date}
                  onChange={(e) => updateDay(i, "earned_date", e.target.value)}
                  required
                />
              </div>
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs">
                  Hoa hồng (gross)
                </Label>
                <CurrencyInput
                  value={d.gross_amount}
                  onChange={(v) => updateDay(i, "gross_amount", v)}
                />
              </div>
              {days.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDay(i)}
                  className="h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Xóa ngày này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Tổng {days.length} ngày:
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium tabular-nums">
                {formatCurrency(sumOfDays)}
              </span>
              {sumOfDays > 0 && totalGross === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={autoFillTotalFromDays}
                >
                  ↓ Điền vào Tổng gross
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tổng cộng (theo Shopee)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Số liệu này phải khớp với phần &quot;Tổng thanh toán sau thuế&quot; trên Shopee
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="mb-1.5 block">
                Tổng Gross <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput value={totalGross} onChange={updateGross} required />
            </div>
            <div>
              <Label className="mb-1.5 block">Thuế TNCN (PIT)</Label>
              <CurrencyInput value={totalTax} onChange={updateTax} />
            </div>
            <div>
              <Label className="mb-1.5 block">
                Tổng Net (sau thuế) <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput value={totalNet} onChange={updateNet} required />
            </div>
          </div>

          {/* Validation feedback */}
          <div className="space-y-2">
            <ValidationRow
              ok={daysSumMatch && totalGross > 0}
              label={`Tổng các ngày (${formatCurrency(sumOfDays)}) khớp với Tổng gross (${formatCurrency(totalGross)})`}
            />
            <ValidationRow
              ok={grossTaxNetMatch && totalGross > 0}
              label={`Gross - Thuế = Net (${formatCurrency(totalGross - totalTax)} = ${formatCurrency(totalNet)})`}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin nhận tiền (tùy chọn)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">Ngân hàng nhận</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Tien Phong Bank"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">4 số cuối TK</Label>
              <Input
                value={bankLast4}
                onChange={(e) => setBankLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="2549"
                className="font-mono"
              />
            </div>
          </div>

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
                Tick nếu Shopee đã chuyển tiền (kiểm tra sao kê ngân hàng)
              </p>
            </label>
          </div>

          <div>
            <Label className="mb-1.5 block">Ghi chú</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
        <Button type="submit" disabled={loading || !canSubmit}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Lưu đợt thanh toán
        </Button>
      </div>
    </form>
  );
}

function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <>
          <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
          <span className="text-muted-foreground">{label}</span>
        </>
      ) : (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <span className="text-warning">{label}</span>
        </>
      )}
    </div>
  );
}
