// Client account admin actions â€” used by Core & OneView CS portals.
// All client-facing emails go through email_queue + Violet Bold corporate
// template (customQueueTemplates). Never sends raw default Supabase emails.
//
// Actions: send_invite, send_password_reset, force_confirm_email,
// change_email, force_logout, set_temporary_password, resend_welcome.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

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
  | "resend_welcome";

interface Body {
  action: Action;
  client_user_id?: string;
  client_email?: string;
  new_email?: string;
  new_password?: string;
  redirect_origin?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisÃ©" });

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authorize: staff roles only
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const allowedRoles = new Set(["admin", "employee", "agent", "manager", "core_admin", "super_admin", "supervisor"]);
  const { isStaff } = await checkStaffAuth(admin, user.id);
  if (!isStaff) return json(403, { error: "RÃ©servÃ© au personnel autorisÃ©" });
  // Admin gate for sensitive actions (email change, etc.)
  const adminRoles = new Set(["admin", "core_admin", "super_admin"]);
  const isAdmin = (roles || []).some((r: any) => adminRoles.has(r.role));

  let body: Body;
  try { body = await req.json(); } catch (_e) { return json(400, { error: "Body invalide" }); }
  if (!body?.action) return json(400, { error: "Action requise" });

  // Resolve target user
  let targetId = body.client_user_id || null;
  let targetEmail = (body.client_email || "").trim().toLowerCase() || null;

  if (!targetId && targetEmail) {
    try {
      const { data: users } = await admin.auth.admin.listUsers();
      const found = users?.users?.find(u => u.email?.toLowerCase() === targetEmail);
      if (found) targetId = found.id;
    } catch (_e) { /* ignore */ }
  }
  if (targetId && !targetEmail) {
    try {
      const { data: tu } = await admin.auth.admin.getUserById(targetId);
      targetEmail = tu?.user?.email?.toLowerCase() ?? null;
    } catch (_e) { /* ignore */ }
  }

  if (!targetEmail && body.action !== "force_logout") {
    return json(400, { error: "Email client requis" });
  }

  // First name lookup (best-effort) â€” used for personalised template
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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip") || "unknown";

  const audit = async (action: string, details: any, ok: boolean) => {
    try {
      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        admin_email: user.email,
        action: `client_account.${action}${ok ? "" : "_failed"}`,
        details,
        ip_address: ip,
        target_type: "client_user",
        target_id: targetId,
        target_email: targetEmail,
      });
    } catch (_e) { /* audit best-effort */ }
  };

  const origin = resolveOrigin(body.redirect_origin);

  const queueEmail = async (templateKey: string, toEmail: string, vars: Record<string, any>) => {
    const { error } = await admin.from("email_queue").insert({
      event_key: `${templateKey}_${toEmail}_${Date.now()}`,
      to_email: toEmail,
      template_key: templateKey,
      template_vars: { first_name: firstName, ...vars },
      status: "queued",
    });
    if (error) throw new Error(`Ã‰chec mise en file courriel: ${error.message}`);
  };

  const genRecoveryLink = async (email: string) => {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/portal/reset-password` },
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(error?.message || "Lien de rÃ©initialisation indisponible");
    }
    return data.properties.action_link as string;
  };

  try {
    switch (body.action) {
      case "send_password_reset": {
        const link = await genRecoveryLink(targetEmail!);
        await queueEmail("client_password_reset", targetEmail!, {
          reset_link: link,
          email: targetEmail,
          audience: "client",
          portal_label: "votre espace client Nivra",
        });
        await audit("password_reset_sent", { email: targetEmail }, true);
        return json(200, { success: true, message: "Courriel de rÃ©initialisation envoyÃ©" });
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
        return json(200, { success: true, message: "Invitation envoyÃ©e au client" });
      }

      case "force_confirm_email": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const { error } = await admin.auth.admin.updateUserById(targetId, { email_confirm: true });
        if (error) throw error;
        await audit("email_confirmed", { email: targetEmail }, true);
        return json(200, { success: true, message: "Courriel confirmÃ©" });
      }

      case "change_email": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const ne = (body.new_email || "").trim().toLowerCase();
        if (!ne || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne)) return json(400, { error: "Nouveau courriel invalide" });
        const oldEmail = targetEmail!;

        // Security: changing a client's email is an account-takeover vector.
        // We now require:
        //   1. The acting staff must be admin (not any staff role)
        //   2. body.reason must be provided (audit + accountability)
        //   3. The OLD email is notified BEFORE the change so the original
        //      account owner can object if they didn't request it
        if (!isAdmin) {
          return json(403, { error: "Seul un admin peut changer le courriel d'un client" });
        }
        if (!body.reason || !String(body.reason).trim()) {
          return json(400, { error: "Motif obligatoire pour changement de courriel" });
        }

        // Notify OLD address first â€” this is the protection against hijack.
        // If a staff member is acting maliciously, the real owner gets warned.
        await queueEmail("client_email_changed_warning_old", oldEmail, {
          old_email: oldEmail,
          new_email: ne,
          changed_by_email: user.email,
          reason: String(body.reason).trim(),
        });

        const { error } = await admin.auth.admin.updateUserById(targetId, { email: ne, email_confirm: true });
        if (error) throw error;
        try { await admin.from("profiles").update({ email: ne }).eq("user_id", targetId); } catch (_e) {}

        // Also notify the new address with the standard notice
        await queueEmail("client_email_changed_notice", ne, {
          old_email: oldEmail,
          new_email: ne,
        });
        await audit("email_changed", {
          old: oldEmail,
          new: ne,
          reason: String(body.reason).trim(),
          changed_by: user.id,
        }, true);
        return json(200, { success: true, message: "Courriel mis Ã  jour. L'ancienne adresse a Ã©tÃ© notifiÃ©e." });
      }

      case "force_logout": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const { error } = await admin.auth.admin.signOut(targetId);
        if (error) throw error;
        await audit("force_logout", { email: targetEmail }, true);
        return json(200, { success: true, message: "Sessions du client rÃ©voquÃ©es" });
      }

      case "set_temporary_password": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const np = body.new_password && body.new_password.length >= 12 ? body.new_password : genPassword();
        const { error } = await admin.auth.admin.updateUserById(targetId, { password: np });
        if (error) throw error;
        await audit("temp_password_set", { email: targetEmail }, true);
        return json(200, { success: true, message: "Mot de passe temporaire dÃ©fini", temporary_password: np });
      }

      case "resend_welcome": {
        await queueEmail("welcome_to_nivra", targetEmail!, {
          email: targetEmail,
        });
        await audit("welcome_resent", { email: targetEmail }, true);
        return json(200, { success: true, message: "Courriel de bienvenue renvoyÃ©" });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    console.error("[client-account-admin] error", e);
    await audit(body.action, { error: e?.message || String(e) }, false);
    return json(500, { error: e?.message || "Erreur inattendue" });
  }
});
