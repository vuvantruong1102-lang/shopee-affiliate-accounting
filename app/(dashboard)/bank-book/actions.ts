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

export interface UpdateBankTxnInput {
  id: string;
  bank_account_id?: string;
  trans_type?: "income" | "expense";
  trans_date?: string;
  amount?: number;
  description?: string;
  notes?: string;
  category_id?: string | null;
  account_id?: string | null;
}

export async function updateBankTransaction(input: UpdateBankTxnInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const updateData: Record<string, unknown> = {};
  if (input.bank_account_id !== undefined) updateData.bank_account_id = input.bank_account_id;
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
    .from("bank_transactions")
    .update(updateData)
    .eq("id", input.id);

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
