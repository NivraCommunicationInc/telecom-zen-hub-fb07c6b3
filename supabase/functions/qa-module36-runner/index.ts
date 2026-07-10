// ============================================================================
// qa-module36-runner — Module 36 « Supervisor Escalation »
// Validates INVARIANT-ESCALATION-SINGLE-DOOR, RBAC, business rules,
// idempotency, audit trail, notifications, cleanup.
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

  // ---------- Setup: client + admin + supervisor + support + unauthorized ----------
  const stamp = Date.now();
  const mkEmail = (tag: string) => `qa-m36-${tag}-${stamp}@qa.test`;
  const clientEmail = mkEmail("client");
  const adminEmail = mkEmail("admin");
  const supEmail = mkEmail("sup");
  const supportEmail = mkEmail("support");
  const unauthEmail = mkEmail("client2");
  const pass = "QaTest1234!Xy";

  const mkUser = async (email: string, meta: Record<string, unknown>) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: pass, email_confirm: true,
      user_metadata: { qa: true, module: 36, run_id: runId, ...meta },
    });
    if (error) throw new Error(`create_user ${email}: ${error.message}`);
    return data.user!.id;
  };

  let clientId = "", adminId = "", supId = "", supportId = "", unauthId = "";
  let accountId = "";
  let ticketIdA = "", ticketIdB = "", ticketNumA = "";

  try {
    clientId = await mkUser(clientEmail, { role: "client" });
    adminId = await mkUser(adminEmail, { role: "admin" });
    supId = await mkUser(supEmail, { role: "supervisor" });
    supportId = await mkUser(supportEmail, { role: "support" });
    unauthId = await mkUser(unauthEmail, { role: "client" });

    await admin.from("profiles").upsert([
      { id: clientId, user_id: clientId, email: clientEmail, first_name: "QA", last_name: "Client", account_type: "client" },
      { id: adminId, user_id: adminId, email: adminEmail, first_name: "QA", last_name: "Admin", account_type: "employee" },
      { id: supId, user_id: supId, email: supEmail, first_name: "QA", last_name: "Sup", account_type: "employee" },
      { id: supportId, user_id: supportId, email: supportEmail, first_name: "QA", last_name: "Support", account_type: "employee" },
      { id: unauthId, user_id: unauthId, email: unauthEmail, first_name: "QA", last_name: "Client2", account_type: "client" },
    ] as any, { onConflict: "id" });

    const roleInserts = [
      { user_id: clientId, role: "client", status: "active" },
      { user_id: adminId, role: "admin", status: "active", can_access_core: true, is_active: true },
      { user_id: supId, role: "supervisor", status: "active", can_access_core: true, is_active: true },
      { user_id: supportId, role: "support", status: "active", can_access_core: true, is_active: true },
      { user_id: unauthId, role: "client", status: "active" },
    ];
    for (const r of roleInserts) {
      const { error } = await admin.from("user_roles").insert(r);
      if (error) console.log(`[qa-m36][setup] role ${r.role}: ${error.message}`);
    }

    const { data: acc, error: accErr } = await admin.from("accounts").insert({
      client_id: clientId, account_number: `QA-M36-${stamp}`, status: "active", billing_anchor_day: 1,
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
  const supJwt = await loginAs(supEmail);
  const supportJwt = await loginAs(supportEmail);
  const clientJwt = await loginAs(clientEmail);
  const unauthJwt = await loginAs(unauthEmail);
  if (!adminJwt || !supJwt || !supportJwt || !clientJwt || !unauthJwt) {
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
    account_id: accountId,
    client_user_id: clientId,
    subject: "QA M36 Escalation",
    description: "Escalade de test automatisée module 36.",
    escalation_type: "billing",
    idempotency_key: idem,
    client_email: clientEmail,
    client_name: "QA Client",
    __audit_reason: "qa-module36-runner",
    ...over,
  });

  // ============================================================================
  // SECURITY / CANONICAL DOOR
  // ============================================================================
  // S1 — no JWT → 401
  {
    const r = await invoke("supervisor-escalation-action", validPayload(`qa-m36-s1-${runId}`));
    push("security", "S1_no_jwt_401", r.status === 401, `status=${r.status}`);
  }
  // S2 — invalid JWT → 401
  {
    const r = await invoke("supervisor-escalation-action", validPayload(`qa-m36-s2-${runId}`), "not.a.valid.jwt");
    push("security", "S2_invalid_jwt_401", r.status === 401, `status=${r.status}`);
  }
  // S3 — client role → 403
  {
    const r = await invoke("supervisor-escalation-action", validPayload(`qa-m36-s3-${runId}`), clientJwt);
    push("security", "S3_client_role_forbidden", r.status === 403, `status=${r.status}`);
  }
  // S4 — direct insert with dept=supervisor blocked by trigger
  {
    const { error } = await admin.from("internal_tickets").insert({
      created_by_id: adminId, created_by_name: "QA", created_by_role: "admin",
      assigned_to_department: "supervisor",
      subject: "DIRECT WRITE", description: "should be blocked",
      priority: "urgent", status: "open", category: "escalation",
      account_id: accountId, client_user_id: clientId,
      idempotency_key: `qa-m36-s4-${runId}`,
    } as any);
    push("security", "S4_direct_insert_supervisor_blocked",
      !!error && /escalation|SINGLE-DOOR|supervisor-escalation-action/i.test(error.message),
      error?.message?.slice(0, 200) ?? "no_error");
  }
  // S5 — direct insert with dept=admin/employee/technician NOT affected (trigger is scoped)
  {
    const { data, error } = await admin.from("internal_tickets").insert({
      created_by_id: adminId, created_by_name: "QA", created_by_role: "admin",
      assigned_to_department: "admin",
      subject: "NOT SCOPED", description: "outside guard",
      priority: "normal", status: "open",
    } as any).select("id").single();
    push("security", "S5_trigger_scoped_to_supervisor_only", !error && !!data?.id,
      error?.message ?? `id=${data?.id}`);
    if (data?.id) await admin.from("internal_tickets").delete().eq("id", data.id);
  }
  // S6 — spoofing created_by_* is ignored (server sources from JWT)
  {
    const idem = `qa-m36-s6-${runId}`;
    const r = await invoke("supervisor-escalation-action", {
      ...validPayload(idem),
      // Attempt to spoof — schema doesn't accept these keys, so they are stripped by zod.
      created_by_id: "00000000-0000-0000-0000-000000000000",
      created_by_email: "attacker@evil.test",
      created_by_role: "admin",
    }, supJwt);
    if (r.ok && r.body?.ticket_id) {
      const { data: row } = await admin.from("internal_tickets")
        .select("created_by_id, created_by_email").eq("id", r.body.ticket_id).single();
      const okAuthor = row?.created_by_id === supId && row?.created_by_email === supEmail;
      push("security", "S6_spoof_created_by_ignored", okAuthor,
        `db_author=${row?.created_by_id} db_email=${row?.created_by_email}`);
      await admin.from("internal_tickets").delete().eq("id", r.body.ticket_id);
      await admin.from("email_queue").delete().eq("idempotency_key", idem);
      await admin.from("admin_audit_log").delete().eq("target_id", r.body.ticket_id);
    } else {
      push("security", "S6_spoof_created_by_ignored", false, `status=${r.status} body=${JSON.stringify(r.body).slice(0,180)}`);
    }
  }

  // ============================================================================
  // RBAC
  // ============================================================================
  const runRoleTest = async (label: string, jwt: string, expectOk: boolean, category = "rbac") => {
    const idem = `qa-m36-${label}-${runId}`;
    const r = await invoke("supervisor-escalation-action", validPayload(idem), jwt);
    const ok = expectOk ? (r.ok && !!r.body?.ticket_id) : (r.status === 403);
    push(category, label, ok, `status=${r.status} idem=${idem}`);
    if (r.ok && r.body?.ticket_id) {
      await admin.from("admin_audit_log").delete().eq("target_id", r.body.ticket_id);
      await admin.from("email_queue").delete().eq("idempotency_key", idem);
      await admin.from("internal_tickets").delete().eq("id", r.body.ticket_id);
    }
  };
  await runRoleTest("R1_admin_authorized", adminJwt, true);
  await runRoleTest("R2_supervisor_authorized", supJwt, true);
  await runRoleTest("R3_support_authorized", supportJwt, true);
  await runRoleTest("R4_client_forbidden", clientJwt, false);
  await runRoleTest("R5_unauth_client_forbidden", unauthJwt, false);

  // R6 — visibility: supervisor can SELECT own-dept tickets via RLS
  {
    // create canonical row first (as admin)
    const idem = `qa-m36-r6-${runId}`;
    const r = await invoke("supervisor-escalation-action", validPayload(idem), adminJwt);
    if (r.ok && r.body?.ticket_id) {
      ticketIdA = r.body.ticket_id;
      ticketNumA = r.body.ticket_number;
      const supClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${supJwt}` } },
      });
      const { data: rows, error: selErr } = await supClient.from("internal_tickets")
        .select("id, assigned_to_department").eq("id", ticketIdA).maybeSingle();
      push("rbac", "R6_supervisor_sees_supervisor_tickets", !selErr && !!rows?.id,
        selErr?.message ?? `visible=${!!rows?.id}`);

      // R7 — clients cannot SELECT internal_tickets
      const clientClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${clientJwt}` } },
      });
      const { data: cRow } = await clientClient.from("internal_tickets")
        .select("id").eq("id", ticketIdA).maybeSingle();
      push("rbac", "R7_client_cannot_read_internal_tickets", !cRow,
        `visible=${!!cRow}`);
    } else {
      push("rbac", "R6_supervisor_sees_supervisor_tickets", false, "no seed ticket");
      push("rbac", "R7_client_cannot_read_internal_tickets", false, "no seed ticket");
    }
  }

  // ============================================================================
  // MÉTIER
  // ============================================================================
  if (ticketIdA) {
    const { data: row } = await admin.from("internal_tickets")
      .select("*").eq("id", ticketIdA).single();
    push("metier", "M1_ticket_number_generated",
      typeof row?.ticket_number === "string" && row.ticket_number.length > 0,
      String(row?.ticket_number));
    push("metier", "M2_category_escalation", row?.category === "escalation", String(row?.category));
    push("metier", "M3_department_supervisor",
      row?.assigned_to_department === "supervisor", String(row?.assigned_to_department));
    push("metier", "M4_priority_urgent", row?.priority === "urgent", String(row?.priority));
    push("metier", "M5_status_open", row?.status === "open", String(row?.status));
    push("metier", "M6_escalation_type_valid", row?.escalation_type === "billing", String(row?.escalation_type));
    push("metier", "M7_subject_prefixed",
      typeof row?.subject === "string" && row.subject.startsWith("[ESCALATION]"),
      String(row?.subject).slice(0, 80));
    push("metier", "M8_created_by_from_jwt", row?.created_by_id === adminId, String(row?.created_by_id));
  }
  // M9 — escalation_type invalide → 400
  {
    const r = await invoke("supervisor-escalation-action",
      validPayload(`qa-m36-m9-${runId}`, { escalation_type: "not_valid" }), adminJwt);
    push("metier", "M9_invalid_escalation_type_rejected", r.status === 400, `status=${r.status}`);
  }
  // M10 — subject vide → 400
  {
    const r = await invoke("supervisor-escalation-action",
      validPayload(`qa-m36-m10-${runId}`, { subject: "" }), adminJwt);
    push("metier", "M10_empty_subject_rejected", r.status === 400, `status=${r.status}`);
  }
  // M11 — account_id invalide → 400
  {
    const r = await invoke("supervisor-escalation-action",
      validPayload(`qa-m36-m11-${runId}`, { account_id: "not-a-uuid" }), adminJwt);
    push("metier", "M11_invalid_uuid_rejected", r.status === 400, `status=${r.status}`);
  }

  // ============================================================================
  // IDEMPOTENCE
  // ============================================================================
  {
    const idem = `qa-m36-idem-${runId}`;
    const r1 = await invoke("supervisor-escalation-action", validPayload(idem), adminJwt);
    ticketIdB = r1.body?.ticket_id ?? "";
    const r2 = await invoke("supervisor-escalation-action", validPayload(idem), adminJwt);
    const r3 = await invoke("supervisor-escalation-action", validPayload(idem, { subject: "Altered" }), adminJwt);
    const sameId = r2.body?.ticket_id === ticketIdB && r3.body?.ticket_id === ticketIdB;
    push("idempotence", "I1_same_idem_key_returns_same_ticket", sameId,
      `t1=${ticketIdB} t2=${r2.body?.ticket_id} t3=${r3.body?.ticket_id}`);
    push("idempotence", "I2_second_call_marked_idempotent",
      r2.body?.idempotent === true, `idempotent=${r2.body?.idempotent}`);

    // Concurrent burst
    const burst = await Promise.all(Array.from({ length: 4 }).map(() =>
      invoke("supervisor-escalation-action", validPayload(idem), adminJwt)));
    const ids = burst.map((x) => x.body?.ticket_id);
    push("idempotence", "I3_concurrent_no_duplicate",
      ids.every((id) => id === ticketIdB), `ids=${ids.join(",")}`);

    // Only 1 row in DB
    const { count: rowCount } = await admin.from("internal_tickets")
      .select("id", { count: "exact", head: true }).eq("idempotency_key", idem);
    push("idempotence", "I4_single_row_in_db", rowCount === 1, `count=${rowCount}`);

    // Only 1 email_queue row for this idem
    const { count: emailCount } = await admin.from("email_queue")
      .select("id", { count: "exact", head: true }).eq("idempotency_key", idem);
    push("idempotence", "I5_single_email_queue_row", (emailCount ?? 0) <= 1, `count=${emailCount}`);
  }

  // ============================================================================
  // AUDIT
  // ============================================================================
  if (ticketIdA) {
    const { data: audit } = await admin.from("admin_audit_log")
      .select("action, admin_user_id, target_type, target_id, details")
      .eq("target_id", ticketIdA)
      .eq("action", "supervisor_escalation")
      .maybeSingle();
    push("audit", "A1_audit_entry_present", !!audit, audit ? "ok" : "missing");
    push("audit", "A2_audit_actor_matches", audit?.admin_user_id === adminId, String(audit?.admin_user_id));
    push("audit", "A3_audit_target_type", audit?.target_type === "internal_ticket", String(audit?.target_type));
    push("audit", "A4_audit_details_has_client",
      !!(audit?.details as any)?.client_user_id, JSON.stringify(audit?.details ?? {}).slice(0, 200));
  } else {
    info("audit", "A1_audit_entry_present", "skipped: no seed ticket");
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  if (ticketIdA) {
    const { data: mails } = await admin.from("email_queue")
      .select("event_key, template_key, to_email, idempotency_key")
      .eq("entity_id", ticketIdA);
    push("notifications", "N1_email_queue_created", (mails?.length ?? 0) >= 1, `count=${mails?.length}`);
    const m = (mails ?? [])[0];
    push("notifications", "N2_template_key_correct",
      m?.template_key === "supervisor_escalation", String(m?.template_key));
    push("notifications", "N3_event_key_present",
      typeof m?.event_key === "string" && m.event_key.startsWith("supervisor_escalation:"),
      String(m?.event_key));
    push("notifications", "N4_recipient_is_client", m?.to_email === clientEmail, String(m?.to_email));

    // uniqueness: duplicate event_key must NOT create a new row (unique index or dedup trigger).
    if (m?.event_key) {
      await admin.from("email_queue").insert({
        event_key: m.event_key,
        idempotency_key: m.idempotency_key,
        to_email: clientEmail,
        subject: "dup",
        template_key: "supervisor_escalation",
        entity_type: "internal_ticket",
        entity_id: ticketIdA,
        status: "queued",
      } as any);
      const { count } = await admin.from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("event_key", m.event_key);
      push("notifications", "N5_event_key_unique",
        count === 1,
        `rows_for_event_key=${count}`);
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

  // Delete all tickets created during this run (match idempotency_key prefix)
  const { data: qaTickets } = await admin.from("internal_tickets")
    .select("id").like("idempotency_key", `qa-m36-%-${runId}`);
  const qaTicketIds = (qaTickets ?? []).map((r: any) => r.id);
  const allTicketIds = Array.from(new Set([...qaTicketIds, ticketIdA, ticketIdB].filter(Boolean)));

  if (allTicketIds.length > 0) {
    await safeDel("email_queue", (b) => b.delete().in("entity_id", allTicketIds));
    await safeDel("admin_audit_log", (b) => b.delete().in("target_id", allTicketIds));
    await safeDel("internal_ticket_replies", (b) => b.delete().in("ticket_id", allTicketIds));
    await safeDel("internal_tickets", (b) => b.delete().in("id", allTicketIds));
  }
  await safeDel("email_queue", (b) => b.delete().like("idempotency_key", `qa-m36-%-${runId}`));

  for (const uid of [clientId, adminId, supId, supportId, unauthId].filter(Boolean)) {
    await safeDel("admin_audit_log", (b) => b.delete().eq("admin_user_id", uid));
    await safeDel("activity_logs", (b) => b.delete().eq("admin_user_id", uid));
    await safeDel("user_roles", (b) => b.delete().eq("admin_user_id", uid));
  }

  if (accountId) await safeDel("accounts", (b) => b.delete().eq("id", accountId));

  for (const uid of [clientId, adminId, supId, supportId, unauthId].filter(Boolean)) {
    await safeDel("profiles", (b) => b.delete().eq("id", uid));
    try { await admin.auth.admin.deleteUser(uid); } catch (e) { cleanupErrors.push(`auth:${(e as Error).message}`); }
  }

  // Orphan verification
  const orphans = { tickets: 0, emails: 0, audit: 0 };
  if (allTicketIds.length > 0) {
    const { count: t } = await admin.from("internal_tickets").select("id", { count: "exact", head: true })
      .in("id", allTicketIds);
    orphans.tickets = t ?? 0;
    const { count: e } = await admin.from("email_queue").select("id", { count: "exact", head: true })
      .in("entity_id", allTicketIds);
    orphans.emails = e ?? 0;
    const { count: a } = await admin.from("admin_audit_log").select("id", { count: "exact", head: true })
      .in("target_id", allTicketIds);
    orphans.audit = a ?? 0;
  }
  push("cleanup", "C1_no_orphan_tickets", orphans.tickets === 0, `count=${orphans.tickets}`);
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
    module: 36,
    run_id: runId,
    summary: { pass: passCount, fail: failCount, skip: skipCount, total },
    by_category: byCategory,
    cleanup: { orphans, errors: cleanupErrors },
    results,
  });
});
