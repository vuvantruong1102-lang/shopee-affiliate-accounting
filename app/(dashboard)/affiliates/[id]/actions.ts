"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface SubmitCashDepositInput {
  affiliate_id: string;
  amount: number;
  trans_date: string;
  notes?: string;
}

export async function submitAffiliateCashDeposit(input: SubmitCashDepositInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (input.amount <= 0) return { error: "Số tiền phải lớn hơn 0" };

  const { data, error } = await supabase.rpc("submit_affiliate_cash_deposit", {
    p_affiliate_id: input.affiliate_id,
    p_amount: input.amount,
    p_trans_date: input.trans_date,
    p_notes: input.notes ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/affiliates/${input.affiliate_id}`);
  revalidatePath("/affiliates");
  revalidatePath("/cash-book");
  revalidatePath("/dashboard");
  return { data };
}

export interface UpdateCommissionInput {
  commission_id: string;
  affiliate_id: string;
  earned_date: string;
  gross_amount: number;
  tax_withheld: number;
  net_amount: number;
  status: "pending" | "received";
  received_date?: string;
  description?: string;
}

export async function updateCommission(input: UpdateCommissionInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase.rpc("update_commission", {
    p_commission_id: input.commission_id,
    p_earned_date: input.earned_date,
    p_gross_amount: input.gross_amount,
    p_tax_withheld: input.tax_withheld,
    p_net_amount: input.net_amount,
    p_status: input.status,
    p_received_date: input.received_date ?? null,
    p_description: input.description ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/affiliates/${input.affiliate_id}`);
  revalidatePath("/affiliates");
  revalidatePath("/dashboard");
  revalidatePath("/tax");
  return { success: true };
}

export async function deleteCommission(commission_id: string, affiliate_id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase.rpc("delete_commission", {
    p_commission_id: commission_id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/affiliates/${affiliate_id}`);
  revalidatePath("/affiliates");
  revalidatePath("/dashboard");
  revalidatePath("/tax");
  return { success: true };
}
