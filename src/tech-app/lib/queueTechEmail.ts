/**
 * queueTechEmail — Helper to queue technician-flow emails to the client.
 * Uses the SECURITY DEFINER RPC `queue_tech_status_email` so it works
 * under the technician's restrictive RLS (technicians cannot insert
 * directly into email_queue). Non-blocking by design.
 */
import { supabase } from "@/integrations/supabase/client";

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
  templateKey,
  extraVars = {},
}: QueueTechEmailInput): Promise<void> {
  try {
    const { error } = await (supabase.rpc as any)("queue_tech_status_email", {
      p_assignment_id: assignmentId,
      p_template_key: templateKey,
      p_extra: extraVars ?? {},
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[queueTechEmail] rpc failed", error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[queueTechEmail] exception", err);
  }
}
