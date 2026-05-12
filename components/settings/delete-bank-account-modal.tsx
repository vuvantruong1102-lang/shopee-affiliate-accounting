"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deleteBankAccount } from "@/app/(dashboard)/settings/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  bankAccount: {
    id: string;
    bank_name: string;
    account_number: string;
    transaction_count: number;
  };
}

export function DeleteBankAccountModal({ open, onClose, bankAccount }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const hasTransactions = bankAccount.transaction_count > 0;

  async function handleDelete() {
    if (!confirmed) {
      toast.error("Tick xác nhận trước khi xóa");
      return;
    }

    setLoading(true);
    try {
      const result = await deleteBankAccount(bankAccount.id);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      if ("data" in result && result.data) {
        if (result.data.was_hard_deleted) {
          toast.success(`Đã xóa hẳn ${bankAccount.bank_name}`);
        } else {
          toast.success(
            `Đã ẩn ${bankAccount.bank_name} (giữ lại ${result.data.transaction_count} giao dịch lịch sử)`,
          );
        }
      } else {
        toast.success(`Đã xóa ${bankAccount.bank_name}`);
      }
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
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Xóa tài khoản</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bankAccount.bank_name} · {bankAccount.account_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-md hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs">
                {hasTransactions ? (
                  <>
                    <p className="font-medium text-warning">
                      Tài khoản có {bankAccount.transaction_count} giao dịch
                    </p>
                    <ul className="space-y-1 ml-3 list-disc text-muted-foreground">
                      <li>Tài khoản sẽ được <strong>ẩn</strong> khỏi danh sách (soft delete)</li>
                      <li>Lịch sử giao dịch <strong>vẫn được giữ lại</strong> để bảo toàn dữ liệu kế toán</li>
                      <li>Không thể nhập giao dịch mới vào TK này</li>
                      <li>Có thể khôi phục từ DB (liên hệ admin)</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-warning">
                      Tài khoản chưa có giao dịch nào
                    </p>
                    <ul className="space-y-1 ml-3 list-disc text-muted-foreground">
                      <li>Tài khoản sẽ được <strong>xóa hẳn</strong> khỏi DB (hard delete)</li>
                      <li>Không thể khôi phục</li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-md border-2 border-border hover:bg-muted/40 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <span className="text-sm">
              Tôi xác nhận muốn xóa tài khoản{" "}
              <strong>{bankAccount.bank_name}</strong> ({bankAccount.account_number})
            </span>
          </label>

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
            <Button
              type="button"
              onClick={handleDelete}
              disabled={loading || !confirmed}
              variant="destructive"
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Xóa
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
