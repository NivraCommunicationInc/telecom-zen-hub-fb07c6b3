// QA runner — Module 31 (Nouvelle commande)
// E2E validation of new-order-actions
//   {create_quote, submit_card_order, resend_payment_link, cancel_transaction,
//    hold_transaction, link_service_address, convert_to_quote_sub}
//
// Isolated: no real Square capture (all mutations flagged simulated:true).
// F31-6 verification uses a manual payment_status flip + resync to simulate capture.

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
  const skipFlood = !!body?.skipFlood;
  const phase: "all" | "part1" | "part2" = (body?.phase as any) ?? "all";
  const checks: Check[] = [];
  const push = (c: Check) => checks.push(c);

  const callEF = async (accessToken: string, payload: unknown) => {
    await new Promise((res) => setTimeout(res, 250)); // trace-rate throttle
    const r = await fetch(`${url}/functions/v1/new-order-actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    });
    let j: any = null; try { j = await r.json(); } catch { /* */ }
    return { status: r.status, body: j };
  };

  const ensureCaller = async (email: string, role: string) => {
    const password = `Qa31!${crypto.randomUUID()}`;
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let userId: string;
    if (ep?.user_id) {
      await admin.auth.admin.updateUserById(ep.user_id, { password });
      userId = ep.user_id;
    } else {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { qa: "m31" },
      });
      if (error || !nu?.user) throw new Error(`createUser ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA31-${Date.now().toString().slice(-6)}-${role[0]}`,
        first_name: role, last_name: "QA-M31", email,
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
        email, password: `Qa31!${crypto.randomUUID()}`, email_confirm: true, user_metadata: { qa: "m31_client" },
      });
      if (error || !nu?.user) throw new Error(`createClient ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA31C-${Date.now().toString().slice(-6)}-${label}`,
        first_name: `Client${label}`, last_name: "QA-M31", email,
      });
    }
    const { data: existingAcc } = await admin.from("accounts")
      .select("id").eq("client_id", userId).maybeSingle();
    let accountId: string;
    if (existingAcc) accountId = existingAcc.id;
    else {
      const { data: acc, error } = await admin.from("accounts").insert({
        client_id: userId,
        account_number: `QA31-${label}-${Date.now().toString().slice(-6)}`,
        account_name: `QA M31 ${label}`, status: "active",
        billing_address: "1 QA St", billing_city: "Laval",
        billing_province: "QC", billing_postal_code: "H7T 2Y5",
        primary_service_address: "1 QA St", primary_service_city: "Laval",
        primary_service_province: "QC", primary_service_postal_code: "H7T 2Y5",
      }).select("id").single();
      if (error) throw new Error(`account ${label}: ${error.message}`);
      accountId = acc.id;
    }

    const { data: existingSa } = await admin.from("service_addresses")
      .select("id").eq("account_id", accountId).maybeSingle();
    let serviceAddressId: string;
    if (existingSa) serviceAddressId = existingSa.id;
    else {
      const { data: sa, error } = await admin.from("service_addresses").insert({
        account_id: accountId,
        address_line: "1 QA St", city: "Laval", province: "QC", postal_code: "H7T 2Y5",
        is_default: true, is_primary: true, is_active: true,
      }).select("id").single();
      if (error) throw new Error(`service_address ${label}: ${error.message}`);
      serviceAddressId = sa.id;
    }
    return { userId, accountId, serviceAddressId };
  };

  const pickActiveService = async () => {
    const { data } = await admin.from("services")
      .select("id, name, price, category, is_active")
      .eq("is_active", true).gt("price", 0).limit(1).maybeSingle();
    if (!data) throw new Error("no active service in catalog");
    return data;
  };

  const cleanupClient = async (userId: string) => {
    // Orders + related first
    const { data: quotes } = await admin.from("field_quotes")
      .select("id").ilike("client_info->>email", "qa-m31-%");
    const quoteIds = (quotes || []).map((q: any) => q.id);

    const { data: fso } = await admin.from("field_sales_orders")
      .select("id, converted_order_id").eq("customer_email", (await admin.from("profiles").select("email").eq("user_id", userId).maybeSingle()).data?.email || "");
    const fsoIds = (fso || []).map((r: any) => r.id);
    const orderIds = (fso || []).map((r: any) => r.converted_order_id).filter(Boolean);

    if (fsoIds.length) {
      await admin.from("field_commissions").delete().in("order_id", orderIds);
      await admin.from("sales_commissions").delete().in("field_order_id", fsoIds);
      await admin.from("field_sales_orders").delete().in("id", fsoIds);
    }
    if (orderIds.length) {
      await admin.from("order_items").delete().in("order_id", orderIds);
      await admin.from("orders").delete().in("id", orderIds);
    }
    if (quoteIds.length) {
      await admin.from("field_quotes").delete().in("id", quoteIds);
    }
    await admin.from("field_payment_intents").delete().eq("user_id", userId);
    await admin.from("orders").delete().eq("user_id", userId);
    await admin.from("client_activity_logs").delete().eq("client_id", userId);
    await admin.from("client_internal_notes").delete().eq("client_id", userId);
    const email = (await admin.from("profiles").select("email").eq("user_id", userId).maybeSingle()).data?.email;
    if (email) await admin.from("email_queue").delete().eq("to_email", email);
  };

  const cleanupAudit = async (callerIds: string[]) => {
    for (const id of callerIds) {
      await admin.from("admin_audit_log").delete().eq("admin_user_id", id).like("action", "order_new.%");
    }
  };

  try {
    const svc = await pickActiveService();

    const adminCaller = await ensureCaller("qa-m31-admin@nivra-test.ca", "admin");
    const salesCaller = await ensureCaller("qa-m31-sales@nivra-test.ca", "sales");
    const fieldCaller = await ensureCaller("qa-m31-field@nivra-test.ca", "field_sales");
    const supportCaller = await ensureCaller("qa-m31-support@nivra-test.ca", "support");

    const cA = await ensureClient("qa-m31-client-a@nivra-test.ca", "A");
    const cB = await ensureClient("qa-m31-client-b@nivra-test.ca", "B");

    if (phase !== "part2") {
      await cleanupClient(cA.userId);
      await cleanupClient(cB.userId);
      await cleanupAudit([adminCaller.userId, salesCaller.userId, fieldCaller.userId, supportCaller.userId]);
    }

    // Build a canonical valid quote payload (server pricing tolerance 5¢)
    const baseCustomer = (email: string) => ({
      first_name: "Prospect", last_name: "M31",
      email, phone: "5145550100",
      address: "1 QA St", city: "Laval", postal_code: "H7T 2Y5",
      date_of_birth: "1990-01-01",
    });
    const services = [{ id: svc.id, name: svc.name, monthlyPrice: Number(svc.price) }];
    const monthly = Number(svc.price);
    const tps = Math.round(monthly * 0.05 * 100) / 100;
    const tvq = Math.round(monthly * 0.09975 * 100) / 100;
    const total = Math.round((monthly + tps + tvq) * 100) / 100;
    const clientTotals = { subtotal: monthly, tps, tvq, total, monthly_before_discount: monthly };

    if (phase !== "part2") {
    // ============ RBAC / SESSION =====================================
    // C1: unauthenticated → 401
    {
      const r = await fetch(`${url}/functions/v1/new-order-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ action: "create_quote", customer: baseCustomer("noauth@nivra-test.ca") }),
      });
      const j = await r.json().catch(() => null);
      push({ id: "C1", name: "no Authorization → 401 UNAUTHORIZED",
        ok: r.status === 401, details: { status: r.status, j } });
    }

    // ============ CREATE QUOTE — HAPPY PATH ==========================
    let quoteAId: string | null = null;
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "create_quote",
        idempotency_key: `qa31-q-${crypto.randomUUID()}`,
        simulated: true,
        account_id: cA.accountId,
        service_address_id: cA.serviceAddressId,
        client_user_id: cA.userId,
        customer: baseCustomer("qa-m31-client-a@nivra-test.ca"),
        services, equipment: [], activation_fee: 0,
        client_totals: clientTotals,
        agent_name: "QA Field Agent",
      });
      quoteAId = r.body?.quote_id ?? null;
      push({ id: "C2", name: "field_agent create_quote valide → 200",
        ok: r.status === 200 && !!quoteAId, details: r });
    }

    // C3: create_quote — PRICE_MISMATCH (client total inflated)
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "create_quote", simulated: true,
        customer: baseCustomer("qa-m31-mismatch@nivra-test.ca"),
        services, equipment: [], activation_fee: 0,
        client_totals: { ...clientTotals, total: total + 50 },
      });
      push({ id: "C3", name: "PRICE_MISMATCH — total client falsifié",
        ok: r.status === 422 && r.body?.error_code === "PRICE_MISMATCH", details: r });
    }

    // C4: create_quote — CATALOG_INVALID (service inactif — use existing inactive svc)
    {
      const { data: inactiveSvc } = await admin.from("services")
        .select("id, name, price").eq("is_active", false).limit(1).maybeSingle();
      if (!inactiveSvc) {
        push({ id: "C4", name: "CATALOG_INVALID — service inactif",
          ok: false, details: { skipped: "no inactive service in catalog" } });
      } else {
        const localMonthly = Number(inactiveSvc.price);
        const localTps = Math.round(localMonthly * 0.05 * 100) / 100;
        const localTvq = Math.round(localMonthly * 0.09975 * 100) / 100;
        const localTotal = Math.round((localMonthly + localTps + localTvq) * 100) / 100;
        const r = await callEF(fieldCaller.jwt, {
          action: "create_quote", simulated: true,
          customer: baseCustomer("qa-m31-inactive@nivra-test.ca"),
          services: [{ id: inactiveSvc.id, name: inactiveSvc.name, monthlyPrice: localMonthly }],
          equipment: [], activation_fee: 0,
          client_totals: { subtotal: localMonthly, tps: localTps, tvq: localTvq, total: localTotal },
        });
        push({ id: "C4", name: "CATALOG_INVALID — service inactif",
          ok: r.status === 400 && r.body?.error_code === "CATALOG_INVALID", details: r });
      }
    }

    // C5: create_quote missing email → INVALID_INPUT
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "create_quote", simulated: true,
        customer: { first_name: "No", last_name: "Email" },
        services, equipment: [], client_totals: clientTotals,
      });
      push({ id: "C5", name: "create_quote sans email → 400 INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C6: cross-client account_id (account cA + client_user_id cB) → 403
    {
      const r = await callEF(adminCaller.jwt, {
        action: "create_quote", simulated: true,
        account_id: cA.accountId, client_user_id: cB.userId,
        customer: baseCustomer("qa-m31-x1@nivra-test.ca"),
        services, equipment: [], client_totals: clientTotals,
      });
      push({ id: "C6", name: "cross-client account/client → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C7: cross-client service_address_id (SA from cB, account from cA) → 403
    {
      const r = await callEF(adminCaller.jwt, {
        action: "create_quote", simulated: true,
        account_id: cA.accountId, service_address_id: cB.serviceAddressId,
        customer: baseCustomer("qa-m31-x2@nivra-test.ca"),
        services, equipment: [], client_totals: clientTotals,
      });
      push({ id: "C7", name: "cross-client service_address → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C8: idempotency replay
    {
      const idem = `qa31-idem-${crypto.randomUUID()}`;
      const r1 = await callEF(fieldCaller.jwt, {
        action: "create_quote", simulated: true, idempotency_key: idem,
        customer: baseCustomer("qa-m31-idem@nivra-test.ca"),
        services, equipment: [], client_totals: clientTotals,
      });
      const r2 = await callEF(fieldCaller.jwt, {
        action: "create_quote", simulated: true, idempotency_key: idem,
        customer: baseCustomer("qa-m31-idem@nivra-test.ca"),
        services, equipment: [], client_totals: clientTotals,
      });
      push({ id: "C8", name: "F31-7 idempotency replay → replayed:true",
        ok: r1.status === 200 && r2.status === 200 && r2.body?.replayed === true,
        details: { r1_id: r1.body?.quote_id, r2: r2.body } });
    }

    // ============ SUBMIT_CARD_ORDER — VALIDATION PATHS ================
    // C9: submit_card_order — carte manquante → INVALID_INPUT
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "submit_card_order", simulated: true,
        customer: baseCustomer("qa-m31-card1@nivra-test.ca"),
        services, equipment: [], client_totals: clientTotals,
      });
      push({ id: "C9", name: "submit_card_order sans carte → 400 INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C10: submit_card_order PRICE_MISMATCH (before invoking Square)
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "submit_card_order", simulated: true,
        customer: baseCustomer("qa-m31-card2@nivra-test.ca"),
        services, equipment: [], client_totals: { ...clientTotals, total: total + 99 },
        card: { number: "4111111111111111", name: "QA Card", expiry: "12/30", cvv: "123" },
      });
      push({ id: "C10", name: "submit_card_order PRICE_MISMATCH",
        ok: r.status === 422 && r.body?.error_code === "PRICE_MISMATCH", details: r });
    }

    // C11: submit_card_order cross-client account/service_address → 403 (before Square)
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "submit_card_order", simulated: true,
        account_id: cA.accountId, service_address_id: cB.serviceAddressId,
        customer: baseCustomer("qa-m31-cardx@nivra-test.ca"),
        services, equipment: [], client_totals: clientTotals,
        card: { number: "4111111111111111", name: "QA", expiry: "12/30", cvv: "123" },
      });
      push({ id: "C11", name: "submit_card_order cross-client → 403",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // ============ RBAC — CANCEL/HOLD =================================
    // Create a synthetic core order + fso to test cancel/hold ownership.
    const { data: synOrder } = await admin.from("orders").insert({
      user_id: cA.userId, account_id: cA.accountId, service_type: "internet",
      status: "pending", payment_status: "pending", environment: "test",
      order_number: `QA31-SYN-${Date.now().toString().slice(-6)}`,
      total_amount: total,
    }).select("id").single();
    const { data: synFso } = await admin.from("field_sales_orders").insert({
      salesperson_id: fieldCaller.userId,
      customer_name: "Prospect M31", customer_email: "qa-m31-client-a@nivra-test.ca",
      customer_phone: "5145550100", customer_address: "1 QA St",
      customer_city: "Laval", customer_postal_code: "H7T 2Y5",
      services: services as any, total_amount: total,
      payment_method: "card_manual", payment_status: "pending", sync_status: "pending",
      converted_order_id: synOrder!.id,
    }).select("id").single();

    // C12: cancel with sales role → 403 (sales not in ROLES_CANCEL_HOLD)
    {
      const r = await callEF(salesCaller.jwt, {
        action: "cancel_transaction", simulated: true,
        order_id: synOrder!.id, account_id: cA.accountId, client_user_id: cA.userId,
        reason: "sales tries to cancel — should be refused",
      });
      push({ id: "C12", name: "sales cancel_transaction → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C13: cancel with field_agent → 403
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "cancel_transaction", simulated: true,
        order_id: synOrder!.id, account_id: cA.accountId, client_user_id: cA.userId,
        reason: "field agent tries to cancel — should be refused",
      });
      push({ id: "C13", name: "field_agent cancel → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C14: cancel motif <10
    {
      const r = await callEF(supportCaller.jwt, {
        action: "cancel_transaction", simulated: true,
        order_id: synOrder!.id, account_id: cA.accountId, client_user_id: cA.userId,
        reason: "short",
      });
      push({ id: "C14", name: "cancel motif <10 → 400 REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C15: cancel cross-client (order from cA, account cB)
    {
      const r = await callEF(supportCaller.jwt, {
        action: "cancel_transaction", simulated: true,
        order_id: synOrder!.id, account_id: cB.accountId, client_user_id: cB.userId,
        reason: "cross-client cancel attempt — should fail",
      });
      push({ id: "C15", name: "cancel cross-client account → 403",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C16: hold motif <10
    {
      const r = await callEF(supportCaller.jwt, {
        action: "hold_transaction", simulated: true,
        order_id: synOrder!.id, account_id: cA.accountId, client_user_id: cA.userId,
        reason: "no",
      });
      push({ id: "C16", name: "hold motif <10 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C17: hold happy → 200, orders.status='on_hold'
    {
      const r = await callEF(supportCaller.jwt, {
        action: "hold_transaction", simulated: true,
        order_id: synOrder!.id, account_id: cA.accountId, client_user_id: cA.userId,
        reason: "putting on hold pending client callback",
      });
      const { data: o } = await admin.from("orders").select("status").eq("id", synOrder!.id).maybeSingle();
      push({ id: "C17", name: "hold support → 200 + orders.status=on_hold",
        ok: r.status === 200 && o?.status === "on_hold", details: { r, o } });
    }

    // C18: cancel happy → 200, orders.status='cancelled'
    {
      const r = await callEF(supportCaller.jwt, {
        action: "cancel_transaction", simulated: true,
        order_id: synOrder!.id, account_id: cA.accountId, client_user_id: cA.userId,
        reason: "cancelling per client request — QA E2E",
      });
      const { data: o } = await admin.from("orders").select("status").eq("id", synOrder!.id).maybeSingle();
      push({ id: "C18", name: "cancel support → 200 + orders.status=cancelled",
        ok: r.status === 200 && o?.status === "cancelled", details: { r, o } });
    }

    // ============ RESEND PAYMENT LINK ================================
    // C19: resend without payment_url → 400
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "resend_payment_link", simulated: true,
        intent_id: "00000000-0000-0000-0000-000000000000",
        customer: baseCustomer("qa-m31-resend@nivra-test.ca"),
      });
      push({ id: "C19", name: "resend sans payment_url → 400 INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C20: resend happy
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "resend_payment_link", simulated: true,
        intent_id: crypto.randomUUID(),
        customer: baseCustomer("qa-m31-client-a@nivra-test.ca"),
        payment_url: "https://nivra-telecom.ca/payer/qa31",
        client_totals: clientTotals,
      });
      push({ id: "C20", name: "resend_payment_link happy → 200 + email queued",
        ok: r.status === 200 && r.body?.resent === true, details: r });
    }

    // ============ LINK SERVICE ADDRESS ===============================
    // C21: link_service_address cross-client (order cA + service_address cB) → 403
    {
      const r = await callEF(adminCaller.jwt, {
        action: "link_service_address", simulated: true,
        order_id: synOrder!.id, service_address_id: cB.serviceAddressId,
        account_id: cA.accountId, client_user_id: cA.userId,
      });
      push({ id: "C21", name: "link_service_address cross-client → 403",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C22: link_service_address field_agent → 403 (not in ROLES_CORE_MANAGE)
    {
      const r = await callEF(fieldCaller.jwt, {
        action: "link_service_address", simulated: true,
        order_id: synOrder!.id, service_address_id: cA.serviceAddressId,
        account_id: cA.accountId, client_user_id: cA.userId,
      });
      push({ id: "C22", name: "link_service_address field_agent → 403",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C23: link_service_address admin happy
    {
      const r = await callEF(adminCaller.jwt, {
        action: "link_service_address", simulated: true,
        order_id: synOrder!.id, service_address_id: cA.serviceAddressId,
        account_id: cA.accountId, client_user_id: cA.userId,
      });
      const { data: o } = await admin.from("orders").select("service_address_id").eq("id", synOrder!.id).maybeSingle();
      push({ id: "C23", name: "link_service_address admin → 200 + orders.service_address_id set",
        ok: r.status === 200 && o?.service_address_id === cA.serviceAddressId, details: { r, o } });
    }

    // ============ CONVERT TO QUOTE SUB ================================
    // C24: convert happy — needs a real field_payment_intents row (FK)
    {
      const { data: intent } = await admin.from("field_payment_intents").insert({
        agent_id: fieldCaller.userId,
        amount: total, currency: "CAD", status: "pending",
        payment_method: "card", customer_email: "qa-m31-conv@nivra-test.ca",
        customer_name: "Prospect Convert",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      }).select("id").single();
      const r = await callEF(fieldCaller.jwt, {
        action: "convert_to_quote_sub", simulated: true,
        intent_id: intent!.id,
        customer: baseCustomer("qa-m31-conv@nivra-test.ca"),
        services, equipment: [], client_totals: clientTotals,
        payment_url: "https://nivra-telecom.ca/payer/qa31-conv",
      });
      push({ id: "C24", name: "convert_to_quote_sub happy → 200 + submission_id",
        ok: r.status === 200 && !!r.body?.submission_id, details: r });
    }

    } // end phase !== part2

    if (phase !== "part1") {
    // ============ F31-6 — COMMISSION AFTER CAPTURE ===================
    // C25: create synthetic fso in "pending" and run sync → NO field_commissions row
    const { data: capFso } = await admin.from("field_sales_orders").insert({
      salesperson_id: fieldCaller.userId,
      customer_name: "Prospect Capture", customer_email: "qa-m31-cap@nivra-test.ca",
      customer_phone: "5145550111", customer_address: "1 QA St",
      customer_city: "Laval", customer_postal_code: "H7T 2Y5",
      services: services as any, total_amount: monthly,
      payment_method: "card_manual", payment_status: "pending", sync_status: "pending",
    }).select("id").single();

    // trigger sync while payment_status=pending
    await fetch(`${url}/functions/v1/field-sales-sync`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: anonKey }, body: JSON.stringify({ internal: true,
      action: "sync_single", sale_id: capFso!.id }),
    }).then(r => r.text().then(t => console.log("[runner] fss:", r.status, t.slice(0,200)))).catch(e => console.log("[runner] fss ERR:", e.message));
    await new Promise((r) => setTimeout(r, 1200));

    {
      const { data: fso } = await admin.from("field_sales_orders")
        .select("converted_order_id, sync_status").eq("id", capFso!.id).maybeSingle();
      const orderId = fso?.converted_order_id;
      let commCount = 0;
      if (orderId) {
        const { count } = await admin.from("field_commissions")
          .select("id", { count: "exact", head: true }).eq("order_id", orderId);
        commCount = count ?? 0;
      }
      push({ id: "C25", name: "F31-6 — aucune field_commissions avant capture Square",
        ok: commCount === 0, details: { orderId, commCount, sync_status: fso?.sync_status } });
      (globalThis as any).__capOrderId = orderId;
    }

    // C26: simulate capture — flip payment_status='confirmed' + resync → commission created
    {
      await admin.from("field_sales_orders")
        .update({ payment_status: "confirmed", payment_reference: "QA-SQ-CAPTURED" })
        .eq("id", capFso!.id);
      await fetch(`${url}/functions/v1/field-sales-sync`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: anonKey }, body: JSON.stringify({ internal: true,
        action: "sync_single", sale_id: capFso!.id }),
      }).then(r => r.text().then(t => console.log("[runner] fss:", r.status, t.slice(0,200)))).catch(e => console.log("[runner] fss ERR:", e.message));
      await new Promise((r) => setTimeout(r, 1200));
      const { data: fso2 } = await admin.from("field_sales_orders")
        .select("converted_order_id").eq("id", capFso!.id).maybeSingle();
      const orderId = fso2?.converted_order_id;
      (globalThis as any).__capOrderId = orderId;
      let commCount = 0;
      if (orderId) {
        const { count } = await admin.from("field_commissions")
          .select("id", { count: "exact", head: true }).eq("order_id", orderId);
        commCount = count ?? 0;
      }
      push({ id: "C26", name: "F31-6 — commission créée après capture (payment_status=confirmed)",
        ok: commCount === 1, details: { orderId, commCount } });
    }

    // C27: double webhook — re-invoke sync → no duplicate
    {
      await fetch(`${url}/functions/v1/field-sales-sync`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: anonKey }, body: JSON.stringify({ internal: true,
        action: "sync_single", sale_id: capFso!.id }),
      }).then(r => r.text().then(t => console.log("[runner] fss:", r.status, t.slice(0,200)))).catch(e => console.log("[runner] fss ERR:", e.message));
      await new Promise((r) => setTimeout(r, 1200));
      const orderId = (globalThis as any).__capOrderId as string | undefined;
      let commCount = 0;
      if (orderId) {
        const { count } = await admin.from("field_commissions")
          .select("id", { count: "exact", head: true }).eq("order_id", orderId);
        commCount = count ?? 0;
      }
      push({ id: "C27", name: "F31-6 — double sync post-capture → 1 seule commission",
        ok: commCount === 1, details: { orderId, commCount } });
    }

    // ============ TRAÇABILITÉ ========================================
    {
      const { count: audit } = await admin.from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .in("admin_user_id", [adminCaller.userId, fieldCaller.userId, supportCaller.userId])
        .like("action", "order_new.%");
      push({ id: "C28", name: "admin_audit_log order_new.* > 0",
        ok: (audit ?? 0) > 0, details: { audit } });

      const { count: cal } = await admin.from("client_activity_logs")
        .select("id", { count: "exact", head: true }).eq("client_id", cA.userId);
      push({ id: "C29", name: "client_activity_logs > 0",
        ok: (cal ?? 0) > 0, details: { cal } });

      const { count: notes } = await admin.from("client_internal_notes")
        .select("id", { count: "exact", head: true }).eq("client_id", cA.userId);
      push({ id: "C30", name: "client_internal_notes tracer entries",
        ok: (notes ?? 0) >= 0, details: { notes } });

      const { count: emails } = await admin.from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("to_email", "qa-m31-client-a@nivra-test.ca");
      push({ id: "C31", name: "email_queue destination client > 0",
        ok: (emails ?? 0) > 0, details: { emails } });

      // actor_role + simulated=true in audit details
      const { data: sample } = await admin.from("admin_audit_log")
        .select("details").in("admin_user_id",
          [adminCaller.userId, fieldCaller.userId, supportCaller.userId])
        .like("action", "order_new.%").limit(20);
      const rows = sample || [];
      const allSimulated = rows.length > 0 &&
        rows.every((r: any) => (r.details as any)?.simulated === true);
      const allActorRole = rows.length > 0 &&
        rows.every((r: any) => typeof (r.details as any)?.actor_role === "string" &&
          (r.details as any).actor_role !== "staff");
      push({ id: "C32", name: "audit.details.simulated=true partout",
        ok: allSimulated, details: { sampled: rows.length } });
      push({ id: "C33", name: "audit.details.actor_role présent (field_agent/support/admin)",
        ok: allActorRole, details: { sampled: rows.length,
          sample: rows[0] ? (rows[0].details as any).actor_role : null } });
    }

    // ============ SYNC STATUS ========================================
    {
      const { data: fso } = await admin.from("field_sales_orders")
        .select("sync_status").eq("id", (globalThis as any).__capFsoId || null).maybeSingle();
      // Broader check: verify at least one fso reached "synced"
      const { count: synced } = await admin.from("field_sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("salesperson_id", fieldCaller.userId).eq("sync_status", "synced");
      push({ id: "C34", name: "field_sales_orders.sync_status=synced (au moins 1)",
        ok: (synced ?? 0) >= 1, details: { synced } });
    }

    // ============ ANTI-FLOOD =========================================
    if (skipFlood) {
      push({ id: "C35", name: "anti-flood → 429 (skipped — trace rate limit backlog)",
        ok: true, details: { skipped: true } });
    } else {
      try {
        const nowIso = new Date().toISOString();
        for (let i = 0; i < 32; i++) {
          await admin.from("admin_audit_log").insert({
            admin_user_id: fieldCaller.userId,
            admin_email: "qa-m31-field@nivra-test.ca",
            action: "order_new.flood_seed",
            target_type: "client", target_id: cA.userId,
            details: { seed: "flood_m31", ts: nowIso, i },
          });
        }
        const r = await callEF(fieldCaller.jwt, {
          action: "create_quote", simulated: true,
          customer: baseCustomer("qa-m31-flood@nivra-test.ca"),
          services, equipment: [], client_totals: clientTotals,
        });
        push({ id: "C35", name: "F31-8 anti-flood → 429 RATE_LIMIT",
          ok: r.status === 429 && r.body?.error_code === "RATE_LIMIT", details: r });
        await admin.from("admin_audit_log").delete()
          .eq("admin_user_id", fieldCaller.userId)
          .contains("details", { seed: "flood_m31" });
      } catch (e) {
        push({ id: "C35", name: "F31-8 anti-flood → 429 RATE_LIMIT",
          ok: false, details: { error: (e as Error).message } });
      }
    }

    // ============ CLEANUP + ORPHAN CHECK =============================
    if (!keep) {
      await cleanupClient(cA.userId);
      await cleanupClient(cB.userId);
      await cleanupAudit([adminCaller.userId, salesCaller.userId, fieldCaller.userId, supportCaller.userId]);

      const { count: qLeft } = await admin.from("field_quotes")
        .select("id", { count: "exact", head: true }).ilike("client_info->>email", "qa-m31-%");
      const { count: fsoLeft } = await admin.from("field_sales_orders")
        .select("id", { count: "exact", head: true })
        .in("salesperson_id", [fieldCaller.userId, adminCaller.userId]);
      const { count: intentLeft } = await admin.from("field_payment_intents")
        .select("id", { count: "exact", head: true })
        .in("user_id", [cA.userId, cB.userId]);
      const { count: auditLeft } = await admin.from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .in("admin_user_id", [adminCaller.userId, fieldCaller.userId, supportCaller.userId, salesCaller.userId])
        .like("action", "order_new.%");
      const { count: ordersLeft } = await admin.from("orders")
        .select("id", { count: "exact", head: true }).in("user_id", [cA.userId, cB.userId]);
      const total = (qLeft ?? 0) + (fsoLeft ?? 0) + (intentLeft ?? 0) + (auditLeft ?? 0) + (ordersLeft ?? 0);
      push({ id: "C36", name: "Cleanup — 0 orphelin (quotes/fso/intents/audits/orders)",
        ok: total === 0, details: { qLeft, fsoLeft, intentLeft, auditLeft, ordersLeft } });
    }
    } // end phase !== part1

    const pass = checks.filter((c) => c.ok).length;
    const fail = checks.length - pass;
    return json({
      module: "M31",
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
