"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateCashTxnInput {
  trans_type: "income" | "expense";
  trans_date: string;
  amount: number;
  description: string;
  notes?: string;
}

export async function createCashTransaction(input: CreateCashTxnInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (input.amount <= 0) return { error: "Số tiền phải lớn hơn 0" };
  if (!input.description.trim()) return { error: "Nhập diễn giải" };

  const { data, error } = await supabase.rpc("create_cash_transaction", {
    p_trans_type: input.trans_type,
    p_trans_date: input.trans_date,
    p_amount: input.amount,
    p_description: input.description.trim(),
    p_notes: input.notes?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/cash-book");
  revalidatePath("/dashboard");
  return { data };
}

export async function deleteCashTransaction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase
    .from("cash_transactions")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/cash-book");
  revalidatePath("/dashboard");
  return { success: true };
}
