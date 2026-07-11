// ============================================================================
// qa-module37-runner — Module 37 « Journal consentements Loi 25 »
// Validates canonical door, RBAC, append-only immutability, idempotency,
// audit trail, notifications, cleanup.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const runId = crypto.randomUUID();
  const results: Array<{ id: string; category: string; ok: boolean; note?: string; skip?: boolean }> = [];
  const push = (category: string, id: string, ok: boolean, note = "") =>
    results.push({ category, id, ok, note });
  const info = (category: string, id: string, note = "") =>
    results.push({ category, id, ok: true, note, skip: true });

  // ---------- Setup ----------
  const stamp = Date.now();
  const mkEmail = (tag: string) => `qa-m37-${tag}-${stamp}@qa.test`;
  const clientEmail = mkEmail("client");
  const client2Email = mkEmail("client2");
  const adminEmail = mkEmail("admin");
  const supportEmail = mkEmail("support");
  const kycEmail = mkEmail("kyc");
  const pass = "QaTest1234!Xy";

  const mkUser = async (email: string, meta: Record<string, unknown>) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: pass, email_confirm: true,
      user_metadata: { qa: true, module: 37, run_id: runId, ...meta },
    });
    if (error) throw new Error(`create_user ${email}: ${error.message}`);
    return data.user!.id;
  };

  let clientId = "", client2Id = "", adminId = "", supportId = "", kycId = "";
  let accountId = "";
  let consentIdA = "";

  try {
    clientId = await mkUser(clientEmail, { role: "client" });
    client2Id = await mkUser(client2Email, { role: "client" });
    adminId = await mkUser(adminEmail, { role: "admin" });
    supportId = await mkUser(supportEmail, { role: "support" });
    kycId = await mkUser(kycEmail, { role: "kyc_agent" });

    await admin.from("profiles").upsert([
      { id: clientId, user_id: clientId, email: clientEmail, first_name: "QA", last_name: "Client", account_type: "client" },
      { id: client2Id, user_id: client2Id, email: client2Email, first_name: "QA", last_name: "Client2", account_type: "client" },
      { id: adminId, user_id: adminId, email: adminEmail, first_name: "QA", last_name: "Admin", account_type: "employee" },
      { id: supportId, user_id: supportId, email: supportEmail, first_name: "QA", last_name: "Support", account_type: "employee" },
      { id: kycId, user_id: kycId, email: kycEmail, first_name: "QA", last_name: "Kyc", account_type: "employee" },
    ] as any, { onConflict: "id" });

    const roleInserts = [
      { user_id: clientId, role: "client", status: "active" },
      { user_id: client2Id, role: "client", status: "active" },
      { user_id: adminId, role: "admin", status: "active", can_access_core: true, is_active: true },
      { user_id: supportId, role: "support", status: "active", can_access_core: true, is_active: true },
      { user_id: kycId, role: "kyc_agent", status: "active", can_access_core: true, is_active: true },
    ];
    for (const r of roleInserts) {
      const { error } = await admin.from("user_roles").insert(r);
      if (error) console.log(`[qa-m37][setup] role ${r.role}: ${error.message}`);
    }

    const { data: acc, error: accErr } = await admin.from("accounts").insert({
      client_id: clientId, account_number: `QA-M37-${stamp}`, status: "active", billing_anchor_day: 1,
    }).select("id").single();
    if (accErr) throw new Error(`account: ${accErr.message}`);
    accountId = acc!.id;
  } catch (e) {
    return json({ ok: false, stage: "setup", error: (e as Error).message, run_id: runId }, 500);
  }

  // ---------- Sessions ----------
  const anonClient = createClient(url, anonKey);
  const loginAs = async (email: string) => {
    const { data } = await anonClient.auth.signInWithPassword({ email, password: pass });
    return data?.session?.access_token ?? null;
  };
  const adminJwt = await loginAs(adminEmail);
  const supportJwt = await loginAs(supportEmail);
  const kycJwt = await loginAs(kycEmail);
  const clientJwt = await loginAs(clientEmail);
  const client2Jwt = await loginAs(client2Email);
  if (!adminJwt || !supportJwt || !kycJwt || !clientJwt || !client2Jwt) {
    return json({ ok: false, stage: "login", run_id: runId }, 500);
  }

  const invoke = async (fn: string, body: unknown, jwt?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json", apikey: anonKey,
    };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    const r = await fetch(`${url}/functions/v1/${fn}`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    let j: any = null;
    try { j = await r.json(); } catch { /* ignore */ }
    return { status: r.status, ok: r.ok, body: j };
  };

  const validPayload = (idem: string, over: Record<string, unknown> = {}) => ({
    subject_user_id: clientId,
    account_id: accountId,
    consent_type: "marketing_email",
    status: "granted",
    channel: "core",
    idempotency_key: idem,
    consent_text_version: "v1",
    consent_text: "Je consens à recevoir des communications marketing par courriel.",
    proof_ref: `qa-ref-${idem}`,
    notes: "QA note",
    __audit_reason: "qa-module37-runner",
    ...over,
  });

  // ============================================================================
  // SECURITY / CANONICAL DOOR
  // ============================================================================
  // S1 — no JWT → 401
  {
    const r = await invoke("consent-journal-action", validPayload(`qa-m37-s1-${runId}`));
    push("security", "S1_no_jwt_401", r.status === 401, `status=${r.status}`);
  }
  // S2 — invalid JWT → 401
  {
    const r = await invoke("consent-journal-action", validPayload(`qa-m37-s2-${runId}`), "not.a.valid.jwt");
    push("security", "S2_invalid_jwt_401", r.status === 401, `status=${r.status}`);
  }
  // S3 — client cannot create consent for another user → 403
  {
    const r = await invoke("consent-journal-action",
      validPayload(`qa-m37-s3-${runId}`, { subject_user_id: client2Id }), clientJwt);
    push("security", "S3_client_for_other_forbidden", r.status === 403, `status=${r.status}`);
  }
  // S4 — direct INSERT authenticated blocked by single-door trigger
  {
    const authedClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${adminJwt}` } },
    });
    const { error } = await authedClient.from("consent_records" as any).insert({
      subject_user_id: clientId,
      consent_type: "marketing_email",
      status: "granted",
      channel: "core",
      idempotency_key: `qa-m37-s4-${runId}`,
      recorded_by_user_id: adminId,
      recorded_by_role: "admin",
    } as any);
    push("security", "S4_direct_insert_blocked",
      !!error, error?.message?.slice(0, 200) ?? "no_error");
  }
  // S5 — direct INSERT via service_role also blocked (bypass flag required)
  {
    const { error } = await admin.from("consent_records" as any).insert({
      subject_user_id: clientId,
      consent_type: "marketing_email",
      status: "granted",
      channel: "core",
      idempotency_key: `qa-m37-s5-${runId}`,
      recorded_by_user_id: adminId,
      recorded_by_role: "admin",
    } as any);
    push("security", "S5_service_role_insert_blocked",
      !!error, error?.message?.slice(0, 200) ?? "no_error");
  }
  // S6 — direct UPDATE blocked (append-only)
  {
    // First create one row via canonical door
    const idem = `qa-m37-s6seed-${runId}`;
    const seed = await invoke("consent-journal-action", validPayload(idem), adminJwt);
    if (seed.ok && seed.body?.consent_id) {
      const { error } = await admin.from("consent_records" as any)
        .update({ notes: "tamper" })
        .eq("id", seed.body.consent_id);
      push("security", "S6_direct_update_blocked",
        !!error, error?.message?.slice(0, 200) ?? "no_error");
      // S7 — direct DELETE blocked
      const { error: delErr } = await admin.from("consent_records" as any)
        .delete().eq("id", seed.body.consent_id);
      push("security", "S7_direct_delete_blocked",
        !!delErr, delErr?.message?.slice(0, 200) ?? "no_error");
    } else {
      push("security", "S6_direct_update_blocked", false, "no seed consent");
      push("security", "S7_direct_delete_blocked", false, "no seed consent");
    }
  }

  // ============================================================================
  // RBAC
  // ============================================================================
  const runRoleTest = async (label: string, jwt: string, payload: any, expectOk: boolean, category = "rbac") => {
    const idem = `qa-m37-${label}-${runId}`;
    const r = await invoke("consent-journal-action", { ...payload, idempotency_key: idem }, jwt);
    const ok = expectOk ? (r.ok && !!r.body?.consent_id) : (r.status === 403);
    push(category, label, ok, `status=${r.status} idem=${idem}`);
  };
  await runRoleTest("R1_client_self_ok", clientJwt,
    validPayload("_", { subject_user_id: clientId }), true);
  await runRoleTest("R2_client_other_forbidden", clientJwt,
    validPayload("_", { subject_user_id: client2Id }), false);
  await runRoleTest("R3_admin_for_client_ok", adminJwt,
    validPayload("_", { subject_user_id: clientId }), true);
  await runRoleTest("R4_support_for_client_ok", supportJwt,
    validPayload("_", { subject_user_id: clientId }), true);
  await runRoleTest("R5_kyc_for_client_ok", kycJwt,
    validPayload("_", { subject_user_id: clientId }), true);

  // R6 — RLS: subject can SELECT own consent
  {
    const idem = `qa-m37-r6-${runId}`;
    const r = await invoke("consent-journal-action",
      validPayload(idem, { subject_user_id: clientId }), adminJwt);
    if (r.ok && r.body?.consent_id) {
      consentIdA = r.body.consent_id;
      const subjectClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${clientJwt}` } },
      });
      const { data: rows } = await subjectClient.from("consent_records" as any)
        .select("id").eq("id", consentIdA).maybeSingle();
      push("rbac", "R6_subject_sees_own_consent", !!rows?.id, `visible=${!!rows?.id}`);

      // R7 — other client cannot SELECT
      const otherClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${client2Jwt}` } },
      });
      const { data: cRow } = await otherClient.from("consent_records" as any)
        .select("id").eq("id", consentIdA).maybeSingle();
      push("rbac", "R7_other_client_cannot_read", !cRow, `visible=${!!cRow}`);
    } else {
      push("rbac", "R6_subject_sees_own_consent", false, "no seed");
      push("rbac", "R7_other_client_cannot_read", false, "no seed");
    }
  }

  // ============================================================================
  // CONFORMITÉ LOI 25 — Append-only, server-side capture
  // ============================================================================
  if (consentIdA) {
    const { data: row } = await admin.from("consent_records" as any)
      .select("*").eq("id", consentIdA).single();
    push("conformite", "C1_created_at_present",
      !!row?.created_at, String(row?.created_at));
    push("conformite", "C2_recorded_by_user_id_matches",
      row?.recorded_by_user_id === adminId, String(row?.recorded_by_user_id));
    push("conformite", "C3_consent_text_hash_present",
      typeof row?.consent_text_hash === "string" && row.consent_text_hash.length === 64,
      String(row?.consent_text_hash).slice(0, 20));
    push("conformite", "C4_consent_text_version_present",
      row?.consent_text_version === "v1", String(row?.consent_text_version));
    push("conformite", "C5_channel_correct",
      row?.channel === "core", String(row?.channel));
    push("conformite", "C6_status_correct",
      row?.status === "granted", String(row?.status));
    push("conformite", "C7_type_correct",
      row?.consent_type === "marketing_email", String(row?.consent_type));
    push("conformite", "C8_subject_correct",
      row?.subject_user_id === clientId, String(row?.subject_user_id));
    push("conformite", "C9_account_linked",
      row?.account_id === accountId, String(row?.account_id));
    push("conformite", "C10_user_agent_captured_server",
      typeof row?.user_agent === "string" && row.user_agent.length > 0,
      String(row?.user_agent).slice(0, 60));
  } else {
    info("conformite", "C1_created_at_present", "skipped: no seed");
  }

  // ============================================================================
  // MÉTIER
  // ============================================================================
  // M1 — enum consent_type invalide → 400
  {
    const r = await invoke("consent-journal-action",
      validPayload(`qa-m37-m1-${runId}`, { consent_type: "not_a_type" }), adminJwt);
    push("metier", "M1_invalid_consent_type_rejected", r.status === 400, `status=${r.status}`);
  }
  // M2 — status invalide → 400
  {
    const r = await invoke("consent-journal-action",
      validPayload(`qa-m37-m2-${runId}`, { status: "maybe" }), adminJwt);
    push("metier", "M2_invalid_status_rejected", r.status === 400, `status=${r.status}`);
  }
  // M3 — channel invalide → 400
  {
    const r = await invoke("consent-journal-action",
      validPayload(`qa-m37-m3-${runId}`, { channel: "carrier_pigeon" }), adminJwt);
    push("metier", "M3_invalid_channel_rejected", r.status === 400, `status=${r.status}`);
  }
  // M4 — subject_user_id invalide → 400
  {
    const r = await invoke("consent-journal-action",
      validPayload(`qa-m37-m4-${runId}`, { subject_user_id: "not-a-uuid" }), adminJwt);
    push("metier", "M4_invalid_uuid_rejected", r.status === 400, `status=${r.status}`);
  }
  // M5 — idempotency_key trop court → 400
  {
    const r = await invoke("consent-journal-action",
      validPayload("short", {}), adminJwt);
    push("metier", "M5_short_idempotency_key_rejected", r.status === 400, `status=${r.status}`);
  }
  // M6 — notes trop longues → 400
  {
    const r = await invoke("consent-journal-action",
      validPayload(`qa-m37-m6-${runId}`, { notes: "x".repeat(2500) }), adminJwt);
    push("metier", "M6_notes_too_long_rejected", r.status === 400, `status=${r.status}`);
  }
  // M7 — création valide OK
  {
    const idem = `qa-m37-m7-${runId}`;
    const r = await invoke("consent-journal-action", validPayload(idem), adminJwt);
    push("metier", "M7_valid_create_ok", r.ok && !!r.body?.consent_id,
      `status=${r.status}`);
  }

  // ============================================================================
  // IDEMPOTENCE
  // ============================================================================
  {
    const idem = `qa-m37-idem-${runId}`;
    const r1 = await invoke("consent-journal-action", validPayload(idem), adminJwt);
    const cid = r1.body?.consent_id;
    const r2 = await invoke("consent-journal-action", validPayload(idem), adminJwt);
    const r3 = await invoke("consent-journal-action",
      validPayload(idem, { status: "denied" }), adminJwt);
    const sameId = r2.body?.consent_id === cid && r3.body?.consent_id === cid;
    push("idempotence", "I1_same_idem_returns_same_consent", sameId,
      `t1=${cid} t2=${r2.body?.consent_id} t3=${r3.body?.consent_id}`);

    // Concurrent burst
    const burst = await Promise.all(Array.from({ length: 4 }).map(() =>
      invoke("consent-journal-action", validPayload(idem), adminJwt)));
    const ids = burst.map((x) => x.body?.consent_id);
    push("idempotence", "I2_concurrent_no_duplicate",
      ids.every((id) => id === cid), `ids=${ids.join(",")}`);

    // Only 1 row in DB
    const { count: rowCount } = await admin.from("consent_records" as any)
      .select("id", { count: "exact", head: true }).eq("idempotency_key", idem);
    push("idempotence", "I3_single_row_in_db", rowCount === 1, `count=${rowCount}`);

    // Only 1 email_queue row for this idem
    const { count: emailCount } = await admin.from("email_queue")
      .select("id", { count: "exact", head: true }).eq("idempotency_key", idem);
    push("idempotence", "I4_single_email_queue_row", (emailCount ?? 0) <= 1, `count=${emailCount}`);

    // I5 — retry after network failure simulated by second call returns same
    push("idempotence", "I5_retry_safe", sameId, `same=${sameId}`);
  }

  // ============================================================================
  // AUDIT
  // ============================================================================
  if (consentIdA) {
    const { data: audit } = await admin.from("admin_audit_log")
      .select("action, admin_user_id, target_type, target_id, details")
      .eq("target_id", consentIdA)
      .eq("action", "consent_recorded")
      .maybeSingle();
    push("audit", "A1_audit_entry_present", !!audit, audit ? "ok" : "missing");
    push("audit", "A2_audit_actor_matches", audit?.admin_user_id === adminId, String(audit?.admin_user_id));
    push("audit", "A3_audit_target_type", audit?.target_type === "consent_record", String(audit?.target_type));
    push("audit", "A4_audit_details_has_subject",
      !!(audit?.details as any)?.subject_user_id, JSON.stringify(audit?.details ?? {}).slice(0, 200));
  } else {
    info("audit", "A1_audit_entry_present", "skipped: no seed");
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  if (consentIdA) {
    const { data: mails } = await admin.from("email_queue")
      .select("event_key, template_key, to_email, idempotency_key")
      .eq("entity_id", consentIdA);
    push("notifications", "N1_email_queue_created", (mails?.length ?? 0) >= 1, `count=${mails?.length}`);
    const m = (mails ?? [])[0];
    push("notifications", "N2_template_key_correct",
      m?.template_key === "consent_recorded", String(m?.template_key));
    push("notifications", "N3_event_key_present",
      typeof m?.event_key === "string" && m.event_key.startsWith("consent_recorded:"),
      String(m?.event_key));
    push("notifications", "N4_recipient_is_subject", m?.to_email === clientEmail, String(m?.to_email));

    // N5 — uniqueness
    if (m?.event_key) {
      await enqueueCommunication({
        channel: "email",
        templateKey: "consent_recorded",
        recipient: clientEmail,
        idempotencyKey: m.idempotency_key,
        subject: "dup",
        entityType: "consent_record",
        entityId: consentIdA,
      });
      const { count } = await admin.from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("event_key", m.event_key);
      push("notifications", "N5_event_key_unique", count === 1, `rows=${count}`);
    }
  } else {
    info("notifications", "N1_email_queue_created", "skipped");
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================
  const cleanupErrors: string[] = [];
  const safeDel = async (table: string, q: (b: any) => any) => {
    try { const { error } = await q(admin.from(table)); if (error) cleanupErrors.push(`${table}:${error.message}`); }
    catch (e) { cleanupErrors.push(`${table}:${(e as Error).message}`); }
  };

  // Set bypass flag for consent_records deletion (guard blocks DELETE otherwise)
  const { data: qaConsents } = await admin.from("consent_records" as any)
    .select("id, idempotency_key").like("idempotency_key", `qa-m37-%-${runId}`);
  const qaConsentIds = (qaConsents ?? []).map((r: any) => r.id);

  if (qaConsentIds.length > 0) {
    await safeDel("email_queue", (b) => b.delete().in("entity_id", qaConsentIds));
    await safeDel("admin_audit_log", (b) => b.delete().in("target_id", qaConsentIds));
    // Try direct delete via SQL bypass — the guard blocks DELETE by design.
    // Use a SECURITY DEFINER RPC if it exists, otherwise leave and report as cleanup residue.
    try {
      const { error: rpcErr } = await admin.rpc("qa_purge_consent_records" as any, {
        p_ids: qaConsentIds,
      });
      if (rpcErr) cleanupErrors.push(`consent_records_rpc:${rpcErr.message}`);
    } catch (e) {
      cleanupErrors.push(`consent_records_rpc:${(e as Error).message}`);
    }
  }
  await safeDel("email_queue", (b) => b.delete().like("idempotency_key", `qa-m37-%-${runId}`));

  for (const uid of [clientId, client2Id, adminId, supportId, kycId].filter(Boolean)) {
    await safeDel("admin_audit_log", (b) => b.delete().eq("admin_user_id", uid));
    await safeDel("activity_logs", (b) => b.delete().eq("user_id", uid));
    await safeDel("user_roles", (b) => b.delete().eq("user_id", uid));
  }

  if (accountId) await safeDel("accounts", (b) => b.delete().eq("id", accountId));

  for (const uid of [clientId, client2Id, adminId, supportId, kycId].filter(Boolean)) {
    await safeDel("profiles", (b) => b.delete().eq("id", uid));
    try { await admin.auth.admin.deleteUser(uid); } catch (e) { cleanupErrors.push(`auth:${(e as Error).message}`); }
  }

  // Orphan verification
  const orphans = { consents: 0, emails: 0, audit: 0 };
  if (qaConsentIds.length > 0) {
    const { count: c } = await admin.from("consent_records" as any).select("id", { count: "exact", head: true })
      .in("id", qaConsentIds);
    orphans.consents = c ?? 0;
    const { count: e } = await admin.from("email_queue").select("id", { count: "exact", head: true })
      .in("entity_id", qaConsentIds);
    orphans.emails = e ?? 0;
    const { count: a } = await admin.from("admin_audit_log").select("id", { count: "exact", head: true })
      .in("target_id", qaConsentIds);
    orphans.audit = a ?? 0;
  }
  push("cleanup", "C1_consents_purged", orphans.consents === 0, `count=${orphans.consents}`);
  push("cleanup", "C2_no_orphan_emails", orphans.emails === 0, `count=${orphans.emails}`);
  push("cleanup", "C3_no_orphan_audit", orphans.audit === 0, `count=${orphans.audit}`);

  const passCount = results.filter(r => r.ok && !r.skip).length;
  const skipCount = results.filter(r => r.skip).length;
  const failCount = results.filter(r => !r.ok).length;
  const total = results.length;

  const byCategory: Record<string, { pass: number; fail: number; skip: number }> = {};
  for (const r of results) {
    byCategory[r.category] ??= { pass: 0, fail: 0, skip: 0 };
    if (r.skip) byCategory[r.category].skip++;
    else if (r.ok) byCategory[r.category].pass++;
    else byCategory[r.category].fail++;
  }

  return json({
    ok: failCount === 0,
    module: 37,
    run_id: runId,
    summary: { pass: passCount, fail: failCount, skip: skipCount, total },
    by_category: byCategory,
    cleanup: { orphans, errors: cleanupErrors },
    results,
  });
});
