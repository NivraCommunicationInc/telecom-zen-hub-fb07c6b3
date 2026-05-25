/**
 * Staff Impersonation — Admin opens an employee's portal as that employee.
 *
 * Two modes coexist:
 *   1. Legacy "assistance" mode (localStorage banner only — admin keeps own session).
 *      Kept for backward compatibility; the banner displays when present.
 *   2. Real impersonation (preferred) — admin clicks Accéder au portail,
 *      backend generates a magic-link, the new tab signs in as the target
 *      user. Admin's session in this browser is replaced; closing the tab +
 *      re-login restores admin access. The banner shows because we mark
 *      `staff_assistance_session` with admin_user_id !== current uid.
 */

import { supabase } from "@/integrations/supabase/client";

export type StaffAssistanceRole = "field_sales" | "rh" | "technician" | "employee" | "core";

export interface StaffAssistanceSession {
  staff_user_id: string;
  staff_name: string;
  staff_email: string;
  staff_role: StaffAssistanceRole;
  admin_user_id: string;
  started_at: string;
  /** Token from start_staff_impersonation (real impersonation only). */
  imp_token?: string;
  /** Session id from staff_impersonation_sessions (real impersonation only). */
  imp_session_id?: string;
  /** True when this is an actual auth swap (not legacy view-only). */
  real_impersonation?: boolean;
}

const KEY = "staff_assistance_session";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const STAFF_IMP_SESSION_KEY = "nivra_staff_imp_session_id";

export function startStaffAssistance(s: StaffAssistanceSession) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function getStaffAssistance(): StaffAssistanceSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffAssistanceSession;
    if (!parsed?.staff_user_id || !parsed?.admin_user_id || !parsed?.started_at) {
      clearStaffAssistance();
      return null;
    }
    const startedAt = new Date(parsed.started_at).getTime();
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > MAX_AGE_MS) {
      clearStaffAssistance();
      return null;
    }
    return parsed;
  } catch { return null; }
}

export async function resolveStaffAssistance(): Promise<StaffAssistanceSession | null> {
  const stored = getStaffAssistance();
  if (!stored) return null;
  try {
    const { data } = await supabase.auth.getUser();
    const currentUid = data.user?.id;
    if (!currentUid) return null;
    // Real impersonation: current user is the TARGET — keep banner.
    if (stored.real_impersonation && currentUid === stored.staff_user_id) return stored;
    // Legacy assistance: current user is NOT admin — keep banner.
    if (!stored.real_impersonation && currentUid !== stored.admin_user_id) return stored;
    // Otherwise stale — clear.
    clearStaffAssistance();
    return null;
  } catch { return null; }
}

export function clearStaffAssistance() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

function resolveStaffImpSessionId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("staff_imp");
    if (fromUrl) {
      sessionStorage.setItem(STAFF_IMP_SESSION_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(STAFF_IMP_SESSION_KEY) || getStaffAssistance()?.imp_session_id || null;
  } catch {
    return null;
  }
}

export async function isActiveStaffImpersonationForPortal(
  currentUserId: string,
  portal: "field" | "rh" | "technician" | "employee" | "core",
): Promise<boolean> {
  const sessionId = resolveStaffImpSessionId();
  if (!sessionId || !currentUserId) return false;

  const stored = getStaffAssistance();
  if (stored?.real_impersonation && stored.staff_user_id && stored.staff_user_id !== currentUserId) {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc("validate_active_staff_impersonation", {
      _session_id: sessionId,
      _target_user_id: currentUserId,
      _portal: portal,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

/**
 * Begin a true impersonation session.
 * Calls start_staff_impersonation RPC → staff-impersonate-issue edge function
 * → opens the magic-link in a new tab. Admin session in same browser will
 * be replaced when the new tab loads (Supabase storage is shared).
 */
export async function beginRealStaffImpersonation(args: {
  targetUserId: string;
  targetName: string | null;
  targetEmail: string | null;
  portal: "field" | "rh" | "technician" | "employee" | "core";
  adminUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // Open placeholder tab synchronously to keep user gesture.
  // We immediately mark its sessionStorage as "isolated" so the Supabase
  // client created on that tab uses sessionStorage (not localStorage) for
  // auth — preventing the new employee session from overwriting the Core
  // admin's session in the original tab.
  const placeholderUrl = `${window.location.origin}/?staff_imp_isolated=1`;
  const placeholder = window.open(placeholderUrl, "_blank");
  try {
    if (placeholder) {
      try { placeholder.sessionStorage.setItem("nivra_staff_imp_isolated", "1"); } catch { /* cross-origin guard */ }
    }
    const { data: rpcData, error: rpcErr } = await supabase.rpc("start_staff_impersonation", {
      _target_user_id: args.targetUserId,
      _portal: args.portal,
      _ip: null,
      _ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
    if (rpcErr) throw rpcErr;
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const token = (row as any)?.token;
    if (!token) throw new Error("Token impersonation manquant");

    const { data: issued, error: issErr } = await supabase.functions.invoke("staff-impersonate-issue", {
      body: { token, origin: window.location.origin },
    });
    if (issErr || !issued?.action_link) throw new Error(issErr?.message || "Émission du lien échouée");

    // Persist banner session BEFORE redirecting (target tab will read it).
    startStaffAssistance({
      staff_user_id: args.targetUserId,
      staff_name: args.targetName || args.targetEmail || "Employé",
      staff_email: args.targetEmail || "",
      staff_role: ({
        field: "field_sales", rh: "rh", technician: "technician", employee: "employee", core: "core",
      } as const)[args.portal],
      admin_user_id: args.adminUserId,
      started_at: new Date().toISOString(),
      imp_token: token,
      imp_session_id: (row as any)?.session_id,
      real_impersonation: true,
    });

    if (placeholder && !placeholder.closed) {
      placeholder.location.replace(issued.action_link);
    } else {
      window.open(issued.action_link, "_blank");
    }
    return { ok: true };
  } catch (e: any) {
    if (placeholder && !placeholder.closed) { try { placeholder.close(); } catch { /* noop */ } }
    return { ok: false, error: e?.message || "Échec impersonation" };
  }
}

export async function endRealStaffImpersonation(token?: string): Promise<void> {
  const t = token || getStaffAssistance()?.imp_token;
  if (t) {
    try { await supabase.rpc("end_staff_impersonation", { _token: t }); } catch { /* noop */ }
  }
  clearStaffAssistance();
  try { sessionStorage.removeItem(STAFF_IMP_SESSION_KEY); } catch { /* noop */ }
}
