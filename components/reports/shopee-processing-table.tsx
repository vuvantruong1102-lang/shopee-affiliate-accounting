"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Save, Loader2, ChevronDown, ChevronUp, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, cn } from "@/lib/utils";
import { upsertShopeeProcessing } from "@/app/(dashboard)/reports/assets/actions";

interface ProcessingItem {
  affiliate_id: string;
  affiliate_name: string;
  amount: number;
  snapshot_date: string | null;
  updated_at: string | null;
  notes: string | null;
}

interface Props {
  items: ProcessingItem[];
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Chưa cập nhật";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  const date = new Date(iso);
  const now = new Date();
  const diffDay = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDay > 7;
}

export function ShopeeProcessingTable({
  items,
  title = "Khoản thanh toán Shopee đang xử lý",
  description,
  defaultExpanded = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [snapshotDates, setSnapshotDates] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function getCurrentAmount(item: ProcessingItem): number {
    return edits[item.affiliate_id] ?? Number(item.amount);
  }

  function getCurrentSnapshot(item: ProcessingItem): string {
    return (
      snapshotDates[item.affiliate_id] ??
      item.snapshot_date ??
      new Date().toISOString().split("T")[0]
    );
  }

  function setEdit(affId: string, value: number) {
    setEdits((prev) => ({ ...prev, [affId]: value }));
  }

  function setSnapshot(affId: string, value: string) {
    setSnapshotDates((prev) => ({ ...prev, [affId]: value }));
  }

  async function save(item: ProcessingItem) {
    const amount = getCurrentAmount(item);
    const snapshotDate = getCurrentSnapshot(item);

    if (amount < 0) {
      toast.error("Số tiền không được âm");
      return;
    }

    setSavingId(item.affiliate_id);
    try {
      const result = await upsertShopeeProcessing({
        affiliate_id: item.affiliate_id,
        amount,
        snapshot_date: snapshotDate,
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Đã cập nhật ${item.affiliate_name}: ${formatCurrency(amount)}`,
      );

      setEdits((prev) => {
        const next = { ...prev };
        delete next[item.affiliate_id];
        return next;
      });
      setSnapshotDates((prev) => {
        const next = { ...prev };
        delete next[item.affiliate_id];
        return next;
      });
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    } finally {
      setSavingId(null);
    }
  }

  const total = items.reduce((s, item) => s + getCurrentAmount(item), 0);
  const hasUnsaved = Object.keys(edits).length > 0;
  const staleCount = items.filter(
    (i) => isStale(i.updated_at) && Number(i.amount) > 0,
  ).length;

  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-purple-500" />
              {title}
              {hasUnsaved && (
                <span className="text-[10px] text-warning font-normal">
                  (có thay đổi chưa lưu)
                </span>
              )}
              {staleCount > 0 && (
                <span className="text-[10px] text-warning font-normal">
                  · {staleCount} mục đã cũ
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {description ?? "Số hoa hồng đã ghi nhận theo ngày nhưng chưa đối soát thành đợt"}
              {" · "}
              {items.length} affiliate · Tổng{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(total)}
              </span>
            </p>
          </div>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronUp className="w-4 h-4 flex-shrink-0" />
          )}
        </button>
      </CardHeader>
      {!collapsed && (
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              Chưa có affiliate nào active. Thêm affiliate trước để nhập số liệu.
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left font-medium px-6 py-2.5">Affiliate</th>
                    <th className="text-right font-medium px-3 py-2.5 w-[200px]">
                      Số tiền đang xử lý
                    </th>
                    <th className="text-center font-medium px-3 py-2.5 w-[160px]">
                      Snapshot Shopee
                    </th>
                    <th className="text-left font-medium px-3 py-2.5 w-[130px]">
                      Cập nhật lần cuối
                    </th>
                    <th className="text-right font-medium px-6 py-2.5 w-[100px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isEdited = edits[item.affiliate_id] !== undefined;
                    const stale = isStale(item.updated_at);
                    const isSaving = savingId === item.affiliate_id;

                    return (
                      <tr
                        key={item.affiliate_id}
                        className={cn(
                          "border-b border-border last:border-0 hover:bg-muted/30",
                          isEdited && "bg-warning/5",
                          stale && Number(item.amount) > 0 && !isEdited && "bg-muted/20",
                        )}
                      >
                        <td className="px-6 py-2.5 font-medium">
                          {item.affiliate_name}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <CurrencyInput
                            value={getCurrentAmount(item)}
                            onChange={(v) => setEdit(item.affiliate_id, v)}
                            className="text-right tabular-nums h-9"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Input
                            type="date"
                            value={getCurrentSnapshot(item)}
                            onChange={(e) =>
                              setSnapshot(item.affiliate_id, e.target.value)
                            }
                            className="h-9 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <div
                            className={cn(
                              stale && Number(item.amount) > 0
                                ? "text-warning font-medium"
                                : "text-muted-foreground",
                            )}
                          >
                            {timeAgo(item.updated_at)}
                          </div>
                          {stale && Number(item.amount) > 0 && (
                            <div className="text-[10px] text-warning mt-0.5">
                              Đã cũ — nên cập nhật
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-2 text-right">
                          <Button
                            size="sm"
                            variant={isEdited ? "default" : "outline"}
                            onClick={() => save(item)}
                            disabled={isSaving || !isEdited}
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            Lưu
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold bg-muted/30">
                    <td className="px-6 py-3">Tổng cộng</td>
                    <td className="px-3 py-3 text-right tabular-nums text-purple-500">
                      {formatCurrency(total)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            💡 <strong>Cách dùng</strong>: Vào trang Shopee Affiliate → Thanh toán → Hóa đơn đối soát → copy số &ldquo;Khoản thanh toán đang xử lý&rdquo; → paste vào ô tương ứng → bấm Lưu.
            Số mới sẽ <strong>ghi đè</strong> số cũ. Hiển thị trong Tổng tài sản và trang chi tiết affiliate.
          </div>
        </CardContent>
      )}
    </Card>
  );
}
