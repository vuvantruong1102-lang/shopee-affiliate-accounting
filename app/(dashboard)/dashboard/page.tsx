import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  TrendingUp,
  CircleDollarSign,
  Receipt,
  ArrowUpRight,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tổng quan"
        description="Theo dõi hoạt động affiliate Shopee và dòng tiền"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tổng hoa hồng tháng này"
          value={formatCurrency(0)}
          subtitle="Cập nhật real-time"
          icon={CircleDollarSign}
          trend={null}
        />
        <KpiCard
          label="Đã nhận tiền"
          value={formatCurrency(0)}
          subtitle="0% so với chốt"
          icon={Wallet}
          trend={null}
        />
        <KpiCard
          label="Chưa nhận"
          value={formatCurrency(0)}
          subtitle="0 đợt chờ"
          icon={TrendingUp}
          trend={null}
          variant="warning"
        />
        <KpiCard
          label="Thuế đã khấu trừ"
          value={formatCurrency(0)}
          subtitle="10% Shopee giữ lại"
          icon={Receipt}
          trend={null}
        />
      </div>

      {/* Chart placeholder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Hoa hồng theo ngày</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              30 ngày gần nhất
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground border-2 border-dashed border-border rounded-md">
            <div className="text-center">
              <p>Biểu đồ sẽ hiển thị sau khi có dữ liệu</p>
              <p className="text-xs mt-2">
                Bắt đầu bằng cách thêm tài khoản affiliate và nhập hoa hồng
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state cho affiliate list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Tài khoản affiliate</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Tổng quan tất cả tài khoản
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Chưa có tài khoản affiliate</p>
            <p className="text-xs text-muted-foreground mt-1">
              Thêm tài khoản đầu tiên để bắt đầu theo dõi
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: number | null;
  variant?: "default" | "warning" | "success";
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
}: KpiCardProps) {
  const iconColor = {
    default: "text-muted-foreground",
    warning: "text-warning",
    success: "text-success",
  }[variant];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-semibold mt-2 tabular-nums tracking-tight">
              {value}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {trend !== null && (
                <span className="inline-flex items-center text-xs font-medium text-success">
                  <ArrowUpRight className="w-3 h-3" />
                  {trend}%
                </span>
              )}
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
          </div>
          <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );
}
