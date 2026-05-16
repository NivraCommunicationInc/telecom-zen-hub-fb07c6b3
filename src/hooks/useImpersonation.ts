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
export const IMPERSONATION_TOKEN_KEY = "nivra_impersonation_token";

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

    // 1) SYNCHRONOUSLY open the real portal route while we still have the
    //    user gesture. The tab itself then receives the token via URL and
    //    localStorage handoff once the RPC returns.
    const pendingUrl = `${window.location.origin}/portal?impersonation_pending=1`;
    const win = window.open(pendingUrl, "_blank");

    const toastId = toast.loading(
      `Ouverture du portail de ${clientName || clientEmail || "client"}…`,
    );

    // Pre-flight: block staff/admin targets with a clear message before opening RPC.
    // This mirrors the server-side guard in start_impersonation() but provides
    // a friendlier UX (no popup churn, explicit "employee" wording).
    const STAFF_ROLES = ["field_sales", "employee", "admin", "hr", "technician"];
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", clientId);
      const targetStaffRole = (roles || []).find((r: any) => STAFF_ROLES.includes(r.role));
      if (targetStaffRole) {
        if (win && !win.closed) { try { win.close(); } catch { /* noop */ } }
        toast.error("Impossible de se connecter en tant qu'employé", { id: toastId });
        return;
      }
    } catch {
      /* fall through to RPC — server will still enforce */
    }

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

      // 2) Persist the token BEFORE redirecting so the newly-opened tab can
      //    resolve the session even if URL navigation is delayed or stripped.
      try {
        localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
        localStorage.setItem(
          IMPERSONATION_PENDING_KEY,
          JSON.stringify({ token, expiresAt, clientId, clientName, clientEmail, ts: Date.now() }),
        );
      } catch {
        /* localStorage unavailable — token will still flow via URL */
      }

      const url = `${window.location.origin}/portal?impersonate=${encodeURIComponent(token)}`;

      // 3) Navigate the already-opened portal tab. If the popup was blocked,
      //    fall back to current-tab navigation after the token exists.
      if (win && !win.closed) {
        try {
          win.location.replace(url);
        } catch {
          win.location.href = url;
        }
      } else {
        window.location.assign(url);
      }

      toast.success(`Mode assistance activé pour ${clientName || clientEmail || "client"}`, {
        id: toastId,
        description: "Session valide 30 minutes — toutes les actions sont enregistrées.",
      });
    } catch (err: any) {
      console.error("[Impersonation] start failed", err);
      if (win && !win.closed) {
        try {
          win.close();
        } catch {
          /* ignore */
        }
      }
      const rawMsg = err?.message || "";
      const friendly = /personnel|staff|employé/i.test(rawMsg)
        ? "Impossible de se connecter en tant qu'employé"
        : rawMsg || "Impossible de démarrer la session d'assistance";
      toast.error(friendly, { id: toastId });
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
