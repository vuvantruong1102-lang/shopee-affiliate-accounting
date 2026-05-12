import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Database, Shield, Clock } from "lucide-react";
import { BackupClient } from "@/components/backup/backup-client";

export default async function BackupPage() {
  const supabase = await createClient();

  // Lấy stats để hiển thị
  const [affRes, commRes, cashRes, bankRes, shopeeRes] = await Promise.all([
    supabase.from("affiliate_accounts").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("commissions").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("cash_transactions").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("bank_transactions").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("shopee_payments").select("*", { count: "exact", head: true }).eq("is_deleted", false),
  ]);

  const stats = {
    affiliates: affRes.count ?? 0,
    commissions: commRes.count ?? 0,
    cash_transactions: cashRes.count ?? 0,
    bank_transactions: bankRes.count ?? 0,
    shopee_payments: shopeeRes.count ?? 0,
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Backup dữ liệu"
        description="Xuất toàn bộ dữ liệu ra Excel để lưu trữ offline"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tổng quan dữ liệu</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tất cả dữ liệu chưa bị xóa
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatBlock label="Affiliate" value={stats.affiliates} />
            <StatBlock label="Hoa hồng" value={stats.commissions} />
            <StatBlock label="GD tiền mặt" value={stats.cash_transactions} />
            <StatBlock label="GD ngân hàng" value={stats.bank_transactions} />
            <StatBlock label="Đợt Shopee" value={stats.shopee_payments} />
            <StatBlock
              label="Tổng records"
              value={Object.values(stats).reduce((s, v) => s + v, 0)}
              highlight
            />
          </div>
        </CardContent>
      </Card>

      <BackupClient />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Khuyến nghị</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Recommendation
            icon={Clock}
            title="Backup định kỳ"
            description="Tải file backup ít nhất 1 lần/tháng. Lưu vào Google Drive, OneDrive, hoặc ổ cứng riêng."
          />
          <Recommendation
            icon={Shield}
            title="Lưu nhiều bản"
            description="Giữ ít nhất 3 bản backup gần nhất (tháng này, tháng trước, 3 tháng trước). Phòng khi có sự cố sửa nhầm số liệu cũ."
          />
          <Recommendation
            icon={Database}
            title="Supabase có backup riêng"
            description="Supabase tự backup database 7 ngày gần nhất (bản free). Nếu cần khôi phục dữ liệu cũ hơn, sẽ cần file backup tự xuất."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatBlock({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={highlight ? "p-4 rounded-md bg-primary/5 border border-primary/20" : "p-4 rounded-md bg-muted/40"}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${highlight ? "text-primary" : ""}`}>
        {value.toLocaleString("vi-VN")}
      </div>
    </div>
  );
}

function Recommendation({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div>
        <div className="font-medium">{title}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
