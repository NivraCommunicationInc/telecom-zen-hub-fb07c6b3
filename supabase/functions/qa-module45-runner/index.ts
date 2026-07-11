// ============================================================================
// qa-module45-runner — Module 45 « Escalade superviseur (state machine + UI) »
// Validates: single door fusion, RBAC, state machine, idempotency,
// journal Client 360 (staff), notifications, direct-write invariant.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-qa-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const BOOTSTRAP = Deno.env.get("BOOTSTRAP_TOKEN") ?? "";

  const runId = crypto.randomUUID();
  const results: Array<{ id: string; category: string; ok: boolean; note?: string }> = [];
  const push = (category: string, id: string, ok: boolean, note = "") => results.push({ category, id, ok, note });

  const stamp = Date.now();
  const mkEmail = (t: string) => `qa-m45-${t}-${stamp}@qa.test`;

  const mkUser = async (email: string, meta: Record<string, unknown>) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: "QaTest1234!Xy", email_confirm: true,
      user_metadata: { qa: true, module: 45, run_id: runId, ...meta },
    });
    if (error) throw new Error(`create_user ${email}: ${error.message}`);
    return data.user!.id;
  };

  let clientId = "", adminId = "", supId = "", employeeId = "", unauthId = "", assigneeId = "";
  let accountId = "";
  const createdTicketIds: string[] = [];

  const invokeAction = async (body: Record<string, unknown>, actorId: string, actorEmail: string) => {
    const res = await fetch(`${url}/functions/v1/supervisor-escalation-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bootstrap-token": BOOTSTRAP,
        "x-qa-actor-id": actorId,
        "x-qa-actor-email": actorEmail,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null; try { data = JSON.parse(text); } catch { /* */ }
    return { status: res.status, data, text };
  };

  try {
    if (!BOOTSTRAP) return json({ ok: false, error: "BOOTSTRAP_TOKEN missing" }, 500);

    clientId = await mkUser(mkEmail("client"), { role: "client" });
    adminId = await mkUser(mkEmail("admin"), { role: "admin" });
    supId = await mkUser(mkEmail("sup"), { role: "supervisor" });
    employeeId = await mkUser(mkEmail("emp"), { role: "employee" });
    assigneeId = await mkUser(mkEmail("assignee"), { role: "supervisor" });
    unauthId = await mkUser(mkEmail("client2"), { role: "client" });

    await admin.from("profiles").upsert([
      { id: clientId, user_id: clientId, email: mkEmail("client"), first_name: "QA", last_name: "Client", account_type: "client" },
      { id: adminId, user_id: adminId, email: mkEmail("admin"), first_name: "QA", last_name: "Admin", account_type: "employee" },
      { id: supId, user_id: supId, email: mkEmail("sup"), first_name: "QA", last_name: "Sup", account_type: "employee" },
      { id: employeeId, user_id: employeeId, email: mkEmail("emp"), first_name: "QA", last_name: "Emp", account_type: "employee" },
      { id: assigneeId, user_id: assigneeId, email: mkEmail("assignee"), first_name: "QA", last_name: "Assignee", account_type: "employee" },
      { id: unauthId, user_id: unauthId, email: mkEmail("client2"), first_name: "QA", last_name: "C2", account_type: "client" },
    ] as any, { onConflict: "id" });

    for (const r of [
      { user_id: clientId, role: "client", status: "active" },
      { user_id: adminId, role: "admin", status: "active", can_access_core: true, is_active: true },
      { user_id: supId, role: "supervisor", status: "active", can_access_core: true, is_active: true },
      { user_id: employeeId, role: "employee", status: "active", can_access_core: true, is_active: true },
      { user_id: assigneeId, role: "supervisor", status: "active", can_access_core: true, is_active: true },
      { user_id: unauthId, role: "client", status: "active" },
    ]) {
      await admin.from("user_roles").upsert(r as any, { onConflict: "user_id,role" });
    }

    const { data: acct } = await admin.from("accounts").insert({
      client_id: clientId, account_number: `QA-M45-${stamp}`, status: "active",
    } as any).select("id").single();
    accountId = acct!.id;

    // ---------- T01: Employee door fusion — creates via canonical EF ----------
    const key1 = `m45-create-${stamp}-1`;
    const r1 = await invokeAction({
      action: "create", account_id: accountId, client_user_id: clientId,
      subject: "QA fusion create", description: "Test fusion door", escalation_type: "billing",
      idempotency_key: key1,
    }, employeeId, mkEmail("emp"));
    push("create", "T01_employee_create", r1.status === 200 && !!r1.data?.ticket_id, `status=${r1.status} body=${r1.text.slice(0,200)}`);
    if (r1.data?.ticket_id) createdTicketIds.push(r1.data.ticket_id);

    // ---------- T02: Idempotency replay ----------
    const r2 = await invokeAction({
      action: "create", account_id: accountId, client_user_id: clientId,
      subject: "QA fusion create", description: "Test fusion door", escalation_type: "billing",
      idempotency_key: key1,
    }, employeeId, mkEmail("emp"));
    push("idempotency", "T02_replay", r2.status === 200 && r2.data?.ticket_id === r1.data?.ticket_id, `replayed=${r2.data?.replayed || r2.data?.idempotent}`);

    // ---------- T03: Idempotency conflict (same key different body) ----------
    const r3 = await invokeAction({
      action: "create", account_id: accountId, client_user_id: clientId,
      subject: "DIFFERENT", description: "different body", escalation_type: "fraud",
      idempotency_key: key1,
    }, employeeId, mkEmail("emp"));
    push("idempotency", "T03_conflict", r3.status === 409, `status=${r3.status}`);

    // ---------- T04: Unauthorized role (client) blocked ----------
    const r4 = await invokeAction({
      action: "create", account_id: accountId, client_user_id: clientId,
      subject: "Should fail", description: "blocked", escalation_type: "other",
      idempotency_key: `m45-forbidden-${stamp}`,
    }, unauthId, mkEmail("client2"));
    push("rbac", "T04_client_forbidden", r4.status === 403, `status=${r4.status}`);

    // ---------- T05: Zod validation (short subject) ----------
    const r5 = await invokeAction({
      action: "create", account_id: accountId, client_user_id: clientId,
      subject: "x", description: "short", escalation_type: "other",
      idempotency_key: `m45-zod-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("validation", "T05_zod_reject", r5.status === 400, `status=${r5.status}`);

    // ---------- T06-T09: Valid state machine happy path ----------
    const ticket1 = r1.data?.ticket_id;
    const kAssign = `m45-assign-${stamp}`;
    const rAssign = await invokeAction({
      action: "assign", ticket_id: ticket1, new_status: "assigned",
      assignee_id: assigneeId, assignee_name: "QA Assignee",
      reason: "assign to supervisor", idempotency_key: kAssign,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T06_open_to_assigned", rAssign.status === 200 && rAssign.data?.new_status === "assigned", `s=${rAssign.status} n=${rAssign.data?.new_status} d=${rAssign.data?.detail || rAssign.text?.slice(0,80)}`);

    const rInv = await invokeAction({
      action: "transition", ticket_id: ticket1, new_status: "investigating",
      reason: "start investigation", idempotency_key: `m45-inv-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T07_assigned_to_investigating", rInv.status === 200 && rInv.data?.new_status === "investigating", `s=${rInv.status}`);

    const rWait = await invokeAction({
      action: "transition", ticket_id: ticket1, new_status: "waiting_information",
      reason: "need info", idempotency_key: `m45-wait-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T08_investigating_to_waiting", rWait.status === 200, `s=${rWait.status}`);

    const rBack = await invokeAction({
      action: "transition", ticket_id: ticket1, new_status: "investigating",
      reason: "info received", idempotency_key: `m45-back-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T09_waiting_to_investigating", rBack.status === 200, `s=${rBack.status}`);

    const rRes = await invokeAction({
      action: "transition", ticket_id: ticket1, new_status: "resolved",
      reason: "resolved", idempotency_key: `m45-res-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T10_investigating_to_resolved", rRes.status === 200, `s=${rRes.status}`);

    const rClose = await invokeAction({
      action: "transition", ticket_id: ticket1, new_status: "closed",
      reason: "close", idempotency_key: `m45-close-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T11_resolved_to_closed", rClose.status === 200, `s=${rClose.status}`);

    // ---------- T12: Terminal — no return from closed ----------
    const rReopen = await invokeAction({
      action: "transition", ticket_id: ticket1, new_status: "investigating",
      reason: "reopen attempt", idempotency_key: `m45-reopen-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T12_closed_terminal", rReopen.status === 409, `s=${rReopen.status}`);

    // ---------- T13: Illegal transition open -> resolved ----------
    const key2 = `m45-create2-${stamp}`;
    const r13c = await invokeAction({
      action: "create", account_id: accountId, client_user_id: clientId,
      subject: "T13 illegal path", description: "test illegal", escalation_type: "technical",
      idempotency_key: key2,
    }, adminId, mkEmail("admin"));
    const ticket2 = r13c.data?.ticket_id;
    createdTicketIds.push(ticket2);
    const r13 = await invokeAction({
      action: "transition", ticket_id: ticket2, new_status: "resolved",
      reason: "skip states", idempotency_key: `m45-illegal-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("state_machine", "T13_open_to_resolved_forbidden", r13.status === 409, `s=${r13.status}`);

    // ---------- T14: Employee cannot resolve/close (terminal restricted) ----------
    // Move ticket2 to assigned first
    await invokeAction({
      action: "assign", ticket_id: ticket2, new_status: "assigned",
      assignee_id: assigneeId, assignee_name: "QA Assignee",
      reason: "assign", idempotency_key: `m45-t14-assign-${stamp}`,
    }, adminId, mkEmail("admin"));
    await invokeAction({
      action: "transition", ticket_id: ticket2, new_status: "investigating",
      reason: "inv", idempotency_key: `m45-t14-inv-${stamp}`,
    }, adminId, mkEmail("admin"));
    const rEmpResolve = await invokeAction({
      action: "transition", ticket_id: ticket2, new_status: "resolved",
      reason: "emp resolve", idempotency_key: `m45-t14-emp-${stamp}`,
    }, employeeId, mkEmail("emp"));
    push("rbac", "T14_employee_terminal_forbidden", rEmpResolve.status === 403, `s=${rEmpResolve.status}`);

    // ---------- T15: Assign requires assignee ----------
    const key3 = `m45-create3-${stamp}`;
    const r15c = await invokeAction({
      action: "create", account_id: accountId, client_user_id: clientId,
      subject: "T15 assign nul", description: "test", escalation_type: "other",
      idempotency_key: key3,
    }, adminId, mkEmail("admin"));
    const ticket3 = r15c.data?.ticket_id;
    createdTicketIds.push(ticket3);
    const r15 = await invokeAction({
      action: "assign", ticket_id: ticket3, new_status: "assigned",
      reason: "no assignee", idempotency_key: `m45-noassignee-${stamp}`,
    }, adminId, mkEmail("admin"));
    push("validation", "T15_assign_requires_assignee", r15.status === 400, `s=${r15.status}`);

    // ---------- T16: Direct INSERT into internal_tickets (supervisor) blocked ----------
    const { error: directErr } = await admin.from("internal_tickets").insert({
      subject: "[DIRECT] blocked", description: "should fail",
      category: "escalation", assigned_to_department: "supervisor",
      priority: "urgent", status: "open",
      created_by_id: adminId, created_by_name: "QA", created_by_role: "admin",
      created_by_email: mkEmail("admin"),
    } as any);
    push("invariant", "T16_direct_insert_blocked", !!directErr && (directErr.message.includes("INVARIANT-ESCALATION") || directErr.message.includes("forbidden")), `err=${directErr?.message?.slice(0,80) ?? "none"}`);

    // ---------- T17: Journal Client 360 events landed ----------
    const { data: journalRows } = await admin
      .from("client_activity_logs").select("event_key, action_type, visibility")
      .eq("client_id", clientId).eq("visibility", "staff")
      .like("event_key", "escalation:%");
    const hasCreated = journalRows?.some((r: any) => r.event_key === `escalation:${ticket1}:created`);
    const hasResolved = journalRows?.some((r: any) => r.event_key === `escalation:${ticket1}:resolved`);
    const hasClosed = journalRows?.some((r: any) => r.event_key === `escalation:${ticket1}:closed`);
    push("timeline", "T17_journal_created", !!hasCreated, `rows=${journalRows?.length ?? 0}`);
    push("timeline", "T18_journal_resolved", !!hasResolved);
    push("timeline", "T19_journal_closed", !!hasClosed);

    // ---------- T20: v_customer_timeline surfaces the escalation ----------
    const { data: tl } = await admin.from("v_customer_timeline")
      .select("event_id, source_table, event_type, visibility")
      .eq("client_id", clientId).eq("visibility", "staff").limit(50);
    push("timeline", "T20_view_includes_staff_events", (tl?.length ?? 0) >= 3, `rows=${tl?.length ?? 0}`);

    // ---------- T21: Admin audit log present ----------
    const { data: audit } = await admin.from("admin_audit_log")
      .select("action").eq("target_id", ticket1).like("action", "supervisor_escalation:%");
    const distinct = new Set((audit ?? []).map((a: any) => a.action));
    push("audit", "T21_audit_all_transitions",
      distinct.has("supervisor_escalation:create")
      && distinct.has("supervisor_escalation:assigned")
      && distinct.has("supervisor_escalation:investigating")
      && distinct.has("supervisor_escalation:waiting_information")
      && distinct.has("supervisor_escalation:resolved")
      && distinct.has("supervisor_escalation:closed"),
      `actions=${Array.from(distinct).join(",")}`);

    // ---------- T22: Communication gateway hits ----------
    const { data: comms } = await admin.from("communication_audit_log")
      .select("template_key, entity_id").eq("entity_type", "internal_ticket").eq("entity_id", ticket1);
    push("notifications", "T22_gateway_used", (comms?.length ?? 0) >= 1, `rows=${comms?.length ?? 0}`);

    // ---------- T23: Idempotency cache row exists ----------
    const { data: idem } = await admin.from("escalation_action_idempotency")
      .select("idempotency_key").eq("idempotency_key", kAssign).maybeSingle();
    push("idempotency", "T23_cache_row", !!idem);
  } catch (e: any) {
    push("harness", "harness_error", false, e?.message ?? String(e));
  } finally {
    // Cleanup
    try {
      for (const tid of createdTicketIds) {
        await admin.from("admin_audit_log").delete().eq("target_id", tid);
        await admin.from("client_activity_logs").delete().eq("correlation_id", tid);
        await admin.rpc("execute_sql" as any, { sql: "" }).catch(() => {});
      }
      await admin.from("escalation_action_idempotency").delete().like("idempotency_key", `m45-%-${stamp}%`);
      await admin.from("communication_audit_log").delete().like("idempotency_key", `m45-%-${stamp}%`);
      await admin.from("internal_tickets").delete().in("id", createdTicketIds.filter(Boolean));
      await admin.from("accounts").delete().eq("id", accountId);
      for (const uid of [clientId, adminId, supId, employeeId, assigneeId, unauthId].filter(Boolean)) {
        await admin.from("user_roles").delete().eq("user_id", uid);
        await admin.from("profiles").delete().eq("id", uid);
        await admin.auth.admin.deleteUser(uid);
      }
    } catch (e) {
      console.error("[qa-m45] cleanup:", (e as Error).message);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  return json({ run_id: runId, module: 45, passed, total, ok: passed === total, results });
});
