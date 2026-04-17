/**
 * useImpersonation — Core admin "View as Client" helper.
 *
 * Calls SECURITY DEFINER RPCs:
 *   - start_impersonation(client_id, reason)  → returns { token, expires_at }
 *   - end_impersonation(token)                → ends the session
 *
 * The returned token is appended to /portal?impersonate=… and opened in a new tab.
 * The client portal validates and consumes the token via validate_impersonation_token.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StartArgs {
  clientId: string;
  clientEmail?: string | null;
  clientName?: string | null;
  reason?: string;
}

export function useImpersonation() {
  const startImpersonation = async ({ clientId, clientEmail, clientName, reason }: StartArgs) => {
    if (!clientId) {
      toast.error("Client invalide");
      return;
    }

    const toastId = toast.loading(`Ouverture du portail de ${clientName || clientEmail || "client"}…`);

    try {
      const { data, error } = await supabase.rpc("start_impersonation", {
        _client_id: clientId,
        _reason: reason ?? "Assistance — Voir comme le client",
        _ip: null,
        _ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      });

      if (error) throw error;

      const session = Array.isArray(data) ? data[0] : data;
      const token = session?.token;
      if (!token) throw new Error("Session d'assistance invalide");

      const url = `${window.location.origin}/portal?impersonate=${encodeURIComponent(token)}`;
      window.open(url, "_blank", "noopener,noreferrer");

      toast.success(`Mode assistance activé pour ${clientName || clientEmail}`, {
        id: toastId,
        description: "Session valide 30 minutes — toutes les actions sont enregistrées.",
      });
    } catch (err: any) {
      console.error("[Impersonation] start failed", err);
      toast.error(err?.message || "Impossible de démarrer la session d'assistance", { id: toastId });
    }
  };

  const endImpersonation = async (token: string) => {
    try {
      await supabase.rpc("end_impersonation", { _token: token });
    } catch (err) {
      console.error("[Impersonation] end failed", err);
    }
  };

  return { startImpersonation, endImpersonation };
}
