import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Tags, Receipt, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const sections = [
    {
      href: "/settings/bank-accounts",
      icon: Building2,
      title: "Tài khoản ngân hàng công ty",
      description: "Khai báo TK gom tiền từ affiliate",
    },
    {
      href: "/settings/categories",
      icon: Tags,
      title: "Khoản mục chi phí",
      description: "Quản lý danh sách các khoản chi",
      disabled: true,
    },
    {
      href: "/settings/users",
      icon: Users,
      title: "Người dùng & phân quyền",
      description: "Quản lý admin / kế toán / viewer",
      disabled: true,
    },
    {
      href: "/settings/tax",
      icon: Receipt,
      title: "Cấu hình thuế",
      description: "Tỷ lệ khấu trừ, ngưỡng áp dụng",
      disabled: true,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Cài đặt"
        description="Quản lý cấu hình hệ thống"
      />

      <div className="space-y-3">
        {sections.map((s) => {
          const Icon = s.icon;
          const inner = (
            <Card
              className={`transition-all ${
                s.disabled
                  ? "opacity-50"
                  : "hover:border-primary/40 hover:shadow-sm cursor-pointer"
              }`}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {s.title}
                    {s.disabled && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Sắp có
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.description}
                  </div>
                </div>
                {!s.disabled && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          );
          return s.disabled ? (
            <div key={s.href}>{inner}</div>
          ) : (
            <Link key={s.href} href={s.href}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
