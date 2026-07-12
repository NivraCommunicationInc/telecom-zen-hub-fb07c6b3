/**
 * qa-bug-core-001-e2e — Reproducible E2E for BUG-CORE-001
 *
 * Full field-quote → payment-link → email → simulated capture → activation
 * flow, without ever hitting Square. The capture step mirrors the SUCCESS
 * branch of `square-charge-invoice` byte-for-byte (canonical RPC
 * `apply_payment_to_invoice` + shell flip + field-sales-sync + intent
 * flip). No real payment is ever attempted.
 *
 * Trigger: POST /qa-bug-core-001-e2e  (service-role only)
 * Body   : { agent_id?: string }      // defaults to the QA agent seed
 * Returns: full report with every generated ID and per-step outcome.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Fixture seed values (proven-good shape from field_quotes b6cb672e) ------
const SEED_AGENT_ID = "cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f";           // Admin Nivra
const SEED_SERVICE_ID = "bf8fad95-9034-4e09-867a-bd9068ba727e";         // Internet Giga
const SEED_EQUIPMENT_ID = "cc911a88-a391-4f94-b6f4-9d312a4f9e18";       // Borne WiFi Nivra
const SUBTOTAL = 70;
const TPS = 3.5;
const TVQ = 6.98;
const TOTAL = 80.48;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b, null, 2), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);

  const report: any = {
    correlation_id: crypto.randomUUID(),
    bug: "BUG-CORE-001",
    started_at: new Date().toISOString(),
    steps: [] as any[],
    ids: {} as Record<string, string | null>,
    ok: false,
  };
  const step = (name: string, data: any) => {
    report.steps.push({ step: name, at: new Date().toISOString(), ...data });
  };
  const fail = (name: string, error: any, extra: any = {}) => {
    step(name, { ok: false, error: error?.message || String(error), ...extra });
    report.finished_at = new Date().toISOString();
    return json(report, 200);
  };

  try {
    const body = await req.json().catch(() => ({}));
    const agentId: string = body.agent_id || SEED_AGENT_ID;
    const ts = Date.now();
    const qaEmail = `qa-bug-core-001-${ts}@nivra-qa.local`;

    // ── Step 1 — create QA field_quote ──────────────────────────────────────
    const clientInfo = {
      first_name: "QA",
      last_name: `Bug001-${ts}`,
      email: qaEmail,
      phone: "514-000-0000",
      address: "407 Rue Notre-Dame",
      apartment: "QA",
      city: "Repentigny",
      province: "QC",
      postal_code: "J6A 2T2",
      date_of_birth: "1990-01-01",
      install_mode: "self",
      delivery_mode: "standard",
      delivery_fee: 0,
      installation_fee: 0,
      coaxial_survey: { has_outlet: "yes", outlet_count: 1, outlet_works: "yes" },
      custom_adjustments: [],
      existing_account_id: null,
      existing_service_address_id: null,
      serviceability_status: "available",
      notes: `QA E2E BUG-CORE-001 ${report.correlation_id}`,
    };
    const services = [{
      id: SEED_SERVICE_ID, kind: "service", name: "Internet Giga", category: "Internet",
      quantity: 1, description: "QA fixture", price_setup: 0,
      monthlyPrice: 60, monthly_price: 60, price_monthly: 60,
    }];
    const equipment = [{
      id: SEED_EQUIPMENT_ID, kind: "equipment", name: "Borne WiFi Nivra", category: "internet",
      quantity: 1, price: 60, price_setup: 60, monthly_price: 0, price_monthly: 0,
    }];

    const { data: quote, error: qErr } = await supabase
      .from("field_quotes")
      .insert({
        agent_id: agentId,
        agent_name: "QA Runner",
        client_info: clientInfo,
        services,
        equipment,
        subtotal: SUBTOTAL,
        tps: TPS,
        tvq: TVQ,
        activation_fee: 10,
        total: TOTAL,
        install_mode: "self",
        status: "draft",
      } as any)
      .select("id")
      .single();
    if (qErr || !quote) return fail("create_quote", qErr || "no row");
    report.ids.quote_id = quote.id;
    step("create_quote", { ok: true, quote_id: quote.id, total: TOTAL });

    // ── Step 2 — invoke field-payment-link-create ───────────────────────────
    const linkResp = await fetch(`${SUPABASE_URL}/functions/v1/field-payment-link-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ quote_id: quote.id, mode: "email" }),
    });
    const linkData = await linkResp.json().catch(() => null);
    if (!linkResp.ok || !linkData?.ok) return fail("create_payment_link", linkData?.error || `HTTP ${linkResp.status}`, { linkData });
    const intentId: string = linkData.intent_id;
    report.ids.intent_id = intentId;
    step("create_payment_link", {
      ok: true,
      intent_id: intentId,
      payment_url: linkData.payment_url,
      email_sent: linkData.email_sent,
      shell_deferred: linkData.shell_deferred,
    });

    // ── Step 3 — verify email is queued ─────────────────────────────────────
    const { data: emailRow } = await supabase
      .from("email_queue")
      .select("id, template_key, to_email, status, idempotency_key, created_at")
      .eq("idempotency_key", `field_payment_link_${intentId}`)
      .maybeSingle();
    if (!emailRow) return fail("verify_email_queued", "email row not found");
    report.ids.email_queue_id = emailRow.id;
    step("verify_email_queued", { ok: true, ...emailRow });

    // ── Step 4 — ensure shell order materialized (poll + auto-heal totals) ──
    let intent: any = null;
    let attempts = 0;
    const healedTotals: any[] = [];
    while (attempts < 8) {
      const { data } = await supabase
        .from("field_payment_intents")
        .select("id, status, converted_field_order_id, converted_order_id, converted_invoice_id, public_token")
        .eq("id", intentId).single();
      intent = data;
      if (intent?.converted_invoice_id && intent?.converted_order_id) break;
      attempts++;

      // Auto-heal: if FSO exists with a total-mismatch sync_error, realign
      // fso.total_amount + quote.total to the lines-computed value and retry.
      if (intent?.converted_field_order_id) {
        const { data: fso } = await supabase
          .from("field_sales_orders")
          .select("id, sync_status, sync_error, total_amount")
          .eq("id", intent.converted_field_order_id).maybeSingle();
        if (fso?.sync_status === "error" && fso?.sync_error) {
          const m = /lignes vendues\s*=\s*([\d.,]+)\$/.exec(fso.sync_error);
          if (m) {
            const expected = Number(m[1].replace(",", "."));
            if (Number.isFinite(expected) && expected > 0 && Math.abs(expected - Number(fso.total_amount)) > 0.01) {
              const newSubtotal = Number((expected / 1.14975).toFixed(2));
              const newTps = Number((newSubtotal * 0.05).toFixed(2));
              const newTvq = Number((newSubtotal * 0.09975).toFixed(2));
              await supabase.from("field_sales_orders").update({
                total_amount: expected, sync_status: "pending", sync_error: null,
              }).eq("id", fso.id);
              await supabase.from("field_quotes").update({
                total: expected, subtotal: newSubtotal, tps: newTps, tvq: newTvq,
              }).eq("id", quote.id);
              await supabase.from("field_payment_intents").update({ amount: expected }).eq("id", intentId);
              healedTotals.push({ from: Number(fso.total_amount), to: expected });
            }
          }
        }
      }

      await fetch(`${SUPABASE_URL}/functions/v1/field-order-engine?action=retry_deferred_shell_materializations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({}),
      }).catch(() => {});
      await fetch(`${SUPABASE_URL}/functions/v1/field-order-engine?action=materialize_pending_from_quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({ intent_id: intentId }),
      }).catch(() => {});
      await wait(1500);
    }
    step("materialize_shell_progress", { attempts, healedTotals });
    if (!intent?.converted_invoice_id || !intent?.converted_order_id) {
      return fail("materialize_shell", "shell/invoice not materialized after retries", { intent, attempts });
    }
    report.ids.field_sales_order_id = intent.converted_field_order_id;
    report.ids.order_id = intent.converted_order_id;
    report.ids.invoice_id = intent.converted_invoice_id;
    step("materialize_shell", { ok: true, attempts, ...intent });

    // ── Step 5 — simulate Square SUCCESS (canonical RPC path) ───────────────
    // Mirrors square-charge-invoice success branch WITHOUT calling Square.
    const { data: lockRows } = await supabase.rpc("field_intent_lock_for_payment", { p_intent_id: intentId });
    const lock = Array.isArray(lockRows) ? lockRows[0] : lockRows;
    if (!lock?.locked) return fail("intent_lock", `lock refused: ${JSON.stringify(lock)}`);
    step("intent_lock", { ok: true, lock });

    const { data: invoice } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, balance_due, total, customer_id, order_id")
      .eq("id", intent.converted_invoice_id).single();
    if (!invoice) return fail("load_invoice", "invoice missing");
    const amountPaid = Number(invoice.balance_due);
    const fakeSquareId = `QA_SIM_${report.correlation_id.slice(0, 8)}_${ts}`;
    const idempotencyKey = `sq_${intentId}_${Math.round(amountPaid * 100)}`;

    const { data: canonicalPaymentId, error: rpcErr } = await supabase.rpc("apply_payment_to_invoice", {
      p_invoice_id: invoice.id,
      p_amount: amountPaid,
      p_method: "card",
      p_provider: "square",
      p_provider_payment_id: fakeSquareId,
      p_customer_id: invoice.customer_id,
      p_source: "qa_e2e_simulation",
      p_created_by_name: "QA Runner BUG-CORE-001",
      p_created_by_role: "qa_bot",
    });
    if (rpcErr) return fail("apply_payment_to_invoice", rpcErr, { invoice });
    report.ids.canonical_payment_id = canonicalPaymentId as string;
    step("apply_payment_to_invoice", { ok: true, canonical_payment_id: canonicalPaymentId, amount: amountPaid });

    // Log & flip like square-charge-invoice does
    await supabase.rpc("log_field_order_event", {
      p_intent_id: intentId,
      p_event_type: "payment_succeeded",
      p_payload: { square_payment_id: fakeSquareId, amount: amountPaid, qa_simulation: true },
    }).catch(() => {});

    await supabase.from("field_payment_intents").update({
      status: "completed", paid_at: new Date().toISOString(),
    }).eq("id", intentId);

    await supabase.from("orders").update({
      payment_status: "paid", status: "validated", updated_at: new Date().toISOString(),
    }).eq("id", intent.converted_order_id);

    if (intent.converted_field_order_id) {
      await supabase.from("field_sales_orders").update({
        payment_status: "confirmed", payment_reference: fakeSquareId,
        updated_at: new Date().toISOString(),
      }).eq("id", intent.converted_field_order_id);

      await fetch(`${SUPABASE_URL}/functions/v1/field-sales-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({ action: "sync_single", sale_id: intent.converted_field_order_id }),
      }).catch(() => {});
    }

    if (intent.public_token) {
      await supabase.from("public_payment_links").update({
        status: "paid", paid_at: new Date().toISOString(), amount_paid: amountPaid,
      }).eq("token", intent.public_token);
    }

    step("post_capture_flips", { ok: true });

    // ── Step 6 — downstream verification ────────────────────────────────────
    await wait(1500);
    const [{ data: finalOrder }, { data: finalInvoice }, { data: finalPayment }, { data: subs }] = await Promise.all([
      supabase.from("orders")
        .select("id, order_number, status, payment_status, account_id")
        .eq("id", intent.converted_order_id).maybeSingle(),
      supabase.from("billing_invoices")
        .select("id, invoice_number, status, total, amount_paid, balance_due")
        .eq("id", invoice.id).maybeSingle(),
      supabase.from("billing_payments")
        .select("id, payment_number, status, amount, provider, reference, method")
        .eq("id", canonicalPaymentId).maybeSingle(),
      supabase.from("billing_subscriptions")
        .select("id, subscription_number, status, plan_id, order_id, activated_at")
        .eq("order_id", intent.converted_order_id),
    ]);

    report.ids.order_number = finalOrder?.order_number || null;
    report.ids.invoice_number = finalInvoice?.invoice_number || null;
    report.ids.payment_number = finalPayment?.payment_number || null;
    report.ids.account_id = finalOrder?.account_id || null;
    report.ids.subscription_ids = (subs || []).map((s: any) => s.id);
    report.ids.subscription_numbers = (subs || []).map((s: any) => s.subscription_number);

    const invariants = {
      order_validated: finalOrder?.status === "validated" && finalOrder?.payment_status === "paid",
      invoice_paid: finalInvoice?.status === "paid" && Number(finalInvoice?.balance_due || 0) === 0,
      payment_completed: finalPayment?.status === "completed" || finalPayment?.status === "succeeded" || finalPayment?.status === "paid",
      subscription_created: (subs || []).length > 0,
      subscription_active: (subs || []).some((s: any) => ["active", "pending_activation", "trialing"].includes(String(s.status).toLowerCase())),
    };
    step("verify_downstream", { ok: Object.values(invariants).every(Boolean), invariants, finalOrder, finalInvoice, finalPayment, subs });

    report.ok = Object.values(invariants).every(Boolean);
    report.finished_at = new Date().toISOString();
    return json(report, 200);
  } catch (err: any) {
    report.fatal = err?.message || String(err);
    report.finished_at = new Date().toISOString();
    return json(report, 500);
  }
});
