// Hub (Nivra Core) auto password-reset trigger.
// Called after N failed login attempts on the hub login page.
// Only sends if the email matches an ACTIVE internal user_roles record.
// Routes the email through the corporate "staff_password_reset" template.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

const INTERNAL_ROLES = [
  "admin", "employee", "technician", "supervisor",
  "sales", "kyc_agent", "billing_admin", "techops", "support", "field_sales",
];

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const getAllowedOrigins = (): string[] => {
  const env = Deno.env.get("ALLOWED_ORIGINS");
  if (env && env.trim() !== "" && env !== "ALLOWED_ORIGINS") {
    return env.split(",").map((o) => o.trim()).filter(Boolean);
  }
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").split(",")[0]?.trim();
  if (appBaseUrl) return [appBaseUrl];
  return ["https://nivra-telecom.ca"];
};

const isOriginAllowed = (origin: string, allowed: string[]): boolean => {
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  if (origin.endsWith(".lovableproject.com")) return true;
  if (origin.endsWith(".lovable.app")) return true;
  return false;
};

const resolveRedirectBaseUrl = (requested?: string): string => {
  const allowed = getAllowedOrigins();
  const fallback = allowed[0] || "https://nivra-telecom.ca";
  if (requested && isOriginAllowed(requested, allowed)) return normalizeBaseUrl(requested);
  return normalizeBaseUrl(fallback);
};

Deno.serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ipAddr =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const rl = await checkRateLimit({
      key: `hub-password-reset-send:${ipAddr}`,
      ...RATE_LIMITS.PASSWORD_RESET,
    });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const requestedOrigin = body?.redirect_origin as string | undefined;

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[hub-password-reset-send] Request for: ${email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Lookup user via auth admin (case-insensitive scan).
    // Note: listUsers is paginated; first 1000 is sufficient for Nivra Core staff.
    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = (usersData?.users || []).find(
      (u) => (u.email || "").toLowerCase() === email,
    );

    // Always respond success (avoid user enumeration).
    if (!user) {
      console.log(`[hub-password-reset-send] No auth user for ${email}, silent success.`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must have an active internal role to qualify.
    const { data: role } = await admin
      .from("user_roles")
      .select("role, status, is_active")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", INTERNAL_ROLES)
      .maybeSingle();

    if (!role || role.is_active === false) {
      console.log(`[hub-password-reset-send] ${email} has no active internal role, silent success.`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectBaseUrl = resolveRedirectBaseUrl(requestedOrigin);
    const redirectTo = `${redirectBaseUrl}/nivra-secure-hub-2617-internal/reset-password`;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.warn("[hub-password-reset-send] generateLink failed:", linkErr);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData.properties.action_link;

    // Best-effort first name for greeting.
    let firstName = "";
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("first_name")
        .eq("user_id", user.id)
        .maybeSingle();
      firstName = (profile as any)?.first_name || "";
    } catch (_e) {
      firstName = "";
    }

    const { error: queueErr } = await (admin as any)
      .from("email_queue")
      .insert({
        event_key: `hub_password_reset_${email}_${Date.now()}`,
        to_email: email,
        template_key: "staff_password_reset",
        template_vars: {
          reset_link: resetLink,
          email,
          first_name: firstName,
          audience: "staff",
          portal_label: "Nivra Secure Hub",
        },
        status: "queued",
      });

    if (queueErr) {
      console.error("[hub-password-reset-send] email_queue insert error:", queueErr);
    } else {
      console.log(`[hub-password-reset-send] Queued staff password reset for ${email}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[hub-password-reset-send] Unexpected error:", e);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
