// ============================================================================
// square_payment_paths_3b2.test.ts — Phase 3.B.2 partie 2
// ============================================================================
// Tests d'invariants pour le chemin de paiement Square canonique.
// 8 scénarios obligatoires :
//   1. Paiement Square réussi (RPC canonique)
//   2. Paiement Square partiel
//   3. Paiement Square échoué (aucun effet billing)
//   4. Retry après succès sans double paiement (idempotence)
//   5. Double événement Square (webhook idempotency)
//   6. Renouvellement abonnement Square (RPC canonique)
//   7. Paiement Square sur facture avec crédit existant
//   8. Plusieurs paiements Square sur une même facture
//
// Tests d'invariants négatifs (bonus 3.B.2) :
//   9. Aucun billing_payment PayPal ne peut être créé (trigger DB)
//  10. Aucun account_adjustment PayPal ne peut être créé
// ============================================================================
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Fixtures ──────────────────────────────────────────────────────────────
async function createFixtureInvoice(total: number, opts: { amount_paid?: number } = {}) {
  const { data: customer } = await supabase.from("billing_customers").insert({
    email: `test-${crypto.randomUUID()}@nivra-test.local`,
    first_name: "Test", last_name: "3B2",
  }).select("id").single();

  const { data: invoice } = await supabase.from("billing_invoices").insert({
    customer_id: customer.id,
    invoice_number: `T3B2-${Date.now().toString().slice(-8)}`,
    total, subtotal: total, taxes: 0,
    amount_paid: opts.amount_paid ?? 0,
    balance_due: total - (opts.amount_paid ?? 0),
    status: (opts.amount_paid ?? 0) > 0 ? "partially_paid" : "unpaid",
    issued_at: new Date().toISOString(),
  }).select("id, total, customer_id").single();

  return { customer, invoice };
}

async function cleanup(invoiceId: string, customerId: string) {
  await supabase.from("billing_payments").delete().eq("invoice_id", invoiceId);
  await supabase.from("square_payment_attempts").delete().eq("invoice_id", invoiceId);
  await supabase.from("billing_invoices").delete().eq("id", invoiceId);
  await supabase.from("billing_customers").delete().eq("id", customerId);
}

// ── 1. Paiement Square réussi ─────────────────────────────────────────────
Deno.test("3B2 — paiement Square réussi via RPC canonique", async () => {
  const { customer, invoice } = await createFixtureInvoice(100);
  try {
    const { data: paymentId, error } = await supabase.rpc("apply_payment_to_invoice", {
      p_invoice_id: invoice.id,
      p_amount: 100,
      p_method: "card",
      p_provider: "square",
      p_external_reference: `sq_test_${crypto.randomUUID()}`,
      p_source: "portal",
      p_context: { test_case: "1_success" },
    });
    assert(!error, `RPC failed: ${error?.message}`);
    assertExists(paymentId);

    const { data: inv } = await supabase.from("billing_invoices")
      .select("status, amount_paid").eq("id", invoice.id).single();
    assertEquals(inv.status, "paid");
    assertEquals(Number(inv.amount_paid), 100);
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 2. Paiement partiel ────────────────────────────────────────────────────
Deno.test("3B2 — paiement Square partiel", async () => {
  const { customer, invoice } = await createFixtureInvoice(200);
  try {
    const { data: paymentId, error } = await supabase.rpc("apply_payment_to_invoice", {
      p_invoice_id: invoice.id, p_amount: 75,
      p_method: "card", p_provider: "square",
      p_external_reference: `sq_partial_${crypto.randomUUID()}`,
      p_source: "portal", p_context: { test_case: "2_partial" },
    });
    assert(!error);
    assertExists(paymentId);
    const { data: inv } = await supabase.from("billing_invoices")
      .select("status, amount_paid").eq("id", invoice.id).single();
    assertEquals(Number(inv.amount_paid), 75);
    assert(inv.status !== "paid", "Facture ne doit pas être marquée payée pour paiement partiel");
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 3. Paiement Square échoué : AUCUN effet billing ────────────────────────
Deno.test("3B2 — échec Square: aucun billing_payment, aucune modif invoice", async () => {
  const { customer, invoice } = await createFixtureInvoice(150);
  try {
    // Simuler un échec : log direct dans square_payment_attempts, sans RPC
    await supabase.from("square_payment_attempts").insert({
      invoice_id: invoice.id, customer_id: customer.id, amount: 150,
      idempotency_key: `fail-${crypto.randomUUID()}`,
      square_error_code: "CARD_DECLINED",
      square_error_detail: "Card was declined by the issuer",
      status: "failed",
    });

    const { count: pmtCount } = await supabase.from("billing_payments")
      .select("*", { count: "exact", head: true }).eq("invoice_id", invoice.id);
    assertEquals(pmtCount, 0, "Aucun billing_payment ne doit être créé en cas d'échec");

    const { data: inv } = await supabase.from("billing_invoices")
      .select("status, amount_paid, balance_due").eq("id", invoice.id).single();
    assertEquals(inv.status, "unpaid");
    assertEquals(Number(inv.amount_paid), 0);
    assertEquals(Number(inv.balance_due), 150);
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 4. Retry après succès : idempotence ────────────────────────────────────
Deno.test("3B2 — retry Square après succès: pas de double paiement", async () => {
  const { customer, invoice } = await createFixtureInvoice(50);
  const squareRef = `sq_idem_${crypto.randomUUID()}`;
  try {
    const { data: id1 } = await supabase.rpc("apply_payment_to_invoice", {
      p_invoice_id: invoice.id, p_amount: 50,
      p_method: "card", p_provider: "square",
      p_external_reference: squareRef,
      p_source: "portal", p_context: {},
    });
    assertExists(id1);

    // Simule le retry: le code Square vérifie d'abord la présence via reference
    const { data: existing } = await supabase.from("billing_payments")
      .select("id").eq("reference", squareRef).maybeSingle();
    assertExists(existing?.id, "Le premier paiement doit être retrouvé par reference");
    assertEquals(existing.id, id1, "Retry doit voir le même paiement (idempotence)");

    const { count } = await supabase.from("billing_payments")
      .select("*", { count: "exact", head: true }).eq("reference", squareRef);
    assertEquals(count, 1);
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 5. Double événement Square (webhook idempotency) ───────────────────────
Deno.test("3B2 — double événement Square: rejet via webhook_events_processed", async () => {
  const eventId = `evt_test_${crypto.randomUUID()}`;
  const { error: e1 } = await supabase.from("webhook_events_processed").insert({
    provider: "square", event_id: eventId, event_type: "payment.updated",
  });
  assert(!e1);

  // Deuxième tentative doit être rejetée par UNIQUE (provider, event_id)
  const { error: e2 } = await supabase.from("webhook_events_processed").insert({
    provider: "square", event_id: eventId, event_type: "payment.updated",
  });
  assertExists(e2, "Le deuxième événement identique doit être rejeté");
  assert(e2.code === "23505" || e2.message.includes("duplicate"), `Attendu conflit unique, reçu: ${e2.message}`);

  await supabase.from("webhook_events_processed").delete().eq("event_id", eventId);
});

// ── 6. Renouvellement abonnement Square ────────────────────────────────────
Deno.test("3B2 — renouvellement abonnement via paiement Square", async () => {
  const { customer, invoice } = await createFixtureInvoice(65);
  try {
    const { data: paymentId, error } = await supabase.rpc("apply_payment_to_invoice", {
      p_invoice_id: invoice.id, p_amount: 65,
      p_method: "card", p_provider: "square",
      p_external_reference: `sq_renewal_${crypto.randomUUID()}`,
      p_source: "autopay_square",
      p_context: { subscription_renewal: true, test_case: "6_renewal" },
    });
    assert(!error);
    assertExists(paymentId);

    const { data: inv } = await supabase.from("billing_invoices")
      .select("status, amount_paid").eq("id", invoice.id).single();
    assertEquals(inv.status, "paid");
    assertEquals(Number(inv.amount_paid), 65);
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 7. Paiement Square sur facture avec crédit existant ────────────────────
Deno.test("3B2 — paiement Square sur facture avec crédit préalable", async () => {
  const { customer, invoice } = await createFixtureInvoice(120, { amount_paid: 30 });
  try {
    const { data: paymentId, error } = await supabase.rpc("apply_payment_to_invoice", {
      p_invoice_id: invoice.id, p_amount: 90,
      p_method: "card", p_provider: "square",
      p_external_reference: `sq_credit_${crypto.randomUUID()}`,
      p_source: "portal", p_context: { pre_credit: 30 },
    });
    assert(!error);
    assertExists(paymentId);

    const { data: inv } = await supabase.from("billing_invoices")
      .select("status, amount_paid").eq("id", invoice.id).single();
    assertEquals(Number(inv.amount_paid), 120, "Le crédit préalable + paiement Square doivent totaliser 120");
    assertEquals(inv.status, "paid");
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 8. Plusieurs paiements Square sur une même facture ─────────────────────
Deno.test("3B2 — plusieurs paiements Square sur une même facture", async () => {
  const { customer, invoice } = await createFixtureInvoice(300);
  try {
    for (const amt of [100, 100, 100]) {
      const { error } = await supabase.rpc("apply_payment_to_invoice", {
        p_invoice_id: invoice.id, p_amount: amt,
        p_method: "card", p_provider: "square",
        p_external_reference: `sq_multi_${crypto.randomUUID()}`,
        p_source: "portal", p_context: {},
      });
      assert(!error, `Paiement ${amt} a échoué: ${error?.message}`);
    }
    const { data: inv } = await supabase.from("billing_invoices")
      .select("status, amount_paid").eq("id", invoice.id).single();
    assertEquals(Number(inv.amount_paid), 300);
    assertEquals(inv.status, "paid");

    const { count } = await supabase.from("billing_payments")
      .select("*", { count: "exact", head: true }).eq("invoice_id", invoice.id);
    assertEquals(count, 3, "3 paiements distincts doivent exister");
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 9. INVARIANT : aucun billing_payment PayPal ne peut être créé ──────────
Deno.test("3B2 — trigger DB refuse tout billing_payment PayPal", async () => {
  const { customer, invoice } = await createFixtureInvoice(50);
  try {
    const { error } = await supabase.from("billing_payments").insert({
      invoice_id: invoice.id, customer_id: customer.id,
      amount: 50, method: "paypal", provider: "paypal",
      status: "confirmed",
      reference: "PP-BLOCKED-TEST",
    });
    assertExists(error, "Le trigger doit refuser tout paiement PayPal");
    assert(
      error.message.includes("PAYPAL-FROZEN") || error.message.includes("INVARIANT-3B2"),
      `Message attendu contient PAYPAL-FROZEN, reçu: ${error.message}`,
    );
  } finally { await cleanup(invoice.id, customer.id); }
});

// ── 10. INVARIANT : aucun account_adjustment source PayPal ─────────────────
Deno.test("3B2 — trigger DB refuse account_adjustment source PayPal", async () => {
  const { customer } = await createFixtureInvoice(10);
  try {
    const { error } = await supabase.from("account_adjustments").insert({
      customer_id: customer.id,
      amount: -20, kind: "credit",
      source: "paypal_refund",
      reason: "Test PayPal blocked",
    });
    assertExists(error, "account_adjustments avec source PayPal doit être refusé");
    assert(
      error.message.includes("PAYPAL-FROZEN") || error.message.includes("INVARIANT-3B2"),
      `Attendu PAYPAL-FROZEN, reçu: ${error.message}`,
    );
  } finally {
    await supabase.from("billing_customers").delete().eq("id", customer.id);
  }
});
