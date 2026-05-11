"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AffiliateStatus } from "@/types/database";

export interface AffiliateFormData {
  full_name: string;
  email: string;
  phone?: string;
  cccd?: string;
  tax_code?: string;
  date_of_birth?: string;
  address?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  shopee_account_email?: string;
  shopee_affiliate_id?: string;
  has_personal_deduction: boolean;
  dependent_count: number;
  status: AffiliateStatus;
  start_date: string;
  notes?: string;
}

function cleanEmpty<T extends object>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === "" || value === undefined) continue;
    result[key] = value;
  }
  return result as Partial<T>;
}

export async function createAffiliate(formData: AffiliateFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Bạn cần đăng nhập" };
  }

  const cleaned = cleanEmpty(formData);

  const { data, error } = await supabase
    .from("affiliate_accounts")
    .insert({
      ...cleaned,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/affiliates");
  revalidatePath("/dashboard");
  return { data };
}

export async function updateAffiliate(
  id: string,
  formData: Partial<AffiliateFormData>,
) {
  const supabase = await createClient();
  const cleaned = cleanEmpty(formData);

  const { data, error } = await supabase
    .from("affiliate_accounts")
    .update(cleaned)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/affiliates");
  revalidatePath(`/affiliates/${id}`);
  revalidatePath("/dashboard");
  return { data };
}

export async function deleteAffiliate(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("affiliate_accounts")
    .update({ is_deleted: true, status: "closed" })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/affiliates");
  revalidatePath("/dashboard");
  redirect("/affiliates");
}

export async function getAffiliateSummary(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_affiliate_summary", { p_account_id: accountId })
    .single();

  if (error) return null;
  return data;
}
