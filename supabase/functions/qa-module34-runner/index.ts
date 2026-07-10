// ============================================================================
// qa-module34-runner — Module 34 « Bon de compensation »
// Phase 1: happy paths | Phase 2: idempotence, caps, RBAC, expiration, revoke
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = Deno.env.get("SUPABASE_URL")!;
  const results: any[] = [];
  const push = (id: string, ok: boolean, note = "") => results.push({ id, ok, note });

  // ---- Setup QA account & user -----------------------------------------------
  const runId = crypto.randomUUID();
  const email = `qa-m34-${Date.now()}@qa.test`;
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email, password: crypto.randomUUID(), email_confirm: true,
    user_metadata: { qa: true, module: 34, run_id: runId },
  });
  if (userErr) return json({ ok: false, stage: "create_user", error: userErr.message }, 500);
  const clientId = userData.user!.id;

  await admin.from("profiles").upsert({ user_id: clientId, email, full_name: "QA M34", account_type: "client" }, { onConflict: "user_id" });
  await admin.from("user_roles").insert({ user_id: clientId, role: "client", status: "active" }).select().maybeSingle();

  const { data: acc } = await admin.from("accounts").insert({
    client_id: clientId,
    account_number: `QA-M34-${Date.now()}`,
    status: "active",
    billing_anchor_day: 1,
  }).select("id").maybeSingle();
  const accountId = acc!.id;

  // Grant admin role to a synthetic operator that will call the edge fn
  const opEmail = `qa-m34-op-${Date.now()}@qa.test`;
  const opPass = crypto.randomUUID();
  const { data: opData } = await admin.auth.admin.createUser({
    email: opEmail, password: opPass, email_confirm: true,
    user_metadata: { qa: true, module: 34, run_id: runId, role: "admin" },
  });
  const opId = opData!.user!.id;
  await admin.from("profiles").upsert({ user_id: opId, email: opEmail, full_name: "QA M34 Admin", account_type: "employee" }, { onConflict: "user_id" });
  await admin.from("user_roles").insert({ user_id: opId, role: "admin", status: "active" });

  // Sign operator in
  const anonClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: sess } = await anonClient.auth.signInWithPassword({ email: opEmail, password: opPass });
  const jwt = sess?.session?.access_token;
  if (!jwt) return json({ ok: false, stage: "operator_login" }, 500);

  const invoke = (fn: string, body: any) =>
    fetch(`${url}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body),
    });

  // ================== PHASE 1 ==================
  // C1 — direct DB insert must fail
  {
    const { error } = await admin.from("account_adjustments").insert({
      account_id: accountId, type: "credit", amount: 10, description: "direct write test",
      months_total: 1, months_remaining: 1, applied_count: 0, status: "active",
      idempotency_key: "direct-write-" + crypto.randomUUID(),
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      metadata: { compensation: { category: "goodwill" } },
    });
    push("C1_direct_write_blocked", !!error && String(error.message).includes("forbidden"),
      error ? error.message : "no error");
  }

  // C2 — issue valid $25
  const idem1 = "qa-m34-c2-" + crypto.randomUUID();
  {
    const r = await invoke("core-issue-compensation", {
      account_id: accountId, client_id: clientId, preset: "amount", amount: 25,
      category: "service_issue", idempotency_key: idem1,
      __audit_reason: "QA compensation test",
    });
    const j = await r.json();
    push("C2_issue_25", r.ok && j.ok === true, JSON.stringify(j).slice(0, 200));
  }

  // C3 — idempotence: same key returns same id
  {
    const r = await invoke("core-issue-compensation", {
      account_id: accountId, client_id: clientId, preset: "amount", amount: 25,
      category: "service_issue", idempotency_key: idem1,
      __audit_reason: "QA compensation test retry",
    });
    const j = await r.json();
    push("C3_idempotent_retry", r.ok && j.idempotent === true, JSON.stringify(j).slice(0, 200));
  }

  // C4 — month_free computes server-side
  {
    const r = await invoke("core-issue-compensation", {
      account_id: accountId, client_id: clientId, preset: "month_free",
      category: "retention", idempotency_key: "qa-m34-c4-" + crypto.randomUUID(),
      __audit_reason: "QA month free",
    });
    const j = await r.json();
    push("C4_month_free_server_calc", r.ok && j.amount_source?.startsWith("fallback") || j.amount_source === "active_subscriptions",
      `amount=${j.amount} src=${j.amount_source}`);
  }

  // C5 — cap enforcement (>500 blocked for admin cap)
  {
    const r = await invoke("core-issue-compensation", {
      account_id: accountId, client_id: clientId, preset: "amount", amount: 999,
      category: "goodwill", idempotency_key: "qa-m34-c5-" + crypto.randomUUID(),
      __audit_reason: "QA cap test",
    });
    push("C5_cap_enforced", r.status === 403, `status=${r.status}`);
  }

  // C6 — missing category rejected
  {
    const r = await invoke("core-issue-compensation", {
      account_id: accountId, client_id: clientId, preset: "amount", amount: 10,
      idempotency_key: "qa-m34-c6-" + crypto.randomUUID(),
      __audit_reason: "QA no category",
    });
    push("C6_missing_category_rejected", r.status === 400);
  }

  // C7 — self-attribution blocked
  {
    // sign in as client
    const { data: clientPassData } = await admin.auth.admin.updateUserById(clientId, { password: "QaTest1234!" });
    const clientLogin = await anonClient.auth.signInWithPassword({ email, password: "QaTest1234!" });
    const clientJwt = clientLogin.data?.session?.access_token;
    if (clientJwt) {
      // Give client admin role temporarily to isolate self-attribution guard
      await admin.from("user_roles").insert({ user_id: clientId, role: "admin", status: "active" });
      const r = await fetch(`${url}/functions/v1/core-issue-compensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${clientJwt}` },
        body: JSON.stringify({
          account_id: accountId, client_id: clientId, preset: "amount", amount: 5,
          category: "goodwill", idempotency_key: "qa-m34-c7-" + crypto.randomUUID(),
          __audit_reason: "QA self attribution",
        }),
      });
      const j = await r.json();
      push("C7_self_attribution_blocked", r.status === 403 && String(j.error).includes("self_attribution"),
        JSON.stringify(j).slice(0, 200));
    } else push("C7_self_attribution_blocked", false, "client login failed");
  }

  // C8 — expiration: create with 1-day expiry, backdate, run cron
  {
    const idem = "qa-m34-c8-" + crypto.randomUUID();
    const r = await invoke("core-issue-compensation", {
      account_id: accountId, client_id: clientId, preset: "amount", amount: 5,
      category: "goodwill", idempotency_key: idem, expires_in_days: 1,
      __audit_reason: "QA expire",
    });
    const j = await r.json();
    if (r.ok && j.id) {
      await admin.from("account_adjustments").update({ expires_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", j.id);
      const { data: expRes } = await admin.rpc("cron_expire_compensations");
      const { data: after } = await admin.from("account_adjustments").select("status").eq("id", j.id).maybeSingle();
      push("C8_auto_expiration", after?.status === "expired", `status=${after?.status}`);
    } else push("C8_auto_expiration", false, "issue failed");
  }

  // C9 — revoke via transition RPC
  {
    const { data: active } = await admin.from("account_adjustments")
      .select("id").eq("account_id", accountId).eq("status", "active").limit(1).maybeSingle();
    if (active) {
      const { data: transitioned, error: trErr } = await admin.rpc("compensation_transition", {
        _adjustment_id: active.id, _new_status: "revoked", _actor_id: opId, _reason: "QA revoke",
      });
      push("C9_revoke_transition", !trErr && (transitioned as any)?.status === "revoked", trErr?.message ?? "");
    } else push("C9_revoke_transition", false, "no active row");
  }

  // C10 — email queued
  {
    const { data: eq } = await admin.from("email_queue")
      .select("id, event_key").like("event_key", "compensation_voucher:%").eq("entity_type", "account_adjustments");
    const rowCount = (eq ?? []).filter((r: any) => r.event_key.startsWith("compensation_voucher:")).length;
    push("C10_email_queued", rowCount > 0, `count=${rowCount}`);
  }

  // C11 — audit log present
  {
    const { data: al } = await admin.from("admin_audit_log")
      .select("id").eq("action", "compensation_issued").eq("admin_user_id", opId);
    push("C11_admin_audit_log", (al ?? []).length > 0, `count=${(al ?? []).length}`);
  }

  // ---- Cleanup ---------------------------------------------------------------
  await admin.from("account_adjustments").delete().eq("account_id", accountId);
  await admin.from("client_activity_logs").delete().eq("client_id", clientId);
  await admin.from("client_internal_notes").delete().eq("client_id", clientId);
  await admin.from("email_queue").delete().eq("entity_id", accountId);
  await admin.from("accounts").delete().eq("id", accountId);
  await admin.from("user_roles").delete().eq("user_id", clientId);
  await admin.from("user_roles").delete().eq("user_id", opId);
  await admin.from("profiles").delete().eq("user_id", clientId);
  await admin.from("profiles").delete().eq("user_id", opId);
  await admin.auth.admin.deleteUser(clientId);
  await admin.auth.admin.deleteUser(opId);

  const pass = results.filter(r => r.ok).length;
  const total = results.length;
  return json({ ok: pass === total, pass, total, run_id: runId, results });
});
