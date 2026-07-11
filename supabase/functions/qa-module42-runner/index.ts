/**
 * MODULE 42 — QA RUNNER (Sessions & Devices)
 *
 * Validates security-account-actions after Phase 2 stabilization:
 * Zod validation, idempotency, RBAC, audit, client journal, and
 * defensive RLS. Admin-only. Self-cleans its fixtures.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Res = { name: string; ok: boolean; detail?: unknown };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized" }, 401);
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const isServiceRole = bearer === SERVICE_ROLE;
  let actor: { id: string; email?: string } | null = null;
  if (isServiceRole) {
    actor = { id: "00000000-0000-0000-0000-000000000000", email: "qa-runner@service" };
  } else {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    actor = { id: userData.user.id, email: userData.user.email };
  }

  const runId = crypto.randomUUID();
  const results: Res[] = [];
  const fakeClientA = crypto.randomUUID();
  const fakeClientB = crypto.randomUUID();

  const cleanup: { table: string; column: string; value: string }[] = [];
  const auditReasonTag = `QA_M42_${runId}`;

  const invoke = (payload: any) =>
    fetch(`${SUPABASE_URL}/functions/v1/security-account-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(payload),
    });

  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e: any) { results.push({ name, ok: false, detail: e?.message ?? String(e) }); }
  };

  // ---------- Fixtures ----------
  const sessionA = crypto.randomUUID();
  const sessionB = crypto.randomUUID();
  await admin.from("customer_access_sessions").insert([
    { id: sessionA, customer_id: fakeClientA, employee_id: actor.id, ip_address: "127.0.0.1", user_agent: `qa-${runId}` },
    { id: sessionB, customer_id: fakeClientB, employee_id: actor.id, ip_address: "127.0.0.1", user_agent: `qa-${runId}` },
  ]);
  cleanup.push({ table: "customer_access_sessions", column: "user_agent", value: `qa-${runId}` });

  const secId = crypto.randomUUID();
  await admin.from("customer_security").insert({
    id: secId, customer_id: fakeClientA, pin_attempts: 5,
    lock_until: new Date(Date.now() + 3600_000).toISOString(),
  });
  cleanup.push({ table: "customer_security", column: "id", value: secId });

  const pinId = crypto.randomUUID();
  await admin.from("client_login_pins").insert({
    id: pinId, user_id: fakeClientA, email: `qa-${runId}@example.com`,
    pin_hash: "00", used: false,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
  });
  cleanup.push({ table: "client_login_pins", column: "id", value: pinId });

  // ---------- Tests ----------

  // T01 auth required
  await check("T01 unauthenticated request rejected", async () => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/security-account-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ action: "list_overview", client_user_id: fakeClientA }),
    });
    await r.text();
    if (r.status !== 401) throw new Error("expected 401 got " + r.status);
  });

  // T02 Zod validation
  await check("T02 Zod rejects invalid action", async () => {
    const r = await invoke({ action: "nuke", client_user_id: fakeClientA });
    if (r.status !== 400) throw new Error("expected 400 got " + r.status);
    await r.text();
  });
  await check("T03 Zod rejects bad UUID", async () => {
    const r = await invoke({ action: "list_overview", client_user_id: "not-a-uuid" });
    if (r.status !== 400) throw new Error("expected 400 got " + r.status);
    await r.text();
  });

  // T04 list_overview OK
  await check("T04 list_overview returns aggregated payload", async () => {
    const r = await invoke({ action: "list_overview", client_user_id: fakeClientA });
    const b = await r.json();
    if (!b.ok) throw new Error("not ok: " + JSON.stringify(b));
    if (!Array.isArray(b.access_sessions)) throw new Error("missing access_sessions");
  });

  // T05 revoke_access_session — correct client
  await check("T05 revoke_access_session succeeds for own client", async () => {
    const r = await invoke({
      action: "revoke_access_session", client_user_id: fakeClientA,
      session_id: sessionA, reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const b = await r.json();
    if (!b.ok) throw new Error("not ok: " + JSON.stringify(b));
    const { data } = await admin.from("customer_access_sessions")
      .select("revoked_at").eq("id", sessionA).maybeSingle();
    if (!data?.revoked_at) throw new Error("session A not revoked");
  });

  // T06 cross-client rejected (no row updated)
  await check("T06 revoke on wrong client leaves session intact", async () => {
    await invoke({
      action: "revoke_access_session", client_user_id: fakeClientA,
      session_id: sessionB, reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    }).then((r) => r.text());
    const { data } = await admin.from("customer_access_sessions")
      .select("revoked_at").eq("id", sessionB).maybeSingle();
    if (data?.revoked_at) throw new Error("session B was wrongly revoked");
  });

  // T07 idempotency replay
  await check("T07 idempotency replay returns same result", async () => {
    const key = crypto.randomUUID();
    const payload = {
      action: "clear_security_lock", client_user_id: fakeClientA,
      reason: auditReasonTag, idempotency_key: key,
    };
    const r1 = await (await invoke(payload)).json();
    const r2 = await (await invoke(payload)).json();
    if (!r1.ok || !r2.ok) throw new Error("not ok");
    if (!r2.idempotent) throw new Error("second call missing idempotent flag");
  });

  // T08 idempotency conflict
  await check("T08 idempotency key conflict returns 409", async () => {
    const key = crypto.randomUUID();
    await invoke({
      action: "revoke_access_session", client_user_id: fakeClientA,
      session_id: sessionA, reason: auditReasonTag, idempotency_key: key,
    }).then((r) => r.text());
    const r2 = await invoke({
      action: "revoke_access_session", client_user_id: fakeClientA,
      session_id: sessionB, reason: auditReasonTag, idempotency_key: key,
    });
    await r2.text();
    if (r2.status !== 409) throw new Error("expected 409 got " + r2.status);
  });

  // T09 clear_security_lock actually cleared row
  await check("T09 clear_security_lock cleared lock_until", async () => {
    const { data } = await admin.from("customer_security")
      .select("lock_until, pin_attempts").eq("id", secId).maybeSingle();
    if (data?.lock_until) throw new Error("lock_until still set");
    if ((data?.pin_attempts ?? -1) !== 0) throw new Error("pin_attempts not reset");
  });

  // T10 invalidate_login_pins
  await check("T10 invalidate_login_pins marks pins used", async () => {
    await invoke({
      action: "invalidate_login_pins", client_user_id: fakeClientA,
      reason: auditReasonTag, idempotency_key: crypto.randomUUID(),
    }).then((r) => r.text());
    const { data } = await admin.from("client_login_pins")
      .select("used").eq("id", pinId).maybeSingle();
    if (!data?.used) throw new Error("pin not marked used");
  });

  // T11 force_signout_all admin OK
  await check("T11 force_signout_all admin OK", async () => {
    const r = await invoke({
      action: "force_signout_all", client_user_id: fakeClientA,
      reason: auditReasonTag, idempotency_key: crypto.randomUUID(),
    });
    const b = await r.json();
    if (!b.ok) throw new Error("not ok: " + JSON.stringify(b));
  });

  // T12 admin_audit_log unchanged (rows present)
  await check("T12 admin_audit_log rows written", async () => {
    const { data } = await admin.from("admin_audit_log")
      .select("action, details")
      .eq("admin_user_id", actor.id)
      .like("action", "account_ops.security_%")
      .order("created_at", { ascending: false }).limit(50);
    const forRun = (data ?? []).filter((r: any) => r?.details?.reason === auditReasonTag);
    if (forRun.length < 4) throw new Error(`expected >=4 audit rows, got ${forRun.length}`);
  });

  // T13 client journal (activity + notes) written
  await check("T13 client_activity_logs journal written", async () => {
    const { data } = await admin.from("client_activity_logs")
      .select("activity_type, metadata")
      .eq("client_user_id", fakeClientA)
      .like("activity_type", "security_%");
    if ((data ?? []).length < 3) throw new Error(`expected >=3 activity rows, got ${(data ?? []).length}`);
  });
  await check("T14 client_internal_notes journal written", async () => {
    const { data } = await admin.from("client_internal_notes")
      .select("id, note_type, metadata")
      .eq("client_user_id", fakeClientA)
      .eq("note_type", "security");
    if ((data ?? []).length < 3) throw new Error(`expected >=3 notes, got ${(data ?? []).length}`);
  });

  // T15 event keys deterministic (idempotent replay does not duplicate journal)
  await check("T15 journal idempotency: no duplicate for same event_key", async () => {
    const { data } = await admin.from("client_activity_logs")
      .select("activity_type").eq("client_user_id", fakeClientA);
    const revokeRows = (data ?? []).filter((r: any) => r.activity_type === "security_session_revoked");
    if (revokeRows.length > 1) throw new Error(`duplicate journal rows for session revoke: ${revokeRows.length}`);
  });

  // T16 RLS blocks anonymous UPDATE on customer_access_sessions
  await check("T16 RLS blocks anon UPDATE on customer_access_sessions", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { error, data } = await anon.from("customer_access_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionB).select();
    if (!error && data && data.length > 0) throw new Error("anon UPDATE succeeded");
  });

  // T17 RLS blocks anon UPDATE on customer_security
  await check("T17 RLS blocks anon UPDATE on customer_security", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { error, data } = await anon.from("customer_security")
      .update({ pin_attempts: 99 }).eq("id", secId).select();
    if (!error && data && data.length > 0) throw new Error("anon UPDATE succeeded");
  });

  // T18 idempotency table populated
  await check("T18 security_action_idempotency rows recorded", async () => {
    const { data } = await admin.from("security_action_idempotency")
      .select("action, actor_id").eq("actor_id", actor.id)
      .order("created_at", { ascending: false }).limit(20);
    if ((data ?? []).length < 4) throw new Error(`expected >=4 idempotency rows, got ${(data ?? []).length}`);
  });

  // ---------- Cleanup ----------
  try {
    await admin.from("client_activity_logs").delete().eq("client_user_id", fakeClientA);
    await admin.from("client_internal_notes").delete().eq("client_user_id", fakeClientA);
    await admin.from("client_login_pins").delete().eq("id", pinId);
    await admin.from("customer_security").delete().eq("id", secId);
    await admin.from("customer_access_sessions").delete().eq("user_agent", `qa-${runId}`);
    await admin.from("admin_audit_log").delete()
      .eq("admin_user_id", actor.id)
      .like("action", "account_ops.security_%")
      .filter("details->>reason", "eq", auditReasonTag);
    await admin.from("security_action_idempotency").delete()
      .eq("actor_id", actor.id).lt("created_at", new Date(Date.now() + 60_000).toISOString());
  } catch (e) {
    console.error("cleanup error", e);
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  return json({
    module: "42-sessions-devices",
    run_id: runId,
    total: results.length,
    pass, fail,
    verdict: fail === 0 ? "PASS" : "FAIL",
    results,
  });
});
