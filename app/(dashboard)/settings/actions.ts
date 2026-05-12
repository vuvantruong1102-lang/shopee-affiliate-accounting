"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface BankAccountInput {
  bank_name: string;
  account_number: string;
  account_holder: string;
  notes?: string;
}

export async function createBankAccount(input: BankAccountInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (!input.bank_name.trim()) return { error: "Nhập tên ngân hàng" };
  if (!input.account_number.trim()) return { error: "Nhập số tài khoản" };
  if (!input.account_holder.trim()) return { error: "Nhập tên chủ tài khoản" };

  // ✨ FIX: bỏ created_by vì cột này không tồn tại trong bảng bank_accounts
  const { error } = await supabase.from("bank_accounts").insert({
    bank_name: input.bank_name.trim(),
    account_number: input.account_number.trim(),
    account_holder: input.account_holder.trim(),
    notes: input.notes?.trim() || null,
    is_company: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/bank-book");
  return { success: true };
}

export interface UpdateBankAccountInput extends BankAccountInput {
  id: string;
}

export async function updateBankAccount(input: UpdateBankAccountInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase
    .from("bank_accounts")
    .update({
      bank_name: input.bank_name.trim(),
      account_number: input.account_number.trim(),
      account_holder: input.account_holder.trim(),
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/bank-book");
  return { success: true };
}

export async function deleteBankAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { data, error } = await supabase
    .rpc("delete_bank_account", { p_bank_account_id: id })
    .single();

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/bank-book");
  return { data: data as { was_hard_deleted: boolean; transaction_count: number } };
}
