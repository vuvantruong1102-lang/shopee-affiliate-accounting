import { createClient } from "@/lib/supabase/server";
import { ShopeeProcessingTable } from "@/components/reports/shopee-processing-table";

interface ProcessingItem {
  affiliate_id: string;
  affiliate_name: string;
  amount: number;
  snapshot_date: string | null;
  updated_at: string | null;
  notes: string | null;
}

interface ProcessingRow {
  affiliate_id: string;
  amount: number | string;
  snapshot_date: string | null;
  updated_at: string | null;
  notes: string | null;
}

/**
 * Server component bọc ShopeeProcessingTable.
 * Fetch danh sách affiliate active/paused + giá trị Shopee đang xử lý hiện tại.
 * Nhúng vào reconciliation/page.tsx hoặc bất cứ đâu cần bảng nhập.
 */
export async function ShopeeProcessingSection() {
  const supabase = await createClient();

  // Lấy tất cả affiliate active/paused (bỏ closed)
  const { data: affiliates } = await supabase
    .from("affiliate_accounts")
    .select("id, full_name, status")
    .or("is_deleted.is.null,is_deleted.eq.false")
    .in("status", ["active", "paused"])
    .order("full_name");

  if (!affiliates || affiliates.length === 0) {
    return null;
  }

  const affiliateIds = affiliates.map((a) => a.id);

  // Lấy giá trị Shopee đang xử lý hiện tại (1 row/affiliate vì PK)
  const { data: processing } = await supabase
    .from("shopee_processing_amounts")
    .select("affiliate_id, amount, snapshot_date, updated_at, notes")
    .in("affiliate_id", affiliateIds);

  const processingMap = new Map<string, ProcessingRow>();
  for (const p of (processing ?? []) as ProcessingRow[]) {
    processingMap.set(p.affiliate_id, p);
  }

  const items: ProcessingItem[] = affiliates.map((a) => {
    const p = processingMap.get(a.id);
    return {
      affiliate_id: a.id,
      affiliate_name: a.full_name,
      amount: p ? Number(p.amount) : 0,
      snapshot_date: p?.snapshot_date ?? null,
      updated_at: p?.updated_at ?? null,
      notes: p?.notes ?? null,
    };
  });

  return <ShopeeProcessingTable items={items} defaultExpanded={true} />;
}
