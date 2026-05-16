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
const IMPERSONATION_SESSION_KEY = "nivra_impersonation_v1";

const STAFF_ROLES = [
  "admin",
  "employee",
  "field_sales",
  "technician",
  "supervisor",
  "billing_admin",
  "sales",
  "support",
  "techops",
  "kyc_agent",
];
const STAFF_ROLE_RPC_CHECKS = STAFF_ROLES;

function getStaffAuthStorageKey() {
  return `sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-staff-auth-token`;
}

async function ensureStaffTokenFallback() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      localStorage.setItem(getStaffAuthStorageKey(), JSON.stringify(session));
    }
  } catch {
    /* ignore — normal token handoff still applies */
  }
}

function persistImpersonationHandoff(args: {
  token: string;
  expiresAt: string;
  clientId: string;
  clientName?: string | null;
  clientEmail?: string | null;
  localSession?: boolean;
  targetWindow?: Window | null;
}) {
  const state = {
    token: args.token,
    clientId: args.clientId,
    clientName: args.clientName ?? null,
    clientEmail: args.clientEmail ?? null,
    expiresAt: args.expiresAt,
  };

  try {
    localStorage.setItem(IMPERSONATION_TOKEN_KEY, args.token);
    localStorage.setItem(
      IMPERSONATION_PENDING_KEY,
      JSON.stringify({ ...state, ts: Date.now(), localSession: args.localSession === true }),
    );
    if (args.localSession) {
      sessionStorage.setItem(IMPERSONATION_SESSION_KEY, JSON.stringify(state));
      if (args.targetWindow && !args.targetWindow.closed) {
        args.targetWindow.sessionStorage.setItem(IMPERSONATION_SESSION_KEY, JSON.stringify(state));
      }
    }
  } catch {
    /* localStorage/sessionStorage unavailable — URL token still flows when server-backed */
  }
}

async function targetHasStaffRole(clientId: string): Promise<boolean> {
  try {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", clientId);
    if ((roles || []).some((r: any) => STAFF_ROLES.includes(r.role))) return true;
  } catch {
    /* fall back to RPC role checks */
  }

  for (const role of STAFF_ROLE_RPC_CHECKS) {
    try {
      const { data } = await supabase.rpc("has_staff_role", {
        _user_id: clientId,
        _role: role as any,
      });
      if (data === true) return true;
    } catch {
      /* keep checking */
    }
  }

  return false;
}

async function currentUserCanViewClient(): Promise<{ canView: boolean; isAdmin: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return { canView: false, isAdmin: false };

  const [adminResult, employeeResult, fieldSalesResult] = await Promise.all([
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as any }),
    supabase.rpc("has_role", { _user_id: user.id, _role: "employee" as any }),
    supabase.rpc("has_role", { _user_id: user.id, _role: "field_sales" as any }),
  ]);

  const isAdmin = adminResult.data === true;
  const isEmployee = employeeResult.data === true;
  const isFieldSales = fieldSalesResult.data === true;
  return { canView: isAdmin || isEmployee || isFieldSales, isAdmin };
}

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

    if (await targetHasStaffRole(clientId)) {
      if (win && !win.closed) { try { win.close(); } catch { /* noop */ } }
      toast.error("Impossible de se connecter en tant qu'employé", { id: toastId });
      return;
    }

    const access = await currentUserCanViewClient();
    if (!access.canView) {
      if (win && !win.closed) { try { win.close(); } catch { /* noop */ } }
      toast.error("Accès refusé", { id: toastId });
      return;
    }

    await ensureStaffTokenFallback();

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
      persistImpersonationHandoff({ token, expiresAt, clientId, clientName, clientEmail });

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
