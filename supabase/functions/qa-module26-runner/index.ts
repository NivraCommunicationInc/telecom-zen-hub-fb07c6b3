// QA runner — Module 26 (Annulation compte)
// E2E validation of account-ops-actions {cancel_account}
// Covers: F26-1 ownership · F26-2 cascade via billing_customers.id ·
// F26-3 email · F26-4 motif ≥ 5 · F26-5 AutoPay OFF · F26-6 idempotency ·
// F26-7 snapshot before/after · F26-8 solde impayé · F26-9 équipement à retourner ·
// F26-11 rôle restreint.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOROLE_EMAIL = "qa-module26-norole@nivra-test.ca";
const CLIENT_A_EMAIL = "qa-module26-client-a@nivra-test.ca";
const CLIENT_B_EMAIL = "qa-module26-client-b@nivra-test.ca";

type Check = { id: string; name: string; ok: boolean; details?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ---- QA admin caller (real JWT) ---------------------------------------
  let jwt: string, callerId: string;
  {
    const email = "qa-module26-runner-admin@nivra-test.ca";
    const password = `Qa26!${crypto.randomUUID()}`;
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let user: { id: string } | null = null;
    if (ep?.user_id) {
      const { data } = await admin.auth.admin.getUserById(ep.user_id);
      if (data?.user) { user = data.user; await admin.auth.admin.updateUserById(user.id, { password }); }
    }
    if (!user) {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { qa: "m26_runner_admin" },
      });
      if (error || !nu?.user) return json({ error: `create_qa_admin: ${error?.message}` }, 500);
      user = nu.user;
    }
    const { data: p } = await admin.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!p) {
      await admin.from("profiles").insert({
        user_id: user.id, client_number: `QA26-RUN-${Date.now().toString().slice(-6)}`,
        first_name: "QA26", last_name: "Runner", email,
      });
    }
    await admin.from("user_roles").upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    const tj = await r.json();
    if (!tj?.access_token) return json({ error: `qa_admin_signin: ${JSON.stringify(tj)}` }, 500);
    jwt = tj.access_token; callerId = user.id;
  }

  const body = await req.json().catch(() => ({}));
  const keep = !!body?.keep;

  const checks: Check[] = [];
  const push = (c: Check) => checks.push(c);

  const callEF = async (accessToken: string, payload: unknown) => {
    const r = await fetch(`${url}/functions/v1/account-ops-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: anonKey },
      body: JSON.stringify(payload),
    });
    let j: any = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
  };

  const upsertUser = async (email: string, meta: Record<string, unknown>) => {
    const password = `Qa26!${crypto.randomUUID()}`;
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    if (ep?.user_id) {
      await admin.auth.admin.updateUserById(ep.user_id, { password });
      return { id: ep.user_id, password, reused: true };
    }
    const { data: nu, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
    if (error || !nu?.user) throw new Error(`createUser ${email}: ${error?.message}`);
    return { id: nu.user.id, password, reused: false };
  };

  const ensureProfile = async (userId: string, email: string, first: string) => {
    const { data: p } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (p) return;
    await admin.from("profiles").insert({
      user_id: userId, client_number: `QA26-${Date.now().toString().slice(-6)}-${first[0]}`,
      first_name: first, last_name: "QA-M26", email,
    });
  };

  const resetAccount = async (accountId: string) => {
    await admin.from("accounts").update({
      status: "active", cancelled_at: null, cancellation_reason: null,
    }).eq("id", accountId);
  };

  const ensureAccount = async (userId: string, label: string): Promise<string> => {
    const { data: existing } = await admin.from("accounts")
      .select("id").eq("client_id", userId).maybeSingle();
    if (existing) { await resetAccount(existing.id); return existing.id as string; }
    const { data: acc, error } = await admin.from("accounts").insert({
      client_id: userId,
      account_number: `QA26-${label}-${Date.now().toString().slice(-6)}`,
      account_name: `QA M26 ${label}`,
      status: "active",
      billing_address: "1799 Av. Pierre-Péladeau",
      billing_city: "Laval", billing_province: "QC", billing_postal_code: "H7T 2Y5",
      primary_service_address: "1799 Av. Pierre-Péladeau",
      primary_service_city: "Laval", primary_service_province: "QC", primary_service_postal_code: "H7T 2Y5",
    }).select("id").single();
    if (error || !acc) throw new Error(`account ${label}: ${error?.message}`);
    await admin.from("account_tags").insert({
      account_id: acc.id, client_user_id: userId,
      tag_key: "qa_test_account", tag_label: "QA Module 26", severity: "info",
      note: "Compte QA Module 26 — cleanup automatique.", created_by: callerId,
    });
    return acc.id as string;
  };

  const ensureBillingCustomer = async (userId: string, email: string): Promise<string> => {
    const { data: bc } = await admin.from("billing_customers").select("id").eq("user_id", userId).maybeSingle();
    if (bc?.id) {
      await admin.from("billing_customers").update({ autopay_enabled: true, autopay_discount_active: true }).eq("id", bc.id);
      return bc.id as string;
    }
    const { data: ins, error } = await admin.from("billing_customers").insert({
      user_id: userId, first_name: "QA", last_name: "M26", email, phone: "5140000000",
      status: "active", autopay_enabled: true, autopay_discount_active: true,
    }).select("id").single();
    if (error || !ins) throw new Error(`billing_customer: ${error?.message}`);
    return ins.id as string;
  };

  const signIn = async (email: string, password: string): Promise<string> => {
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!j?.access_token) throw new Error(`signIn ${email}: ${JSON.stringify(j)}`);
    return j.access_token as string;
  };

  let clientA: string, clientB: string, accountA: string, accountB: string;
  let billingCustA: string, billingCustB: string;
  let noRoleJwt: string;
  const createdSubIds: string[] = [];
  const createdEquipIds: string[] = [];

  try {
    const uA = await upsertUser(CLIENT_A_EMAIL, { qa: "m26", role: "client_a" });
    const uB = await upsertUser(CLIENT_B_EMAIL, { qa: "m26", role: "client_b" });
    const uNR = await upsertUser(NOROLE_EMAIL, { qa: "m26", role: "staff_norole" });
    clientA = uA.id; clientB = uB.id;
    await ensureProfile(clientA, CLIENT_A_EMAIL, "Alpha");
    await ensureProfile(clientB, CLIENT_B_EMAIL, "Bravo");
    await ensureProfile(uNR.id, NOROLE_EMAIL, "NoRole");
    accountA = await ensureAccount(clientA, "A");
    accountB = await ensureAccount(clientB, "B");
    billingCustA = await ensureBillingCustomer(clientA, CLIENT_A_EMAIL);
    billingCustB = await ensureBillingCustomer(clientB, CLIENT_B_EMAIL);

    // Purge any leftover subs / equipment from prior runs
    // Phase 6E — canonical QA fixture gateway (env=test only)
    await admin.rpc("rpc_qa_reset_subscription_fixture", { p_customer_ids: [billingCustA, billingCustB] });
    await admin.from("equipment_inventory").delete().in("account_id", [accountA, accountB]);
    await admin.from("equipment_return_requests").delete().in("account_id", [accountA, accountB]);

    const nowIso = new Date().toISOString();
    const inXDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

    // Seed helper orders + order_items (is_recurring=true) for traceability guards.
    async function seedRecurringItem(userId: string, acctId: string, category: "Internet" | "TV") {
      const { data: ord, error: ordErr } = await admin.from("orders").insert({
        user_id: userId, account_id: acctId, service_type: category.toLowerCase(),
        order_number: `QA26-ORD-${crypto.randomUUID().slice(0, 8)}`, status: "completed",
      }).select("id").single();
      if (ordErr) throw new Error(`seed_order: ${ordErr.message}`);
      const { data: it, error: itErr } = await admin.from("order_items").insert({
        order_id: ord.id, service_type: category.toLowerCase(),
        plan_code: `QA26-${category}-${Date.now()}`, plan_name: `QA ${category}`,
        unit_price: 49.99, quantity: 1, line_total: 49.99, is_recurring: true, status: "active",
      }).select("id").single();
      if (itErr) throw new Error(`seed_item: ${itErr.message}`);
      return it.id as string;
    }
    const itemA1 = await seedRecurringItem(clientA, accountA, "Internet");
    const itemA2 = await seedRecurringItem(clientA, accountA, "TV");
    const itemB1 = await seedRecurringItem(clientB, accountB, "Internet");

    const frozen = (name: string, code: string, price: number) => ({
      frozen_name: name, frozen_code: code, frozen_unit_price: price,
      frozen_currency: "CAD", frozen_cycle: "monthly", frozen_frequency: "monthly",
      frozen_anchor_date: nowIso.slice(0, 10),
    });
    const traceBase = { source_type: "qa_module26" };
    // Phase 6E — QA seed rows tagged environment='test' and provenance for canonical trigger
    const qaSeedRows = [
      { customer_id: billingCustA, plan_code: `QA26-INT-${Date.now()}-a`, plan_name: "QA Internet 50",
        plan_price: 49.99, cycle_start_date: nowIso, cycle_end_date: inXDays(30),
        status: "active", service_category: "Internet", environment: "test",
        source_order_item_id: itemA1, source_id: itemA1, ...traceBase, ...frozen("QA Internet 50", "QA26-INT", 49.99) },
      { customer_id: billingCustA, plan_code: `QA26-TV-${Date.now()}-a`, plan_name: "QA TV Base",
        plan_price: 29.99, cycle_start_date: nowIso, cycle_end_date: inXDays(30),
        status: "active", service_category: "TV", environment: "test",
        source_order_item_id: itemA2, source_id: itemA2, ...traceBase, ...frozen("QA TV Base", "QA26-TV", 29.99) },
      { customer_id: billingCustB, plan_code: `QA26-INT-B-${Date.now()}`, plan_name: "QA B Internet",
        plan_price: 49.99, cycle_start_date: nowIso, cycle_end_date: inXDays(30),
        status: "active", service_category: "Internet", environment: "test",
        source_order_item_id: itemB1, source_id: itemB1, ...traceBase, ...frozen("QA B Internet", "QA26-INT-B", 49.99) },
    ];
    // Seed via canonical QA gateway (allow-listed writer, env=test only)
    const subs: Array<{ id: string; customer_id: string }> = [];
    for (const row of qaSeedRows) {
      const { data: newId, error: seedErr } = await admin.rpc("rpc_qa_seed_subscription_fixture", { p_row: row });
      if (seedErr) throw new Error(`seed_subs: ${seedErr.message}`);
      if (newId) subs.push({ id: newId as string, customer_id: row.customer_id });
    }
    (subs ?? []).forEach((s: any) => createdSubIds.push(s.id));

    // Seed 2 equipment items assigned to account A
    const { data: eq } = await admin.from("equipment_inventory").insert([
      { catalog_name: "QA26 Modem", category: "modem", sku: "QA26-MOD",
        serial_number: `QA26-${crypto.randomUUID().slice(0, 8)}`, status: "assigned", account_id: accountA },
      { catalog_name: "QA26 STB", category: "tv_box", sku: "QA26-STB",
        serial_number: `QA26-${crypto.randomUUID().slice(0, 8)}`, status: "deployed", account_id: accountA },
    ]).select("id");
    (eq ?? []).forEach((e: any) => createdEquipIds.push(e.id));

    await admin.from("user_roles").delete().eq("user_id", uNR.id);
    noRoleJwt = await signIn(NOROLE_EMAIL, uNR.password);
  } catch (e) {
    return json({ ok: false, phase: "provision", error: (e as Error).message }, 500);
  }

  const runTag = `QA-M26-${Date.now()}`;

  // ------------------------------------------------------------------
  // 1) Rejects — motif court, rôle non autorisé, cross-client
  // ------------------------------------------------------------------
  {
    const r = await callEF(jwt, {
      action: "cancel_account", client_user_id: clientA, account_id: accountA,
      reason: "xy",
    });
    push({ id: "1.1", name: "F26-4 motif <5 → 400 REASON_REQUIRED",
      ok: r.status === 400 && r.body?.code === "REASON_REQUIRED", details: r });
  }
  {
    const r = await callEF(noRoleJwt, {
      action: "cancel_account", client_user_id: clientA, account_id: accountA,
      reason: `${runTag} tentative sans rôle`,
    });
    // No-role: EF returns 403 either at global role gate or ROLE_NOT_ALLOWED
    push({ id: "1.2", name: "F26-11 rôle non autorisé → 403",
      ok: r.status === 403, details: r });
  }
  {
    // Cross-client: pass account A but claim client B → CROSS_CLIENT_TARGET
    const r = await callEF(jwt, {
      action: "cancel_account", client_user_id: clientB, account_id: accountA,
      reason: `${runTag} cross-client`,
    });
    push({ id: "1.3", name: "F26-1 cross-client → 403 CROSS_CLIENT_TARGET",
      ok: r.status === 403 && r.body?.code === "CROSS_CLIENT_TARGET", details: r });
    // Account A must still be active
    const { data: acc } = await admin.from("accounts").select("status").eq("id", accountA).maybeSingle();
    push({ id: "1.4", name: "Compte A reste actif après tentative cross-client",
      ok: acc?.status === "active", details: acc });
  }

  // ------------------------------------------------------------------
  // 2) Guard solde impayé (F26-8) — refuse sans acknowledge
  // ------------------------------------------------------------------
  {
    // Seed unpaid invoice (75.25) on client A via billing_invoices
    const { error: invSeedErr } = await admin.from("billing_invoices").insert({
      customer_id: billingCustA, account_id: accountA, subscription_id: createdSubIds[0],
      invoice_number: `QA26-INV-${Date.now().toString().slice(-6)}`,
      type: "renewal",
      subtotal: 65.45, tps_amount: 3.27, tvq_amount: 6.53, total: 75.25,
      amount_paid: 0, balance_due: 75.25, status: "pending",
      cycle_start_date: new Date().toISOString().slice(0, 10),
      cycle_end_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
      environment: "test",
    });
    if (invSeedErr) push({ id: "2.0", name: "seed_invoice", ok: false, details: invSeedErr.message });
    const r = await callEF(jwt, {
      action: "cancel_account", client_user_id: clientA, account_id: accountA,
      reason: `${runTag} solde sans ack`, acknowledge_equipment: true,
    });
    push({ id: "2.1", name: "F26-8 balance_due>0 sans ack → 400 UNPAID_BALANCE_ACK_REQUIRED",
      ok: r.status === 400 && r.body?.code === "UNPAID_BALANCE_ACK_REQUIRED", details: r });
  }

  // ------------------------------------------------------------------
  // 3) Guard équipement (F26-9) — refuse sans acknowledge
  // ------------------------------------------------------------------
  {
    const r = await callEF(jwt, {
      action: "cancel_account", client_user_id: clientA, account_id: accountA,
      reason: `${runTag} equip sans ack`, acknowledge_unpaid: true,
    });
    push({ id: "3.1", name: "F26-9 équipement>0 sans ack → 400 EQUIPMENT_RETURN_ACK_REQUIRED",
      ok: r.status === 400 && r.body?.code === "EQUIPMENT_RETURN_ACK_REQUIRED", details: r });
  }

  // ------------------------------------------------------------------
  // 4) Cancel nominal — avec toutes les acknowledges + idempotency_key
  // ------------------------------------------------------------------
  const idemKey = `qa-m26-${crypto.randomUUID()}`;
  let firstResp: any = null;
  {
    const r = await callEF(jwt, {
      action: "cancel_account", client_user_id: clientA, account_id: accountA,
      reason: `${runTag} nominal — annulation complète`,
      idempotency_key: idemKey,
      acknowledge_unpaid: true, acknowledge_equipment: true,
    });
    firstResp = r.body;
    const { data: acc } = await admin.from("accounts")
      .select("status, cancelled_at, cancellation_reason").eq("id", accountA).maybeSingle();
    push({ id: "4.1", name: "cancel_account nominal 200 + accounts.status=cancelled + cancelled_at set",
      ok: r.status === 200 && acc?.status === "cancelled" && !!acc?.cancelled_at, details: { http: r.status, acc, resp: r.body } });
    push({ id: "4.2", name: "Motif persisté dans accounts.cancellation_reason",
      ok: (acc?.cancellation_reason ?? "").includes(runTag), details: acc?.cancellation_reason });
    const { data: invAfter } = await admin.from("billing_invoices")
      .select("balance_due, status").eq("customer_id", billingCustA)
      .not("status", "in", "(paid,void,cancelled,refunded)");
    const stillDue = (invAfter ?? []).reduce((s: number, r: any) => s + Number(r?.balance_due ?? 0), 0);
    push({ id: "4.3", name: "Solde impayé préservé (facture ouverte reste due après annulation)",
      ok: Math.abs(stillDue - 75.25) < 0.01, details: { stillDue, invAfter } });
  }

  // ------------------------------------------------------------------
  // 5) F26-2 cascade — subs A cancelled via billing_customers.id, B intact
  // ------------------------------------------------------------------
  {
    const { data: subsA } = await admin.from("billing_subscriptions")
      .select("id, status").eq("customer_id", billingCustA);
    const allA = (subsA ?? []).length;
    const cancelledA = (subsA ?? []).filter((s: any) => s.status === "cancelled").length;
    push({ id: "5.1", name: "F26-2 cascade — toutes les subs client A cancelled via billing_customers.id",
      ok: allA >= 2 && cancelledA === allA, details: { allA, cancelledA, subsA } });
    push({ id: "5.2", name: "Cascade retournée par EF (cancelled_subscriptions ≥ 2)",
      ok: Number(firstResp?.cancelled_subscriptions ?? 0) >= 2, details: firstResp?.cancelled_subscriptions });

    const { data: subsB } = await admin.from("billing_subscriptions")
      .select("id, status").eq("customer_id", billingCustB);
    const intactB = (subsB ?? []).every((s: any) => s.status !== "cancelled" && s.status !== "expired");
    push({ id: "5.3", name: "Isolation — subs du client B non impactées (non cancelled/expired)",
      ok: intactB && (subsB ?? []).length > 0, details: subsB });
  }

  // ------------------------------------------------------------------
  // 6) F26-5 AutoPay désactivé + F26-9 retours équipement créés
  // ------------------------------------------------------------------
  {
    const { data: bc } = await admin.from("billing_customers")
      .select("autopay_enabled, autopay_discount_active").eq("id", billingCustA).maybeSingle();
    push({ id: "6.1", name: "F26-5 AutoPay OFF sur billing_customers du client A",
      ok: bc?.autopay_enabled === false && bc?.autopay_discount_active === false, details: bc });

    const { data: rets } = await admin.from("equipment_return_requests")
      .select("id, equipment_inventory_id, reason, status, client_user_id").eq("account_id", accountA);
    const okReturns = (rets?.length ?? 0) >= 2
      && rets!.every((r: any) => r.reason === "account_cancelled" && r.status === "pending" && r.client_user_id === clientA);
    push({ id: "6.2", name: "F26-9 demandes de retour créées (≥ 2, reason=account_cancelled, status=pending)",
      ok: okReturns, details: rets });
    push({ id: "6.3", name: "EF a retourné equipment_return_requests ≥ 2",
      ok: Number(firstResp?.equipment_return_requests ?? 0) >= 2, details: firstResp?.equipment_return_requests });
  }

  // ------------------------------------------------------------------
  // 7) F26-6 idempotency — rejouer même clé → idempotent=true, pas de double effet
  // ------------------------------------------------------------------
  {
    const r = await callEF(jwt, {
      action: "cancel_account", client_user_id: clientA, account_id: accountA,
      reason: `${runTag} replay`, idempotency_key: idemKey,
      acknowledge_unpaid: true, acknowledge_equipment: true,
    });
    push({ id: "7.1", name: "F26-6 replay même idempotency_key → 200 idempotent=true",
      ok: r.status === 200 && r.body?.idempotent === true, details: r });

    const { data: rets } = await admin.from("equipment_return_requests")
      .select("id").eq("account_id", accountA);
    push({ id: "7.2", name: "Pas de nouvelles equipment_return_requests créées au replay",
      ok: (rets?.length ?? 0) <= (firstResp?.equipment_return_requests ?? 0), details: { count: rets?.length } });
  }

  // ------------------------------------------------------------------
  // 8) Already cancelled → 409
  // ------------------------------------------------------------------
  {
    const r = await callEF(jwt, {
      action: "cancel_account", client_user_id: clientA, account_id: accountA,
      reason: `${runTag} deuxième annulation`,
      acknowledge_unpaid: true, acknowledge_equipment: true,
    });
    push({ id: "8.1", name: "cancel sur compte déjà résilié → 409 ALREADY_CANCELLED",
      ok: r.status === 409 && r.body?.code === "ALREADY_CANCELLED", details: r });
  }

  // ------------------------------------------------------------------
  // 9) F26-7 audit snapshot before/after + activity + note + email
  // ------------------------------------------------------------------
  {
    const { data: audit } = await admin.from("admin_audit_log")
      .select("id, action, details").eq("target_id", clientA)
      .like("action", "account_ops.cancel_account%").order("created_at", { ascending: false }).limit(1);
    const det = (audit?.[0] as any)?.details || {};
    const beforeOk = det?.before_state && det.before_state.status === "active"
      && Array.isArray(det.before_state.subscriptions) && Math.abs(Number(det.before_state.balance_due ?? 0) - 75.25) < 0.01
      && det.before_state.autopay_enabled === true && det.before_state.equipment_assigned >= 2;
    const afterOk = det?.after_state && det.after_state.status === "cancelled"
      && det.after_state.autopay_disabled === true
      && (det.after_state.equipment_return_requests ?? 0) >= 2;
    push({ id: "9.1", name: "admin_audit_log présent avec action=cancel_account",
      ok: (audit?.length ?? 0) > 0, details: audit });
    push({ id: "9.2", name: "F26-7 before_state complet (status/balance/subs/autopay/equipment)",
      ok: !!beforeOk, details: det?.before_state });
    push({ id: "9.3", name: "F26-7 after_state complet (cancelled/autopay_disabled/returns)",
      ok: !!afterOk, details: det?.after_state });

    const { data: act } = await admin.from("client_activity_logs")
      .select("id, action_type, summary").eq("client_id", clientA).eq("action_type", "account_cancel")
      .order("created_at", { ascending: false }).limit(1);
    push({ id: "9.4", name: "client_activity_logs contient action_type=account_cancel",
      ok: (act?.length ?? 0) > 0, details: act });

    const { data: note } = await admin.from("client_internal_notes")
      .select("id, body").eq("client_id", clientA).ilike("body", "Compte annulé%")
      .order("created_at", { ascending: false }).limit(1);
    push({ id: "9.5", name: "client_internal_notes contient note d'annulation",
      ok: (note?.length ?? 0) > 0, details: note });

    const { data: mail } = await admin.from("email_queue")
      .select("id, template_key, to_email").eq("template_key", "client_account_cancelled")
      .eq("to_email", CLIENT_A_EMAIL).order("created_at", { ascending: false }).limit(1);
    push({ id: "9.6", name: "F26-3 email_queue contient client_account_cancelled bilingue",
      ok: (mail?.length ?? 0) > 0, details: mail });
  }

  // ------------------------------------------------------------------
  // 10) Refus rejoués — motif court / cross-client / rôle → deny audit trail
  // ------------------------------------------------------------------
  {
    const { data: denyAudits } = await admin.from("admin_audit_log")
      .select("id, action, details").like("action", "account_ops.cancel_account_denied%")
      .order("created_at", { ascending: false }).limit(10);
    const hasCross = (denyAudits ?? []).some((a: any) => a.details?.reason_code === "CROSS_CLIENT_TARGET");
    push({ id: "10.1", name: "Refus cross-client audité (cancel_account_denied · CROSS_CLIENT_TARGET)",
      ok: hasCross, details: denyAudits?.slice(0, 3) });
  }

  // ------------------------------------------------------------------
  // 11) Sécurité finale — aucun 5xx observé
  // ------------------------------------------------------------------
  {
    const hadServerError = checks.some((c) => {
      const d: any = c.details || {}; const s = d?.http ?? d?.status;
      return typeof s === "number" && s >= 500;
    });
    push({ id: "11.1", name: "Aucun 5xx observé sur les appels EF", ok: !hadServerError });
  }

  // ------------------------------------------------------------------
  // 12) Cleanup
  // ------------------------------------------------------------------
  const cleanup: Record<string, unknown> = { skipped: keep };
  if (!keep) {
    const del: Record<string, number | null> = {};
    // Restore accounts to active state
    for (const id of [accountA, accountB]) {
      await admin.from("accounts").update({
        status: "active", cancelled_at: null, cancellation_reason: null,
      }).eq("id", id);
    }
    // Restore autopay on billing customers
    for (const id of [billingCustA, billingCustB]) {
      await admin.from("billing_customers").update({ autopay_enabled: false, autopay_discount_active: false }).eq("id", id);
    }
    const subsDel = await admin.from("billing_subscriptions").delete()
      .in("customer_id", [billingCustA, billingCustB]).select("id");
    del.billing_subscriptions = subsDel.data?.length ?? 0;
    const invDel = await admin.from("billing_invoices").delete()
      .in("customer_id", [billingCustA, billingCustB]).select("id");
    del.billing_invoices = invDel.data?.length ?? 0;
    const equipDel = await admin.from("equipment_inventory").delete()
      .in("account_id", [accountA, accountB]).select("id");
    del.equipment_inventory = equipDel.data?.length ?? 0;
    const retDel = await admin.from("equipment_return_requests").delete()
      .in("account_id", [accountA, accountB]).select("id");
    del.equipment_return_requests = retDel.data?.length ?? 0;
    const emailDel = await admin.from("email_queue").delete()
      .eq("template_key", "client_account_cancelled")
      .in("to_email", [CLIENT_A_EMAIL, CLIENT_B_EMAIL]).select("id");
    del.email_queue = emailDel.data?.length ?? 0;
    const auditDel = await admin.from("admin_audit_log").delete()
      .in("target_id", [clientA, clientB])
      .like("action", "account_ops.cancel_account%").select("id");
    del.admin_audit_log = auditDel.data?.length ?? 0;
    const actDel = await admin.from("client_activity_logs").delete()
      .in("client_id", [clientA, clientB]).eq("action_type", "account_cancel").select("id");
    del.client_activity_logs = actDel.data?.length ?? 0;
    const noteDel = await admin.from("client_internal_notes").delete()
      .in("client_id", [clientA, clientB]).ilike("body", "Compte annulé%").select("id");
    del.client_internal_notes = noteDel.data?.length ?? 0;
    cleanup.deleted = del;
  }

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  return json({
    ok: failed === 0,
    module: "M26 — Annulation compte",
    status: failed === 0 ? "PASS" : "FAIL",
    total: checks.length, passed, failed, checks,
    fixtures: { clientA, clientB, accountA, accountB, billingCustA, billingCustB,
      emails: { CLIENT_A_EMAIL, CLIENT_B_EMAIL, NOROLE_EMAIL } },
    cleanup,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
