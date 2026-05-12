"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateCommission } from "@/app/(dashboard)/affiliates/[id]/actions";

interface Commission {
  id: string;
  earned_date: string;
  gross_amount: number;
  tax_withheld: number;
  net_amount: number;
  status: string;
  received_date: string | null;
  description: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  affiliateId: string;
  commission: Commission | null;
}

export function EditCommissionModal({ open, onClose, affiliateId, commission }: Props) {
  const [earnedDate, setEarnedDate] = useState("");
  const [grossAmount, setGrossAmount] = useState(0);
  const [taxWithheld, setTaxWithheld] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [status, setStatus] = useState<"pending" | "received">("pending");
  const [receivedDate, setReceivedDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (commission) {
      setEarnedDate(commission.earned_date);
      setGrossAmount(Number(commission.gross_amount));
      setTaxWithheld(Number(commission.tax_withheld));
      setNetAmount(Number(commission.net_amount));
      setStatus(commission.status as "pending" | "received");
      setReceivedDate(commission.received_date ?? "");
      setDescription(commission.description ?? "");
    }
  }, [commission]);

  if (!open || !commission) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commission) return;

    setLoading(true);
    try {
      const result = await updateCommission({
        commission_id: commission.id,
        affiliate_id: affiliateId,
        earned_date: earnedDate,
        gross_amount: grossAmount,
        tax_withheld: taxWithheld,
        net_amount: netAmount,
        status,
        received_date: status === "received" ? receivedDate || undefined : undefined,
        description: description.trim() || undefined,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã cập nhật hoa hồng");
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
              <Pencil className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-base font-semibold">Sửa hoa hồng</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">Ngày ghi nhận *</Label>
            <Input
              type="date"
              value={earnedDate}
              onChange={(e) => setEarnedDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Gross *</Label>
              <CurrencyInput value={grossAmount} onChange={setGrossAmount} className="tabular-nums" />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Thuế</Label>
              <CurrencyInput value={taxWithheld} onChange={setTaxWithheld} className="tabular-nums text-warning" />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">Net *</Label>
            <CurrencyInput value={netAmount} onChange={setNetAmount} className="tabular-nums font-semibold text-success" />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm font-medium">Trạng thái</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "pending" | "received")}
              className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="pending">Chờ nhận</option>
              <option value="received">Đã nhận</option>
            </select>
          </div>

          {status === "received" && (
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Ngày nhận</Label>
              <Input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label className="mb-1.5 block text-sm font-medium">Mô tả</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tùy chọn"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Hủy
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
