"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ConfirmPaymentForm } from "./confirm-payment-form";
import { PaymentList } from "./payment-list";
import type { AffiliateAccount } from "@/types/database";

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
  affiliates: Pick<
    AffiliateAccount,
    "id" | "full_name" | "bank_name" | "bank_account_number" | "status"
  >[];
  payments: ShopeePayment[];
}

export function ReconciliationView({ affiliates, payments }: Props) {
  const [editingPayment, setEditingPayment] = useState<ShopeePayment | null>(null);

  const totalPending = payments
    .filter((p) => !p.is_received)
    .reduce((s, p) => s + Number(p.total_net), 0);

  const totalReceived = payments
    .filter((p) => p.is_received)
    .reduce((s, p) => s + Number(p.total_net), 0);

  const pendingCount = payments.filter((p) => !p.is_received).length;
  const receivedCount = payments.filter((p) => p.is_received).length;

  return (
    <div className="space-y-6">
      {/* KPI tổng quan */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Đang chờ nhận"
          value={pendingCount}
          subtitle={`Tổng ${totalPending.toLocaleString("vi-VN")}đ`}
          variant="warning"
        />
        <KpiCard
          label="Đã nhận"
          value={receivedCount}
          subtitle={`Tổng ${totalReceived.toLocaleString("vi-VN")}đ`}
          variant="success"
        />
        <KpiCard
          label="Tổng đợt"
          value={payments.length}
          subtitle="Tất cả thời gian"
        />
      </div>

      {/* Layout 2 cột */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* CỘT TRÁI: Form (2/5) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {editingPayment ? "Sửa đợt thanh toán" : "Thêm đợt thanh toán mới"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Nhập số liệu từ trang "Lịch sử thanh toán" của Shopee Affiliate
              </p>
            </CardHeader>
            <CardContent>
              <ConfirmPaymentForm
                affiliates={affiliates}
                editingPayment={editingPayment}
                onCancelEdit={() => setEditingPayment(null)}
                onSuccess={() => setEditingPayment(null)}
              />
            </CardContent>
          </Card>
        </div>

        {/* CỘT PHẢI: Danh sách đợt (3/5) */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Các đợt thanh toán đã nhập</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {payments.length} đợt - sắp xếp theo ngày mới nhất
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <PaymentList
                payments={payments}
                onEdit={setEditingPayment}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  variant = "default",
}: {
  label: string;
  value: number;
  subtitle: string;
  variant?: "default" | "success" | "warning";
}) {
  const valueColor = {
    default: "",
    success: "text-success",
    warning: "text-warning",
  }[variant];

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-2 tabular-nums ${valueColor}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
