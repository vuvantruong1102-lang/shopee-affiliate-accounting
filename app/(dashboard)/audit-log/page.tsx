import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { AuditLogList } from "@/components/audit/audit-log-list";
import { History } from "lucide-react";
import type { AuditLog } from "@/types/audit";

interface PageProps {
  searchParams: Promise<{
    table?: string;
    action?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.table) query = query.eq("table_name", params.table);
  if (params.action) query = query.eq("action", params.action);

  const { data } = await query;
  const logs = (data ?? []) as AuditLog[];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Lịch sử thay đổi"
        description={`${logs.length} thay đổi gần nhất • Tự động ghi nhận mọi hành động sửa/xóa quan trọng`}
      />

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <History className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Chưa có hoạt động nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mọi thay đổi quan trọng sẽ được ghi lại tại đây
            </p>
          </CardContent>
        </Card>
      ) : (
        <AuditLogList
          logs={logs}
          currentTableFilter={params.table}
          currentActionFilter={params.action}
        />
      )}
    </div>
  );
}
