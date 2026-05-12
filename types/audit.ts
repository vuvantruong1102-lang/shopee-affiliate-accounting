/**
 * Types cho Phase 6 - Audit log + Dashboard alerts
 */

export type AuditAction = "create" | "update" | "delete" | "restore";

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  description: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export type AlertSeverity = "low" | "medium" | "high";
export type AlertType = "undeposited" | "pending_commission" | "unreconciled";

export interface DashboardAlert {
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  affiliate_id: string | null;
  affiliate_name: string | null;
  amount: number;
  count_value: number | null;
  link_url: string;
}

export interface MonthlyRevenue {
  year_month: string;
  total_gross: number;
  total_net: number;
  total_tax: number;
  commission_count: number;
}

export interface TopAffiliate {
  affiliate_id: string;
  affiliate_name: string;
  total_gross: number;
  total_net: number;
  commission_count: number;
}
