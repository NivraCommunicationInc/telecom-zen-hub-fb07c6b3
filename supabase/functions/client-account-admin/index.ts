// Client account admin actions — used by Core & OneView CS portals.
// All client-facing emails go through email_queue + corporate template.
// Never sends raw default Supabase emails.
//
// Actions: send_invite, send_password_reset, force_confirm_email,
// change_email, force_logout, set_temporary_password, resend_welcome,
// disable_portal_access, enable_portal_access.
//
// Security hardening (Module 24 static fixes):
//  M24-1: cross-role target validation (target MUST be a client, never staff)
//  M24-2: set_temporary_password = admin-only + reason required
//  M24-3: force_logout = reason required
//  M24-4: disable_portal_access / enable_portal_access (admin-only, reason)
//  M24-5: denied actions produce admin_audit_log with reason/code
//  M24-6: uniform responses to prevent user enumeration
//  M24-7: anti-flood 60s window on (admin, client, action)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "send_invite"
  | "send_password_reset"
  | "force_confirm_email"
  | "change_email"
  | "force_logout"
  | "set_temporary_password"
  | "resend_welcome"
  | "disable_portal_access"
  | "enable_portal_access";

interface Body {
  action: Action;
  client_user_id?: string;
  client_email?: string;
  new_email?: string;
  new_password?: string;
  redirect_origin?: string;
  reason?: string;
}

const json = (status: number, payload: unknown, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

const genPassword = () => {
  const base = crypto.randomUUID().replace(/-/g, "");
  return `Nv-${base.slice(0, 10)}!9`;
};

const ALLOWED_ORIGINS = ["https://nivra-telecom.ca", "https://www.nivra-telecom.ca"];
const resolveOrigin = (origin?: string) => {
  if (!origin) return ALLOWED_ORIGINS[0];
  const trimmed = origin.replace(/\/+$/, "");
  if (ALLOWED_ORIGINS.includes(trimmed)) return trimmed;
  if (trimmed.endsWith(".lovableproject.com") || trimmed.endsWith(".lovable.app")) return trimmed;
  return ALLOWED_ORIGINS[0];
};

// Staff roles that must NEVER be manipulated via this client-facing module.
const STAFF_ROLES = new Set([
  "admin",
  "core_admin",
  "super_admin",
  "supervisor",
  "manager",
  "employee",
  "agent",
  "technician",
  "hr",
  "field_agent",
  "staff",
]);

// Actions that require the admin gate (not just any staff role).
const ADMIN_ONLY_ACTIONS = new Set<Action>([
  "change_email",
  "set_temporary_password",
  "disable_portal_access",
  "enable_portal_access",
]);

// Actions that require a mandatory motif (>= 5 chars).
const REASON_REQUIRED_ACTIONS = new Set<Action>([
  "change_email",
  "set_temporary_password",
  "force_logout",
  "disable_portal_access",
  "enable_portal_access",
]);

// Uniform message when we refuse to expose whether an account exists.
const GENERIC_TARGET_MSG = "Si un compte client existe pour cette adresse, la demande a été traitée.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisé" });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip") || "unknown";

  // ---------- Denied-action audit helper (M24-5) ----------
  const auditDenied = async (action: string, code: string, reason: string, extra: Record<string, unknown> = {}) => {
    try {
      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: `client_account.${action}_denied`,
        details: { code, reason, ...extra },
        ip_address: ip,
        target_type: "client_user",
        target_id: extra.target_id ?? null,
        target_email: extra.target_email ?? null,
      });
    } catch (_e) { /* best-effort */ }
  };

  // Authorize: staff roles only
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const { isStaff } = await checkStaffAuth(admin, user.id);
  if (!isStaff) {
    await auditDenied("_gate", "NOT_STAFF", "Utilisateur non staff");
    return json(403, { error: "Réservé au personnel autorisé" });
  }
  const adminRoles = new Set(["admin", "core_admin", "super_admin"]);
  const isAdmin = (roles || []).some((r: any) => adminRoles.has(r.role));

  let body: Body;
  try { body = await req.json(); } catch (_e) {
    await auditDenied("_parse", "BAD_BODY", "Body invalide");
    return json(400, { error: "Body invalide" });
  }
  if (!body?.action) {
    await auditDenied("_parse", "MISSING_ACTION", "Action absente");
    return json(400, { error: "Action requise" });
  }

  const action = body.action;
  const reason = (body.reason ?? "").trim();

  // ---------- Admin gate (M24-2/M24-4) ----------
  if (ADMIN_ONLY_ACTIONS.has(action) && !isAdmin) {
    await auditDenied(action, "ADMIN_ONLY", "Action réservée aux admins");
    return json(403, { error: "Seul un admin peut exécuter cette action" });
  }

  // ---------- Reason gate (M24-2/M24-3/M24-4) ----------
  if (REASON_REQUIRED_ACTIONS.has(action) && reason.length < 5) {
    await auditDenied(action, "REASON_REQUIRED", "Motif obligatoire (min. 5 caractères)");
    return json(400, { error: "Motif obligatoire (min. 5 caractères)" });
  }

  // Resolve target user
  let targetId = body.client_user_id || null;
  let targetEmail = (body.client_email || "").trim().toLowerCase() || null;

  if (!targetId && targetEmail) {
    // Prefer profiles lookup (avoids listUsers pagination limits).
    try {
      const { data: prof } = await admin
        .from("profiles").select("user_id")
        .ilike("email", targetEmail).maybeSingle();
      if ((prof as any)?.user_id) targetId = (prof as any).user_id;
    } catch (_e) { /* ignore */ }
    // Fallback: scan auth.users pages.
    if (!targetId) {
      try {
        for (let page = 1; page <= 20 && !targetId; page++) {
          const { data: users } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const found = users?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
          if (found) { targetId = found.id; break; }
          if (!users?.users || users.users.length < 200) break;
        }
      } catch (_e) { /* ignore */ }
    }
  }
  if (targetId && !targetEmail) {
    try {
      const { data: tu } = await admin.auth.admin.getUserById(targetId);
      targetEmail = tu?.user?.email?.toLowerCase() ?? null;
    } catch (_e) { /* ignore */ }
  }

  // ---------- M24-6 : uniform response when target does not exist ----------
  // For non-existence, we log-deny but return the generic success shape for
  // enumeration-sensitive actions. Destructive actions still return 404.
  const ENUM_SAFE_ACTIONS = new Set<Action>([
    "send_invite",
    "send_password_reset",
    "resend_welcome",
    "force_confirm_email",
  ]);

  if (!targetEmail && action !== "force_logout") {
    await auditDenied(action, "TARGET_MISSING", "Email/id client absent", { target_email: body.client_email ?? null });
    if (ENUM_SAFE_ACTIONS.has(action)) {
      return json(200, { success: true, message: GENERIC_TARGET_MSG });
    }
    return json(400, { error: "Email client requis" });
  }

  // ---------- M24-1 : cross-role target guard ----------
  // The target MUST be a real client. We refuse if the target carries any
  // staff role in user_roles. We also require an accounts.client_id link
  // (canonical proof this is a managed client), unless we are creating the
  // account for the first time via send_invite (see exception below).
  if (targetId) {
    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role, status")
      .eq("user_id", targetId);

    const isStaffTarget = (targetRoles || []).some((r: any) => {
      const role = String(r.role || "").toLowerCase();
      const status = String(r.status || "active").toLowerCase();
      return status === "active" && STAFF_ROLES.has(role);
    });
    if (isStaffTarget) {
      await auditDenied(action, "CROSS_ROLE_TARGET", "Cible possède un rôle staff", {
        target_id: targetId, target_email: targetEmail,
      });
      return json(403, { error: "CROSS_ROLE_TARGET", code: "CROSS_ROLE_TARGET" });
    }

    const { data: acc } = await admin
      .from("accounts")
      .select("id")
      .eq("client_id", targetId)
      .maybeSingle();

    if (!acc?.id && action !== "send_invite") {
      // Not a managed client — refuse.
      await auditDenied(action, "NOT_A_CLIENT", "Cible non liée à un compte client", {
        target_id: targetId, target_email: targetEmail,
      });
      if (ENUM_SAFE_ACTIONS.has(action)) {
        return json(200, { success: true, message: GENERIC_TARGET_MSG });
      }
      return json(403, { error: "NOT_A_CLIENT", code: "NOT_A_CLIENT" });
    }
  }

  // ---------- M24-7 : anti-flood (60s window per admin/client/action) ----------
  try {
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await admin
      .from("admin_audit_log")
      .select("id, created_at")
      .eq("admin_user_id", user.id)
      .eq("target_id", targetId)
      .in("action", [`client_account.${action}`, `client_account.${actionEventKey(action)}`])
      .gte("created_at", windowStart)
      .limit(1);
    if (recent && recent.length > 0) {
      await auditDenied(action, "RATE_LIMITED", "Action répétée dans la fenêtre de 60s", {
        target_id: targetId, target_email: targetEmail,
      });
      return json(429, { error: "Trop de tentatives. Réessayez dans 60 secondes.", code: "RATE_LIMITED" });
    }
  } catch (_e) { /* best-effort */ }

  // First name lookup for personalised template
  let firstName = "";
  try {
    if (targetId) {
      const { data: prof } = await admin
        .from("profiles")
        .select("first_name, full_name")
        .eq("user_id", targetId)
        .maybeSingle();
      firstName = (prof as any)?.first_name || ((prof as any)?.full_name || "").split(" ")[0] || "";
    } else if (targetEmail) {
      const { data: prof } = await admin
        .from("profiles")
        .select("first_name, full_name")
        .ilike("email", targetEmail)
        .maybeSingle();
      firstName = (prof as any)?.first_name || ((prof as any)?.full_name || "").split(" ")[0] || "";
    }
  } catch (_e) { firstName = ""; }

  // Resolve account_id for client_internal_notes
  let accountId: string | null = null;
  try {
    if (targetId) {
      const { data: acc } = await admin
        .from("accounts")
        .select("id")
        .eq("client_id", targetId)
        .maybeSingle();
      accountId = (acc as any)?.id ?? null;
    }
  } catch (_e) { /* ignore */ }

  const ACTION_LABELS: Record<string, string> = {
    send_invite: "Invitation compte en ligne envoyée",
    send_password_reset: "Réinitialisation de mot de passe envoyée",
    force_confirm_email: "Courriel confirmé manuellement",
    change_email: "Courriel de connexion modifié",
    force_logout: "Sessions client révoquées",
    set_temporary_password: "Mot de passe temporaire défini",
    resend_welcome: "Courriel de bienvenue renvoyé",
    disable_portal_access: "Accès portail désactivé",
    enable_portal_access: "Accès portail réactivé",
  };

  const audit = async (evt: string, details: any, ok: boolean) => {
    try {
      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: `client_account.${evt}${ok ? "" : "_failed"}`,
        details,
        ip_address: ip,
        target_type: "client_user",
        target_id: targetId,
        target_email: targetEmail,
      });
    } catch (_e) { /* audit best-effort */ }

    if (!ok || !targetId) return;

    try {
      await admin.from("client_activity_logs").insert({
        client_id: targetId,
        actor_user_id: user.id,
        actor_role: "admin",
        actor_name: user.email || "admin",
        action_type: "account_access",
        summary: ACTION_LABELS[evt] || `Action accès en ligne: ${evt}`,
        entity_type: "client_user",
        entity_id: targetId,
        after_data: details,
      });
    } catch (_e) { /* best-effort */ }

    try {
      if (accountId) {
        await admin.from("client_internal_notes").insert({
          account_id: accountId,
          client_id: targetId,
          note_type: "system",
          body: `${ACTION_LABELS[evt] || evt}${reason ? ` — motif: ${reason}` : ""} — par ${user.email || user.id}`,
          created_by_user_id: user.id,
          created_by_name: user.email || "admin",
          created_by_role: "admin",
        });
      }
    } catch (_e) { /* best-effort */ }
  };

  const origin = resolveOrigin(body.redirect_origin);

  const queueEmail = async (templateKey: string, toEmail: string, vars: Record<string, any>) => {
    let error: any = null;
    try { await enqueueCommunication({
      channel: "email",
      templateKey: templateKey,
      recipient: toEmail,
      idempotencyKey: `${templateKey}_${toEmail}_${Date.now()}`,
      templateVars: { first_name: firstName, ...vars },
    }); } catch (__e) { error = __e; }
    if (error) throw new Error(`Échec mise en file courriel: ${error.message}`);
  };

  const genRecoveryLink = async (email: string) => {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/portal/reset-password` },
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(error?.message || "Lien de réinitialisation indisponible");
    }
    return data.properties.action_link as string;
  };

  try {
    switch (action) {
      case "send_password_reset": {
        // Anti-enum: if the target does not exist, return the generic message
        // without attempting to generate a link (which would leak existence).
        if (!targetId) {
          await auditDenied(action, "TARGET_NOT_FOUND", "Utilisateur introuvable", { target_email: targetEmail });
          return json(200, { success: true, message: GENERIC_TARGET_MSG });
        }
        const link = await genRecoveryLink(targetEmail!);
        await queueEmail("client_password_reset", targetEmail!, {
          reset_link: link,
          email: targetEmail,
          audience: "client",
          portal_label: "votre espace client Nivra",
        });
        await audit("password_reset_sent", { email: targetEmail }, true);
        return json(200, { success: true, message: GENERIC_TARGET_MSG });
      }

      case "send_invite": {
        if (!targetId) {
          const { data: created, error: cErr } = await admin.auth.admin.createUser({
            email: targetEmail!,
            password: genPassword(),
            email_confirm: true,
          });
          if (cErr) throw cErr;
          targetId = created.user?.id ?? null;
        }
        const link = await genRecoveryLink(targetEmail!);
        await queueEmail("client_account_invite", targetEmail!, {
          setup_link: link,
          email: targetEmail,
        });
        await audit("invite_sent", { email: targetEmail }, true);
        return json(200, { success: true, message: GENERIC_TARGET_MSG });
      }

      case "force_confirm_email": {
        if (!targetId) {
          await auditDenied(action, "TARGET_NOT_FOUND", "Utilisateur introuvable", { target_email: targetEmail });
          return json(200, { success: true, message: GENERIC_TARGET_MSG });
        }
        const { error } = await admin.auth.admin.updateUserById(targetId, { email_confirm: true });
        if (error) throw error;
        await audit("email_confirmed", { email: targetEmail }, true);
        return json(200, { success: true, message: "Courriel confirmé" });
      }

      case "change_email": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const ne = (body.new_email || "").trim().toLowerCase();
        if (!ne || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne)) {
          await auditDenied(action, "INVALID_NEW_EMAIL", "Nouveau courriel invalide", { new_email: ne });
          return json(400, { error: "Nouveau courriel invalide" });
        }
        const oldEmail = targetEmail!;

        await queueEmail("client_email_changed_warning_old", oldEmail, {
          old_email: oldEmail,
          new_email: ne,
          changed_by_email: user.email,
          reason,
        });

        const { error } = await admin.auth.admin.updateUserById(targetId, { email: ne, email_confirm: true });
        if (error) throw error;
        try { await admin.from("profiles").update({ email: ne }).eq("user_id", targetId); } catch (_e) {}

        await queueEmail("client_email_changed_notice", ne, {
          old_email: oldEmail,
          new_email: ne,
        });
        await audit("email_changed", {
          old: oldEmail,
          new: ne,
          reason,
          changed_by: user.id,
        }, true);
        return json(200, { success: true, message: "Courriel mis à jour. L'ancienne adresse a été notifiée." });
      }

      case "force_logout": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        let revoked = 0;
        try {
          const anyAdmin = admin.auth.admin as any;
          if (typeof anyAdmin.listUserSessions === "function") {
            const { data: sessData, error: lsErr } = await anyAdmin.listUserSessions(targetId);
            if (lsErr) throw lsErr;
            const sessions = (sessData?.sessions ?? sessData ?? []) as Array<{ id: string }>;
            for (const s of sessions) {
              try {
                await anyAdmin.deleteSession(s.id);
                revoked++;
              } catch (_e) { /* continue */ }
            }
          }
        } catch (_e) {
          try {
            await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetId}/sessions`, {
              method: "DELETE",
              headers: {
                apikey: supabaseServiceKey,
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
            });
          } catch (_e2) { /* ignore */ }
        }
        await audit("force_logout", {
          email: targetEmail,
          sessions_revoked: revoked,
          reason,
        }, true);
        return json(200, { success: true, message: "Sessions du client révoquées" });
      }

      case "set_temporary_password": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const np = body.new_password && body.new_password.length >= 12 ? body.new_password : genPassword();
        const { error } = await admin.auth.admin.updateUserById(targetId, { password: np });
        if (error) throw error;
        // NOTE: le mot de passe n'est JAMAIS journalisé dans les logs.
        await audit("temp_password_set", { email: targetEmail, reason }, true);
        return json(200, {
          success: true,
          message: "Mot de passe temporaire défini",
          temporary_password: np,
        }, { "Cache-Control": "no-store" });
      }

      case "resend_welcome": {
        await queueEmail("welcome_to_nivra", targetEmail!, {
          email: targetEmail,
        });
        await audit("welcome_resent", { email: targetEmail }, true);
        return json(200, { success: true, message: GENERIC_TARGET_MSG });
      }

      case "disable_portal_access": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const { error } = await admin
          .from("profiles")
          .update({ security_status: "suspended" })
          .eq("user_id", targetId);
        if (error) throw error;
        // Best-effort: révoquer aussi les sessions actives.
        try {
          const anyAdmin = admin.auth.admin as any;
          if (typeof anyAdmin.listUserSessions === "function") {
            const { data: sessData } = await anyAdmin.listUserSessions(targetId);
            const sessions = (sessData?.sessions ?? sessData ?? []) as Array<{ id: string }>;
            for (const s of sessions) { try { await anyAdmin.deleteSession(s.id); } catch (_e) {} }
          }
        } catch (_e) { /* ignore */ }
        await audit("portal_access_disabled", { email: targetEmail, reason }, true);
        return json(200, { success: true, message: "Accès portail désactivé" });
      }

      case "enable_portal_access": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const { error } = await admin
          .from("profiles")
          .update({ security_status: "active" })
          .eq("user_id", targetId);
        if (error) throw error;
        await audit("portal_access_enabled", { email: targetEmail, reason }, true);
        return json(200, { success: true, message: "Accès portail réactivé" });
      }

      default:
        await auditDenied(String(action), "UNKNOWN_ACTION", "Action inconnue");
        return json(400, { error: "Action inconnue" });
    }
  } catch (e: any) {
    console.error("[client-account-admin] error", e);
    await audit(action, { error: e?.message || String(e), reason }, false);
    return json(500, { error: e?.message || "Erreur inattendue" });
  }
});

// Map an action name to the event name that gets stored in admin_audit_log
// (the switch above stores e.g. `password_reset_sent`, not `send_password_reset`).
// Used by the anti-flood check so both the request name and the stored event
// name are matched inside the 60s window.
function actionEventKey(a: Action): string {
  switch (a) {
    case "send_password_reset": return "password_reset_sent";
    case "send_invite": return "invite_sent";
    case "force_confirm_email": return "email_confirmed";
    case "change_email": return "email_changed";
    case "force_logout": return "force_logout";
    case "set_temporary_password": return "temp_password_set";
    case "resend_welcome": return "welcome_resent";
    case "disable_portal_access": return "portal_access_disabled";
    case "enable_portal_access": return "portal_access_enabled";
    default: return a;
  }
}
