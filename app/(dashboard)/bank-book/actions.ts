"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ===========================================================================
// THU/CHI NGÂN HÀNG thủ công
// ===========================================================================
export interface CreateBankTxnInput {
  bank_account_id: string;
  trans_type: "income" | "expense";
  trans_date: string;
  amount: number;
  description: string;
  notes?: string;
  category_id?: string | null;
  account_id?: string | null;
}

export async function createBankTransaction(input: CreateBankTxnInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (input.amount <= 0) return { error: "Số tiền phải lớn hơn 0" };
  if (!input.description.trim()) return { error: "Nhập diễn giải" };
  if (!input.bank_account_id) return { error: "Chọn tài khoản ngân hàng" };

  const { data, error } = await supabase.rpc("create_bank_transaction", {
    p_bank_account_id: input.bank_account_id,
    p_trans_type: input.trans_type,
    p_trans_date: input.trans_date,
    p_amount: input.amount,
    p_description: input.description.trim(),
    p_notes: input.notes?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { data };
}

export interface BankTxnUpdates {
  bank_account_id?: string;
  trans_type?: "income" | "expense";
  trans_date?: string;
  amount?: number;
  description?: string;
  notes?: string | null;
  category_id?: string | null;
  account_id?: string | null;
}

// ✨ Signature: updateBankTransaction(id, updates) — tương thích code cũ
export async function updateBankTransaction(id: string, updates: BankTxnUpdates) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const updateData: Record<string, unknown> = {};
  if (updates.bank_account_id !== undefined) updateData.bank_account_id = updates.bank_account_id;
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
    .from("bank_transactions")
    .update(updateData)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBankTransaction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase
    .from("bank_transactions")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { success: true };
}

// ===========================================================================
// NỘP TIỀN AFFILIATE TỪ TK TIỀN MẶT VÀO NGÂN HÀNG
// (Atomic: tạo cùng lúc bank income + cash expense)
// ===========================================================================
export interface SubmitBankFromCashInput {
  affiliate_id: string | null;
  bank_account_id: string;
  amount: number;
  trans_date: string;
  notes?: string;
}

export async function submitBankFromCash(input: SubmitBankFromCashInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (input.amount <= 0) return { error: "Số tiền phải lớn hơn 0" };
  if (!input.bank_account_id) return { error: "Chọn tài khoản ngân hàng" };

  const { data, error } = await supabase
    .rpc("submit_bank_from_cash", {
      p_affiliate_id: input.affiliate_id,
      p_bank_account_id: input.bank_account_id,
      p_amount: input.amount,
      p_trans_date: input.trans_date,
      p_notes: input.notes?.trim() || null,
    })
    .single();

  if (error) return { error: error.message };

  revalidatePath("/bank-book");
  revalidatePath("/cash-book");
  revalidatePath("/dashboard");
  if (input.affiliate_id) {
    revalidatePath(`/affiliates/${input.affiliate_id}`);
  }
  return { data };
}
