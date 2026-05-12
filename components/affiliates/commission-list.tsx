"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Loader2, Link2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { deleteCommission } from "@/app/(dashboard)/affiliates/[id]/actions";
import { EditCommissionModal } from "./edit-commission-modal";

interface Commission {
  id: string;
  earned_date: string;
  period_month: number;
  period_year: number;
  gross_amount: number;
  tax_withheld: number;
  net_amount: number;
  status: string;
  received_date: string | null;
  description: string | null;
  is_from_shopee: boolean; // có link với shopee_payment không
}

interface Props {
  affiliateId: string;
  commissions: Commission[];
}

export function CommissionList({ affiliateId, commissions }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editingCommission = commissions.find((c) => c.id === editingId) ?? null;

  async function handleDelete(c: Commission) {
    if (c.is_from_shopee) {
      toast.error(
        "Hoa hồng này từ đợt Shopee. Vào trang Đối soát Shopee để xóa.",
        { duration: 5000 },
      );
      return;
    }

    if (!confirm(`Xóa hoa hồng ${formatCurrency(c.gross_amount)}?\nHành động không thể hoàn tác.`)) {
      return;
    }

    setDeletingId(c.id);
    try {
      const result = await deleteCommission(c.id, affiliateId);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã xóa hoa hồng");
      }
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(c: Commission) {
    if (c.is_from_shopee) {
      toast.error(
        "Hoa hồng này từ đợt Shopee. Vào trang Đối soát Shopee để sửa.",
        { duration: 5000 },
      );
      return;
    }
    setEditingId(c.id);
  }

  if (commissions.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Chưa có hoa hồng nào.
        <br />
        <span className="text-xs">Nhập từ trang Đối soát Shopee.</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left font-medium px-6 py-2.5">Ngày chốt</th>
              <th className="text-left font-medium px-6 py-2.5">Kỳ</th>
              <th className="text-right font-medium px-6 py-2.5">Gross</th>
              <th className="text-right font-medium px-6 py-2.5">Thuế (10%)</th>
              <th className="text-right font-medium px-6 py-2.5">Thực nhận</th>
              <th className="text-center font-medium px-6 py-2.5">Trạng thái</th>
              <th className="text-right font-medium px-6 py-2.5 w-24">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr
                key={c.id}
                className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors group"
              >
                <td className="px-6 py-3 tabular-nums">{formatDate(c.earned_date)}</td>
                <td className="px-6 py-3 text-muted-foreground">
                  T{c.period_month}/{c.period_year}
                  {c.is_from_shopee && (
                    <span
                      className="inline-flex items-center gap-0.5 ml-1.5 text-[10px] text-primary"
                      title="Từ đợt Shopee"
                    >
                      <Link2 className="w-2.5 h-2.5" />
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {formatCurrency(c.gross_amount)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums text-warning">
                  −{formatCurrency(c.tax_withheld)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums font-semibold">
                  {formatCurrency(c.net_amount)}
                </td>
                <td className="px-6 py-3 text-center">
                  {c.status === "received" ? (
                    <Badge variant="success" className="text-[10px]">
                      Đã nhận
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">
                      Chờ nhận
                    </Badge>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div
                    className={cn(
                      "flex items-center justify-end gap-0.5 transition-opacity",
                      "opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <button
                      onClick={() => handleEdit(c)}
                      disabled={deletingId === c.id}
                      className={cn(
                        "p-1.5 rounded text-muted-foreground transition-colors",
                        c.is_from_shopee
                          ? "hover:bg-muted/40 cursor-not-allowed opacity-50"
                          : "hover:text-foreground hover:bg-muted",
                      )}
                      title={c.is_from_shopee ? "Vào Đối soát Shopee để sửa" : "Sửa"}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                      className={cn(
                        "p-1.5 rounded text-muted-foreground transition-colors",
                        c.is_from_shopee
                          ? "hover:bg-muted/40 cursor-not-allowed opacity-50"
                          : "hover:text-destructive hover:bg-destructive/10",
                      )}
                      title={c.is_from_shopee ? "Vào Đối soát Shopee để xóa" : "Xóa"}
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note nếu có commission từ Shopee */}
      {commissions.some((c) => c.is_from_shopee) && (
        <div className="flex items-start gap-2 p-3 mx-4 mb-4 mt-2 rounded-md bg-muted/40 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Dòng có biểu tượng <Link2 className="inline w-3 h-3 text-primary" /> là từ đợt thanh
            toán Shopee. Để sửa/xóa, vào trang <strong>Đối soát Shopee</strong>.
          </span>
        </div>
      )}

      <EditCommissionModal
        open={!!editingId}
        onClose={() => setEditingId(null)}
        affiliateId={affiliateId}
        commission={editingCommission}
      />
    </>
  );
}
