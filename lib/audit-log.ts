import { createClient } from "@/lib/supabase/server";

export type AuditAction = "create" | "update" | "delete" | "restore";

/**
 * Log một hành động vào audit_log.
 * Không throw error nếu fail - log nhưng không break flow chính.
 */
export async function logAudit(params: {
  action: AuditAction;
  table_name: string;
  record_id: string;
  description: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_audit", {
      p_action: params.action,
      p_table_name: params.table_name,
      p_record_id: params.record_id,
      p_description: params.description,
      p_old_values: params.old_values ?? null,
      p_new_values: params.new_values ?? null,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
    // Không throw để không block flow chính
  }
}
