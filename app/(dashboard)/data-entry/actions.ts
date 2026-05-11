"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// 1. COMMISSION (Hoa hồng) - giữ nguyên Phase 2
// ============================================================================
export interface CommissionInput {
  account_id: string;
  earned_date: string;
  received_date?: string;
  gross_amount: number;
  tax_withheld: number;
  net_amount: number;
  status: "pending" | "received";
  description?: string;
  shopee_order_id?: string;
}

export async function createCommission(input: CommissionInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const earnedDate = new Date(input.earned_date);
  const period_month = earnedDate.getMonth() + 1;
  const period_year = earnedDate.getFullYear();

  const { data, error } = await supabase
    .from("commissions")
    .insert({
      account_id: input.account_id,
      period_month,
      period_year,
      earned_date: input.earned_date,
      received_date: input.received_date || null,
      gross_amount: input.gross_amount,
      tax_withheld: input.tax_withheld,
      net_amount: input.net_amount,
      status: input.status,
      description: input.description || null,
      shopee_order_id: input.shopee_order_id || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/affiliates");
  revalidatePath(`/affiliates/${input.account_id}`);
  revalidatePath("/dashboard");
  return { data };
}

// ============================================================================
// 2. DEPOSIT (Affiliate nộp tiền vào TK ngân hàng công ty)
// THAY ĐỔI Phase 3: CHỈ ghi vào bank_transactions, không ghi cash_transactions.
// Lý do: affiliate cầm tiền mặt từ TK cá nhân đi nộp trực tiếp tại quầy NH,
// không qua quỹ tiền mặt của công ty.
// ============================================================================
export interface DepositInput {
  account_id: string;
  trans_date: string;
  amount: number;
  depositor_name?: string;
  bank_account_id: string;
  description?: string;
}

export async function createDeposit(input: DepositInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const description = input.description || `Nộp tiền HH affiliate`;

  const { data, error } = await supabase
    .from("bank_transactions")
    .insert({
      bank_account_id: input.bank_account_id,
      trans_date: input.trans_date,
      trans_type: "income",
      amount: input.amount,
      description,
      counterparty_name: input.depositor_name || null,
      // Lưu account_id vào reference để track affiliate nào nộp tiền
      // (bank_transactions không có cột account_id nhưng có thể dùng counterparty_name)
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  revalidatePath(`/affiliates/${input.account_id}`);
  return { data };
}

// ============================================================================
// 3. EXPENSE (Chi tiêu - giữ nguyên Phase 2)
// ============================================================================
export interface ExpenseInput {
  trans_date: string;
  amount: number;
  expense_category_id: string;
  description: string;
  source: "cash" | "bank";
  bank_account_id?: string;
  counterparty_name?: string;
}

export async function createExpense(input: ExpenseInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  if (input.source === "cash") {
    const { data, error } = await supabase
      .from("cash_transactions")
      .insert({
        trans_date: input.trans_date,
        trans_type: "expense",
        amount: input.amount,
        description: input.description,
        expense_category_id: input.expense_category_id,
        depositor_name: input.counterparty_name || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    revalidatePath("/cash-book");
    revalidatePath("/dashboard");
    return { data };
  }

  // source = bank
  if (!input.bank_account_id) {
    return { error: "Cần chọn tài khoản ngân hàng" };
  }

  const { data, error } = await supabase
    .from("bank_transactions")
    .insert({
      bank_account_id: input.bank_account_id,
      trans_date: input.trans_date,
      trans_type: "expense",
      amount: input.amount,
      description: input.description,
      expense_category_id: input.expense_category_id,
      counterparty_name: input.counterparty_name || null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath("/bank-book");
  revalidatePath("/dashboard");
  return { data };
}
