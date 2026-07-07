/**
 * quote-checkout-finalize — regression test (Phase 3.A.1.b)
 *
 * Reproduit un scénario de finalisation de soumission (Internet récurrent +
 * frais uniques + rabais) et vérifie :
 *   1. Une SEULE facture est créée via build_invoice_from_order.
 *   2. AUCUN calcul local de taxes — les montants viennent des order_items.
 *   3. Les abonnements sont figés (frozen_*) via create_subscriptions_from_order.
 *   4. Idempotence : deuxième appel = même invoice_id.
 *   5. Aucune ligne fantôme sur billing_invoice_lines.
 */
// dotenv skipped; env comes from runtime
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test({
  name: "quote-checkout-finalize — order_items → RPC canonique (pas d'écriture directe)",
  ignore: !SUPABASE_URL || !SERVICE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Simule une commande CRM/quote convertie : plan + frais + rabais
    const pseudoUserId = crypto.randomUUID();
    const { data: bc } = await admin.from("billing_customers").insert({
      user_id: pseudoUserId,
      first_name: "Test", last_name: "Quote-3AB",
      email: `test-quote-3ab-${Date.now()}@example.com`, phone: "5140000000", status: "active",
    }).select("id").single();

    assert(bc?.id, "billing_customer créé");

    const { data: order, error: oErr } = await admin.from("orders").insert({
      order_number: `TST-3AB-${Date.now()}`,
      user_id: pseudoUserId,
      service_type: "combo",
      status: "submitted",
      payment_status: "pending",
      payment_method: "paypal",
      environment: "live",
    }).select("id").single();

    assert(!oErr, `orders setup: ${oErr?.message}`);

    try {
      // order_items dérivés de quote_lines (simulés)
      const items = [
        { order_id: order.id, item_number: 1, plan_code: "INT-100", plan_name: "Internet 100 Mbps",
          service_type: "internet", unit_price: 60, quantity: 1, line_total: 60, is_recurring: true },
        { order_id: order.id, item_number: 2, plan_code: "ACT", plan_name: "Frais d'activation",
          service_type: "fee", unit_price: 25, quantity: 1, line_total: 25, is_recurring: false },
        { order_id: order.id, item_number: 3, plan_code: "PROMO-10", plan_name: "Rabais 10$",
          service_type: "promotion", unit_price: -10, quantity: 1, line_total: -10, is_recurring: false },
      ];
      const { error: iErr } = await admin.from("order_items").insert(items);
      assert(!iErr, `order_items: ${iErr?.message}`);

      const ctx = { edge_function_name: "quote-checkout-finalize-test", module: "test",
        actor_user_id: pseudoUserId, reason: "regression_3ab_quote" };

      // Appel 1
      const { data: inv1, error: e1 } = await admin.rpc("build_invoice_from_order",
        { p_order_id: order.id, p_context: ctx });
      assert(!e1 && inv1, `build_invoice_from_order: ${e1?.message}`);

      // Idempotence
      const { data: inv2 } = await admin.rpc("build_invoice_from_order",
        { p_order_id: order.id, p_context: ctx });
      assertEquals(inv2, inv1, "idempotent");

      // Subscriptions figés
      const { data: subIds, error: e3 } = await admin.rpc("create_subscriptions_from_order",
        { p_order_id: order.id, p_context: ctx });
      assert(!e3, `subs: ${e3?.message}`);
      assert(Array.isArray(subIds) && subIds.length === 1, "1 abonnement (récurrent uniquement)");

      // Vérifie les montants : subtotal = 60+25-10 = 75, GST=3.75, QST=7.48, total=86.23
      const { data: invoice } = await admin.from("billing_invoices")
        .select("subtotal, tps_amount, tvq_amount, total").eq("id", inv1).single();

      assertEquals(Number(invoice!.subtotal), 75, "subtotal figé");
      assertEquals(Number(invoice!.tps_amount), 3.75, "GST 5%");
      assertEquals(Number(invoice!.tvq_amount), 7.48, "QST 9.975%");

      // Pas de ligne fantôme : exactement 3 lignes
      const { count: linesCount } = await admin.from("billing_invoice_lines")
        .select("id", { head: true, count: "exact" }).eq("invoice_id", inv1);
      assertEquals(linesCount, 3, "aucune ligne fantôme");

      // Abonnement figé (frozen_*)
      const { data: sub } = await admin.from("billing_subscriptions")
        .select("frozen_name, frozen_unit_price, source_order_item_id").eq("id", subIds[0]).single();

      assertEquals(sub!.frozen_name, "Internet 100 Mbps");
      assertEquals(Number(sub!.frozen_unit_price), 60);
      assert(sub!.source_order_item_id, "traçabilité order_item");
    } finally {
      await admin.from("orders").delete().eq("id", order.id);
      await admin.from("billing_customers").delete().eq("id", bc.id);
    }
  },
});
