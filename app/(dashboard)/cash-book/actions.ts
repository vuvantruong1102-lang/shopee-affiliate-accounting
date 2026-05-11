"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface CashTransactionUpdate {
  trans_date?: string;
  amount?: number;
  description?: string;
  notes?: string;
}

export async function updateCashTransaction(
  id: string,
  input: CashTransactionUpdate,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error: updateError } = await supabase
    .from("cash_transactions")
    .update(input)
    .eq("id", id);

  if (updateError) return { error: updateError.message };

  // Nếu thay đổi ngày hoặc số tiền → recompute toàn bộ balance
  if (input.trans_date !== undefined || input.amount !== undefined) {
    const { error: recomputeError } = await supabase.rpc("recompute_cash_balances");
    if (recomputeError) {
      console.error("Recompute failed:", recomputeError);
    }
  }

  revalidatePath("/cash-book");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteCashTransaction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  // Lấy thông tin transaction trước khi xóa (để biết có liên kết bank không)
  const { data: cashTrans } = await supabase
    .from("cash_transactions")
    .select("id, account_id")
    .eq("id", id)
    .single();

  if (!cashTrans) return { error: "Không tìm thấy giao dịch" };

  // Tìm bank_transaction liên kết (nếu đây là deposit)
  const { data: linkedBank } = await supabase
    .from("bank_transactions")
    .select("id, bank_account_id")
    .eq("cash_transaction_id", id)
    .single();

  // Soft delete cash
  const { error: cashError } = await supabase
    .from("cash_transactions")
    .update({ is_deleted: true })
    .eq("id", id);

  if (cashError) return { error: cashError.message };

  // Soft delete linked bank (nếu có) — đảm bảo data consistency
  if (linkedBank) {
    await supabase
      .from("bank_transactions")
      .update({ is_deleted: true })
      .eq("id", linkedBank.id);

    // Recompute bank balance
    await supabase.rpc("recompute_bank_balances", {
      p_bank_account_id: linkedBank.bank_account_id,
    });
  }

  // Recompute cash balance
  await supabase.rpc("recompute_cash_balances");

  revalidatePath("/cash-book");
  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { success: true };
}

// ============================================================================
// BANK TRANSACTIONS
// ============================================================================
export interface BankTransactionUpdate {
  trans_date?: string;
  amount?: number;
  description?: string;
  counterparty_name?: string;
  reference_no?: string;
}

export async function updateBankTransaction(
  id: string,
  input: BankTransactionUpdate,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { data: oldTrans } = await supabase
    .from("bank_transactions")
    .select("bank_account_id")
    .eq("id", id)
    .single();

  if (!oldTrans) return { error: "Không tìm thấy giao dịch" };

  const { error: updateError } = await supabase
    .from("bank_transactions")
    .update(input)
    .eq("id", id);

  if (updateError) return { error: updateError.message };

  if (input.trans_date !== undefined || input.amount !== undefined) {
    await supabase.rpc("recompute_bank_balances", {
      p_bank_account_id: oldTrans.bank_account_id,
    });
  }

  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBankTransaction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { data: bankTrans } = await supabase
    .from("bank_transactions")
    .select("id, bank_account_id, cash_transaction_id")
    .eq("id", id)
    .single();

  if (!bankTrans) return { error: "Không tìm thấy giao dịch" };

  const { error: bankError } = await supabase
    .from("bank_transactions")
    .update({ is_deleted: true })
    .eq("id", id);

  if (bankError) return { error: bankError.message };

  // Nếu có liên kết cash_transaction → xóa luôn
  if (bankTrans.cash_transaction_id) {
    await supabase
      .from("cash_transactions")
      .update({ is_deleted: true })
      .eq("id", bankTrans.cash_transaction_id);
    await supabase.rpc("recompute_cash_balances");
  }

  await supabase.rpc("recompute_bank_balances", {
    p_bank_account_id: bankTrans.bank_account_id,
  });

  revalidatePath("/cash-book");
  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { success: true };
}
