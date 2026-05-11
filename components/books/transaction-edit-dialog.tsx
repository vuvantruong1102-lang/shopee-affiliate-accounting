"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { X, Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  updateCashTransaction,
  updateBankTransaction,
} from "@/app/(dashboard)/cash-book/actions";
import type { CashTransaction, BankTransaction } from "@/types/database";

interface Props {
  transaction: CashTransaction | BankTransaction;
  type: "cash" | "bank";
  onClose: () => void;
}

export function TransactionEditDialog({ transaction, type, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [transDate, setTransDate] = useState(transaction.trans_date);
  const [amount, setAmount] = useState(Number(transaction.amount));
  const [description, setDescription] = useState(transaction.description);

  const oldAmount = Number(transaction.amount);
  const oldDate = transaction.trans_date;
  const hasChanges =
    transDate !== oldDate || amount !== oldAmount || description !== transaction.description;
  const significantChange = transDate !== oldDate || amount !== oldAmount;

  async function handleSave() {
    if (!hasChanges) {
      onClose();
      return;
    }
    if (amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }

    setLoading(true);
    try {
      const updates = {
        trans_date: transDate,
        amount,
        description,
      };
      const result =
        type === "cash"
          ? await updateCashTransaction(transaction.id, updates)
          : await updateBankTransaction(transaction.id, updates);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã cập nhật giao dịch");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-semibold">Sửa giao dịch</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <Label className="mb-1.5 block">Ngày giao dịch</Label>
            <Input
              type="date"
              value={transDate}
              onChange={(e) => setTransDate(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Số tiền</Label>
            <CurrencyInput value={amount} onChange={setAmount} />
          </div>

          <div>
            <Label className="mb-1.5 block">Diễn giải</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
            />
          </div>

          {significantChange && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-warning">Thay đổi quan trọng</p>
                <p className="text-muted-foreground mt-0.5">
                  Số dư của tất cả các giao dịch sau giao dịch này sẽ được tính lại.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={loading || !hasChanges}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Lưu thay đổi
          </Button>
        </div>
      </div>
    </div>
  );
}
