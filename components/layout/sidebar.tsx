"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Pencil,
  Wallet,
  Building2,
  Receipt,
  CheckSquare,
  FileText,
  Calculator,
  History,
  Database,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "Quản lý",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/affiliates", label: "Tài khoản affiliate", icon: Users },
      { href: "/data-entry", label: "Nhập liệu", icon: Pencil },
      { href: "/cash-book", label: "Sổ quỹ tiền mặt", icon: Wallet },
      { href: "/bank-book", label: "Sổ ngân hàng", icon: Building2 },
      { href: "/tax", label: "Thuế TNCN", icon: Receipt },
      { href: "/reconciliation", label: "Đối soát Shopee", icon: CheckSquare },
      { href: "/reports", label: "Báo cáo", icon: FileText },
      { href: "/calculator", label: "Tính toán", icon: Calculator },
    ],
  },
  {
    title: "Khác",
    items: [
      { href: "/audit-log", label: "Lịch sử thay đổi", icon: History },
      { href: "/backup", label: "Backup dữ liệu", icon: Database },
      { href: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
];

interface Props {
  appName?: string;
  version?: string;
}

export function Sidebar({ appName = "Shopee Acc.", version = "v1.2" }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-card border-r border-border flex flex-col flex-shrink-0 print:hidden">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            SA
          </div>
          <div>
            <div className="font-semibold text-sm">{appName}</div>
            <div className="text-[10px] text-muted-foreground -mt-0.5">{version}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 mb-1.5">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 text-[10px] text-muted-foreground text-center border-t border-border">
        © {new Date().getFullYear()} Internal Tool
      </div>
    </aside>
  );
}
