/**
 * useImpersonation — Core admin "View as Client" helper.
 *
 * IMPORTANT: window.open() must be called synchronously in the click handler,
 * never after `await`, otherwise browsers block it as a non-user-gesture popup.
 *
 * Flow (Shopify-style "View as customer"):
 *   1. Click handler calls startImpersonation()
 *   2. We synchronously open about:blank in a new tab (preserves user gesture)
 *   3. We call start_impersonation RPC → { token, expires_at }
 *   4. We persist the token to localStorage AND pass it via the URL
 *   5. We navigate the new tab to /portal?impersonate=<token>
 *   6. The portal's ClientAuthProvider reads the token, validates it,
 *      and synthesises an effective user identity for the impersonated client.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const IMPERSONATION_PENDING_KEY = "nivra_impersonation_pending_v1";

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

    // 1) SYNCHRONOUS popup open while we still have the user gesture.
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error(
        "Le navigateur a bloqué l'ouverture du portail. Autorisez les popups pour ce site puis réessayez.",
      );
      return;
    }

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
      const expiresAt = (session as any)?.expires_at;
      if (!token) throw new Error("Session d'assistance invalide (token manquant)");

      // 2) Persist the token to localStorage so the new tab can pick it up
      //    even if it is opened with about:blank and the URL is later stripped.
      try {
        localStorage.setItem(
          IMPERSONATION_PENDING_KEY,
          JSON.stringify({ token, expiresAt, clientId, clientName, clientEmail, ts: Date.now() }),
        );
      } catch {
        /* localStorage unavailable — token will still flow via URL */
      }

      const url = `${window.location.origin}/portal?impersonate=${encodeURIComponent(token)}`;

      // 3) Navigate the already-open tab.
      try {
        win.location.replace(url);
      } catch {
        win.location.href = url;
      }

      toast.success(`Mode assistance activé pour ${clientName || clientEmail || "client"}`, {
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
