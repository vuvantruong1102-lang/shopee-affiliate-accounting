import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { TrendingUp, Users, Calculator, ArrowRight } from "lucide-react";

const REPORTS = [
  {
    href: "/reports/revenue",
    icon: TrendingUp,
    title: "Báo cáo Doanh thu",
    description: "Tổng hợp doanh thu hoa hồng theo kỳ, breakdown từng tháng, so sánh với kỳ trước",
    color: "bg-primary/10 text-primary",
  },
  {
    href: "/reports/affiliates",
    icon: Users,
    title: "Báo cáo theo Affiliate",
    description: "Bảng tổng hợp doanh thu, đã nhận, đã nộp, đang cầm của từng affiliate",
    color: "bg-success/10 text-success",
  },
  {
    href: "/reports/pnl",
    icon: Calculator,
    title: "Báo cáo Lãi/Lỗ (P&L)",
    description: "Doanh thu - Chi phí = Lãi/Lỗ. Phân tích chi phí theo từng loại (Marketing, Lương...)",
    color: "bg-warning/10 text-warning",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Báo cáo"
        description="Chọn loại báo cáo phù hợp với mục đích sử dụng"
      />

      <div className="grid gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href}>
              <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-6 flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${r.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base">{r.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {r.description}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
