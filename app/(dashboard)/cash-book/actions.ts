"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import * as bankActions from "@/app/(dashboard)/bank-book/actions";

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

export interface CashTxnUpdates {
  trans_type?: "income" | "expense";
  trans_date?: string;
  amount?: number;
  description?: string;
  notes?: string | null;
  category_id?: string | null;
  account_id?: string | null;
}

// ✨ Signature: updateCashTransaction(id, updates) — tương thích code cũ
export async function updateCashTransaction(id: string, updates: CashTxnUpdates) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const updateData: Record<string, unknown> = {};
  if (updates.trans_type !== undefined) updateData.trans_type = updates.trans_type;
  if (updates.trans_date !== undefined) updateData.trans_date = updates.trans_date;
  if (updates.amount !== undefined) {
    if (updates.amount <= 0) return { error: "Số tiền phải lớn hơn 0" };
    updateData.amount = updates.amount;
  }
  if (updates.description !== undefined) {
    if (!updates.description.trim()) return { error: "Nhập diễn giải" };
    updateData.description = updates.description.trim();
  }
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes === null ? null : updates.notes?.trim() || null;
  }
  if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
  if (updates.account_id !== undefined) updateData.account_id = updates.account_id;

  const { error } = await supabase
    .from("cash_transactions")
    .update(updateData)
    .eq("id", id);

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
// BANK - wrap để tương thích import cũ từ cash-book/actions
// ============================================================================
export async function createBankTransaction(
  input: Parameters<typeof bankActions.createBankTransaction>[0],
) {
  return bankActions.createBankTransaction(input);
}

export async function updateBankTransaction(
  id: string,
  updates: Parameters<typeof bankActions.updateBankTransaction>[1],
) {
  return bankActions.updateBankTransaction(id, updates);
}

export async function deleteBankTransaction(id: string) {
  return bankActions.deleteBankTransaction(id);
}

export async function submitBankFromCash(
  input: Parameters<typeof bankActions.submitBankFromCash>[0],
) {
  return bankActions.submitBankFromCash(input);
}
