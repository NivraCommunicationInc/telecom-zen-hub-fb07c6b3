import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuditSessionRequest {
  target_email?: string;
  target_user_id?: string;
  reason?: string;
  redirect_to?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const actorClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: actorData, error: actorErr } = await actorClient.auth.getUser();
    const actor = actorData?.user;
    if (actorErr || !actor) {
      return new Response(JSON.stringify({ success: false, error: "INVALID_SESSION" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", actor.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ success: false, error: "ADMIN_ONLY" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as AuditSessionRequest;
    const reason = body.reason?.trim();
    if (!reason || reason.length < 5) {
      return new Response(JSON.stringify({ success: false, error: "REASON_REQUIRED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUserId = body.target_user_id?.trim() || "";
    let targetEmail = body.target_email?.trim().toLowerCase() || "";

    if (!targetUserId && targetEmail) {
      const { data: billingCustomer } = await adminClient
        .from("billing_customers")
        .select("user_id")
        .ilike("email", targetEmail)
        .not("user_id", "is", null)
        .maybeSingle();

      if (billingCustomer?.user_id) {
        targetUserId = billingCustomer.user_id;
      }
    }

    if (!targetUserId && targetEmail) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id")
        .ilike("email", targetEmail)
        .not("user_id", "is", null)
        .maybeSingle();

      if (profile?.user_id) {
        targetUserId = profile.user_id;
      }
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ success: false, error: "TARGET_USER_NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetData, error: targetErr } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetErr || !targetData?.user?.email) {
      return new Response(JSON.stringify({ success: false, error: "TARGET_USER_NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    targetEmail = targetData.user.email.toLowerCase();

    const fallbackOrigin = req.headers.get("origin") || "https://telecom-zen-hub.lovable.app";
    const redirectTo =
      body.redirect_to && /^https?:\/\//i.test(body.redirect_to)
        ? body.redirect_to
        : `${fallbackOrigin}/portal/service-addresses?audit_session=1`;

    const { data: magicData, error: magicErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo },
    });

    const actionLink = magicData?.properties?.action_link;
    if (magicErr || !actionLink) {
      return new Response(JSON.stringify({ success: false, error: "MAGIC_LINK_GENERATION_FAILED" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    // Compute magic link hash for correlation
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(actionLink));
    const magicLinkHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const sessionId = crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // TTL 10 minutes

    // Insert into admin_audit_sessions (lifecycle tracking)
    await adminClient.from("admin_audit_sessions").insert({
      id: sessionId,
      admin_user_id: actor.id,
      admin_email: actor.email,
      target_user_id: targetUserId,
      target_email: targetEmail,
      reason,
      redirect_to: redirectTo,
      ip_address: ipAddress,
      issued_at: issuedAt,
      expires_at: expiresAt,
      magic_link_hash: magicLinkHash,
    });

    // Queue notification email
    await adminClient.from("email_queue").insert({
      event_key: `audit_magiclink_${sessionId}`,
      to_email: targetEmail,
      template_key: "audit_magiclink",
      template_vars: {
        action_link: actionLink,
        actor_admin_id: actor.id,
        target_user_id: targetUserId,
        reason,
        one_time: true,
        session_id: sessionId,
        expires_at: expiresAt,
        created_at: issuedAt,
      },
      status: "queued",
    });

    // Audit log (existing)
    await adminClient.from("admin_audit_log").insert({
      admin_user_id: actor.id,
      admin_email: actor.email,
      action: "audit_session_magiclink_issued",
      details: {
        reason,
        redirect_to: redirectTo,
        one_time: true,
        delivery: "email_queue",
        session_id: sessionId,
        ttl_minutes: 10,
        expires_at: expiresAt,
      },
      ip_address: ipAddress,
      target_type: "user",
      target_id: targetUserId,
      target_email: targetEmail,
    });

    return new Response(
      JSON.stringify({
        success: true,
        one_time: true,
        delivery: "email_queue",
        session_id: sessionId,
        actor_admin_id: actor.id,
        target_user_id: targetUserId,
        target_email: targetEmail,
        reason,
        ip: ipAddress,
        issued_at: issuedAt,
        expires_at: expiresAt,
        ttl_minutes: 10,
        action_link: actionLink,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[admin-audit-session-link] error", error);
    return new Response(JSON.stringify({ success: false, error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
