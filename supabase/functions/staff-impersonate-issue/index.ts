/**
 * staff-impersonate-issue
 * Validates a one-time staff impersonation token (created via RPC
 * `start_staff_impersonation`) and returns a Supabase magic-link
 * action_link that, when opened, signs the browser in as the target
 * staff member. The admin's existing session in the same browser will
 * be replaced — this is the documented trade-off for true impersonation.
 *
 * Body: { token: string }
 * Returns: { action_link: string, target_email: string, portal: string, target_name: string | null }
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { token, origin: bodyOrigin } = body as { token?: string; origin?: string };
    if (!token || typeof token !== "string" || token.length < 16) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1) Validate token (marks consumed_at)
    const { data: vRows, error: vErr } = await admin.rpc("validate_staff_impersonation_token", { _token: token });
    if (vErr) throw vErr;
    const v = Array.isArray(vRows) ? vRows[0] : vRows;
    if (!v?.is_valid) {
      return new Response(JSON.stringify({ error: "Token expiré ou invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Resolve target email
    const { data: targetUser, error: uErr } = await admin.auth.admin.getUserById(v.target_user_id);
    if (uErr || !targetUser?.user?.email) {
      return new Response(JSON.stringify({ error: "Utilisateur cible introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Resolve display name (best effort)
    let targetName: string | null = null;
    try {
      const { data: prof } = await admin.from("profiles")
        .select("full_name, first_name, last_name").eq("user_id", v.target_user_id).maybeSingle();
      targetName = (prof as any)?.full_name
        || [(prof as any)?.first_name, (prof as any)?.last_name].filter(Boolean).join(" ")
        || null;
    } catch { /* noop */ }

    // 4) Generate magic link → action_link signs the browser in as target user
    const portalPath = ({
      field: "/field", rh: "/rh", technician: "/staff/technician",
      employee: "/employee", core: "/core",
    } as Record<string, string>)[v.portal] ?? "/hub";

    // Resolve the APP origin (NOT the Supabase functions host) for the redirect.
    // Priority: explicit body.origin → Origin header → Referer → fallback.
    const ALLOWED_APP_ORIGINS = [
      "https://nivra-telecom.ca",
      "https://www.nivra-telecom.ca",
    ];
    const headerOrigin = req.headers.get("origin");
    const refererOrigin = (() => {
      const r = req.headers.get("referer");
      try { return r ? new URL(r).origin : null; } catch { return null; }
    })();
    const candidateOrigin = bodyOrigin || headerOrigin || refererOrigin;
    const appOrigin = (candidateOrigin && ALLOWED_APP_ORIGINS.includes(candidateOrigin))
      ? candidateOrigin
      : "https://www.nivra-telecom.ca";

    const redirectTo = `${appOrigin}${portalPath}?staff_imp=${encodeURIComponent(v.session_id)}&staff_imp_isolated=1`;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: "Impossible de générer le lien" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      action_link: linkData.properties.action_link,
      target_email: targetUser.user.email,
      target_name: targetName,
      portal: v.portal,
      session_id: v.session_id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[staff-impersonate-issue]", err);
    return new Response(JSON.stringify({ error: err?.message || "Erreur interne" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
