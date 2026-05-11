"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  createAffiliate,
  updateAffiliate,
  type AffiliateFormData,
} from "@/app/(dashboard)/affiliates/actions";
import type { AffiliateAccount } from "@/types/database";

interface Props {
  mode: "create" | "edit";
  initialData?: AffiliateAccount;
}

export function AffiliateForm({ mode, initialData }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<AffiliateFormData>({
    full_name: initialData?.full_name ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    cccd: initialData?.cccd ?? "",
    tax_code: initialData?.tax_code ?? "",
    date_of_birth: initialData?.date_of_birth ?? "",
    address: initialData?.address ?? "",
    bank_name: initialData?.bank_name ?? "",
    bank_account_number: initialData?.bank_account_number ?? "",
    bank_account_holder: initialData?.bank_account_holder ?? "",
    shopee_account_email: initialData?.shopee_account_email ?? "",
    shopee_affiliate_id: initialData?.shopee_affiliate_id ?? "",
    has_personal_deduction: initialData?.has_personal_deduction ?? true,
    dependent_count: initialData?.dependent_count ?? 0,
    status: initialData?.status ?? "active",
    start_date:
      initialData?.start_date ?? new Date().toISOString().split("T")[0],
    notes: initialData?.notes ?? "",
  });

  const update = <K extends keyof AffiliateFormData>(
    key: K,
    value: AffiliateFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Vui lòng nhập đầy đủ họ tên và email");
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === "create"
          ? await createAffiliate(form)
          : await updateAffiliate(initialData!.id, form);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        mode === "create"
          ? "Đã thêm tài khoản mới"
          : "Đã cập nhật thông tin",
      );

      if (mode === "create" && result.data) {
        router.push(`/affiliates/${result.data.id}`);
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin cá nhân</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Họ và tên" required>
            <Input
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Nguyễn Văn A"
              required
            />
          </FormField>
          <FormField label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="email@example.com"
              required
            />
          </FormField>
          <FormField label="Số điện thoại">
            <Input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="0901234567"
            />
          </FormField>
          <FormField label="Ngày sinh">
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => update("date_of_birth", e.target.value)}
            />
          </FormField>
          <FormField label="CCCD/CMND">
            <Input
              value={form.cccd}
              onChange={(e) => update("cccd", e.target.value)}
              placeholder="0XXXXXXXXXXX"
            />
          </FormField>
          <FormField label="Mã số thuế cá nhân">
            <Input
              value={form.tax_code}
              onChange={(e) => update("tax_code", e.target.value)}
              placeholder="XXXXXXXXXX"
            />
          </FormField>
          <FormField label="Địa chỉ" className="md:col-span-2">
            <Input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản ngân hàng cá nhân</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tài khoản nhận tiền chuyển từ Shopee
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Tên ngân hàng">
            <Input
              value={form.bank_name}
              onChange={(e) => update("bank_name", e.target.value)}
              placeholder="Vietcombank, MB Bank, ..."
            />
          </FormField>
          <FormField label="Số tài khoản">
            <Input
              value={form.bank_account_number}
              onChange={(e) => update("bank_account_number", e.target.value)}
              placeholder="XXXXXXXXXXXX"
              className="font-mono"
            />
          </FormField>
          <FormField label="Tên chủ tài khoản" className="md:col-span-2">
            <Input
              value={form.bank_account_holder}
              onChange={(e) => update("bank_account_holder", e.target.value)}
              placeholder="NGUYEN VAN A"
              style={{ textTransform: "uppercase" }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản Shopee Affiliate</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Email đăng ký Shopee">
            <Input
              type="email"
              value={form.shopee_account_email}
              onChange={(e) => update("shopee_account_email", e.target.value)}
              placeholder="email@example.com"
            />
          </FormField>
          <FormField label="ID Affiliate (nếu có)">
            <Input
              value={form.shopee_affiliate_id}
              onChange={(e) => update("shopee_affiliate_id", e.target.value)}
              placeholder="affiliate_id"
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin thuế TNCN</CardTitle>
          <p className="text-xs text-muted-foreground">
            Dùng để tính thuế quyết toán cuối năm
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
            <input
              type="checkbox"
              id="has_personal_deduction"
              checked={form.has_personal_deduction}
              onChange={(e) => update("has_personal_deduction", e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <label htmlFor="has_personal_deduction" className="cursor-pointer flex-1">
              <div className="text-sm font-medium">
                Được giảm trừ bản thân (11 triệu/tháng)
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Áp dụng khi quyết toán thuế cuối năm. Mặc định bật.
              </p>
            </label>
          </div>

          <FormField label="Số người phụ thuộc">
            <Input
              type="number"
              min="0"
              max="20"
              value={form.dependent_count}
              onChange={(e) =>
                update("dependent_count", parseInt(e.target.value) || 0)
              }
              className="w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mỗi người phụ thuộc được giảm trừ 4.4 triệu/tháng
            </p>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trạng thái</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Trạng thái">
            <select
              value={form.status}
              onChange={(e) => update("status", e.target.value as typeof form.status)}
              className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="active">Đang hoạt động</option>
              <option value="paused">Tạm dừng</option>
              <option value="closed">Đã đóng</option>
            </select>
          </FormField>
          <FormField label="Ngày bắt đầu">
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => update("start_date", e.target.value)}
            />
          </FormField>
          <FormField label="Ghi chú" className="md:col-span-2">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
              placeholder="Ghi chú thêm (tùy chọn)"
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {mode === "create" ? "Thêm tài khoản" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
