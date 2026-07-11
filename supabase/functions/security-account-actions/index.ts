// security-account-actions — Module 42 Phase 2
// Staff-only security operations for a client account.
// Actions:
//   - list_overview
//   - revoke_access_session
//   - clear_security_lock
//   - invalidate_login_pins
//   - force_signout_all (admin only)
//
// Phase 2 additions:
//   - Zod validation of request body
//   - Idempotency via public.security_action_idempotency
//   - Client Timeline journal via rpc_account_journal_write (writeAccountJournal)
//   - admin_audit_log unchanged (kept for compliance)

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  action: z.enum([
    "list_overview",
    "revoke_access_session",
    "clear_security_lock",
    "invalidate_login_pins",
    "force_signout_all",
  ]),
  client_user_id: z.string().regex(uuidRe, "client_user_id must be a UUID"),
  client_email: z.string().email().max(255).nullish(),
  account_id: z.string().regex(uuidRe).nullish(),
  session_id: z.string().regex(uuidRe).optional(),
  reason: z.string().trim().max(500).optional(),
  idempotency_key: z.string().regex(uuidRe).optional(),
});

type Body = z.infer<typeof BodySchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashRequest(action: string, body: Body): Promise<string> {
  const canonical = JSON.stringify({
    action,
    client_user_id: body.client_user_id,
    session_id: body.session_id ?? null,
    reason: body.reason ?? null,
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isoMinuteBucket36(d = new Date()): string {
  // 36-char bucket: YYYYMMDDHHMM
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
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

    const { isStaff } = await checkStaffAuth(admin, userData.user.id);
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    const isAdmin = isAdminData === true;

    // Zod validation
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400);
    }
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: "validation_failed", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;
    const clientId = body.client_user_id;
    const email = body.client_email?.toLowerCase() ?? null;
    const actorId = userData.user.id;
    const actorEmail = userData.user.email ?? null;

    // Idempotency (only for mutating actions)
    const isMutation = body.action !== "list_overview";
    const idempotencyKey =
      body.idempotency_key ?? req.headers.get("x-idempotency-key") ?? null;

    if (isMutation && idempotencyKey) {
      const requestHash = await hashRequest(body.action, body);
      const { data: existing } = await admin
        .from("security_action_idempotency")
        .select("request_hash, response")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) {
        if (existing.request_hash !== requestHash) {
          return json({ error: "idempotency_key_conflict" }, 409);
        }
        return json({ ...(existing.response as object ?? { ok: true }), idempotent: true });
      }
      // Reserve the key
      const { error: insErr } = await admin.from("security_action_idempotency").insert({
        idempotency_key: idempotencyKey,
        action: body.action,
        actor_id: actorId,
        request_hash: requestHash,
        response: null,
      });
      if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
        throw insErr;
      }
    }

    const logAudit = async (action: string, details: Record<string, unknown>) => {
      await admin.from("admin_audit_log").insert({
        admin_user_id: actorId,
        admin_email: actorEmail,
        action: `account_ops.security_${action}`,
        target_type: "user",
        target_id: clientId,
        target_email: email,
        details,
      });
    };

    const journalActor = {
      userId: actorId,
      role: isAdmin ? "admin" : "employee",
      name: actorEmail ?? "staff",
      email: actorEmail,
    };

    // Client Timeline journal (activity + internal note). Non-fatal: log & continue.
    const writeClientJournal = async (opts: {
      eventPrefix: string; // e.g. "session_revoked"
      businessId: string;  // stable id or minute bucket
      summary: string;
      details: Record<string, unknown>;
    }) => {
      const activityKey = `security:${clientId}:${opts.eventPrefix}:${opts.businessId}:activity`;
      const noteKey = `security:${clientId}:${opts.eventPrefix}:${opts.businessId}:note`;
      try {
        await writeAccountJournal(admin, {
          targetTable: "client_activity_logs",
          eventKey: activityKey,
          actor: journalActor,
          payload: {
            client_user_id: clientId,
            activity_type: `security_${opts.eventPrefix}`,
            description: opts.summary,
            metadata: opts.details,
          },
        });
      } catch (err) {
        console.error("[security-account-actions] journal activity failed", activityKey, err);
      }
      try {
        await writeAccountJournal(admin, {
          targetTable: "client_internal_notes",
          eventKey: noteKey,
          actor: journalActor,
          payload: {
            client_user_id: clientId,
            note_type: "security",
            content: opts.summary,
            metadata: opts.details,
          },
        });
      } catch (err) {
        console.error("[security-account-actions] journal note failed", noteKey, err);
      }
    };

    let response: Record<string, unknown> = { ok: true };

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
        await writeClientJournal({
          eventPrefix: "session_revoked",
          businessId: body.session_id,
          summary: `Session ${body.session_id.slice(0, 8)} révoquée par ${actorEmail ?? "staff"}`,
          details: { session_id: body.session_id, reason: body.reason ?? null },
        });
        response = { ok: true };
        break;
      }

      case "clear_security_lock": {
        const { data: secRow, error } = await admin
          .from("customer_security")
          .update({ pin_attempts: 0, lock_until: null, updated_at: new Date().toISOString() })
          .eq("customer_id", clientId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        await logAudit("clear_lock", { reason: body.reason });
        await writeClientJournal({
          eventPrefix: "security_lock_cleared",
          businessId: secRow?.id ?? clientId,
          summary: `Verrouillage sécurité levé par ${actorEmail ?? "staff"}`,
          details: { customer_security_id: secRow?.id ?? null, reason: body.reason ?? null },
        });
        response = { ok: true };
        break;
      }

      case "invalidate_login_pins": {
        const { error } = await admin
          .from("client_login_pins")
          .update({ used: true })
          .eq("user_id", clientId)
          .eq("used", false);
        if (error) throw error;
        await logAudit("invalidate_pins", { reason: body.reason });
        await writeClientJournal({
          eventPrefix: "login_pins_invalidated",
          businessId: isoMinuteBucket36(),
          summary: `PINs de connexion invalidés par ${actorEmail ?? "staff"}`,
          details: { reason: body.reason ?? null },
        });
        response = { ok: true };
        break;
      }

      case "force_signout_all": {
        if (!isAdmin) return json({ error: "admin role required" }, 403);
        const { error } = await admin.auth.admin.signOut(clientId, "global" as any);
        if (error && !String(error.message).toLowerCase().includes("user not found")) {
          throw error;
        }
        await logAudit("force_signout", { reason: body.reason });
        await writeClientJournal({
          eventPrefix: "force_signout_all",
          businessId: isoMinuteBucket36(),
          summary: `Déconnexion globale forcée par ${actorEmail ?? "admin"}`,
          details: { reason: body.reason ?? null },
        });
        response = { ok: true };
        break;
      }
    }

    // Persist idempotent response
    if (isMutation && idempotencyKey) {
      await admin
        .from("security_action_idempotency")
        .update({ response })
        .eq("idempotency_key", idempotencyKey);
    }

    return json(response);
  } catch (e) {
    console.error("security-account-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
