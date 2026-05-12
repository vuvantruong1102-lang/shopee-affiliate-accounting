"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  markPaymentReceived,
  unmarkPaymentReceived,
  deleteShopeePayment,
} from "@/app/(dashboard)/reconciliation/actions";

interface ShopeePayment {
  id: string;
  account_id: string;
  payment_code: string | null;
  payment_date: string;
  total_gross: number;
  total_tax: number;
  total_net: number;
  is_received: boolean;
  received_date: string | null;
  notes: string | null;
  commission_id: string | null;
  created_at: string;
  affiliate_name?: string;
}

interface Props {
  payments: ShopeePayment[];
  onEdit: (p: ShopeePayment) => void;
}

export function PaymentList({ payments, onEdit }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "received">("all");

  const filtered = payments.filter((p) => {
    if (filter === "pending") return !p.is_received;
    if (filter === "received") return p.is_received;
    return true;
  });

  async function handleMarkReceived(id: string) {
    setActionLoading(id);
    try {
      const result = await markPaymentReceived(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã đánh dấu nhận tiền");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnmarkReceived(id: string) {
    if (!confirm("Hoàn tác đánh dấu đã nhận?")) return;
    setActionLoading(id);
    try {
      const result = await unmarkPaymentReceived(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã hoàn tác");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string, code: string | null) {
    if (
      !confirm(
        `Xóa đợt thanh toán ${code || "(không mã)"}?\n\nHoa hồng liên kết cũng sẽ bị xóa. Hành động không thể hoàn tác.`,
      )
    ) {
      return;
    }
    setActionLoading(id);
    try {
      const result = await deleteShopeePayment(id);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Đã xóa đợt thanh toán");
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-3 border-b border-border">
        <FilterTab
          label={`Tất cả (${payments.length})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterTab
          label={`Chờ nhận (${payments.filter((p) => !p.is_received).length})`}
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
        />
        <FilterTab
          label={`Đã nhận (${payments.filter((p) => p.is_received).length})`}
          active={filter === "received"}
          onClick={() => setFilter("received")}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {filter === "all" 
            ? "Chưa có đợt thanh toán nào. Nhập đợt đầu tiên bên trái."
            : `Không có đợt nào ${filter === "pending" ? "đang chờ" : "đã nhận"}`}
        </div>
      ) : (
        <div className="divide-y divide-border max-h-[700px] overflow-y-auto scrollbar-thin">
          {filtered.map((p) => (
            <PaymentItem
              key={p.id}
              payment={p}
              loading={actionLoading === p.id}
              onMarkReceived={() => handleMarkReceived(p.id)}
              onUnmarkReceived={() => handleUnmarkReceived(p.id)}
              onEdit={() => onEdit(p)}
              onDelete={() => handleDelete(p.id, p.payment_code)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function PaymentItem({
  payment: p,
  loading,
  onMarkReceived,
  onUnmarkReceived,
  onEdit,
  onDelete,
}: {
  payment: ShopeePayment;
  loading: boolean;
  onMarkReceived: () => void;
  onUnmarkReceived: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "p-4 hover:bg-muted/30 transition-colors group",
        p.is_received ? "bg-success/5" : "bg-warning/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Bên trái: info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm">{p.affiliate_name}</span>
            {p.is_received ? (
              <Badge variant="success" className="text-[10px]">
                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                Đã thanh toán
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px]">
                <Clock className="w-2.5 h-2.5 mr-0.5" />
                Chưa thanh toán
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>📅 {formatDate(p.payment_date)}</span>
            {p.payment_code && (
              <span className="font-mono">🔖 {p.payment_code}</span>
            )}
            {p.is_received && p.received_date && (
              <span className="text-success">
                ✓ Nhận {formatDate(p.received_date)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs">
            <span>
              <span className="text-muted-foreground">Gross:</span>{" "}
              <span className="tabular-nums font-medium">{formatCurrency(p.total_gross)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Thuế:</span>{" "}
              <span className="tabular-nums text-warning">−{formatCurrency(p.total_tax)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Net:</span>{" "}
              <span className="tabular-nums font-bold text-success">
                {formatCurrency(p.total_net)}
              </span>
            </span>
          </div>

          {p.notes && (
            <p className="text-xs text-muted-foreground italic mt-1.5">📝 {p.notes}</p>
          )}
        </div>

        {/* Bên phải: actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {!p.is_received ? (
            <Button
              size="sm"
              onClick={onMarkReceived}
              disabled={loading}
              className="text-xs"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Xác nhận đã nhận
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onUnmarkReceived}
              disabled={loading}
              className="text-xs"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3" />
              )}
              Hoàn tác
            </Button>
          )}

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              disabled={loading}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Sửa"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              disabled={loading}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Xóa"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
