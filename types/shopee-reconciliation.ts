/**
 * Types cho Phase 4 - Đối soát Shopee
 * (Append vào file types/database.ts hiện có)
 */

export interface ShopeePayment {
  id: string;
  account_id: string;
  payment_code: string;
  reconcile_date: string;
  payment_date: string;
  total_gross: number;
  total_tax: number;
  total_net: number;
  bank_name: string | null;
  bank_account_last4: string | null;
  is_received: boolean;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  is_deleted: boolean;
}

export interface ShopeePaymentDay {
  id: string;
  payment_id: string;
  earned_date: string;
  gross_amount: number;
  created_at: string;
}

export type ReconcileStatus = "matched" | "mismatched" | "missing";

export interface ReconcileDay {
  earned_date: string;
  shopee_gross: number;
  manual_gross: number;
  difference: number;
  status: ReconcileStatus;
  commission_id: string | null;
}

export interface ReconciliationSummary {
  total_payments: number;
  total_received: number;
  total_pending: number;
  total_gross_received: number;
  total_gross_pending: number;
  total_net_received: number;
  total_net_pending: number;
}
