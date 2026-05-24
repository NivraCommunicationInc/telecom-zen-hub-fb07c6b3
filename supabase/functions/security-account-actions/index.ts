// security-account-actions — Phase 12
// Staff-only security operations for a client account.
// Actions:
//   - list_overview: aggregates login attempts, active access sessions,
//                    security lock state, pending login PINs, security events
//   - revoke_access_session: revoke a single staff/customer access session
//   - clear_security_lock: clear lock_until + reset pin_attempts
//   - invalidate_login_pins: mark all unused client_login_pins as used
//   - force_signout_all: invalidates the auth user's refresh tokens

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  action: string;
  client_user_id: string;
  client_email?: string | null;
  account_id?: string | null;
  session_id?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const roles = await Promise.all([
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "support_agent" }),
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "billing_admin" }),
    ]);
    const isStaff = roles.some((r) => r.data === true);
    if (!isStaff) return json({ error: "forbidden" }, 403);

    // Sensitive actions require admin
    const isAdmin = roles[0].data === true;

    const body = (await req.json()) as Body;
    if (!body?.client_user_id || !body?.action) {
      return json({ error: "client_user_id and action required" }, 400);
    }

    const clientId = body.client_user_id;
    const email = body.client_email?.toLowerCase() ?? null;

    const logAudit = async (action: string, details: Record<string, any>) => {
      await admin.from("admin_audit_log").insert({
        admin_user_id: userData.user.id,
        admin_email: userData.user.email,
        action: `account_ops.security_${action}`,
        target_type: "user",
        target_id: clientId,
        target_email: email,
        details,
      });
    };

    switch (body.action) {
      case "list_overview": {
        const [attemptsRes, sessionsRes, securityRes, pinsRes, eventsRes] = await Promise.all([
          email
            ? admin
                .from("auth_login_attempts")
                .select("id, email_attempted, success, failure_reason, ip_address, user_agent, portal, created_at")
                .eq("email_attempted", email)
                .order("created_at", { ascending: false })
                .limit(50)
            : Promise.resolve({ data: [] as any[], error: null }),
          admin
            .from("customer_access_sessions")
            .select("id, employee_id, ip_address, user_agent, verified_at, expires_at, revoked_at, created_at")
            .eq("customer_id", clientId)
            .order("created_at", { ascending: false })
            .limit(50),
          admin
            .from("customer_security")
            .select("id, pin_attempts, lock_until, last_verified_at, updated_at")
            .eq("customer_id", clientId)
            .maybeSingle(),
          admin
            .from("client_login_pins")
            .select("id, email, expires_at, used, attempts, created_at")
            .eq("user_id", clientId)
            .order("created_at", { ascending: false })
            .limit(20),
          admin
            .from("security_events")
            .select("id, event_type, severity, details, created_at")
            .or(`details->>user_id.eq.${clientId}${email ? `,details->>email.eq.${email}` : ""}`)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        return json({
          ok: true,
          login_attempts: attemptsRes.data ?? [],
          access_sessions: sessionsRes.data ?? [],
          security: securityRes.data ?? null,
          login_pins: pinsRes.data ?? [],
          security_events: eventsRes.data ?? [],
        });
      }

      case "revoke_access_session": {
        if (!body.session_id) return json({ error: "session_id required" }, 400);
        const { error } = await admin
          .from("customer_access_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", body.session_id)
          .eq("customer_id", clientId)
          .is("revoked_at", null);
        if (error) throw error;
        await logAudit("revoke_session", { session_id: body.session_id, reason: body.reason });
        return json({ ok: true });
      }

      case "clear_security_lock": {
        const { error } = await admin
          .from("customer_security")
          .update({ pin_attempts: 0, lock_until: null, updated_at: new Date().toISOString() })
          .eq("customer_id", clientId);
        if (error) throw error;
        await logAudit("clear_lock", { reason: body.reason });
        return json({ ok: true });
      }

      case "invalidate_login_pins": {
        const { error } = await admin
          .from("client_login_pins")
          .update({ used: true })
          .eq("user_id", clientId)
          .eq("used", false);
        if (error) throw error;
        await logAudit("invalidate_pins", { reason: body.reason });
        return json({ ok: true });
      }

      case "force_signout_all": {
        if (!isAdmin) return json({ error: "admin role required" }, 403);
        // Invalidate all refresh tokens for the user
        const { error } = await admin.auth.admin.signOut(clientId, "global" as any);
        if (error && !String(error.message).toLowerCase().includes("user not found")) {
          throw error;
        }
        await logAudit("force_signout", { reason: body.reason });
        return json({ ok: true });
      }

      default:
        return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error("security-account-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
