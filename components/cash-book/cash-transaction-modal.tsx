"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, X, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createCashTransaction } from "@/app/(dashboard)/cash-book/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: "income" | "expense";
}

export function CashTransactionModal({ open, onClose, defaultType = "income" }: Props) {
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [amount, setAmount] = useState(0);
  const [transDate, setTransDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setType(defaultType);
    }
  }, [open, defaultType]);

  if (!open) return null;

  function reset() {
    setAmount(0);
    setDescription("");
    setNotes("");
    setTransDate(new Date().toISOString().split("T")[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (amount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      return;
    }
    if (!description.trim()) {
      toast.error("Nhập diễn giải");
      return;
    }

    setLoading(true);
    try {
      const result = await createCashTransaction({
        trans_type: type,
        trans_date: transDate,
        amount,
        description: description.trim(),
        notes: notes.trim() || undefined,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(type === "income" ? "Đã ghi nhận thu tiền mặt" : "Đã ghi nhận chi tiền mặt");
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
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              type === "income" ? "bg-success/10" : "bg-warning/10",
            )}>
              {type === "income" ? (
                <ArrowDownToLine className="w-5 h-5 text-success" />
              ) : (
                <ArrowUpFromLine className="w-5 h-5 text-warning" />
              )}
            </div>
            <h2 className="text-base font-semibold">
              {type === "income" ? "Thu tiền mặt" : "Chi tiền mặt"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Toggle Thu/Chi */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-md bg-muted/40">
            <button
              type="button"
              onClick={() => setType("income")}
              className={cn(
                "py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                type === "income"
                  ? "bg-success text-success-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Thu
            </button>
            <button
              type="button"
              onClick={() => setType("expense")}
              className={cn(
                "py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                type === "expense"
                  ? "bg-warning text-warning-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              Chi
            </button>
          </div>

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

          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Diễn giải <span className="text-destructive">*</span>
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "income" ? "VD: Khách trả tiền hàng" : "VD: Mua văn phòng phẩm"}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Hủy
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Lưu giao dịch
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
