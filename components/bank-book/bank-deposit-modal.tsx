"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, X, Banknote, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitBankFromCash, createBankTransaction } from "@/app/(dashboard)/bank-book/actions";

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

type DepositType = "from_affiliate_cash" | "other";

export function BankDepositModal({ open, onClose, bankAccounts }: Props) {
  const [depositType, setDepositType] = useState<DepositType>("from_affiliate_cash");
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
    setDepositType("from_affiliate_cash");
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
    if (depositType === "other" && !description.trim()) {
      toast.error("Nhập diễn giải");
      return;
    }

    setLoading(true);
    try {
      if (depositType === "from_affiliate_cash") {
        // Atomic: bank income + cash expense (affiliate_id = null vì gom nhiều người)
        const result = await submitBankFromCash({
          affiliate_id: null,
          bank_account_id: bankAccountId,
          amount,
          trans_date: transDate,
          notes: description.trim() || undefined,
        });

        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Đã nộp tiền vào ngân hàng + giảm tiền mặt tương ứng");
      } else {
        const result = await createBankTransaction({
          bank_account_id: bankAccountId,
          trans_type: "income",
          trans_date: transDate,
          amount,
          description: description.trim(),
        });

        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Đã ghi nhận nộp tiền vào ngân hàng");
      }

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
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-base font-semibold">Nộp tiền vào ngân hàng</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Loại giao dịch */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              Nội dung giao dịch <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              <label
                className={cn(
                  "flex items-start gap-2.5 p-3 rounded-md border-2 cursor-pointer transition-colors",
                  depositType === "from_affiliate_cash"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  name="depositType"
                  checked={depositType === "from_affiliate_cash"}
                  onChange={() => setDepositType("from_affiliate_cash")}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Users className="w-3.5 h-3.5" />
                    Nộp tiền Affiliate từ TK tiền mặt
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tự tạo bút toán giảm tiền mặt tương ứng. Có thể gom tiền nhiều affiliate vào 1 lần nộp.
                  </p>
                </div>
              </label>

              <label
                className={cn(
                  "flex items-start gap-2.5 p-3 rounded-md border-2 cursor-pointer transition-colors",
                  depositType === "other"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  name="depositType"
                  checked={depositType === "other"}
                  onChange={() => setDepositType("other")}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Banknote className="w-3.5 h-3.5" />
                    Nộp tiền khác
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Chỉ ghi tăng tiền ngân hàng (vốn, vay, hoàn tiền...)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              TK ngân hàng nhận <span className="text-destructive">*</span>
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
            {bankAccounts.length === 0 && (
              <p className="text-xs text-destructive mt-1">
                Chưa có TK ngân hàng. Vào Cài đặt để thêm.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">
                Số tiền <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                className="text-lg font-semibold tabular-nums"
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
              Diễn giải {depositType === "other" && <span className="text-destructive">*</span>}
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder={
                depositType === "from_affiliate_cash"
                  ? "VD: Nộp gom tiền của Trần Văn An, Vũ Văn Trường ngày 12/05..."
                  : "VD: Vay vốn, hoàn tiền nhà cung cấp..."
              }
              required={depositType === "other"}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Hủy
            </Button>
            <Button type="submit" disabled={loading || bankAccounts.length === 0} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              Xác nhận nộp tiền
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
