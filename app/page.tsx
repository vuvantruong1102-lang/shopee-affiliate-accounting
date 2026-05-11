import { LoginForm } from "@/components/auth/login-form";
import { Building2 } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Kế toán Affiliate Shopee
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Đăng nhập để quản lý hệ thống
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <LoginForm />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 — Phần mềm nội bộ
        </p>
      </div>
    </div>
  );
}
