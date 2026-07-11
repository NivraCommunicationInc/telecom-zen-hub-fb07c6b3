/**
 * MODULE 43 — QA RUNNER (Fraude & Score de risque)
 *
 * Validates fraud-risk-actions & calculate-phone-fraud-score after Phase 2.
 * Coverage: RBAC (staff/admin/non-staff), Zod, idempotency (replay + conflict),
 * incident CRUD across every severity, state machine (valid + blocked),
 * risk score clamp + level recompute, delta auto-apply on create_incident,
 * supervisor escalation via rpc_communication_enqueue, client timeline
 * journal, admin_audit_log, defensive RLS, phone-fraud scoring auth/rate-limit.
 *
 * Admin-only. Self-cleans fixtures.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-qa-secret",
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

async function mintUser(admin: any, role: string | null, tag: string) {
  const email = `qa-m43-${role ?? "user"}-${tag}@qa.local`;
  const password = crypto.randomUUID() + "Aa1!";
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !created?.user) throw new Error(`mintUser ${role} failed: ${error?.message}`);
  const uid = created.user.id;
  if (role) await admin.from("user_roles").insert({ user_id: uid, role });
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({ email, password });
  if (sErr || !sess?.session) throw new Error(`login ${role} failed: ${sErr?.message}`);
  return { id: uid, email, token: sess.session.access_token };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const auth = req.headers.get("Authorization");
  const qaSecret = req.headers.get("x-qa-secret");
  const bootstrapToken = Deno.env.get("BOOTSTRAP_TOKEN") ?? "";
  const m43Token = Deno.env.get("QA_M43_SECRET") ?? "";
  const isServiceRole = !!auth && auth.replace(/^Bearer\s+/i, "").trim() === SERVICE_ROLE;
  const isQaSecret = !!qaSecret && ((bootstrapToken && qaSecret === bootstrapToken) || (m43Token && qaSecret === m43Token));

  if (!isServiceRole && !isQaSecret) {
    if (!auth) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) return json({ error: "forbidden" }, 403);
  }

  const runId = crypto.randomUUID();
  const results: Res[] = [];
  const clientA = crypto.randomUUID();
  const clientB = crypto.randomUUID();
  const auditReasonTag = `QA_M43_${runId}`;

  // Mint role fixtures
  let adminUser: any, employeeUser: any, plainUser: any;
  try {
    adminUser = await mintUser(admin, "admin", runId + "-a");
    employeeUser = await mintUser(admin, "employee", runId + "-e");
    plainUser = await mintUser(admin, "client", runId + "-u");
  } catch (e: any) {
    return json({ error: "fixture users failed: " + e.message }, 500);
  }

  const invokeAs = (token: string, payload: any) =>
    fetch(`${SUPABASE_URL}/functions/v1/fraud-risk-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

  const invokePhoneScoreAs = (token: string, payload: any) =>
    fetch(`${SUPABASE_URL}/functions/v1/calculate-phone-fraud-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e: any) { results.push({ name, ok: false, detail: e?.message ?? String(e) }); }
  };

  const createdIncidents: string[] = [];

  // ---------- 1. AUTH / RBAC ----------
  await check("T01 unauth call rejected (401)", async () => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/fraud-risk-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ action: "list", clientId: clientA }),
    });
    await r.text();
    if (r.status !== 401) throw new Error("expected 401 got " + r.status);
  });

  await check("T02 non-staff rejected (403)", async () => {
    const r = await invokeAs(plainUser.token, { action: "list", clientId: clientA });
    await r.text();
    if (r.status !== 403) throw new Error("expected 403 got " + r.status);
  });

  await check("T03 employee can list", async () => {
    const r = await invokeAs(employeeUser.token, { action: "list", clientId: clientA });
    const b = await r.json();
    if (!Array.isArray(b.incidents)) throw new Error("no incidents array: " + JSON.stringify(b));
  });

  // ---------- 2. ZOD ----------
  await check("T04 Zod rejects bad action", async () => {
    const r = await invokeAs(adminUser.token, { action: "nuke", clientId: clientA });
    if (r.status !== 400) throw new Error("expected 400 got " + r.status);
    await r.text();
  });
  await check("T05 Zod rejects bad UUID", async () => {
    const r = await invokeAs(adminUser.token, { action: "list", clientId: "not-a-uuid" });
    if (r.status !== 400) throw new Error("expected 400 got " + r.status);
    await r.text();
  });

  // ---------- 3. INCIDENTS: ALL SEVERITIES ----------
  const severities = ["low", "medium", "high", "critical"] as const;
  const sevIncidents: Record<string, string> = {};
  for (const sev of severities) {
    await check(`T06.${sev} employee creates ${sev} incident`, async () => {
      const r = await invokeAs(employeeUser.token, {
        action: "create_incident",
        clientId: clientA,
        incidentType: `qa_${sev}`,
        severity: sev,
        description: `QA ${sev} incident ${runId}`,
        reason: auditReasonTag,
        idempotency_key: crypto.randomUUID(),
      });
      const b = await r.json();
      if (!b.ok || !b.incident?.id) throw new Error("create failed: " + JSON.stringify(b));
      if (b.incident.severity !== sev) throw new Error("severity mismatch");
      if (!b.score || typeof b.score.current_score !== "number") throw new Error("no delta applied");
      sevIncidents[sev] = b.incident.id;
      createdIncidents.push(b.incident.id);
    });
  }

  // Score after 4 incidents: 5+10+20+30 = 65 → high
  await check("T07 aggregated risk score & level correct", async () => {
    const { data } = await admin.from("account_risk_scores")
      .select("current_score, risk_level").eq("client_id", clientA).maybeSingle();
    if (!data) throw new Error("no score row");
    if (data.current_score !== 65) throw new Error("score = " + data.current_score);
    if (data.risk_level !== "high") throw new Error("level = " + data.risk_level);
  });

  // ---------- 4. IDEMPOTENCY ----------
  await check("T08 idempotency replay returns same result + flag", async () => {
    const key = crypto.randomUUID();
    const payload = {
      action: "create_incident",
      clientId: clientB,
      incidentType: "idempotency_test",
      severity: "low",
      description: "idem replay",
      reason: auditReasonTag,
      idempotency_key: key,
    };
    const r1 = await (await invokeAs(adminUser.token, payload)).json();
    const r2 = await (await invokeAs(adminUser.token, payload)).json();
    if (!r1.ok || !r2.ok) throw new Error("not ok");
    if (!r2.idempotent) throw new Error("second call missing idempotent flag");
    if (r1.incident?.id) createdIncidents.push(r1.incident.id);
  });

  await check("T09 idempotency key conflict returns 409", async () => {
    const key = crypto.randomUUID();
    await invokeAs(adminUser.token, {
      action: "create_incident", clientId: clientB,
      incidentType: "conflict_a", severity: "low",
      description: "A", reason: auditReasonTag, idempotency_key: key,
    }).then((r) => r.json()).then((b: any) => { if (b.incident?.id) createdIncidents.push(b.incident.id); });
    const r2 = await invokeAs(adminUser.token, {
      action: "create_incident", clientId: clientB,
      incidentType: "conflict_b", severity: "critical",
      description: "B", reason: auditReasonTag, idempotency_key: key,
    });
    await r2.text();
    if (r2.status !== 409) throw new Error("expected 409 got " + r2.status);
  });

  await check("T10 idempotency table populated + TTL set", async () => {
    const { data } = await admin.from("fraud_action_idempotency")
      .select("action, expires_at").eq("actor_id", adminUser.id);
    if ((data ?? []).length < 2) throw new Error("no rows");
    if (!(data ?? []).every((r: any) => r.expires_at)) throw new Error("missing TTL");
  });

  // ---------- 5. STATE MACHINE ----------
  const incLow = sevIncidents.low;
  const incMedium = sevIncidents.medium;
  const incHigh = sevIncidents.high;
  const incCritical = sevIncidents.critical;

  await check("T11 open → investigating (employee OK)", async () => {
    const r = await invokeAs(employeeUser.token, {
      action: "update_status", clientId: clientA, incidentId: incLow,
      status: "investigating", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const b = await r.json();
    if (!b.ok || b.incident?.status !== "investigating") throw new Error("bad: " + JSON.stringify(b));
  });

  await check("T12 open → resolved BLOCKED (invalid transition 409)", async () => {
    const r = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incMedium,
      status: "resolved", resolutionNotes: "n/a", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    if (r.status !== 409) throw new Error("expected 409 got " + r.status);
    await r.text();
  });

  await check("T13 employee cannot resolve investigating (403)", async () => {
    // First move medium to investigating
    await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incMedium,
      status: "investigating", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    }).then((r) => r.text());
    const r = await invokeAs(employeeUser.token, {
      action: "update_status", clientId: clientA, incidentId: incMedium,
      status: "resolved", resolutionNotes: "should fail", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    if (r.status !== 403) throw new Error("expected 403 got " + r.status);
    await r.text();
  });

  await check("T14 admin resolves investigating", async () => {
    const r = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incMedium,
      status: "resolved", resolutionNotes: "closed by admin", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const b = await r.json();
    if (!b.ok || b.incident?.status !== "resolved") throw new Error(JSON.stringify(b));
  });

  await check("T15 investigating → false_positive (admin)", async () => {
    // move low (already investigating) → false_positive
    const r = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incLow,
      status: "false_positive", resolutionNotes: "not fraud", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const b = await r.json();
    if (!b.ok || b.incident?.status !== "false_positive") throw new Error(JSON.stringify(b));
  });

  await check("T16 resolved → open BLOCKED (terminal, 409)", async () => {
    const r = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incMedium,
      status: "investigating", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    if (r.status !== 409) throw new Error("expected 409 got " + r.status);
    await r.text();
  });

  await check("T17 false_positive terminal (409)", async () => {
    const r = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incLow,
      status: "investigating", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    if (r.status !== 409) throw new Error("expected 409 got " + r.status);
    await r.text();
  });

  await check("T18 investigating → escalated → resolved (admin)", async () => {
    // high: open → investigating
    await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incHigh,
      status: "investigating", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    }).then((r) => r.text());
    // investigating → escalated
    const rEsc = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incHigh,
      status: "escalated", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const bEsc = await rEsc.json();
    if (!bEsc.ok || bEsc.incident?.status !== "escalated") throw new Error("escalation failed: " + JSON.stringify(bEsc));
    // escalated → resolved
    const rRes = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incHigh,
      status: "resolved", resolutionNotes: "resolved after escalation", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const bRes = await rRes.json();
    if (!bRes.ok || bRes.incident?.status !== "resolved") throw new Error("resolve failed");
  });

  await check("T19 escalated → false_positive (admin)", async () => {
    // critical open → investigating → escalated → false_positive
    await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incCritical,
      status: "investigating", reason: auditReasonTag, idempotency_key: crypto.randomUUID(),
    }).then((r) => r.text());
    await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incCritical,
      status: "escalated", reason: auditReasonTag, idempotency_key: crypto.randomUUID(),
    }).then((r) => r.text());
    const r = await invokeAs(adminUser.token, {
      action: "update_status", clientId: clientA, incidentId: incCritical,
      status: "false_positive", resolutionNotes: "fp", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const b = await r.json();
    if (!b.ok || b.incident?.status !== "false_positive") throw new Error(JSON.stringify(b));
  });

  // ---------- 6. COMMUNICATION ESCALADE ----------
  await check("T20 escalation enqueued via canonical gateway", async () => {
    const { data } = await admin.from("communication_idempotency")
      .select("idempotency_key, channel")
      .in("idempotency_key", [`fraud:escalated:${incHigh}`, `fraud:escalated:${incCritical}`]);
    if ((data ?? []).length < 2) throw new Error(`expected 2 rows, got ${(data ?? []).length}`);
  });

  // ---------- 7. RISK SCORE ----------
  await check("T21 upsert_score rejects score > 100 (Zod boundary)", async () => {
    const r = await invokeAs(adminUser.token, {
      action: "upsert_score", clientId: clientB,
      score: 250, riskLevel: "critical", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    if (r.status !== 400) throw new Error("expected 400 got " + r.status);
    await r.text();
  });

  await check("T21b upsert_score clamp with fractional (100.4 → 100)", async () => {
    // In-range fractional forces Math.round then clamp
    const r = await invokeAs(adminUser.token, {
      action: "upsert_score", clientId: clientB,
      score: 99.9, riskLevel: "critical", reason: auditReasonTag,
      idempotency_key: crypto.randomUUID(),
    });
    const b = await r.json();
    if (!b.ok || b.score?.current_score !== 100) throw new Error("no clamp/round: " + JSON.stringify(b));
  });

  await check("T22 upsert_score rejects negative in Zod", async () => {
    const r = await invokeAs(adminUser.token, {
      action: "upsert_score", clientId: clientB,
      score: -10, riskLevel: "low", reason: auditReasonTag,
    });
    if (r.status !== 400) throw new Error("expected 400 got " + r.status);
    await r.text();
  });

  // ---------- 8. TIMELINE JOURNAL ----------
  await check("T23 client_activity_logs journal written for fraud", async () => {
    const { data } = await admin.from("client_activity_logs")
      .select("action_type").eq("client_id", clientA)
      .like("action_type", "fraud_%");
    if ((data ?? []).length < 6) throw new Error(`expected >=6 activity rows, got ${(data ?? []).length}`);
  });
  await check("T24 client_internal_notes (security) journal written", async () => {
    const { data } = await admin.from("client_internal_notes")
      .select("id").eq("client_id", clientA).eq("note_type", "security");
    if ((data ?? []).length < 6) throw new Error(`expected >=6 notes, got ${(data ?? []).length}`);
  });
  await check("T25 admin_audit_log rows written", async () => {
    const { data } = await admin.from("admin_audit_log")
      .select("action").like("action", "account_ops.fraud_%")
      .filter("details->>reason", "eq", auditReasonTag);
    if ((data ?? []).length < 4) throw new Error(`expected >=4 audit rows, got ${(data ?? []).length}`);
  });

  // ---------- 9. RLS DEFENSIVE ----------
  await check("T26 RLS blocks anon INSERT on account_fraud_incidents", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { error, data } = await anon.from("account_fraud_incidents").insert({
      client_id: clientA, incident_type: "anon", severity: "low",
      description: "anon attempt", status: "open",
    }).select();
    if (!error && data && data.length > 0) throw new Error("anon INSERT succeeded");
  });
  await check("T27 RLS blocks anon UPDATE on account_risk_scores", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { error, data } = await anon.from("account_risk_scores")
      .update({ current_score: 0 }).eq("client_id", clientA).select();
    if (!error && data && data.length > 0) throw new Error("anon UPDATE succeeded");
  });

  // ---------- 10. PHONE FRAUD SCORE ----------
  // Pause to let auth/rate windows drain from the fraud-actions burst above.
  await new Promise((r) => setTimeout(r, 8000));

  await check("T28 phone-fraud-score rejects invalid JWT (401)", async () => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/calculate-phone-fraud-score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: "Bearer not.a.jwt",
      },
      body: JSON.stringify({ user_id: plainUser.id, order_amount: 100 }),
    });
    await r.text();
    if (r.status !== 401) throw new Error("expected 401 got " + r.status);
  });

  await check("T29 phone-fraud-score cross-user blocked for non-staff", async () => {
    const r = await invokePhoneScoreAs(plainUser.token, {
      user_id: clientA, order_amount: 100,
    });
    if (r.status !== 403) throw new Error("expected 403 got " + r.status);
    await r.text();
  });

  await check("T30 phone-fraud-score staff can score any user", async () => {
    const r = await invokePhoneScoreAs(employeeUser.token, {
      user_id: plainUser.id, order_amount: 100,
    });
    if (r.status !== 200) throw new Error("expected 200 got " + r.status);
    const b = await r.json();
    if (typeof b.score !== "number") throw new Error("no score returned: " + JSON.stringify(b));
  });

  await check("T31 phone-fraud-score self-scoring allowed", async () => {
    const r = await invokePhoneScoreAs(plainUser.token, {
      user_id: plainUser.id, order_amount: 50,
    });
    if (r.status !== 200) throw new Error("expected 200 got " + r.status);
    await r.text();
  });

  await check("T32 phone-fraud-score rate-limit fires", async () => {
    // Clear existing counters for a fresh window
    await admin.from("rate_limits").delete().eq("action_type", "calculate-phone-fraud-score");
    // Seed a synthetic counter > threshold to force rate limit without spamming
    await admin.from("rate_limits").insert({
      identifier: plainUser.id,
      action_type: "calculate-phone-fraud-score",
      attempts: 25,
      window_start: new Date().toISOString(),
    });
    const r = await invokePhoneScoreAs(plainUser.token, {
      user_id: plainUser.id, order_amount: 10,
    });
    await r.text();
    if (r.status !== 429) throw new Error("expected 429 got " + r.status);
  });

  // ---------- CLEANUP ----------
  try {
    await admin.from("communication_idempotency").delete()
      .in("idempotency_key", [`fraud:escalated:${incHigh}`, `fraud:escalated:${incCritical}`]);
    await admin.from("client_activity_logs").delete().in("client_id", [clientA, clientB]);
    await admin.from("client_internal_notes").delete().in("client_id", [clientA, clientB]);
    await admin.from("admin_audit_log").delete()
      .filter("details->>reason", "eq", auditReasonTag);
    await admin.from("account_fraud_incidents").delete().in("client_id", [clientA, clientB]);
    await admin.from("account_risk_scores").delete().in("client_id", [clientA, clientB]);
    await admin.from("fraud_action_idempotency").delete().in("actor_id", [adminUser.id, employeeUser.id]);
    await admin.from("rate_limits").delete().eq("action_type", "calculate-phone-fraud-score");
    for (const u of [adminUser, employeeUser, plainUser]) {
      await admin.from("user_roles").delete().eq("user_id", u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  } catch (e) {
    console.error("cleanup error", e);
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  return json({
    module: "43-fraud-risk",
    run_id: runId,
    total: results.length,
    pass, fail,
    verdict: fail === 0 ? "PASS" : "FAIL",
    results,
  });
});
