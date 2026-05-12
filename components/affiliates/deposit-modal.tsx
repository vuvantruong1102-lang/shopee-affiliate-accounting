"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Wallet, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { submitAffiliateDeposit } from "@/app/(dashboard)/affiliates/[id]/actions";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  affiliate: {
    id: string;
    full_name: string;
    received_total: number; // Đã thực nhận
    undeposited: number; // Đang cầm chưa nộp
  };
  companyBanks: BankAccount[];
}

export function DepositModal({ open, onClose, affiliate, companyBanks }: Props) {
  const [amount, setAmount] = useState(Math.max(0, affiliate.undeposited));
  const [bankId, setBankId] = useState(companyBanks[0]?.id ?? "");
  const [transDate, setTransDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const exceedsReceived = amount > affiliate.received_total;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!bankId) {
      toast.error("Chọn tài khoản công ty nhận tiền");
      return;
    }
    if (amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }

    setLoading(true);
    try {
      const result = await submitAffiliateDeposit({
        affiliate_id: affiliate.id,
        company_bank_id: bankId,
        amount,
        trans_date: transDate,
        notes: notes.trim() || undefined,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã ghi nhận ${affiliate.full_name} nộp ${formatCurrency(amount)}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Nộp tiền vào công ty</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{affiliate.full_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Info block */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Đã thực nhận
              </p>
              <p className="text-sm font-bold tabular-nums mt-1">
                {formatCurrency(affiliate.received_total)}
              </p>
            </div>
            <div className="rounded-md bg-warning/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-warning font-medium">
                Đang cầm
              </p>
              <p className="text-sm font-bold tabular-nums mt-1 text-warning">
                {formatCurrency(Math.max(0, affiliate.undeposited))}
              </p>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Số tiền nộp <span className="text-destructive">*</span>
            </Label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              className="text-lg font-semibold tabular-nums"
            />
            {exceedsReceived && (
              <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  Số tiền nộp lớn hơn số đã thực nhận ({formatCurrency(affiliate.received_total)}).
                  Có thể là ứng trước. Kiểm tra lại nếu không đúng.
                </p>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              TK công ty nhận <span className="text-destructive">*</span>
            </Label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value="">-- Chọn tài khoản công ty --</option>
              {companyBanks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} • {b.account_number}
                </option>
              ))}
            </select>
            {companyBanks.length === 0 && (
              <p className="text-xs text-destructive mt-1">
                Chưa có TK công ty. Vào Cài đặt → Tài khoản ngân hàng để thêm.
              </p>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
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
            <Label className="mb-1.5 block text-sm font-medium">Ghi chú</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder="Tùy chọn"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Hủy
            </Button>
            <Button type="submit" disabled={loading || companyBanks.length === 0} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Xác nhận nộp tiền
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
