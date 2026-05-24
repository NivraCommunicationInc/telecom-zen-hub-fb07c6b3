// Client account admin actions — used by Core & OneView CS portals.
// Actions: send_invite, send_password_reset, force_confirm_email,
// change_email, force_logout, set_temporary_password.
//
// All actions require an authenticated staff user (admin or employee role)
// and are recorded in admin_audit_log.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  | "set_temporary_password";

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

  // Authorize: staff roles only
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const allowedRoles = new Set(["admin", "employee", "agent", "manager", "core_admin"]);
  const isStaff = (roles || []).some((r: any) => allowedRoles.has(r.role));
  if (!isStaff) return json(403, { error: "Réservé au personnel autorisé" });

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { error: "Body invalide" }); }
  if (!body?.action) return json(400, { error: "Action requise" });

  // Resolve target user
  let targetId = body.client_user_id || null;
  let targetEmail = (body.client_email || "").trim().toLowerCase() || null;

  if (!targetId && targetEmail) {
    const { data: users } = await admin.auth.admin.listUsers();
    const found = users?.users?.find(u => u.email?.toLowerCase() === targetEmail);
    if (found) targetId = found.id;
  }
  if (targetId && !targetEmail) {
    const { data: tu } = await admin.auth.admin.getUserById(targetId);
    targetEmail = tu?.user?.email?.toLowerCase() ?? null;
  }

  if (!targetEmail && body.action !== "force_logout") {
    return json(400, { error: "Email client requis" });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip") || "unknown";

  const audit = async (action: string, details: any, ok: boolean) =>
    admin.from("admin_audit_log").insert({
      admin_user_id: user.id,
      admin_email: user.email,
      action: `client_account.${action}${ok ? "" : "_failed"}`,
      details,
      ip_address: ip,
      target_type: "client_user",
      target_id: targetId,
      target_email: targetEmail,
    });

  const redirectOrigin = body.redirect_origin || "https://nivra-telecom.ca";

  try {
    switch (body.action) {
      case "send_password_reset": {
        const { error } = await admin.auth.resetPasswordForEmail(targetEmail!, {
          redirectTo: `${redirectOrigin.replace(/\/+$/, "")}/portal/reset-password`,
        });
        if (error) throw error;
        await audit("password_reset_sent", { email: targetEmail }, true);
        return json(200, { success: true, message: "Courriel de réinitialisation envoyé" });
      }

      case "send_invite": {
        // If user already exists, send password reset (acts as account setup).
        // Otherwise create user + send invite link.
        if (!targetId) {
          const { data: created, error: cErr } = await admin.auth.admin.createUser({
            email: targetEmail!,
            password: genPassword(),
            email_confirm: true,
          });
          if (cErr) throw cErr;
          targetId = created.user?.id ?? null;
        }
        const { error } = await admin.auth.resetPasswordForEmail(targetEmail!, {
          redirectTo: `${redirectOrigin.replace(/\/+$/, "")}/portal/reset-password`,
        });
        if (error) throw error;
        await audit("invite_sent", { email: targetEmail }, true);
        return json(200, { success: true, message: "Invitation envoyée au client" });
      }

      case "force_confirm_email": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const { error } = await admin.auth.admin.updateUserById(targetId, { email_confirm: true });
        if (error) throw error;
        await audit("email_confirmed", { email: targetEmail }, true);
        return json(200, { success: true, message: "Courriel confirmé" });
      }

      case "change_email": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const ne = (body.new_email || "").trim().toLowerCase();
        if (!ne || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne)) return json(400, { error: "Nouveau courriel invalide" });
        const { error } = await admin.auth.admin.updateUserById(targetId, { email: ne, email_confirm: true });
        if (error) throw error;
        await admin.from("profiles").update({ email: ne }).eq("user_id", targetId);
        await audit("email_changed", { old: targetEmail, new: ne }, true);
        return json(200, { success: true, message: "Courriel mis à jour" });
      }

      case "force_logout": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const { error } = await admin.auth.admin.signOut(targetId);
        if (error) throw error;
        await audit("force_logout", { email: targetEmail }, true);
        return json(200, { success: true, message: "Sessions du client révoquées" });
      }

      case "set_temporary_password": {
        if (!targetId) return json(404, { error: "Utilisateur introuvable" });
        const np = body.new_password && body.new_password.length >= 12 ? body.new_password : genPassword();
        const { error } = await admin.auth.admin.updateUserById(targetId, { password: np });
        if (error) throw error;
        await audit("temp_password_set", { email: targetEmail }, true);
        return json(200, { success: true, message: "Mot de passe temporaire défini", temporary_password: np });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e: any) {
    console.error("[client-account-admin] error", e);
    await audit(body.action, { error: e?.message }, false);
    return json(500, { error: e?.message || "Erreur inattendue" });
  }
});
