"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface BankAccountInput {
  bank_name: string;
  account_number: string;
  account_holder: string;
  notes?: string;
  opening_balance?: number;
}

export async function createBankAccount(input: BankAccountInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (!input.bank_name.trim()) return { error: "Nhập tên ngân hàng" };
  if (!input.account_number.trim()) return { error: "Nhập số tài khoản" };
  if (!input.account_holder.trim()) return { error: "Nhập tên chủ tài khoản" };

  const { error } = await supabase.from("bank_accounts").insert({
    bank_name: input.bank_name.trim(),
    account_number: input.account_number.trim(),
    account_holder: input.account_holder.trim(),
    notes: input.notes?.trim() || null,
    opening_balance: input.opening_balance ?? 0,
    is_company: true,
  });

  if (error) {
    console.error("[createBankAccount] error:", error);
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/bank-book");
  revalidatePath("/reports/assets");
  revalidatePath("/dashboard");
  return { success: true };
}

export interface UpdateBankAccountInput extends BankAccountInput {
  id: string;
}

export async function updateBankAccount(input: UpdateBankAccountInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (!input.bank_name.trim()) return { error: "Nhập tên ngân hàng" };
  if (!input.account_number.trim()) return { error: "Nhập số tài khoản" };
  if (!input.account_holder.trim()) return { error: "Nhập tên chủ tài khoản" };

  const { error } = await supabase
    .from("bank_accounts")
    .update({
      bank_name: input.bank_name.trim(),
      account_number: input.account_number.trim(),
      account_holder: input.account_holder.trim(),
      notes: input.notes?.trim() || null,
      opening_balance: input.opening_balance ?? 0,
    })
    .eq("id", input.id);

  if (error) {
    console.error("[updateBankAccount] error:", error);
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/bank-book");
  revalidatePath("/reports/assets");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBankAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { data, error } = await supabase
    .rpc("delete_bank_account", { p_bank_account_id: id })
    .single();

  if (error) {
    console.error("[deleteBankAccount] error:", error);
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/bank-book");
  revalidatePath("/reports/assets");
  revalidatePath("/dashboard");
  return {
    data: data as { was_hard_deleted: boolean; transaction_count: number },
  };
}
