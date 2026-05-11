import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { AffiliateTable } from "@/components/affiliates/affiliate-table";
import type { AffiliateAccount } from "@/types/database";

export default async function AffiliatesPage() {
  const supabase = await createClient();

  const { data: affiliates } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const list = (affiliates ?? []) as AffiliateAccount[];

  const activeCount = list.filter((a) => a.status === "active").length;
  const pausedCount = list.filter((a) => a.status === "paused").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tài khoản affiliate"
        description={`${list.length} người đứng tên • ${activeCount} đang hoạt động • ${pausedCount} tạm dừng`}
        action={
          <Button asChild>
            <Link href="/affiliates/new">
              <Plus className="w-4 h-4" />
              Thêm tài khoản
            </Link>
          </Button>
        }
      />

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Chưa có tài khoản affiliate</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Thêm người đứng tên đầu tiên để bắt đầu theo dõi
            </p>
            <Button asChild>
              <Link href="/affiliates/new">
                <Plus className="w-4 h-4" />
                Thêm tài khoản đầu tiên
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AffiliateTable data={list} />
      )}
    </div>
  );
}
