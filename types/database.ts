/**
 * Types cho các bảng trong database.
 * Khớp với schema trong supabase/migrations/
 */

export type AffiliateStatus = "active" | "paused" | "closed";
export type CommissionStatus = "pending" | "received" | "cancelled" | "adjusted";
export type TransactionType = "income" | "expense";
export type UserRole = "admin" | "accountant" | "viewer";
export type WithdrawalMethod = "atm" | "counter" | "transfer" | "other";

// Re-export PeriodType từ date-period
export type PeriodType =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface AffiliateAccount {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cccd: string | null;
  tax_code: string | null;
  date_of_birth: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  shopee_account_email: string | null;
  shopee_affiliate_id: string | null;
  has_personal_deduction: boolean;
  dependent_count: number;
  has_company_salary: boolean;
  monthly_salary_gross: number;
  monthly_salary_tax_withheld: number;
  cccd_front_url: string | null;
  cccd_back_url: string | null;
  status: AffiliateStatus;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  is_deleted: boolean;
}

export interface Commission {
  id: string;
  account_id: string;
  period_month: number;
  period_year: number;
  earned_date: string;
  received_date: string | null;
  gross_amount: number;
  tax_withheld: number;
  net_amount: number;
  status: CommissionStatus;
  description: string | null;
  shopee_order_id: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  is_deleted: boolean;
}

export interface Withdrawal {
  id: string;
  account_id: string;
  withdraw_date: string;
  amount: number;
  method: WithdrawalMethod;
  description: string | null;
  evidence_url: string | null;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  trans_date: string;
  trans_type: TransactionType;
  amount: number;
  description: string;
  account_id: string | null;
  depositor_name: string | null;
  expense_category_id: string | null;
  balance_after: number | null;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
  is_deleted: boolean;
}

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  currency: string;
  opening_balance: number;
  opening_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  trans_date: string;
  trans_type: TransactionType;
  amount: number;
  description: string;
  cash_transaction_id: string | null;
  expense_category_id: string | null;
  counterparty_name: string | null;
  counterparty_bank: string | null;
  reference_no: string | null;
  balance_after: number | null;
  created_at: string;
  is_deleted: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  type: "operating" | "marketing" | "salary" | "tax" | "other";
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface AffiliateSummary {
  total_gross: number;
  total_tax_withheld: number;
  total_net: number;
  received_net: number;
  pending_net: number;
  total_withdrawn: number;
  total_deposited: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}
