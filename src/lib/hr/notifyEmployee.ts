/**
 * notifyEmployee — Enqueue an HR-related transactional email to a specific
 * employee using the canonical Nivra "Violet Bold" shell template.
 *
 * Inserts into `email_queue` (status='queued'); the `email-queue-drain`
 * worker picks it up and renders via `renderQueueTemplate` in
 * `customQueueTemplates.ts` (no inline HTML).
 *
 * Safe to call from authenticated admin/employee sessions (RLS allows
 * those roles to insert into email_queue). Errors are swallowed and
 * logged so they never break the primary HR mutation.
 */
import { supabase } from "@/integrations/supabase/client";

export type HrTemplateKey =
  | "hr_payroll_issued"
  | "hr_payslip_issued"
  | "hr_payroll_paid"
  | "hr_schedule_created"
  | "hr_schedule_updated"
  | "hr_schedule_deleted"
  | "hr_shift_created"
  | "hr_shift_updated"
  | "hr_shift_deleted"
  | "hr_commission_generated"
  | "hr_commission_validated"
  | "hr_commission_paid";

export interface NotifyEmployeeOptions {
  /** Auth user_id of the employee (used to look up email + full_name). */
  employeeId: string;
  templateKey: HrTemplateKey;
  /** Template variables (period_label, amount, shift_date, etc.). */
  vars?: Record<string, unknown>;
  /** Stable idempotency key — prevents duplicate sends. */
  eventKey: string;
  /** Optional entity reference for audit. */
  entityType?: string;
  entityId?: string;
}

export async function notifyEmployee(opts: NotifyEmployeeOptions): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, first_name, last_name")
      .eq("user_id", opts.employeeId)
      .maybeSingle();

    const email = (profile as any)?.email as string | undefined;
    if (!email) {
      console.warn(`[notifyEmployee] No email for user ${opts.employeeId}`);
      return;
    }

    const clientName =
      (profile as any)?.full_name ||
      [(profile as any)?.first_name, (profile as any)?.last_name].filter(Boolean).join(" ") ||
      "Collègue";

    const templateVars: Record<string, unknown> = {
      ...opts.vars,
      client_name: clientName,
      portal_url: opts.vars?.portal_url ?? "https://nivra-telecom.ca/hr",
    };

    const { error } = await supabase.from("email_queue").insert({
      event_key: opts.eventKey,
      to_email: email,
      template_key: opts.templateKey,
      template_vars: templateVars,
      message_type: opts.templateKey,
      entity_type: opts.entityType ?? "employee",
      entity_id: opts.entityId ?? opts.employeeId,
      status: "queued",
    });

    if (error) {
      // Idempotency conflict on event_key is expected for retries — silent.
      const msg = (error.message || "").toLowerCase();
      if (!msg.includes("duplicate") && !msg.includes("unique")) {
        console.warn("[notifyEmployee] enqueue failed:", error.message);
      }
    }
  } catch (e: any) {
    console.warn("[notifyEmployee] exception:", e?.message || e);
  }
}
