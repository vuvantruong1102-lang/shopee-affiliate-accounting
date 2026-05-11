"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface PaymentDayInput {
  earned_date: string;
  gross_amount: number;
}

export interface ShopeePaymentInput {
  account_id: string;
  payment_code: string;
  reconcile_date: string;
  payment_date: string;
  total_gross: number;
  total_tax: number;
  total_net: number;
  bank_name?: string;
  bank_account_last4?: string;
  is_received: boolean;
  notes?: string;
  days: PaymentDayInput[];
}

export async function createShopeePayment(input: ShopeePaymentInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  // Validate: tổng ngày = tổng gross
  const sumOfDays = input.days.reduce((s, d) => s + d.gross_amount, 0);
  if (Math.abs(sumOfDays - input.total_gross) > 1) {
    return {
      error: `Tổng các ngày (${sumOfDays.toLocaleString("vi-VN")}đ) không khớp với tổng gross (${input.total_gross.toLocaleString("vi-VN")}đ)`,
    };
  }

  // Validate: gross - tax = net (cho phép sai số 1đ do làm tròn)
  if (Math.abs(input.total_gross - input.total_tax - input.total_net) > 1) {
    return {
      error: `Gross - Tax phải bằng Net (chênh ${Math.abs(input.total_gross - input.total_tax - input.total_net).toLocaleString("vi-VN")}đ)`,
    };
  }

  // 1. Insert đợt thanh toán
  const { data: payment, error: paymentError } = await supabase
    .from("shopee_payments")
    .insert({
      account_id: input.account_id,
      payment_code: input.payment_code,
      reconcile_date: input.reconcile_date,
      payment_date: input.payment_date,
      total_gross: input.total_gross,
      total_tax: input.total_tax,
      total_net: input.total_net,
      bank_name: input.bank_name || null,
      bank_account_last4: input.bank_account_last4 || null,
      is_received: input.is_received,
      notes: input.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (paymentError) {
    if (paymentError.code === "23505") {
      return { error: "Mã thanh toán này đã tồn tại cho affiliate này" };
    }
    return { error: paymentError.message };
  }

  // 2. Insert chi tiết các ngày
  const daysData = input.days.map((d) => ({
    payment_id: payment.id,
    earned_date: d.earned_date,
    gross_amount: d.gross_amount,
  }));

  const { error: daysError } = await supabase
    .from("shopee_payment_days")
    .insert(daysData);

  if (daysError) {
    // Rollback: xóa payment vừa tạo
    await supabase.from("shopee_payments").delete().eq("id", payment.id);
    return { error: daysError.message };
  }

  revalidatePath("/reconciliation");
  revalidatePath("/dashboard");
  return { data: payment };
}

export async function toggleReceivedStatus(paymentId: string, isReceived: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase
    .from("shopee_payments")
    .update({ is_received: isReceived })
    .eq("id", paymentId);

  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${paymentId}`);
  return { success: true };
}

export async function deleteShopeePayment(paymentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  const { error } = await supabase
    .from("shopee_payments")
    .update({ is_deleted: true })
    .eq("id", paymentId);

  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  redirect("/reconciliation");
}
