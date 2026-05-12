"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, X, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { createBankTransaction } from "@/app/(dashboard)/bank-book/actions";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  bankAccounts: BankAccount[];
}

export function BankExpenseModal({ open, onClose, bankAccounts }: Props) {
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [transDate, setTransDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && bankAccounts[0] && !bankAccountId) {
      setBankAccountId(bankAccounts[0].id);
    }
  }, [open, bankAccounts, bankAccountId]);

  if (!open) return null;

  function reset() {
    setAmount(0);
    setDescription("");
    setTransDate(new Date().toISOString().split("T")[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }
    if (!bankAccountId) {
      toast.error("Chọn tài khoản ngân hàng");
      return;
    }
    if (!description.trim()) {
      toast.error("Nhập diễn giải");
      return;
    }

    setLoading(true);
    try {
      const result = await createBankTransaction({
        bank_account_id: bankAccountId,
        trans_type: "expense",
        trans_date: transDate,
        amount,
        description: description.trim(),
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã ghi nhận chi tiêu ngân hàng");
      reset();
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
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <ArrowUpFromLine className="w-5 h-5 text-warning" />
            </div>
            <h2 className="text-base font-semibold">Chi tiêu ngân hàng</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              TK ngân hàng chi <span className="text-destructive">*</span>
            </Label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value="">-- Chọn tài khoản --</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} · {b.account_number}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">
                Số tiền <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                className="text-lg font-semibold tabular-nums text-warning"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">
                Ngày <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={transDate}
                onChange={(e) => setTransDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Diễn giải <span className="text-destructive">*</span>
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder="VD: Thanh toán hóa đơn điện, chuyển trả nhà cung cấp..."
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Hủy
            </Button>
            <Button type="submit" disabled={loading || bankAccounts.length === 0} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
              Lưu giao dịch
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
