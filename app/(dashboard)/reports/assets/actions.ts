"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface UpsertShopeeProcessingInput {
  affiliate_id: string;
  amount: number;
  snapshot_date?: string;
  notes?: string;
}

export async function upsertShopeeProcessing(input: UpsertShopeeProcessingInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (input.amount < 0) return { error: "Số tiền không được âm" };

  const { data, error } = await supabase.rpc("upsert_shopee_processing", {
    p_affiliate_id: input.affiliate_id,
    p_amount: input.amount,
    p_snapshot_date: input.snapshot_date ?? null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    console.error("[upsertShopeeProcessing] error:", error);
    return { error: error.message };
  }

  revalidatePath("/reports/assets");
  revalidatePath("/dashboard");
  return { data };
}
