/**
 * NOVA Action Executor — executes approved actions issued by the NOVA brain.
 * All actions are persisted via nova_actions table updates after execution.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
export type NovaActionType =
  | "send_email"
  | "launch_campaign"
  | "control_agent"
  | "modify_crm"
  | "generate_report"
  | "send_alert"
  | "create_ticket"
  | "modify_account"
  | "assign_lead"
  | "schedule_task";

export interface NovaAction {
  type: NovaActionType;
  description?: string;
  payload: Record<string, any>;
  requires_approval?: boolean;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function executeNovaAction(
  action: NovaAction,
  supabase: SupabaseClient,
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case "control_agent": {
        const { agent_name, new_status } = action.payload;
        const { error } = await supabase
          .from("agent_registry")
          .update({ status: new_status })
          .eq("agent_name", agent_name);
        if (error) throw error;
        return { success: true, message: `Agent ${agent_name} mis à ${new_status}` };
      }

      case "send_email": {
        const { to_email, template_key, vars } = action.payload;
        let error: any = null;
        try { await enqueueCommunication({
          channel: "email",
          templateKey: template_key,
          recipient: to_email,
          idempotencyKey: `nova-send-email:${to_email}:${template_key}`,
          templateVars: vars ?? {},
        }); } catch (__e) { error = __e; }
        if (error) throw error;
        return { success: true, message: "Email mis en file d'attente" };
      }

      case "launch_campaign": {
        const { error } = await supabase.functions.invoke("agent-marketing", {
          body: {
            action: "send_campaign",
            segment: action.payload.segment,
            campaign_id: action.payload.campaign_id,
          },
        });
        if (error) throw error;
        return { success: true, message: "Campagne lancée" };
      }

      case "generate_report": {
        const { error } = await supabase.functions.invoke("agent-analytics", {
          body: { action: "daily", force: true },
        });
        if (error) throw error;
        return { success: true, message: "Rapport généré et envoyé" };
      }

      case "modify_crm": {
        const { contact_id, updates } = action.payload;
        const { error } = await supabase
          .from("crm_contacts")
          .update(updates)
          .eq("id", contact_id);
        if (error) throw error;
        return { success: true, message: "CRM mis à jour" };
      }

      case "send_alert": {
        const { title, message, severity } = action.payload;
        const { error } = await (supabase as any).from("nova_decisions").insert({
          situation: title ?? "Alerte NOVA",
          context: { severity: severity ?? "warning", source: "nova" },
          decision_made: message ?? "",
          reasoning: "Alerte émise par NOVA",
          made_by: "nova",
        });
        if (error) throw error;
        return { success: true, message: "Alerte enregistrée" };
      }

      case "create_ticket": {
        const { subject, body, priority } = action.payload;
        const { error } = await (supabase as any).from("internal_tickets").insert({
          subject: subject ?? "Ticket NOVA",
          description: body ?? "",
          priority: priority ?? "normal",
          status: "open",
          category: "nova",
          created_by_name: "NOVA Digital Brain",
          created_by_role: "system",
        });
        if (error) throw error;
        return { success: true, message: "Ticket créé" };
      }

      default:
        return { success: false, message: `Action non reconnue: ${action.type}` };
    }
  } catch (err: any) {
    return { success: false, message: err?.message ?? "Erreur inconnue" };
  }
}
