// QA runner — Module 28 (Service Internet)
// E2E validation of internet-account-actions
//   {change_plan, modem_action, run_diagnostic, set_wifi, set_static_ip}
//
// Isolated: aucun vrai client, aucun provisioning réel (simulated=true côté serveur).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Check = { id: string; name: string; ok: boolean; details?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const keep = !!body?.keep;
  const checks: Check[] = [];
  const push = (c: Check) => checks.push(c);

  const callEF = async (accessToken: string, payload: unknown) => {
    const r = await fetch(`${url}/functions/v1/internet-account-actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    });
    let j: any = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
  };

  const ensureCaller = async (email: string, role: string) => {
    const password = `Qa28!${crypto.randomUUID()}`;
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let userId: string;
    if (ep?.user_id) {
      await admin.auth.admin.updateUserById(ep.user_id, { password });
      userId = ep.user_id;
    } else {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { qa: "m28" },
      });
      if (error || !nu?.user) throw new Error(`createUser ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA28-${Date.now().toString().slice(-6)}-${role[0]}`,
        first_name: role, last_name: "QA-M28", email,
      });
    }
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role });
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    const tj = await r.json();
    if (!tj?.access_token) throw new Error(`signin ${email}: ${JSON.stringify(tj)}`);
    return { userId, jwt: tj.access_token as string };
  };

  const ensureClient = async (email: string, label: string) => {
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let userId: string;
    if (ep?.user_id) userId = ep.user_id;
    else {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password: `Qa28!${crypto.randomUUID()}`, email_confirm: true, user_metadata: { qa: "m28_client" },
      });
      if (error || !nu?.user) throw new Error(`createClient ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA28C-${Date.now().toString().slice(-6)}-${label}`,
        first_name: `Client${label}`, last_name: "QA-M28", email,
      });
    }
    const { data: existing } = await admin.from("accounts")
      .select("id").eq("client_id", userId).maybeSingle();
    if (existing) return { userId, accountId: existing.id as string };
    const { data: acc, error } = await admin.from("accounts").insert({
      client_id: userId,
      account_number: `QA28-${label}-${Date.now().toString().slice(-6)}`,
      account_name: `QA M28 ${label}`, status: "active",
      billing_address: "1 QA St", billing_city: "Laval",
      billing_province: "QC", billing_postal_code: "H7T 2Y5",
      primary_service_address: "1 QA St", primary_service_city: "Laval",
      primary_service_province: "QC", primary_service_postal_code: "H7T 2Y5",
    }).select("id").single();
    if (error) throw new Error(`account ${label}: ${error.message}`);
    return { userId, accountId: acc.id as string };
  };

  const ensureCatalogPlan = async (name: string, price: number) => {
    const { data: existing } = await admin
      .from("services")
      .select("id, name, price")
      .eq("category", "Internet")
      .ilike("name", name)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await admin.from("services").insert({
      name, category: "Internet", price, status: "active", is_active: true,
    }).select("id, name, price").single();
    if (error) throw new Error(`catalog: ${error.message}`);
    return data;
  };

  const cleanupClient = async (userId: string, accountId: string) => {
    await admin.from("internet_plan_changes").delete().eq("user_id", userId);
    await admin.from("internet_modem_actions").delete().eq("user_id", userId);
    await admin.from("internet_diagnostics").delete().eq("user_id", userId);
    await admin.from("internet_wifi_settings").delete().eq("user_id", userId);
    await admin.from("internet_static_ip_assignments").delete().eq("user_id", userId);
    await admin.from("client_activity_logs").delete().eq("client_id", userId);
    await admin.from("client_internal_notes").delete().eq("client_id", userId);
    await admin.from("email_queue").delete().eq("to_email", (await admin.from("profiles").select("email").eq("user_id", userId).maybeSingle()).data?.email || "___");
    await admin.from("billing_subscriptions").delete().eq("customer_id", userId).eq("environment", "test");
  };

  const cleanupAudit = async (callerIds: string[]) => {
    for (const id of callerIds) {
      await admin.from("admin_audit_log").delete().eq("admin_user_id", id).like("action", "internet.%");
    }
  };

  try {
    // ---- Setup catalog ------------------------------------------------
    const canonicalPlan = await ensureCatalogPlan("QA Internet 500 Mbps", 50);

    // ---- Setup callers & clients --------------------------------------
    const adminCaller = await ensureCaller("qa-m28-admin@nivra-test.ca", "admin");
    const salesCaller = await ensureCaller("qa-m28-sales@nivra-test.ca", "sales");
    const supportCaller = await ensureCaller("qa-m28-support@nivra-test.ca", "support");
    const clientA = await ensureClient("qa-m28-client-a@nivra-test.ca", "A");
    const clientB = await ensureClient("qa-m28-client-b@nivra-test.ca", "B");

    // Fresh state
    await cleanupClient(clientA.userId, clientA.accountId);
    await cleanupClient(clientB.userId, clientB.accountId);
    await cleanupAudit([adminCaller.userId, salesCaller.userId, supportCaller.userId]);

    // Seed a billing_customer + billing_subscription for clientA (F28-17 sync)
    await admin.from("billing_customers").delete().eq("user_id", clientA.userId);
    const { data: bc, error: bcErr } = await admin.from("billing_customers").insert({
      user_id: clientA.userId, email: "qa-m28-client-a@nivra-test.ca",
      first_name: "ClientA", last_name: "QA-M28", phone: "5145550100",
    }).select("id").single();
    if (bcErr || !bc) throw new Error(`billing_customers: ${bcErr?.message}`);
    const { data: bsub, error: bsubErr } = await admin.from("billing_subscriptions").insert({
      customer_id: bc!.id,
      plan_code: "qa_internet_500",
      plan_name: "QA Internet 500 Mbps",
      plan_price: 50,
      status: "active",
      environment: "test",
      auto_billing_enabled: false,
      cycle_start_date: new Date().toISOString().slice(0, 10),
      cycle_end_date: new Date(Date.now() + 25 * 86_400_000).toISOString().slice(0, 10),
      billing_anchor_date: new Date().toISOString().slice(0, 10),
      billing_cycle_anchor: Math.min(new Date().getDate(), 28),
    }).select("id").single();
    if (bsubErr || !bsub) throw new Error(`billing_subscriptions: ${bsubErr?.message}`);

    // =============== CHANGE_PLAN ===============
    // C1 sales → 403 FORBIDDEN_ROLE
    {
      const r = await callEF(salesCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 50, reason: "sales tries change_plan",
      });
      push({ id: "C1", name: "sales change_plan → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C2 reason too short
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 50, reason: "abc",
      });
      push({ id: "C2", name: "reason < 5 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C3 unknown plan
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: "Forfait Inexistant 9999", new_monthly_price: 99,
        reason: "trying unknown plan against catalogue",
      });
      push({ id: "C3", name: "plan hors catalogue → UNKNOWN_PLAN",
        ok: r.status === 400 && r.body?.error_code === "UNKNOWN_PLAN", details: r });
    }

    // C4 cross-client account
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientB.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 50,
        reason: "cross-client account attempt",
      });
      push({ id: "C4", name: "cross-client account → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C5 client_user_id inconnu
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: "00000000-0000-0000-0000-000000000000",
        account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 50,
        reason: "unknown client_user_id",
      });
      push({ id: "C5", name: "client inconnu → 404 NOT_FOUND",
        ok: r.status === 404 && r.body?.error_code === "NOT_FOUND", details: r });
    }

    // C6 change_plan valide
    const planIdemKey = `qa28-plan-${crypto.randomUUID()}`;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        previous_plan_name: "QA Internet Legacy", previous_monthly_price: 40,
        new_plan_name: canonicalPlan.name, new_monthly_price: 50,
        change_type: "upgrade", reason: "official upgrade to canonical plan",
        idempotency_key: planIdemKey,
      });
      push({ id: "C6", name: "admin change_plan valide → 200 + plan_change_id",
        ok: r.status === 200 && r.body?.ok === true && !!r.body?.plan_change_id, details: r });
    }

    // C7 idempotency replay
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 50,
        reason: "replay attempt same idempotency key",
        idempotency_key: planIdemKey,
      });
      push({ id: "C7", name: "idempotency replay → 200 replayed=true",
        ok: r.status === 200 && r.body?.replayed === true, details: r });
    }

    // C8 simulated=true dans internet_plan_changes
    {
      const { data: rows } = await admin.from("internet_plan_changes")
        .select("id, metadata").eq("user_id", clientA.userId);
      const allSimulated = (rows || []).length > 0 && rows!.every((r: any) => r.metadata?.simulated === true);
      push({ id: "C8", name: "internet_plan_changes.metadata.simulated=true",
        ok: allSimulated, details: { count: rows?.length, sample: rows?.[0]?.metadata } });
    }

    // C9 billing_subscriptions.plan_name synchronisé (F28-17)
    {
      const { data: bsAfter } = await admin.from("billing_subscriptions")
        .select("plan_name").eq("id", bsub!.id).single();
      push({ id: "C9", name: "billing_subscriptions.plan_name synchronisé",
        ok: bsAfter?.plan_name === canonicalPlan.name, details: bsAfter });
    }

    // =============== MODEM_ACTION ===============
    // C10 support factory_reset → 403 FORBIDDEN_ROLE (critical)
    {
      const r = await callEF(supportCaller.jwt, {
        action: "modem_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "factory_reset", modem_serial: "QA-M28-001",
        reason: "support tries critical factory reset action",
      });
      push({ id: "C10", name: "support factory_reset → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C11 reboot motif <5 → REASON_REQUIRED
    {
      const r = await callEF(adminCaller.jwt, {
        action: "modem_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "reboot", modem_serial: "QA-M28-001", reason: "x",
      });
      push({ id: "C11", name: "reboot motif <5 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C12 factory_reset motif <10 → REASON_REQUIRED
    {
      const r = await callEF(adminCaller.jwt, {
        action: "modem_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "factory_reset", modem_serial: "QA-M28-001", reason: "short",
      });
      push({ id: "C12", name: "factory_reset motif <10 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C13 reboot admin OK
    {
      const r = await callEF(adminCaller.jwt, {
        action: "modem_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "reboot", modem_serial: "QA-M28-001", reason: "planned reboot after upgrade",
      });
      push({ id: "C13", name: "reboot admin → 200",
        ok: r.status === 200 && !!r.body?.modem_action_id, details: r });
    }

    // C14 reboot cooldown → 429 RATE_LIMIT
    {
      const r = await callEF(adminCaller.jwt, {
        action: "modem_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "reboot", modem_serial: "QA-M28-001", reason: "second reboot within cooldown",
      });
      push({ id: "C14", name: "reboot cooldown → 429 RATE_LIMIT",
        ok: r.status === 429 && r.body?.error_code === "RATE_LIMIT", details: r });
    }

    // C15 factory_reset admin OK with different serial
    {
      const r = await callEF(adminCaller.jwt, {
        action: "modem_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "factory_reset", modem_serial: "QA-M28-002",
        reason: "admin performs certified factory reset for QA validation",
      });
      push({ id: "C15", name: "factory_reset admin motif OK → 200",
        ok: r.status === 200 && !!r.body?.modem_action_id, details: r });
    }

    // C16 simulated=true dans internet_modem_actions
    {
      const { data: rows } = await admin.from("internet_modem_actions")
        .select("metadata").eq("user_id", clientA.userId);
      const allSim = (rows || []).length > 0 && rows!.every((r: any) => r.metadata?.simulated === true);
      push({ id: "C16", name: "internet_modem_actions.metadata.simulated=true",
        ok: allSim, details: { count: rows?.length } });
    }

    // =============== RUN_DIAGNOSTIC ===============
    // C17 link_status "up" normalisé → ok
    {
      const r = await callEF(adminCaller.jwt, {
        action: "run_diagnostic", client_user_id: clientA.userId, account_id: clientA.accountId,
        diagnostic_type: "full", link_status: "up",
        download_mbps: 480, upload_mbps: 40, latency_ms: 12, packet_loss_pct: 0,
      });
      push({ id: "C17", name: "diagnostic link_status=up → 200",
        ok: r.status === 200 && !!r.body?.diagnostic_id, details: r });
      // verify stored as "ok"
      const { data: diag } = await admin.from("internet_diagnostics")
        .select("link_status").eq("id", r.body?.diagnostic_id).maybeSingle();
      push({ id: "C18", name: "diagnostic link_status stocké = ok",
        ok: diag?.link_status === "ok", details: diag });
    }

    // C19 link_status invalide
    {
      const r = await callEF(adminCaller.jwt, {
        action: "run_diagnostic", client_user_id: clientA.userId, account_id: clientA.accountId,
        diagnostic_type: "full", link_status: "wobbly",
      });
      push({ id: "C19", name: "link_status invalide → INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // =============== SET_WIFI ===============
    // C20 set_wifi admin OK, scoped par account
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_wifi", client_user_id: clientA.userId, account_id: clientA.accountId,
        ssid_24: "NIVRA_A_24", ssid_5: "NIVRA_A_5", band_mode: "dual", guest_enabled: false,
      });
      push({ id: "C20", name: "set_wifi admin → 200",
        ok: r.status === 200, details: r });
      const { data: rows } = await admin.from("internet_wifi_settings")
        .select("id, ssid_24, account_id").eq("user_id", clientA.userId);
      push({ id: "C21", name: "wifi scoped par (user, account) — 1 seule ligne",
        ok: (rows || []).length === 1 && rows![0].account_id === clientA.accountId,
        details: rows });
    }

    // =============== SET_STATIC_IP ===============
    // C22 support → 403 FORBIDDEN_ROLE
    {
      const r = await callEF(supportCaller.jwt, {
        action: "set_static_ip", client_user_id: clientA.userId, account_id: clientA.accountId,
        static_ip_mode: "assign", ip_address: "10.20.30.40", monthly_price: 5,
        reason: "support tries static IP assignment",
      });
      push({ id: "C22", name: "support static_ip → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C23 assign motif <5 → REASON_REQUIRED
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_static_ip", client_user_id: clientA.userId, account_id: clientA.accountId,
        static_ip_mode: "assign", ip_address: "10.20.30.40", monthly_price: 5, reason: "abc",
      });
      push({ id: "C23", name: "static_ip assign motif <5 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C24 assign OK
    let assignId: string | null = null;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_static_ip", client_user_id: clientA.userId, account_id: clientA.accountId,
        static_ip_mode: "assign", ip_address: "10.20.30.40", monthly_price: 5,
        reason: "assign static IP for QA validation",
      });
      assignId = r.body?.assignment_id ?? null;
      push({ id: "C24", name: "static_ip assign admin → 200",
        ok: r.status === 200 && !!assignId, details: r });
    }

    // C25 duplicate → 409
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_static_ip", client_user_id: clientA.userId, account_id: clientA.accountId,
        static_ip_mode: "assign", ip_address: "10.20.30.40", monthly_price: 5,
        reason: "duplicate ip attempt for QA",
      });
      push({ id: "C25", name: "static_ip dup → 409 DUPLICATE_ACTIVE",
        ok: r.status === 409 && r.body?.error_code === "DUPLICATE_ACTIVE", details: r });
    }

    // C26 release cross-client (clientB releasing A's IP)
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_static_ip", client_user_id: clientB.userId,
        static_ip_mode: "release", assignment_id: assignId,
        reason: "cross-client release attempt for QA",
      });
      push({ id: "C26", name: "static_ip release cross-client → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C27 release motif <5
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_static_ip", client_user_id: clientA.userId,
        static_ip_mode: "release", assignment_id: assignId, reason: "x",
      });
      push({ id: "C27", name: "static_ip release motif <5 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C28 release OK
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_static_ip", client_user_id: clientA.userId,
        static_ip_mode: "release", assignment_id: assignId,
        reason: "release static IP after QA validation",
      });
      push({ id: "C28", name: "static_ip release admin → 200",
        ok: r.status === 200, details: r });
    }

    // =============== UNKNOWN ACTION ===============
    {
      const r = await callEF(adminCaller.jwt, {
        action: "does_not_exist", client_user_id: clientA.userId,
      } as any);
      push({ id: "C29", name: "action inconnue → UNKNOWN_ACTION",
        ok: r.status === 400 && r.body?.error_code === "UNKNOWN_ACTION", details: r });
    }

    // =============== LOGS / EMAILS / AUDIT ===============
    {
      const { count: auditCount } = await admin.from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("admin_user_id", adminCaller.userId)
        .like("action", "internet.%");
      push({ id: "C30", name: "admin_audit_log internet.* > 0",
        ok: (auditCount ?? 0) > 0, details: { auditCount } });

      const { count: cal } = await admin.from("client_activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientA.userId)
        .like("entity_type", "internet_%");
      push({ id: "C31", name: "client_activity_logs internet_% > 0",
        ok: (cal ?? 0) > 0, details: { cal } });

      const { count: notes } = await admin.from("client_internal_notes")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientA.userId)
        .eq("note_type", "system");
      push({ id: "C32", name: "client_internal_notes system > 0",
        ok: (notes ?? 0) > 0, details: { notes } });

      const { count: emails } = await admin.from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("to_email", "qa-m28-client-a@nivra-test.ca")
        .like("template_key", "client_internet_%");
      push({ id: "C33", name: "email_queue client_internet_* > 0",
        ok: (emails ?? 0) > 0, details: { emails } });

      // actor_role stored
      const { data: sample } = await admin.from("admin_audit_log")
        .select("details").eq("admin_user_id", adminCaller.userId)
        .like("action", "internet.%").limit(1).maybeSingle();
      push({ id: "C34", name: "admin_audit_log.details.actor_role présent",
        ok: !!sample?.details && typeof (sample.details as any).actor_role === "string",
        details: sample?.details });
    }

    // =============== ANTI-FLOOD ===============
    {
      const nowIso = new Date().toISOString();
      const rows = Array.from({ length: 20 }).map(() => ({
        admin_user_id: salesCaller.userId,
        admin_email: "qa-m28-sales@nivra-test.ca",
        action: "internet.flood_seed",
        target_type: "client",
        target_id: clientA.userId,
        details: { seed: "flood_m28", ts: nowIso },
      }));
      await admin.from("admin_audit_log").insert(rows);
      // sales cannot change_plan (403 by role) but anti-flood is checked BEFORE role gate for the action.
      // Actually role gate is in the switch; anti-flood is checked before. So use a diagnostic (sales role is in ROLES_READ_ALL).
      const r = await callEF(salesCaller.jwt, {
        action: "run_diagnostic", client_user_id: clientA.userId, account_id: clientA.accountId,
        diagnostic_type: "full",
      });
      push({ id: "C35", name: "anti-flood → 429 RATE_LIMIT",
        ok: r.status === 429 && r.body?.error_code === "RATE_LIMIT", details: r });
      await admin.from("admin_audit_log").delete()
        .eq("admin_user_id", salesCaller.userId)
        .contains("details", { seed: "flood_m28" });
    }

    // =============== CLEANUP ===============
    if (!keep) {
      await cleanupClient(clientA.userId, clientA.accountId);
      await cleanupClient(clientB.userId, clientB.accountId);
      await cleanupAudit([adminCaller.userId, salesCaller.userId, supportCaller.userId]);
      await admin.from("billing_customers").delete().eq("user_id", clientA.userId);
    }

    const pass = checks.filter((c) => c.ok).length;
    const fail = checks.length - pass;
    return json({
      module: "M28",
      total: checks.length, pass, fail,
      status: fail === 0 ? "PASS" : "FAIL",
      checks,
    });
  } catch (e) {
    return json({ error: (e as Error).message, checks }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
