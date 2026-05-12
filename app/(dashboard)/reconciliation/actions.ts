"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface ConfirmPaymentInput {
  account_id: string;
  payment_code: string;
  payment_date: string; // YYYY-MM-DD
  total_gross: number;
  total_tax: number;
  total_net: number;
  is_received: boolean;
  notes?: string;
}

export async function confirmShopeePayment(input: ConfirmPaymentInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { data, error } = await supabase
    .rpc("confirm_shopee_payment", {
      p_account_id: input.account_id,
      p_payment_code: input.payment_code,
      p_payment_date: input.payment_date,
      p_total_gross: input.total_gross,
      p_total_tax: input.total_tax,
      p_total_net: input.total_net,
      p_is_received: input.is_received,
      p_notes: input.notes ?? null,
    })
    .single();

  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  revalidatePath("/affiliates");
  revalidatePath(`/affiliates/${input.account_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/tax");
  return { data };
}

export interface UpdatePaymentInput {
  payment_id: string;
  payment_code: string;
  payment_date: string;
  total_gross: number;
  total_tax: number;
  total_net: number;
  notes?: string;
  account_id?: string; // để revalidate
}

export async function updateShopeePayment(input: UpdatePaymentInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase.rpc("update_shopee_payment", {
    p_payment_id: input.payment_id,
    p_payment_code: input.payment_code,
    p_payment_date: input.payment_date,
    p_total_gross: input.total_gross,
    p_total_tax: input.total_tax,
    p_total_net: input.total_net,
    p_notes: input.notes ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  revalidatePath("/affiliates");
  if (input.account_id) revalidatePath(`/affiliates/${input.account_id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markPaymentReceived(payment_id: string, received_date?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase.rpc("mark_shopee_payment_received", {
    p_payment_id: payment_id,
    p_received_date: received_date ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  revalidatePath("/affiliates");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function unmarkPaymentReceived(payment_id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase.rpc("unmark_shopee_payment_received", {
    p_payment_id: payment_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  revalidatePath("/affiliates");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteShopeePayment(payment_id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase.rpc("delete_shopee_payment", {
    p_payment_id: payment_id,
  });

  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  revalidatePath("/affiliates");
  revalidatePath("/dashboard");
  revalidatePath("/tax");
  return { success: true };
}

export async function checkDuplicatePaymentCode(
  payment_code: string,
  exclude_id?: string,
) {
  if (!payment_code.trim()) return { duplicates: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_duplicate_payment_code", {
    p_payment_code: payment_code,
    p_exclude_id: exclude_id ?? null,
  });

  if (error) return { duplicates: [] };
  return { duplicates: data ?? [] };
}
