/**
 * useCrmLock — Lock / unlock a CRM contact for an active call (30 min).
 * Calls the crm_lock_contact / crm_unlock_contact RPCs.
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCrmLock() {
  const [pending, setPending] = useState(false);

  const lock = useCallback(async (contactId: string): Promise<boolean> => {
    setPending(true);
    try {
      const { data, error } = await supabase.rpc("crm_lock_contact", { p_contact_id: contactId });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; locked_by_name?: string };
      if (!res?.ok) {
        if (res?.error === "locked") {
          toast.error(`Déjà en appel par ${res.locked_by_name ?? "un autre agent"}`);
        } else {
          toast.error(`Impossible de verrouiller : ${res?.error ?? "inconnu"}`);
        }
        return false;
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast.error(msg);
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const unlock = useCallback(async (contactId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc("crm_unlock_contact", { p_contact_id: contactId });
      if (error) throw error;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast.error(msg);
      return false;
    }
  }, []);

  return { lock, unlock, pending };
}

export interface CrmLogCallInput {
  contactId: string;
  outcome: "sold" | "voicemail" | "callback" | "not_interested" | "wrong_number" | "no_answer";
  notes?: string;
  callbackAt?: string | null;
  portal?: "field" | "employee" | "core";
  orderId?: string | null;
}

export async function crmLogCall(input: CrmLogCallInput): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("crm_log_call", {
    p_contact_id: input.contactId,
    p_outcome: input.outcome,
    p_notes: input.notes ?? null,
    p_callback_at: input.callbackAt ?? null,
    p_portal: input.portal ?? "field",
    p_order_id: input.orderId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const res = data as { ok: boolean; error?: string };
  return res;
}
