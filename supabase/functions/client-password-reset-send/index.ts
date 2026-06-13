// CANONICAL — Client portal password reset.
// All emails go through email_queue + customQueueTemplates Violet Bold shell.
// Reset link redirects to https://nivra-telecom.ca/portal/reset-password.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

type ClientPasswordResetSendRequest = {
  email: string;
  redirect_origin?: string;
};

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const getAllowedOrigins = (): string[] => {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (allowedOriginsEnv && allowedOriginsEnv.trim() !== "" && allowedOriginsEnv !== "ALLOWED_ORIGINS") {
    return allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean);
  }
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").split(",")[0]?.trim();
  if (appBaseUrl) return [appBaseUrl];
  return ["https://nivra-telecom.ca"];
};

const isOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".lovableproject.com")) return true;
  if (origin.endsWith(".lovable.app")) return true;
  return false;
};

const resolveRedirectBaseUrl = (requestedOrigin: string | undefined): string => {
  const allowedOrigins = getAllowedOrigins();
  const fallback = allowedOrigins[0] || "https://nivra-telecom.ca";
  if (requestedOrigin && isOriginAllowed(requestedOrigin, allowedOrigins)) {
    return normalizeBaseUrl(requestedOrigin);
  }
  return normalizeBaseUrl(fallback);
};

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limit by IP
    const ipAddr =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const rl = await checkRateLimit({
      key: `client-password-reset-send:${ipAddr}`,
      ...RATE_LIMITS.PASSWORD_RESET,
    });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const body: ClientPasswordResetSendRequest = await req.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[client-password-reset-send] Request for: ${email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // CANONICAL — client portal reset URL
    const redirectBaseUrl = resolveRedirectBaseUrl(body.redirect_origin);
    const redirectTo = `${redirectBaseUrl}/portal/reset-password`;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    // Prevent user enumeration: always respond success.
    if (linkError || !linkData?.properties?.action_link) {
      console.warn("[client-password-reset-send] generateLink failed (returning success anyway):", linkError);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData.properties.action_link;

    // Look up first name (best-effort)
    let firstName = "";
    try {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("first_name")
        .ilike("email", email)
        .maybeSingle();
      firstName = (profile as any)?.first_name || "";
    } catch (_e) {
      firstName = "";
    }

    // CANONICAL — route through email_queue + customQueueTemplates Violet Bold shell.
    const { error: queueErr } = await (adminClient as any)
      .from("email_queue")
      .insert({
        event_key: `client_password_reset_${email}_${Date.now()}`,
        to_email: email,
        template_key: "client_password_reset",
        template_vars: {
          reset_link: resetLink,
          email,
          first_name: firstName,
          audience: "client",
          portal_label: "votre espace client Nivra",
        },
        status: "queued",
      });

    if (queueErr) {
      console.error("[client-password-reset-send] email_queue insert error:", queueErr);
      // Still respond success to prevent enumeration
    } else {
      console.log(`[client-password-reset-send] Queued password reset email for ${email}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[client-password-reset-send] Unexpected error:", error);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
