// ============================================================================
// Regression test — Scénario "commande 58953"
// ============================================================================
//
// Reproduit :
//   • Une commande avec 1 service récurrent + 1 frais unique (activation)
//   • + 1 promotion (rabais négatif appliqué à la commande)
//   • + 1 paiement PayPal capturé
//
// Vérifie que le lot 3.A garantit :
//   1. UNE et une seule facture canonique créée pour la commande
//   2. UNE et une seule ligne par order_item (aucune ligne fantôme, aucune
//      duplication comme l'ancien billing-create-order en produisait)
//   3. Taxes figées (tax_snapshot présent, tps=5%, tvq=9.975%)
//   4. UN et un seul abonnement créé (frozen_* renseignés)
//   5. UN paiement appliqué, facture passée à `paid`, amount_paid == total
//   6. UNE entrée billing_provenance pour la facture, l'abonnement et le
//      paiement (traçabilité canonique complète)
//
// Le test appelle DIRECTEMENT les RPC canoniques (mêmes portes d'entrée que
// les Edge Functions réécrites) — c'est le contrat testé, pas l'HTTP.
//
// Prérequis d'environnement (chargés depuis .env par Deno dotenv) :
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
try { await load({ export: true, allowEmptyValues: true, examplePath: null, defaultsPath: null }); } catch { /* .env optional */ }
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Guard : ne pas exploser si les secrets manquent en CI
const CAN_RUN = !!SUPABASE_URL && !!SERVICE_KEY;

const admin = CAN_RUN ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

async function cleanup(orderId: string, userId: string) {
  if (!admin) return;
  // Ordre : provenance → payments → invoice_lines → invoices → subs → items → order → customer
  const { data: invoices } = await admin
    .from("billing_invoices").select("id").eq("order_id", orderId);
  const invIds = (invoices ?? []).map((r: any) => r.id);
  if (invIds.length) {
    await admin.from("billing_provenance").delete().in("object_id", invIds);
    await admin.from("billing_payments").delete().in("invoice_id", invIds);
    await admin.from("billing_invoice_lines").delete().in("invoice_id", invIds);
    await admin.from("billing_invoices").delete().in("id", invIds);
  }
  const { data: subs } = await admin
    .from("billing_subscriptions").select("id").eq("order_id", orderId);
  const subIds = (subs ?? []).map((r: any) => r.id);
  if (subIds.length) {
    await admin.from("billing_provenance").delete().in("object_id", subIds);
    await admin.from("billing_subscriptions").delete().in("id", subIds);
  }
  await admin.from("order_items").delete().eq("order_id", orderId);
  await admin.from("orders").delete().eq("id", orderId);
  await admin.from("billing_customers").delete().eq("user_id", userId);
}

Deno.test({
  name: "regression 58953 — canonical RPCs produce single invoice, no phantom lines",
  ignore: !CAN_RUN,
  async fn() {
    const testId = crypto.randomUUID().slice(0, 8);
    const testEmail = `regression-58953-${testId}@nivra.test`;
    const orderNumber = `TEST-58953-${testId}`;

    // ── SETUP : user profile + billing_customer + order + order_items ────
    // On ne peut pas créer un auth.users depuis Deno test → on réutilise
    // l'utilisateur de service via un pseudo user_id UUID pour la fixture.
    const pseudoUserId = crypto.randomUUID();

    // billing_customer minimal
    const { data: bc, error: bcErr } = await admin!
      .from("billing_customers")
      .insert({
        user_id: pseudoUserId,
        first_name: "Test",
        last_name: "Regression",
        email: testEmail,
        phone: "5145550058",
        status: "active",
      })
      .select("id").single();
    if (bcErr) throw new Error(`billing_customer setup: ${bcErr.message}`);

    // order minimal (le trigger orders_total_amount doit accepter notre total)
    // Composition scénario 58953 :
    //   plan récurrent  50.00
    //   frais activation 10.00
    //   promotion       -5.00  (rabais)
    // subtotal = 55.00 → gst 2.75, qst 5.49, total 63.24
    const subtotal = 55.00;
    const gst = Number((subtotal * 0.05).toFixed(2));
    const qst = Number((subtotal * 0.09975).toFixed(2));
    const total = Number((subtotal + gst + qst).toFixed(2));

    const { data: order, error: orderErr } = await admin!
      .from("orders")
      .insert({
        user_id: pseudoUserId,
        order_number: orderNumber,
        status: "submitted",
        payment_status: "pending",
        payment_method: "paypal",
        service_type: "internet",
        subtotal,
        tps_rate: 0.05, tvq_rate: 0.09975,
        tps_amount: gst, tvq_amount: qst,
        total_amount: total,
        environment: "test",
      })
      .select("id").single();
    if (orderErr) throw new Error(`orders setup: ${orderErr.message}`);
    const orderId = order.id as string;

    try {
      // order_items : 1 récurrent + 1 fee + 1 discount
      const items = [
        {
          order_id: orderId, item_number: 1,
          plan_code: "INT-100", plan_name: "Internet 100 Mbps",
          service_type: "internet",
          unit_price: 50.00, quantity: 1, line_total: 50.00,
          is_recurring: true,
        },
        {
          order_id: orderId, item_number: 2,
          plan_code: "ACT", plan_name: "Frais d'activation",
          service_type: "activation_fee",
          unit_price: 10.00, quantity: 1, line_total: 10.00,
          is_recurring: false,
        },
        {
          order_id: orderId, item_number: 3,
          plan_code: "PROMO-5", plan_name: "Promotion -5$",
          service_type: "promotion",
          unit_price: -5.00, quantity: 1, line_total: -5.00,
          is_recurring: false,
        },
      ];
      const { error: itemsErr } = await admin!.from("order_items").insert(items);
      if (itemsErr) throw new Error(`order_items setup: ${itemsErr.message}`);

      const ctx = {
        edge_function_name: "regression-test-58953",
        module: "test",
        actor_user_id: pseudoUserId,
        reason: "regression_58953",
      };

      // ── ACT 1 : build_invoice_from_order (idempotent) ────────────────
      const { data: invoiceId1, error: e1 } = await admin!.rpc(
        "build_invoice_from_order",
        { p_order_id: orderId, p_context: ctx },
      );
      assert(!e1, `build_invoice_from_order 1: ${e1?.message}`);
      assert(invoiceId1, "invoice_id retourné");

      // Deuxième appel → même invoice_id (idempotence)
      const { data: invoiceId2 } = await admin!.rpc(
        "build_invoice_from_order",
        { p_order_id: orderId, p_context: ctx },
      );
      assertEquals(invoiceId2, invoiceId1, "RPC doit être idempotent");

      // ── ACT 2 : create_subscriptions_from_order ──────────────────────
      const { data: subIds, error: e2 } = await admin!.rpc(
        "create_subscriptions_from_order",
        { p_order_id: orderId, p_context: ctx },
      );
      assert(!e2, `create_subscriptions_from_order: ${e2?.message}`);

      // ── ACT 3 : apply_payment_to_invoice ─────────────────────────────
      const { data: paymentId, error: e3 } = await admin!.rpc(
        "apply_payment_to_invoice",
        {
          p_invoice_id: invoiceId1,
          p_amount: total,
          p_method: "paypal",
          p_provider: "paypal",
          p_external_reference: `PAYPAL-CAP-${testId}`,
          p_source: "test",
          p_context: ctx,
        },
      );
      assert(!e3, `apply_payment_to_invoice: ${e3?.message}`);
      assert(paymentId, "payment_id retourné");

      // ── ASSERT 1 : une seule facture pour la commande ────────────────
      const { data: invoicesForOrder } = await admin!
        .from("billing_invoices")
        .select("id, subtotal, tps_amount, tvq_amount, total, status, amount_paid, tax_snapshot")
        .eq("order_id", orderId);
      assertEquals(invoicesForOrder!.length, 1, "Exactement UNE facture canonique par commande");
      const inv = invoicesForOrder![0];

      // ── ASSERT 2 : une ligne par order_item (aucune ligne fantôme) ───
      const { data: invLines } = await admin!
        .from("billing_invoice_lines")
        .select("id, source_order_item_id, line_total")
        .eq("invoice_id", inv.id);
      assertEquals(invLines!.length, 3, "3 lignes = 3 order_items (aucune duplication)");
      const linkedItems = new Set(invLines!.map((l: any) => l.source_order_item_id).filter(Boolean));
      assertEquals(linkedItems.size, 3, "Chaque ligne référence son order_item source");

      // ── ASSERT 3 : taxes figées et correctes ─────────────────────────
      assertEquals(Number(inv.subtotal), subtotal, "subtotal figé");
      assertEquals(Number(inv.tps_amount), gst, "TPS 5% figée");
      assertEquals(Number(inv.tvq_amount), qst, "TVQ 9.975% figée");
      assertEquals(Number(inv.total), total, "total figé");
      assert(inv.tax_snapshot, "tax_snapshot présent (immuabilité)");
      assertEquals((inv.tax_snapshot as any).gst_rate, 0.05, "snapshot GST rate");
      assertEquals((inv.tax_snapshot as any).qst_rate, 0.09975, "snapshot QST rate");

      // ── ASSERT 4 : un abonnement figé pour l'unique service récurrent ─
      const { data: subs } = await admin!
        .from("billing_subscriptions")
        .select("id, plan_code, plan_price, frozen_code, frozen_name, frozen_unit_price")
        .eq("order_id", orderId);
      assertEquals(subs!.length, 1, "Un seul abonnement (un seul order_item récurrent)");
      assertEquals(subs![0].frozen_code, "INT-100", "frozen_code renseigné");
      assertEquals(Number(subs![0].frozen_unit_price), 50.00, "prix figé dans frozen_unit_price");

      // ── ASSERT 5 : paiement appliqué, facture payée ──────────────────
      const { data: paidInv } = await admin!
        .from("billing_invoices")
        .select("status, amount_paid, paid_at")
        .eq("id", inv.id).single();
      assertEquals(paidInv!.status, "paid", "facture passée à `paid` par le RPC");
      assertEquals(Number(paidInv!.amount_paid), total, "amount_paid == total");
      assert(paidInv!.paid_at, "paid_at renseigné par le RPC");

      const { data: payments } = await admin!
        .from("billing_payments").select("id, amount, status").eq("invoice_id", inv.id);
      assertEquals(payments!.length, 1, "UN paiement, aucun doublon");
      assertEquals(payments![0].status, "completed");

      // ── ASSERT 6 : traçabilité complète billing_provenance ───────────
      const { data: prov } = await admin!
        .from("billing_provenance")
        .select("object_type, rpc_name")
        .in("object_id", [inv.id, subs![0].id, payments![0].id]);
      const rpcs = new Set((prov ?? []).map((p: any) => p.rpc_name));
      assert(rpcs.has("build_invoice_from_order"), "traçabilité facture");
      assert(rpcs.has("create_subscriptions_from_order"), "traçabilité abonnement");
      assert(rpcs.has("apply_payment_to_invoice"), "traçabilité paiement");

      // ── ASSERT 7 : garantie no phantom (le trigger d'immutabilité
      //     interdit toute mutation des order_items maintenant utilisés)
      const { error: mutateErr } = await admin!
        .from("order_items")
        .update({ unit_price: 999.00 })
        .eq("order_id", orderId)
        .eq("item_number", 1);
      assert(mutateErr, "trigger d'immutabilité doit refuser la mutation");
    } finally {
      await cleanup(orderId, pseudoUserId);
    }
  },
});
