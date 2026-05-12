"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { closeAffiliate } from "@/app/(dashboard)/affiliates/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  affiliate: {
    id: string;
    full_name: string;
    has_pending_commissions?: boolean;
    has_undeposited?: boolean;
  };
}

export function CloseAffiliateModal({ open, onClose, affiliate }: Props) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleClose() {
    if (!confirmed) {
      toast.error("Vui lòng tick xác nhận trước khi đóng");
      return;
    }

    setLoading(true);
    try {
      const result = await closeAffiliate(affiliate.id);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã đóng tài khoản ${affiliate.full_name}`);
      onClose();
      router.refresh();
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
              <XCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Đóng tài khoản</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{affiliate.full_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-warning-foreground">
                <p className="font-medium text-warning">Lưu ý khi đóng tài khoản</p>
                <ul className="space-y-1 ml-3 list-disc text-muted-foreground">
                  <li>Tài khoản chuyển sang trạng thái <strong>"Đã đóng"</strong></li>
                  <li>Affiliate KHÔNG bị xóa, dữ liệu lịch sử vẫn còn</li>
                  <li>Không nhận hoa hồng mới từ thời điểm đóng</li>
                  <li>Có thể mở lại bằng cách "Chỉnh sửa" → đổi trạng thái</li>
                </ul>
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
              Tôi xác nhận muốn đóng tài khoản của <strong>{affiliate.full_name}</strong>
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              disabled={loading || !confirmed}
              variant="destructive"
              className="flex-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Đóng tài khoản
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
