/**
 * queueTechEmail — Helper to queue technician-flow emails to the client.
 * Always BCCs support@nivra-telecom.ca for traceability.
 */
import { supabase } from "@/integrations/supabase/client";

const SUPPORT_BCC = "support@nivra-telecom.ca";

export type TechEmailKey =
  | "tech_en_route"
  | "tech_arrived"
  | "tech_in_progress"
  | "tech_completed"
  | "tech_missed"
  | "tech_rescheduled";

export interface QueueTechEmailInput {
  assignmentId: string;
  orderId?: string | null;
  templateKey: TechEmailKey;
  extraVars?: Record<string, any>;
}

export async function queueTechEmail({
  assignmentId,
  orderId,
  templateKey,
  extraVars = {},
}: QueueTechEmailInput): Promise<void> {
  try {
    if (!orderId) return;

    const { data: order } = await supabase
      .from("orders")
      .select("client_email, client_first_name, order_number, account_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order?.client_email) return;

    // Resolve technician name (best-effort)
    let techName = "Votre technicien Nivra";
    const { data: assignment } = await supabase
      .from("technician_assignments")
      .select("technician_id, scheduled_date, scheduled_time_start")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignment?.technician_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", assignment.technician_id)
        .maybeSingle();
      const full = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ");
      if (full) techName = full;
    }

    const baseVars: Record<string, any> = {
      first_name: order.client_first_name || "Client",
      tech_name: techName,
      order_number: order.order_number,
      scheduled_date: assignment?.scheduled_date ?? null,
      ...extraVars,
    };

    await supabase.from("email_queue").insert({
      to_email: order.client_email,
      bcc: SUPPORT_BCC,
      template_key: templateKey,
      template_vars: baseVars,
      status: "queued",
      language: "fr",
    });
  } catch (err) {
    // Non-blocking: never throw from email queueing
    // eslint-disable-next-line no-console
    console.warn("[queueTechEmail] failed", err);
  }
}
