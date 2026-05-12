"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { formatCurrency } from "@/lib/utils";

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

  // Lấy giá trị cũ trước khi update
  const { data: oldData } = await supabase
    .from("cash_transactions")
    .select("trans_date, amount, description")
    .eq("id", id)
    .single();

  const { error: updateError } = await supabase
    .from("cash_transactions")
    .update(input)
    .eq("id", id);

  if (updateError) return { error: updateError.message };

  if (input.trans_date !== undefined || input.amount !== undefined) {
    const { error: recomputeError } = await supabase.rpc("recompute_cash_balances");
    if (recomputeError) {
      console.error("Recompute failed:", recomputeError);
    }
  }

  // Log audit
  if (oldData) {
    const changes: string[] = [];
    if (input.amount !== undefined && input.amount !== Number(oldData.amount)) {
      changes.push(`số tiền ${formatCurrency(Number(oldData.amount))} → ${formatCurrency(input.amount)}`);
    }
    if (input.trans_date !== undefined && input.trans_date !== oldData.trans_date) {
      changes.push(`ngày ${oldData.trans_date} → ${input.trans_date}`);
    }
    if (input.description !== undefined && input.description !== oldData.description) {
      changes.push(`diễn giải`);
    }

    await logAudit({
      action: "update",
      table_name: "cash_transactions",
      record_id: id,
      description: `Sửa giao dịch tiền mặt: ${changes.join(", ")}`,
      old_values: oldData,
      new_values: input as Record<string, unknown>,
    });
  }

  revalidatePath("/cash-book");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteCashTransaction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { data: cashTrans } = await supabase
    .from("cash_transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (!cashTrans) return { error: "Không tìm thấy giao dịch" };

  const { data: linkedBank } = await supabase
    .from("bank_transactions")
    .select("id, bank_account_id")
    .eq("cash_transaction_id", id)
    .single();

  const { error: cashError } = await supabase
    .from("cash_transactions")
    .update({ is_deleted: true })
    .eq("id", id);

  if (cashError) return { error: cashError.message };

  if (linkedBank) {
    await supabase
      .from("bank_transactions")
      .update({ is_deleted: true })
      .eq("id", linkedBank.id);

    await supabase.rpc("recompute_bank_balances", {
      p_bank_account_id: linkedBank.bank_account_id,
    });
  }

  await supabase.rpc("recompute_cash_balances");

  // Log audit
  await logAudit({
    action: "delete",
    table_name: "cash_transactions",
    record_id: id,
    description: `Xóa giao dịch tiền mặt ${formatCurrency(Number(cashTrans.amount))} ngày ${cashTrans.trans_date} (${cashTrans.description})`,
    old_values: cashTrans as Record<string, unknown>,
  });

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

  const { data: oldData } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (!oldData) return { error: "Không tìm thấy giao dịch" };

  const { error: updateError } = await supabase
    .from("bank_transactions")
    .update(input)
    .eq("id", id);

  if (updateError) return { error: updateError.message };

  if (input.trans_date !== undefined || input.amount !== undefined) {
    await supabase.rpc("recompute_bank_balances", {
      p_bank_account_id: oldData.bank_account_id,
    });
  }

  const changes: string[] = [];
  if (input.amount !== undefined && input.amount !== Number(oldData.amount)) {
    changes.push(`số tiền ${formatCurrency(Number(oldData.amount))} → ${formatCurrency(input.amount)}`);
  }
  if (input.trans_date !== undefined && input.trans_date !== oldData.trans_date) {
    changes.push(`ngày ${oldData.trans_date} → ${input.trans_date}`);
  }
  if (input.description !== undefined && input.description !== oldData.description) {
    changes.push(`diễn giải`);
  }

  await logAudit({
    action: "update",
    table_name: "bank_transactions",
    record_id: id,
    description: `Sửa giao dịch ngân hàng: ${changes.join(", ")}`,
    old_values: oldData as Record<string, unknown>,
    new_values: input as Record<string, unknown>,
  });

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
    .select("*")
    .eq("id", id)
    .single();

  if (!bankTrans) return { error: "Không tìm thấy giao dịch" };

  const { error: bankError } = await supabase
    .from("bank_transactions")
    .update({ is_deleted: true })
    .eq("id", id);

  if (bankError) return { error: bankError.message };

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

  await logAudit({
    action: "delete",
    table_name: "bank_transactions",
    record_id: id,
    description: `Xóa giao dịch ngân hàng ${formatCurrency(Number(bankTrans.amount))} ngày ${bankTrans.trans_date} (${bankTrans.description})`,
    old_values: bankTrans as Record<string, unknown>,
  });

  revalidatePath("/cash-book");
  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { success: true };
}
