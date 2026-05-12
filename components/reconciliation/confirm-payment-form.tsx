"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import {
  confirmShopeePayment,
  updateShopeePayment,
  checkDuplicatePaymentCode,
} from "@/app/(dashboard)/reconciliation/actions";
import { formatCurrency } from "@/lib/utils";
import type { AffiliateAccount } from "@/types/database";

interface ShopeePayment {
  id: string;
  account_id: string;
  payment_code: string | null;
  payment_date: string;
  total_gross: number;
  total_tax: number;
  total_net: number;
  is_received: boolean;
  notes: string | null;
}

interface Props {
  affiliates: Pick<
    AffiliateAccount,
    "id" | "full_name" | "bank_name" | "bank_account_number" | "status"
  >[];
  editingPayment?: ShopeePayment | null;
  onCancelEdit: () => void;
  onSuccess: () => void;
}

interface DuplicateInfo {
  payment_id: string;
  account_name: string;
  payment_date: string;
  total_net: number;
}

export function ConfirmPaymentForm({ affiliates, editingPayment, onCancelEdit, onSuccess }: Props) {
  const isEditing = !!editingPayment;

  const [accountId, setAccountId] = useState(editingPayment?.account_id ?? "");
  const [paymentCode, setPaymentCode] = useState(editingPayment?.payment_code ?? "");
  const [paymentDate, setPaymentDate] = useState(
    editingPayment?.payment_date ?? new Date().toISOString().split("T")[0],
  );
  const [totalGross, setTotalGross] = useState(editingPayment?.total_gross ?? 0);
  const [totalTax, setTotalTax] = useState(editingPayment?.total_tax ?? 0);
  const [totalNet, setTotalNet] = useState(editingPayment?.total_net ?? 0);
  const [isReceived, setIsReceived] = useState(editingPayment?.is_received ?? false);
  const [notes, setNotes] = useState(editingPayment?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [autoCalcNet, setAutoCalcNet] = useState(!isEditing);

  // Sync khi đổi editing payment
  useEffect(() => {
    if (editingPayment) {
      setAccountId(editingPayment.account_id);
      setPaymentCode(editingPayment.payment_code ?? "");
      setPaymentDate(editingPayment.payment_date);
      setTotalGross(Number(editingPayment.total_gross));
      setTotalTax(Number(editingPayment.total_tax));
      setTotalNet(Number(editingPayment.total_net));
      setIsReceived(editingPayment.is_received);
      setNotes(editingPayment.notes ?? "");
      setAutoCalcNet(false);
    }
  }, [editingPayment]);

  // Tự tính Net = Gross - Tax khi user nhập gross hoặc tax
  useEffect(() => {
    if (autoCalcNet) {
      setTotalNet(Math.max(0, totalGross - totalTax));
    }
  }, [totalGross, totalTax, autoCalcNet]);

  // Tự tính Tax = 10% Gross khi nhập Gross
  function handleGrossChange(v: number) {
    setTotalGross(v);
    if (autoCalcNet && totalTax === 0) {
      setTotalTax(Math.round(v * 0.1));
    }
  }

  // Check trùng payment_code khi nhập
  useEffect(() => {
    if (!paymentCode.trim()) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await checkDuplicatePaymentCode(
        paymentCode,
        editingPayment?.id,
      );
      setDuplicates(result.duplicates as DuplicateInfo[]);
    }, 500);
    return () => clearTimeout(timer);
  }, [paymentCode, editingPayment?.id]);

  function reset() {
    setAccountId("");
    setPaymentCode("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTotalGross(0);
    setTotalTax(0);
    setTotalNet(0);
    setIsReceived(false);
    setNotes("");
    setDuplicates([]);
    setAutoCalcNet(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!accountId) {
      toast.error("Chọn affiliate");
      return;
    }
    if (totalGross <= 0) {
      toast.error("Tổng gross phải lớn hơn 0");
      return;
    }
    if (totalNet <= 0) {
      toast.error("Tổng net phải lớn hơn 0");
      return;
    }

    setLoading(true);
    try {
      if (isEditing && editingPayment) {
        const result = await updateShopeePayment({
          payment_id: editingPayment.id,
          payment_code: paymentCode.trim(),
          payment_date: paymentDate,
          total_gross: totalGross,
          total_tax: totalTax,
          total_net: totalNet,
          notes: notes.trim() || undefined,
          account_id: accountId,
        });
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Đã cập nhật đợt thanh toán");
      } else {
        const result = await confirmShopeePayment({
          account_id: accountId,
          payment_code: paymentCode.trim(),
          payment_date: paymentDate,
          total_gross: totalGross,
          total_tax: totalTax,
          total_net: totalNet,
          is_received: isReceived,
          notes: notes.trim() || undefined,
        });
        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          isReceived
            ? "Đã xác nhận đợt thanh toán và đánh dấu đã nhận"
            : "Đã xác nhận đợt thanh toán (chưa nhận tiền)",
        );
        reset();
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEditing && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          <span>Đang sửa đợt thanh toán</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block text-sm font-medium">
          Affiliate <span className="text-destructive">*</span>
        </Label>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
          required
          disabled={isEditing}
        >
          <option value="">-- Chọn affiliate --</option>
          {affiliates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
              {a.bank_account_number ? ` • ${a.bank_account_number}` : ""}
            </option>
          ))}
        </select>
        {isEditing && (
          <p className="text-xs text-muted-foreground mt-1">
            Không thể đổi affiliate khi sửa. Hãy xóa và tạo mới nếu cần.
          </p>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-sm font-medium">Mã thanh toán</Label>
          <Input
            value={paymentCode}
            onChange={(e) => setPaymentCode(e.target.value)}
            placeholder="VD: 17351120532260507"
            className="font-mono tabular-nums"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm font-medium">
            Ngày thanh toán <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Cảnh báo trùng */}
      {duplicates.length > 0 && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/30">
          <div className="flex items-start gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs font-medium text-warning">
              Mã này đã có {duplicates.length} đợt trùng:
            </div>
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
            {duplicates.map((d) => (
              <li key={d.payment_id}>
                • {d.account_name} • {d.payment_date} • {formatCurrency(d.total_net)}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground mt-1.5 ml-6 italic">
            Bạn vẫn có thể tạo nếu chắc chắn cần.
          </p>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block text-sm font-medium">
          Tổng doanh thu hợp lệ (Gross) <span className="text-destructive">*</span>
        </Label>
        <CurrencyInput
          value={totalGross}
          onChange={handleGrossChange}
          className="text-lg font-semibold tabular-nums"
        />
      </div>

      <div>
        <Label className="mb-1.5 block text-sm font-medium">
          Số tiền thuế TNCN (PIT) - 10%
        </Label>
        <CurrencyInput
          value={totalTax}
          onChange={(v) => {
            setTotalTax(v);
            if (autoCalcNet) setTotalNet(Math.max(0, totalGross - v));
          }}
          className="text-lg font-semibold tabular-nums text-warning"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-sm font-medium">
            Tổng thanh toán sau thuế (Net) <span className="text-destructive">*</span>
          </Label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoCalcNet}
              onChange={(e) => setAutoCalcNet(e.target.checked)}
              className="w-3 h-3"
            />
            Tự tính = Gross − Thuế
          </label>
        </div>
        <CurrencyInput
          value={totalNet}
          onChange={setTotalNet}
          className="text-lg font-bold tabular-nums text-success"
          readOnly={autoCalcNet}
        />
      </div>

      {!isEditing && (
        <div className="flex items-start gap-3 p-3 rounded-md bg-muted/40">
          <input
            type="checkbox"
            id="is_received"
            checked={isReceived}
            onChange={(e) => setIsReceived(e.target.checked)}
            className="mt-0.5 w-4 h-4"
          />
          <label htmlFor="is_received" className="cursor-pointer flex-1 text-sm">
            <div className="font-medium">Đã nhận tiền vào TK cá nhân</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check khi đã thấy tiền về tài khoản. Có thể đánh dấu sau.
            </p>
          </label>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block text-sm font-medium">Ghi chú</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
          placeholder="Tùy chọn"
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        {isEditing ? "Cập nhật đợt thanh toán" : "Xác nhận đợt thanh toán"}
      </Button>
    </form>
  );
}
