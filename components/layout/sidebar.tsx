"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Building2,
  PencilLine,
  Receipt,
  FileSearch,
  FileBarChart,
  Settings,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Tài khoản affiliate", href: "/affiliates", icon: Users },
  { title: "Nhập liệu", href: "/data-entry", icon: PencilLine },
  { title: "Sổ quỹ tiền mặt", href: "/cash-book", icon: Wallet },
  { title: "Sổ ngân hàng", href: "/bank-book", icon: Building2 },
  { title: "Thuế TNCN", href: "/tax", icon: Receipt },
  { title: "Đối soát Shopee", href: "/reconciliation", icon: FileSearch },
  { title: "Báo cáo", href: "/reports", icon: FileBarChart },
];

const settingsItems: NavItem[] = [
  { title: "Cài đặt", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r border-border bg-card flex-shrink-0 flex flex-col">
      <div className="h-14 flex items-center px-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-semibold text-sm">
              SA
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">
              Shopee Acc.
            </span>
            <span className="text-[10px] text-muted-foreground leading-none mt-1">
              v1.0
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        <div className="px-2 mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Quản lý
          </p>
        </div>
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <div className="px-2 mt-6 mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Khác
          </p>
        </div>
        {settingsItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="text-[10px] text-muted-foreground text-center">
          © 2026 Internal Tool
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}
