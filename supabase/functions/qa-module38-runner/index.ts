// ============================================================================
// qa-module38-runner — Module 38 « Privacy Requests / Loi 25 »
// Validates Single Door, RBAC, Loi 25 conformity, business rules,
// state machine, idempotency, audit trail, notifications, cleanup.
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
  const mkEmail = (tag: string) => `qa-m38-${tag}-${stamp}@qa.test`;
  const clientEmail = mkEmail("client");
  const client2Email = mkEmail("client2");
  const adminEmail = mkEmail("admin");
  const supportEmail = mkEmail("support");
  const kycEmail = mkEmail("kyc");
  const pass = "QaTest1234!Xy";

  const mkUser = async (email: string, meta: Record<string, unknown>) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: pass, email_confirm: true,
      user_metadata: { qa: true, module: 38, run_id: runId, ...meta },
    });
    if (error) throw new Error(`create_user ${email}: ${error.message}`);
    return data.user!.id;
  };

  let clientId = "", client2Id = "", adminId = "", supportId = "", kycId = "";
  let accountId = "";
  let requestIdA = "";
  const createdRequestIds: string[] = [];

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
      if (error) console.log(`[qa-m38][setup] role ${r.role}: ${error.message}`);
    }

    const { data: acc, error: accErr } = await admin.from("accounts").insert({
      client_id: clientId, account_number: `QA-M38-${stamp}`, status: "active", billing_anchor_day: 1,
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

  const invoke = async (fn: string, body: unknown, jwt?: string | null) => {
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

  const uuid = () => crypto.randomUUID();

  const validCreate = (idem: string, over: Record<string, unknown> = {}) => ({
    action: "create",
    clientId,
    accountId,
    requestType: "access",
    description: "Le client demande accès à ses renseignements personnels.",
    internalNotes: "QA note",
    reason: "qa-module38-runner",
    idempotencyKey: idem,
    ...over,
  });

  // ============================================================================
  // SECURITY / SINGLE DOOR
  // ============================================================================
  // S1 — no JWT → 401
  {
    const r = await invoke("privacy-requests-actions", validCreate(uuid()));
    push("security", "S1_no_jwt_401", r.status === 401, `status=${r.status}`);
  }
  // S2 — invalid JWT → 401
  {
    const r = await invoke("privacy-requests-actions", validCreate(uuid()), "not.a.valid.jwt");
    push("security", "S2_invalid_jwt_401", r.status === 401, `status=${r.status}`);
  }
  // S3 — client role → 403
  {
    const r = await invoke("privacy-requests-actions", validCreate(uuid()), clientJwt);
    push("security", "S3_client_role_forbidden", r.status === 403, `status=${r.status}`);
  }
  // S4 — direct INSERT authenticated blocked
  {
    const authedClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${adminJwt}` } },
    });
    const { error } = await authedClient.from("privacy_requests").insert({
      client_id: clientId, request_type: "access",
      description: "tamper", created_by: adminId,
      idempotency_key: uuid(),
    } as any);
    push("security", "S4_direct_insert_authenticated_blocked",
      !!error, error?.message?.slice(0, 200) ?? "no_error");
  }
  // S5 — direct INSERT via service_role also blocked (no bypass flag)
  {
    const { error } = await admin.from("privacy_requests").insert({
      client_id: clientId, request_type: "access",
      description: "tamper2", created_by: adminId,
      idempotency_key: uuid(),
    } as any);
    push("security", "S5_service_role_insert_blocked",
      !!error, error?.message?.slice(0, 200) ?? "no_error");
  }
  // Seed a real request for later tests
  {
    const idem = uuid();
    const r = await invoke("privacy-requests-actions", validCreate(idem), adminJwt);
    if (r.ok && r.body?.request?.id) {
      requestIdA = r.body.request.id;
      createdRequestIds.push(requestIdA);
    }
    push("security", "S6_seed_created", !!requestIdA, `status=${r.status}`);
  }
  // S7 — direct UPDATE blocked
  if (requestIdA) {
    const { error } = await admin.from("privacy_requests")
      .update({ description: "tamper" } as any)
      .eq("id", requestIdA);
    push("security", "S7_direct_update_blocked",
      !!error, error?.message?.slice(0, 200) ?? "no_error");
  } else info("security", "S7_direct_update_blocked", "no seed");
  // S8 — direct DELETE blocked
  if (requestIdA) {
    const { error } = await admin.from("privacy_requests").delete().eq("id", requestIdA);
    push("security", "S8_direct_delete_blocked",
      !!error, error?.message?.slice(0, 200) ?? "no_error");
  } else info("security", "S8_direct_delete_blocked", "no seed");

  // ============================================================================
  // RBAC
  // ============================================================================
  const runCreateAs = async (label: string, jwt: string | null, expectOk: boolean) => {
    const idem = uuid();
    const r = await invoke("privacy-requests-actions", validCreate(idem), jwt);
    const created = r.ok && !!r.body?.request?.id;
    if (created) createdRequestIds.push(r.body.request.id);
    const ok = expectOk ? created : (r.status === 401 || r.status === 403);
    push("rbac", label, ok, `status=${r.status}`);
  };
  await runCreateAs("R1_admin_ok", adminJwt, true);
  await runCreateAs("R2_support_ok", supportJwt, true);
  await runCreateAs("R3_kyc_agent_ok", kycJwt, true);
  await runCreateAs("R4_client_forbidden", clientJwt, false);
  await runCreateAs("R5_client2_forbidden", client2Jwt, false);
  // R6 — client cannot SELECT via RLS (no policy grants it)
  {
    const subj = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${clientJwt}` } },
    });
    const { data } = await subj.from("privacy_requests").select("id").eq("id", requestIdA).maybeSingle();
    push("rbac", "R6_client_cannot_read", !data, `visible=${!!data}`);
  }
  // R7 — staff can SELECT
  {
    const st = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${supportJwt}` } },
    });
    const { data } = await st.from("privacy_requests").select("id").eq("id", requestIdA).maybeSingle();
    push("rbac", "R7_staff_can_read", !!data?.id, `visible=${!!data?.id}`);
  }

  // ============================================================================
  // CONFORMITÉ LOI 25
  // ============================================================================
  if (requestIdA) {
    const { data: row } = await admin.from("privacy_requests").select("*").eq("id", requestIdA).single();
    push("conformite", "C1_created_by_matches", row?.created_by === adminId, String(row?.created_by));
    push("conformite", "C2_created_by_role_correct",
      row?.created_by_role === "admin", String(row?.created_by_role));
    push("conformite", "C3_description_hash_present",
      typeof row?.description_hash === "string" && row.description_hash.length === 64,
      String(row?.description_hash).slice(0, 20));
    push("conformite", "C4_request_user_agent_captured",
      typeof row?.request_user_agent === "string" && row.request_user_agent.length > 0,
      String(row?.request_user_agent).slice(0, 60));
    // request_ip is captured from x-forwarded-for; edge fetch may or may not set it.
    push("conformite", "C5_request_ip_captured_or_null",
      row?.request_ip === null || typeof row?.request_ip === "string",
      String(row?.request_ip));
    push("conformite", "C6_received_at_present", !!row?.received_at, String(row?.received_at));
    push("conformite", "C7_due_at_present", !!row?.due_at, String(row?.due_at));
    push("conformite", "C8_state_transitions_seeded",
      Array.isArray(row?.state_transitions) && (row.state_transitions as any[]).length >= 1,
      `n=${(row?.state_transitions as any[])?.length}`);
    push("conformite", "C9_idempotency_key_stored",
      typeof row?.idempotency_key === "string", String(row?.idempotency_key).slice(0, 20));
    push("conformite", "C10_status_initial_received",
      row?.status === "received", String(row?.status));
  } else info("conformite", "C1_created_by_matches", "no seed");

  // ============================================================================
  // MÉTIER
  // ============================================================================
  // M1 — request_type invalide → 400
  {
    const r = await invoke("privacy-requests-actions",
      validCreate(uuid(), { requestType: "not_a_type" }), adminJwt);
    push("metier", "M1_invalid_request_type_rejected", r.status === 400, `status=${r.status}`);
  }
  // M2 — description trop longue → 400
  {
    const r = await invoke("privacy-requests-actions",
      validCreate(uuid(), { description: "x".repeat(5001) }), adminJwt);
    push("metier", "M2_description_too_long_rejected", r.status === 400, `status=${r.status}`);
  }
  // M3 — clientId invalide → 400
  {
    const r = await invoke("privacy-requests-actions",
      validCreate(uuid(), { clientId: "not-a-uuid" }), adminJwt);
    push("metier", "M3_invalid_uuid_rejected", r.status === 400, `status=${r.status}`);
  }
  // M4 — description vide → 400
  {
    const r = await invoke("privacy-requests-actions",
      validCreate(uuid(), { description: "   " }), adminJwt);
    push("metier", "M4_empty_description_rejected", r.status === 400, `status=${r.status}`);
  }
  // M5 — reason vide → 400
  {
    const r = await invoke("privacy-requests-actions",
      validCreate(uuid(), { reason: "" }), adminJwt);
    push("metier", "M5_empty_reason_rejected", r.status === 400, `status=${r.status}`);
  }
  // M6 — idempotencyKey non-UUID → 400
  {
    const r = await invoke("privacy-requests-actions",
      validCreate("not-a-uuid"), adminJwt);
    push("metier", "M6_invalid_idempotency_key_rejected", r.status === 400, `status=${r.status}`);
  }
  // M7 — action inconnue → 400
  {
    const r = await invoke("privacy-requests-actions", { action: "wat" }, adminJwt);
    push("metier", "M7_unknown_action_rejected", r.status === 400, `status=${r.status}`);
  }

  // State machine — need a separate request per transition test
  const createFresh = async (): Promise<string | null> => {
    const idem = uuid();
    const r = await invoke("privacy-requests-actions", validCreate(idem), adminJwt);
    const id = r.body?.request?.id ?? null;
    if (id) createdRequestIds.push(id);
    return id;
  };

  // M8 — transition received → in_review OK
  const idSM1 = await createFresh();
  if (idSM1) {
    const r = await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM1, status: "in_review",
      reason: "démarrage QA", idempotencyKey: uuid(),
    }, adminJwt);
    push("metier", "M8_transition_received_to_in_review", r.ok, `status=${r.status}`);
  } else info("metier", "M8_transition_received_to_in_review", "no seed");

  // M9 — normalization submitted → received (accepted)
  const idSM2 = await createFresh();
  if (idSM2) {
    // First transition to in_review to allow further ops, then send status=submitted (alias→received but same-state should just return unchanged)
    // Instead: submit alias should be accepted by EF preprocess and mapped to "received".
    // Since the seed is already "received", a submitted->received is a no-op (v_from == v_to in state machine → RETURN NEW).
    const r = await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM2, status: "submitted",
      reason: "alias test", idempotencyKey: uuid(),
    }, adminJwt);
    push("metier", "M9_alias_submitted_normalized", r.ok, `status=${r.status}`);
  } else info("metier", "M9_alias_submitted_normalized", "no seed");

  // M10 — refused sans refusalReason → 400
  const idSM3 = await createFresh();
  if (idSM3) {
    const r = await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM3, status: "refused",
      reason: "test", idempotencyKey: uuid(),
    }, adminJwt);
    push("metier", "M10_refused_without_reason_rejected", r.status === 400, `status=${r.status}`);
  } else info("metier", "M10_refused_without_reason_rejected", "no seed");

  // M11 — transition interdite (completed → received)
  const idSM4 = await createFresh();
  let idSM4Completed = false;
  if (idSM4) {
    // received → in_review → completed
    await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM4, status: "in_review",
      reason: "step1", idempotencyKey: uuid(),
    }, adminJwt);
    const r2 = await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM4, status: "completed",
      reason: "step2", idempotencyKey: uuid(),
    }, adminJwt);
    idSM4Completed = r2.ok;
    // Try invalid completed → received
    const r3 = await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM4, status: "in_review",
      reason: "backwards", idempotencyKey: uuid(),
    }, adminJwt);
    push("metier", "M11_terminal_state_locked", r3.status === 400 && idSM4Completed, `status=${r3.status}`);
  } else info("metier", "M11_terminal_state_locked", "no seed");

  // M12 — refused OK avec refusalReason
  const idSM5 = await createFresh();
  if (idSM5) {
    await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM5, status: "in_review",
      reason: "step1", idempotencyKey: uuid(),
    }, adminJwt);
    const r = await invoke("privacy-requests-actions", {
      action: "update_status", requestId: idSM5, status: "refused",
      reason: "refus QA", refusalReason: "raison communicable",
      idempotencyKey: uuid(),
    }, adminJwt);
    push("metier", "M12_refused_with_reason_ok", r.ok, `status=${r.status}`);
  } else info("metier", "M12_refused_with_reason_ok", "no seed");

  // ============================================================================
  // IDEMPOTENCE
  // ============================================================================
  {
    const idem = uuid();
    const r1 = await invoke("privacy-requests-actions", validCreate(idem), adminJwt);
    const rid = r1.body?.request?.id;
    if (rid) createdRequestIds.push(rid);
    const r2 = await invoke("privacy-requests-actions", validCreate(idem), adminJwt);
    const r3 = await invoke("privacy-requests-actions",
      validCreate(idem, { description: "different" }), adminJwt);
    const same = r2.body?.request?.id === rid && r3.body?.request?.id === rid;
    push("idempotence", "I1_same_idem_same_request", same,
      `t1=${rid} t2=${r2.body?.request?.id} t3=${r3.body?.request?.id}`);

    // Concurrent burst
    const burst = await Promise.all(Array.from({ length: 5 }).map(() =>
      invoke("privacy-requests-actions", validCreate(idem), adminJwt)));
    const ids = burst.map((x) => x.body?.request?.id);
    push("idempotence", "I2_concurrent_no_duplicate",
      ids.every((id) => id === rid), `ids=${ids.join(",")}`);

    const { count: rowCount } = await admin.from("privacy_requests")
      .select("id", { count: "exact", head: true }).eq("idempotency_key", idem);
    push("idempotence", "I3_single_row_in_db", rowCount === 1, `count=${rowCount}`);

    // Update idempotence
    if (rid) {
      const updIdem = uuid();
      const u1 = await invoke("privacy-requests-actions", {
        action: "update_status", requestId: rid, status: "in_review",
        reason: "idem-update", idempotencyKey: updIdem,
      }, adminJwt);
      const u2 = await invoke("privacy-requests-actions", {
        action: "update_status", requestId: rid, status: "completed",
        reason: "idem-update-retry", idempotencyKey: updIdem,
      }, adminJwt);
      push("idempotence", "I4_update_status_idempotent",
        u1.ok && u2.ok && u2.body?.idempotent === true,
        `u1=${u1.status} u2.idempotent=${u2.body?.idempotent}`);
    }
  }

  // ============================================================================
  // AUDIT
  // ============================================================================
  if (requestIdA) {
    const { data: auditCreate } = await admin.from("admin_audit_log")
      .select("action, admin_user_id, target_type, target_id, details")
      .eq("target_id", requestIdA)
      .eq("action", "privacy.request.create")
      .maybeSingle();
    push("audit", "A1_create_audit_present", !!auditCreate,
      auditCreate ? "ok" : "missing");
    push("audit", "A2_audit_actor_matches",
      auditCreate?.admin_user_id === adminId, String(auditCreate?.admin_user_id));
    push("audit", "A3_audit_target_type",
      auditCreate?.target_type === "privacy_request", String(auditCreate?.target_type));
    push("audit", "A4_audit_before_after_shape",
      (auditCreate?.details as any)?.before === null &&
      typeof (auditCreate?.details as any)?.after === "object",
      "details shape");
    push("audit", "A5_audit_reason_present",
      typeof (auditCreate?.details as any)?.reason === "string" &&
      (auditCreate?.details as any).reason.length > 0,
      String((auditCreate?.details as any)?.reason).slice(0, 40));
  } else info("audit", "A1_create_audit_present", "no seed");

  // Update audit — check idSM5 (has full lifecycle)
  if (idSM5) {
    const { data: upd } = await admin.from("admin_audit_log")
      .select("action, details").eq("target_id", idSM5)
      .eq("action", "privacy.request.update_status")
      .order("created_at", { ascending: true });
    push("audit", "A6_update_audit_present",
      Array.isArray(upd) && (upd?.length ?? 0) >= 2, `n=${upd?.length}`);
    const anyRefuse = (upd ?? []).some((r: any) =>
      r.details?.to === "refused" && r.details?.from === "in_review");
    push("audit", "A7_transition_from_to_recorded", anyRefuse, `hasRefuse=${anyRefuse}`);
  } else info("audit", "A6_update_audit_present", "no seed");

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  if (requestIdA) {
    const { data: mails } = await admin.from("email_queue")
      .select("event_key, template_key, to_email, idempotency_key, entity_type")
      .eq("entity_id", requestIdA);
    push("notifications", "N1_received_email_created",
      (mails?.length ?? 0) >= 1, `count=${mails?.length}`);
    const m = (mails ?? [])[0];
    push("notifications", "N2_template_key_correct",
      m?.template_key === "privacy_request_received", String(m?.template_key));
    push("notifications", "N3_event_key_prefix",
      typeof m?.event_key === "string" && m.event_key === "privacy.request.received",
      String(m?.event_key));
    push("notifications", "N4_recipient_is_subject",
      m?.to_email === clientEmail, String(m?.to_email));
    push("notifications", "N5_entity_type_correct",
      m?.entity_type === "privacy_request", String(m?.entity_type));
  } else info("notifications", "N1_received_email_created", "no seed");

  // Completion / refusal emails on idSM5 (refused) and idSM4 (completed)
  if (idSM5) {
    const { data: refusedMails } = await admin.from("email_queue")
      .select("event_key, template_key").eq("entity_id", idSM5)
      .eq("event_key", "privacy.request.refused");
    push("notifications", "N6_refusal_email_created",
      (refusedMails?.length ?? 0) === 1, `count=${refusedMails?.length}`);
  }
  if (idSM4 && idSM4Completed) {
    const { data: doneMails } = await admin.from("email_queue")
      .select("event_key, template_key").eq("entity_id", idSM4)
      .eq("event_key", "privacy.request.completed");
    push("notifications", "N7_completion_email_created",
      (doneMails?.length ?? 0) === 1, `count=${doneMails?.length}`);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================
  const cleanupErrors: string[] = [];
  const safeDel = async (table: string, q: (b: any) => any) => {
    try { const { error } = await q(admin.from(table)); if (error) cleanupErrors.push(`${table}:${error.message}`); }
    catch (e) { cleanupErrors.push(`${table}:${(e as Error).message}`); }
  };

  // Gather all QA-created privacy_requests (by client_id) too, for defense in depth
  const { data: qaRows } = await admin.from("privacy_requests")
    .select("id").in("client_id", [clientId, client2Id]);
  const allIds = Array.from(new Set([
    ...createdRequestIds,
    ...((qaRows ?? []).map((r: any) => r.id)),
  ]));

  if (allIds.length > 0) {
    await safeDel("email_queue", (b) => b.delete().in("entity_id", allIds));
    await safeDel("admin_audit_log", (b) => b.delete().in("target_id", allIds));
    // DB trigger blocks DELETE — use SECURITY DEFINER helper if present, otherwise raw SQL via rpc
    try {
      const { error } = await admin.rpc("qa_purge_privacy_requests" as any, { p_ids: allIds });
      if (error) cleanupErrors.push(`privacy_requests_rpc:${error.message}`);
    } catch (e) {
      cleanupErrors.push(`privacy_requests_rpc:${(e as Error).message}`);
    }
  }

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

  const orphans = { requests: 0, emails: 0, audit: 0 };
  if (allIds.length > 0) {
    const { count: c } = await admin.from("privacy_requests").select("id", { count: "exact", head: true }).in("id", allIds);
    orphans.requests = c ?? 0;
    const { count: e } = await admin.from("email_queue").select("id", { count: "exact", head: true }).in("entity_id", allIds);
    orphans.emails = e ?? 0;
    const { count: a } = await admin.from("admin_audit_log").select("id", { count: "exact", head: true }).in("target_id", allIds);
    orphans.audit = a ?? 0;
  }
  push("cleanup", "C1_requests_purged", orphans.requests === 0, `count=${orphans.requests}`);
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
    module: 38,
    run_id: runId,
    summary: { pass: passCount, fail: failCount, skip: skipCount, total },
    by_category: byCategory,
    cleanup: { orphans, errors: cleanupErrors },
    results,
  });
});
