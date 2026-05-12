"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, X, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  createBankAccount,
  updateBankAccount,
} from "@/app/(dashboard)/settings/actions";

interface BankAccountInitial {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string | null;
  notes: string | null;
  opening_balance?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initialData?: BankAccountInitial;
}

export function BankAccountModal({ open, onClose, mode, initialData }: Props) {
  const [bankName, setBankName] = useState(initialData?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initialData?.account_number ?? "",
  );
  const [accountHolder, setAccountHolder] = useState(
    initialData?.account_holder ?? "",
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [openingBalance, setOpeningBalance] = useState(
    Number(initialData?.opening_balance ?? 0),
  );
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!bankName.trim()) {
      toast.error("Nhập tên ngân hàng");
      return;
    }
    if (!accountNumber.trim()) {
      toast.error("Nhập số tài khoản");
      return;
    }
    if (!accountHolder.trim()) {
      toast.error("Nhập tên chủ tài khoản");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        notes: notes || undefined,
        opening_balance: openingBalance,
      };

      const result =
        mode === "create"
          ? await createBankAccount(payload)
          : await updateBankAccount({ ...payload, id: initialData!.id });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        mode === "create" ? "Đã thêm tài khoản mới" : "Đã cập nhật",
      );
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
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-base font-semibold">
              {mode === "create" ? "Thêm tài khoản mới" : "Chỉnh sửa tài khoản"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-md hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Tên ngân hàng <span className="text-destructive">*</span>
            </Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="VD: Vietcombank, MB Bank, Techcombank"
              required
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Số tài khoản <span className="text-destructive">*</span>
            </Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="VD: 0011004146873"
              className="font-mono"
              required
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Tên chủ tài khoản <span className="text-destructive">*</span>
            </Label>
            <Input
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="VD: VU VAN TRUONG"
              style={{ textTransform: "uppercase" }}
              required
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">Số dư đầu kỳ</Label>
            <CurrencyInput
              value={openingBalance}
              onChange={setOpeningBalance}
              className="text-right tabular-nums"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Số tiền có trong TK tại thời điểm bắt đầu dùng phần mềm. Có thể là số âm nếu TK đang vay nợ.
            </p>
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
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {mode === "create" ? "Thêm" : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
