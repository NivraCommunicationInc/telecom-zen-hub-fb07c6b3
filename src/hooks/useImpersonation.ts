/**
 * useImpersonation — Core admin "View as Client" helper.
 *
 * IMPORTANT: window.open() must be called synchronously in the click handler,
 * never after `await`, otherwise browsers block it as a non-user-gesture popup.
 * This hook therefore exposes a `requestImpersonationToken` that the caller uses
 * AFTER opening a blank window synchronously, then navigates that window to the
 * resulting URL.
 *
 * RPCs (SECURITY DEFINER):
 *   - start_impersonation(client_id, reason) → { token, expires_at }
 *   - end_impersonation(token)               → ends the session
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
  /**
   * Open the client portal in a new tab in "support / view-as" mode.
   *
   * Synchronously opens a blank window in response to the click, then fetches
   * a one-time token and navigates the window to /portal?impersonate=<token>.
   * If the popup was blocked or the RPC fails, the window is closed and an
   * error toast is shown.
   */
  const startImpersonation = async ({ clientId, clientEmail, clientName, reason }: StartArgs) => {
    if (!clientId) {
      toast.error("Client invalide");
      return;
    }

    // 1) Synchronously open a blank tab while we still have the user gesture.
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error("Le navigateur a bloqué l'ouverture du portail. Autorisez les popups pour ce site.");
      return;
    }

    // Friendly placeholder while we fetch the token
    try {
      win.document.write(
        `<!doctype html><html><head><title>Mode assistance — Nivra</title>
         <meta name="color-scheme" content="dark light" />
         <style>html,body{margin:0;height:100%;background:#0d0d1a;color:#ede9fe;font:14px system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center}</style>
         </head><body>Préparation du mode assistance…</body></html>`,
      );
    } catch {
      /* cross-origin: ignore */
    }

    const toastId = toast.loading(
      `Ouverture du portail de ${clientName || clientEmail || "client"}…`,
    );

    try {
      const { data, error } = await supabase.rpc("start_impersonation", {
        _client_id: clientId,
        _reason: reason ?? "Assistance — Voir comme le client",
        _ip: null,
        _ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
      });

      if (error) throw error;

      const session = Array.isArray(data) ? data[0] : data;
      const token = (session as any)?.token;
      if (!token) throw new Error("Session d'assistance invalide");

      const url = `${window.location.origin}/portal?impersonate=${encodeURIComponent(token)}`;

      // 2) Navigate the already-open tab to the portal URL.
      try {
        win.location.replace(url);
      } catch {
        // Fallback: try assigning .href
        win.location.href = url;
      }

      toast.success(`Mode assistance activé pour ${clientName || clientEmail}`, {
        id: toastId,
        description: "Session valide 30 minutes — toutes les actions sont enregistrées.",
      });
    } catch (err: any) {
      console.error("[Impersonation] start failed", err);
      try {
        win.close();
      } catch {
        /* ignore */
      }
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
