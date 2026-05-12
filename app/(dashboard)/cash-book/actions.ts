"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// CASH - thu/chi tiền mặt thủ công
// ============================================================================
export interface CreateCashTxnInput {
  trans_type: "income" | "expense";
  trans_date: string;
  amount: number;
  description: string;
  notes?: string;
  category_id?: string | null;
  account_id?: string | null;
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

export interface UpdateCashTxnInput {
  id: string;
  trans_type?: "income" | "expense";
  trans_date?: string;
  amount?: number;
  description?: string;
  notes?: string;
  category_id?: string | null;
  account_id?: string | null;
}

export async function updateCashTransaction(input: UpdateCashTxnInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const updateData: Record<string, unknown> = {};
  if (input.trans_type !== undefined) updateData.trans_type = input.trans_type;
  if (input.trans_date !== undefined) updateData.trans_date = input.trans_date;
  if (input.amount !== undefined) {
    if (input.amount <= 0) return { error: "Số tiền phải lớn hơn 0" };
    updateData.amount = input.amount;
  }
  if (input.description !== undefined) {
    if (!input.description.trim()) return { error: "Nhập diễn giải" };
    updateData.description = input.description.trim();
  }
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
  if (input.category_id !== undefined) updateData.category_id = input.category_id;
  if (input.account_id !== undefined) updateData.account_id = input.account_id;

  const { error } = await supabase
    .from("cash_transactions")
    .update(updateData)
    .eq("id", input.id);

  if (error) return { error: error.message };

  revalidatePath("/cash-book");
  revalidatePath("/dashboard");
  return { success: true };
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

// ============================================================================
// BANK - re-export từ bank-book/actions.ts
// (Để tương thích với code cũ import từ cash-book/actions)
// ============================================================================
export {
  createBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
  submitBankFromCash,
} from "@/app/(dashboard)/bank-book/actions";
