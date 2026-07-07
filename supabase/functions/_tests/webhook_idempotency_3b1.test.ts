/**
 * ============================================================================
 * 3.B.1 — Tests d'idempotence webhooks (Square + PayPal) + garde-fous refund
 * ============================================================================
 *
 * Scénarios couverts :
 *   1. Double événement Square (même event_id rejoué 2×) → une seule ligne DB
 *   2. Double événement PayPal (même event_id rejoué 2×) → une seule ligne DB
 *   3. Événement invalide (signature manquante / payload malformé) → rejet
 *   4. Paiement déjà traité (invoice.status='paid') → short-circuit
 *   5. Refund qui tente le mauvais chemin (account_adjustment /
 *      invoice_line négative / promotion) → RAISE EXCEPTION côté DB
 *
 * Exécution :
 *   deno test -A --unsafely-ignore-certificate-errors \
 *     supabase/functions/_tests/webhook_idempotency_3b1.test.ts
 *
 * Ces tests utilisent les RPC canoniques (SECURITY DEFINER) via service_role,
 * exactement comme les webhooks en production.
 * ============================================================================
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────
async function seedTestInvoice(amount = 25.00): Promise<{ invoiceId: string; customerId: string }> {
  const { data: customer } = await supabase
    .from("billing_customers")
    .insert({
      first_name: "Test3B1",
      last_name: `Idem-${Date.now()}`,
      email: `test-3b1-${Date.now()}@nivra-telecom.ca`,
    })
    .select("id").single();
  const customerId = customer!.id;

  const { data: invoice } = await supabase
    .from("billing_invoices")
    .insert({
      customer_id: customerId,
      subtotal: amount,
      total: amount,
      amount_paid: 0,
      status: "sent",
      environment: "test",
    })
    .select("id").single();

  return { invoiceId: invoice!.id, customerId };
}

async function cleanup(customerId: string) {
  await supabase.from("billing_customers").delete().eq("id", customerId);
}

// ═════════════════════════════════════════════════════════════════════
// Test 1 — Double événement Square (idempotence)
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-01: même event_id Square rejoué 2× → une seule écriture", async () => {
  const { invoiceId, customerId } = await seedTestInvoice(50);
  const eventId = `test-square-idem-${Date.now()}`;

  const call = () => supabase.rpc("apply_payment_from_webhook", {
    p_provider: "square",
    p_event_id: eventId,
    p_event_type: "payment.updated",
    p_provider_created_at: new Date().toISOString(),
    p_invoice_id: invoiceId,
    p_amount: 50,
    p_method: "card",
    p_external_reference: `sq_${eventId}`,
    p_source: "webhook",
    p_context: { test: "3B1-01" },
  });

  const first  = await call();
  const second = await call();

  assertEquals(first.error, null, `Premier appel doit réussir: ${first.error?.message}`);
  assertEquals(second.error, null, `Second appel (duplicate) doit renvoyer NULL, pas erreur`);
  assert(first.data,  "Premier appel doit produire un payment_id");

  // Le second appel doit soit renvoyer NULL (nouveau paiement pas créé) soit le même id
  // (selon si webhook_events_processed a mémorisé le payment_id)
  const secondId = second.data;
  if (secondId !== null) {
    assertEquals(secondId, first.data, "Second appel doit renvoyer le MÊME payment_id");
  }

  // Vérifier : une seule ligne dans billing_payments pour cet event_id
  const { data: payments } = await supabase
    .from("billing_payments")
    .select("id, provider_event_id, rpc_used")
    .eq("provider", "square")
    .eq("provider_event_id", eventId);
  assertEquals(payments?.length, 1, "Doit y avoir EXACTEMENT 1 billing_payment pour cet event_id");
  assertEquals(payments![0].rpc_used, "apply_payment_from_webhook");

  // Vérifier : registre webhook_events_processed a exactement 1 ligne
  const { data: events } = await supabase
    .from("webhook_events_processed")
    .select("provider, event_id, payment_id")
    .eq("provider", "square").eq("event_id", eventId);
  assertEquals(events?.length, 1, "webhook_events_processed doit avoir 1 seule ligne");

  await cleanup(customerId);
});

// ═════════════════════════════════════════════════════════════════════
// Test 2 — Double événement PayPal (idempotence)
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-02: même event_id PayPal rejoué 2× → une seule écriture", async () => {
  const { invoiceId, customerId } = await seedTestInvoice(35);
  const eventId = `WH-PAYPAL-IDEM-${Date.now()}`;

  const call = () => supabase.rpc("apply_payment_from_webhook", {
    p_provider: "paypal",
    p_event_id: eventId,
    p_event_type: "PAYMENT.SALE.COMPLETED",
    p_provider_created_at: new Date().toISOString(),
    p_invoice_id: invoiceId,
    p_amount: 35,
    p_method: "paypal",
    p_external_reference: `PP_${eventId}`,
    p_source: "webhook",
    p_context: { test: "3B1-02" },
  });

  const first  = await call();
  const second = await call();

  assertEquals(first.error, null);
  assertEquals(second.error, null);
  assert(first.data, "Premier appel PayPal doit produire un payment_id");

  const { count } = await supabase
    .from("billing_payments")
    .select("*", { count: "exact", head: true })
    .eq("provider", "paypal")
    .eq("provider_event_id", eventId);
  assertEquals(count, 1, "Un seul billing_payment doit exister pour cet event_id PayPal");

  await cleanup(customerId);
});

// ═════════════════════════════════════════════════════════════════════
// Test 3 — Événement invalide (provider ou event_id manquant)
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-03: record_webhook_event rejette provider/event_id NULL", async () => {
  const r1 = await supabase.rpc("record_webhook_event", {
    p_provider: null as any,
    p_event_id: "abc",
    p_event_type: "test",
    p_provider_created_at: null,
    p_payload_hash: null,
  });
  assert(r1.error !== null, "provider NULL doit lever une exception");

  const r2 = await supabase.rpc("record_webhook_event", {
    p_provider: "square",
    p_event_id: null as any,
    p_event_type: "test",
    p_provider_created_at: null,
    p_payload_hash: null,
  });
  assert(r2.error !== null, "event_id NULL doit lever une exception");
});

// ═════════════════════════════════════════════════════════════════════
// Test 4 — Paiement déjà traité (facture soldée) → apply_payment
// n'invalide pas mais n'écrit rien de nouveau
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-04: événement rejoué après facture payée → short-circuit", async () => {
  const { invoiceId, customerId } = await seedTestInvoice(20);
  const eventId = `already-paid-${Date.now()}`;

  const call = () => supabase.rpc("apply_payment_from_webhook", {
    p_provider: "square",
    p_event_id: eventId,
    p_event_type: "payment.updated",
    p_provider_created_at: new Date().toISOString(),
    p_invoice_id: invoiceId,
    p_amount: 20,
    p_method: "card",
    p_external_reference: `sq_paid_${eventId}`,
    p_source: "webhook",
    p_context: {},
  });

  const first = await call();
  assertEquals(first.error, null);
  assert(first.data);

  // Vérifier facture bien passée à 'paid'
  const { data: inv } = await supabase
    .from("billing_invoices").select("status, amount_paid").eq("id", invoiceId).single();
  assertEquals(inv?.status, "paid");
  assertEquals(Number(inv?.amount_paid), 20);

  // Rejouer le MÊME event_id → short-circuit
  const second = await call();
  assertEquals(second.error, null);

  // amount_paid ne doit PAS avoir doublé
  const { data: inv2 } = await supabase
    .from("billing_invoices").select("amount_paid").eq("id", invoiceId).single();
  assertEquals(Number(inv2?.amount_paid), 20, "amount_paid ne doit pas avoir doublé");

  await cleanup(customerId);
});

// ═════════════════════════════════════════════════════════════════════
// Test 5.a — Refund NE PEUT PAS être un account_adjustment
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-05a: refund → account_adjustments = RAISE EXCEPTION", async () => {
  const { data: acc } = await supabase
    .from("accounts")
    .insert({ display_name: `Test-3B1-05a-${Date.now()}` })
    .select("id").single();

  await assertRejects(
    async () => {
      const { error } = await supabase
        .from("account_adjustments")
        .insert({
          account_id: acc!.id,
          type: "refund",
          amount: 25,
          description: "Refund PayPal externe",
          status: "active",
        });
      if (error) throw new Error(error.message);
    },
    Error,
    "INVARIANT-3B1",
    "Un adjustment de type/description refund doit lever INVARIANT-3B1",
  );

  await supabase.from("accounts").delete().eq("id", acc!.id);
});

// ═════════════════════════════════════════════════════════════════════
// Test 5.b — Refund NE PEUT PAS être une invoice_line négative
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-05b: refund → billing_invoice_lines négative = RAISE EXCEPTION", async () => {
  const { invoiceId, customerId } = await seedTestInvoice(30);

  await assertRejects(
    async () => {
      const { error } = await supabase
        .from("billing_invoice_lines")
        .insert({
          invoice_id: invoiceId,
          description: "Refund PayPal externe (mauvais chemin)",
          unit_price: -15,
          quantity: 1,
          line_total: -15,
          line_type: "refund",
          line_kind: "refund",
        });
      if (error) throw new Error(error.message);
    },
    Error,
    "INVARIANT-3B1",
    "Une ligne de facture négative libellée refund doit lever INVARIANT-3B1",
  );

  await cleanup(customerId);
});

// ═════════════════════════════════════════════════════════════════════
// Test 5.c — Refund NE PEUT PAS être une promotion
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-05c: refund → account_promotions = RAISE EXCEPTION", async () => {
  const { data: acc } = await supabase
    .from("accounts")
    .insert({ display_name: `Test-3B1-05c-${Date.now()}` })
    .select("id").single();

  await assertRejects(
    async () => {
      const { error } = await supabase
        .from("account_promotions")
        .insert({
          account_id: acc!.id,
          description: "Refund PayPal — promotion illégitime",
          discount_amount: 25,
          discount_type: "fixed",
          status: "active",
        });
      if (error) throw new Error(error.message);
    },
    Error,
    "INVARIANT-3B1",
    "Une promotion libellée refund doit lever INVARIANT-3B1",
  );

  await supabase.from("accounts").delete().eq("id", acc!.id);
});

// ═════════════════════════════════════════════════════════════════════
// Test 5.d — Refund canonique via refund_payment() ✓
// ═════════════════════════════════════════════════════════════════════
Deno.test("3B1-05d: refund canonique via refund_payment → billing_payment(kind=refund)", async () => {
  const { invoiceId, customerId } = await seedTestInvoice(40);
  const captureEventId = `capture-for-refund-${Date.now()}`;
  const refundEventId  = `refund:refund-${Date.now()}`;

  // 1. Créer un paiement capture initial
  const cap = await supabase.rpc("apply_payment_from_webhook", {
    p_provider: "paypal",
    p_event_id: captureEventId,
    p_event_type: "PAYMENT.CAPTURE.COMPLETED",
    p_provider_created_at: new Date().toISOString(),
    p_invoice_id: invoiceId,
    p_amount: 40,
    p_method: "paypal",
    p_external_reference: "PP-CAP-TEST",
    p_source: "webhook",
    p_context: {},
  });
  assertEquals(cap.error, null);
  const originalPaymentId = cap.data as string;
  assert(originalPaymentId);

  // 2. Rembourser via refund_payment (chemin canonique)
  const ref = await supabase.rpc("refund_payment", {
    p_provider: "paypal",
    p_event_id: refundEventId,
    p_original_payment_id: originalPaymentId,
    p_amount: 40,
    p_external_reference: "PP-REFUND-TEST",
    p_reason: "test refund",
    p_provider_created_at: new Date().toISOString(),
    p_context: {},
  });
  assertEquals(ref.error, null, `refund_payment doit réussir: ${ref.error?.message}`);
  const refundPaymentId = ref.data as string;
  assert(refundPaymentId);

  // Vérifier structure : billing_payment de kind='refund', amount négatif
  const { data: refPmt } = await supabase
    .from("billing_payments")
    .select("id, amount, payment_kind, rpc_used, provider_event_id")
    .eq("id", refundPaymentId).single();
  assertEquals(refPmt?.payment_kind, "refund");
  assert(Number(refPmt?.amount) < 0, "montant refund doit être négatif");
  assertEquals(refPmt?.rpc_used, "refund_payment");
  assertEquals(refPmt?.provider_event_id, refundEventId);

  // Vérifier facture : amount_paid réajusté, status revient à sent
  const { data: inv } = await supabase
    .from("billing_invoices").select("status, amount_paid").eq("id", invoiceId).single();
  assertEquals(Number(inv?.amount_paid), 0);
  assertEquals(inv?.status, "sent");

  // Idempotence refund : rejouer le même event_id → pas de doublon
  const ref2 = await supabase.rpc("refund_payment", {
    p_provider: "paypal",
    p_event_id: refundEventId,
    p_original_payment_id: originalPaymentId,
    p_amount: 40,
    p_external_reference: "PP-REFUND-TEST",
    p_reason: "test refund duplicate",
    p_provider_created_at: new Date().toISOString(),
    p_context: {},
  });
  assertEquals(ref2.error, null);

  const { count: refundCount } = await supabase
    .from("billing_payments")
    .select("*", { count: "exact", head: true })
    .eq("payment_kind", "refund")
    .eq("provider_event_id", refundEventId);
  assertEquals(refundCount, 1, "Un seul refund_payment malgré 2 appels");

  await cleanup(customerId);
});
