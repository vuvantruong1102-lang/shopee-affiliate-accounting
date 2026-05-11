import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  CircleDollarSign,
  Banknote,
  Receipt,
} from "lucide-react";
import Link from "next/link";

export default async function DataEntryPage() {
  const supabase = await createClient();

  const [{ count: affiliateCount }, { count: bankCount }] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false),
    supabase
      .from("bank_accounts")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  const hasAffiliates = (affiliateCount ?? 0) > 0;
  const hasBank = (bankCount ?? 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Nhập liệu hàng ngày"
        description="Chọn loại giao dịch cần ghi nhận"
      />

      {!hasAffiliates && (
        <Card>
          <CardContent className="py-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <CircleDollarSign className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                Chưa có tài khoản affiliate
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cần thêm ít nhất 1 affiliate trước khi nhập hoa hồng
              </p>
            </div>
            <Link
              href="/affiliates/new"
              className="text-sm text-primary font-medium hover:underline"
            >
              Thêm ngay →
            </Link>
          </CardContent>
        </Card>
      )}

      {!hasBank && (
        <Card>
          <CardContent className="py-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                Chưa có tài khoản ngân hàng công ty
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cần khai báo TK ngân hàng để gom tiền về
              </p>
            </div>
            <Link
              href="/settings/bank-accounts"
              className="text-sm text-primary font-medium hover:underline"
            >
              Khai báo →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard
          href="/data-entry/commission"
          icon={CircleDollarSign}
          title="Hoa hồng mới"
          description="Ghi nhận hoa hồng Shopee chuyển về tài khoản cá nhân"
          color="primary"
          disabled={!hasAffiliates}
        />
        <ActionCard
          href="/data-entry/deposit"
          icon={Banknote}
          title="Nộp tiền vào ngân hàng"
          description="Affiliate nộp tiền vào TK ngân hàng công ty (ghi vào sổ ngân hàng)"
          color="success"
          disabled={!hasAffiliates || !hasBank}
        />
        <ActionCard
          href="/data-entry/expense"
          icon={Receipt}
          title="Chi tiêu"
          description="Ghi nhận khoản chi (lương, marketing, văn phòng...)"
          color="danger"
          disabled={!hasBank}
        />
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  color,
  disabled,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: "primary" | "warning" | "success" | "danger";
  disabled?: boolean;
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
  };

  const content = (
    <Card
      className={`transition-all ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-primary/40 hover:shadow-md cursor-pointer"
      }`}
    >
      <CardContent className="p-6 flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-lg ${colorMap[color]} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-base">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (disabled) return content;
  return <Link href={href}>{content}</Link>;
}
