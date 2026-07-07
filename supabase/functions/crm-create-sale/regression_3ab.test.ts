/**
 * crm-create-sale — regression test (Phase 3.A.1.b)
 *
 * Reproduit une vente CRM : plan récurrent + équipement + rabais agent + welcome.
 * Vérifie :
 *   1. Les 4 lignes order_items produisent UNE seule facture via RPC.
 *   2. Les rabais sont bien appliqués AVANT taxation (subtotal net).
 *   3. Aucune ligne fantôme sur billing_invoice_lines.
 *   4. Abonnement récurrent figé (frozen_unit_price = prix brut du plan).
 *   5. Aucun paiement n'est créé côté RPC — la capture est déléguée.
 */
// dotenv skipped; env comes from runtime
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test({
  name: "crm-create-sale — RPC canonique, rabais matérialisés, taxes figées",
  ignore: !SUPABASE_URL || !SERVICE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const pseudoUserId = crypto.randomUUID();
    const { data: bc } = await admin.from("billing_customers").insert({
      user_id: pseudoUserId,
      first_name: "Test", last_name: "CRM-3AB",
      email: `test-crm-3ab-${Date.now()}@example.com`, phone: "5140000001", status: "active",
    }).select("id").single();

    assert(bc?.id);

    const { data: order, error: oErr } = await admin.from("orders").insert({
      order_number: `TST-CRM-3AB-${Date.now()}`,
      user_id: pseudoUserId,
      service_type: "internet",
      status: "submitted",
      source: "crm_call",
      payment_status: "pending",
      payment_method: "paypal",
      environment: "live",
    }).select("id").single();

    assert(!oErr, oErr?.message);

    try {
      // Reproduit ce que crm-create-sale insère comme order_items :
      // plan récurrent (prix brut) + équipement + rabais agent + welcome 1er mois
      const monthly = 70;
      const equip = 60;
      const agentDiscount = 5;
      const welcome = monthly; // 1er mois offert
      const items = [
        { order_id: order.id, item_number: 1, plan_code: "INT-100", plan_name: "Internet 100 Mbps",
          service_type: "internet", unit_price: monthly, quantity: 1, line_total: monthly, is_recurring: true },
        { order_id: order.id, item_number: 2, plan_code: "EQP-WIFI", plan_name: "Borne WiFi",
          service_type: "equipment", unit_price: equip, quantity: 1, line_total: equip, is_recurring: false },
        { order_id: order.id, item_number: 3, plan_code: "PROMO-AGENT", plan_name: "Rabais agent",
          service_type: "promotion", unit_price: -agentDiscount, quantity: 1, line_total: -agentDiscount, is_recurring: false },
        { order_id: order.id, item_number: 4, plan_code: "PROMO-WELCOME-FMF", plan_name: "1er mois offert",
          service_type: "promotion", unit_price: -welcome, quantity: 1, line_total: -welcome, is_recurring: false },
      ];
      const { error: iErr } = await admin.from("order_items").insert(items);
      assert(!iErr, `order_items: ${iErr?.message}`);

      const ctx = { edge_function_name: "crm-create-sale-test", module: "test",
        actor_user_id: pseudoUserId, reason: "regression_3ab_crm" };

      const { data: invoiceId, error: e1 } = await admin.rpc("build_invoice_from_order",
        { p_order_id: order.id, p_context: ctx });
      assert(!e1 && invoiceId, `build_invoice_from_order: ${e1?.message}`);

      const { data: subIds, error: e2 } = await admin.rpc("create_subscriptions_from_order",
        { p_order_id: order.id, p_context: ctx });
      assert(!e2, e2?.message);
      assertEquals(subIds.length, 1, "un seul abonnement récurrent");

      // Subtotal attendu = 70 + 60 - 5 - 70 = 55
      // GST 5% = 2.75 ; QST 9.975% = 5.49 ; total = 63.24
      const { data: invoice } = await admin.from("billing_invoices")
        .select("subtotal, tps_amount, tvq_amount, total, status").eq("id", invoiceId).single();

      assertEquals(Number(invoice!.subtotal), 55, "subtotal net après rabais");
      assertEquals(Number(invoice!.tps_amount), 2.75);
      assertEquals(Number(invoice!.tvq_amount), 5.49);
      assertEquals(Number(invoice!.total), 63.24);
      assertEquals(invoice!.status, "pending", "aucun paiement appliqué par crm-create-sale");

      // 4 lignes exactement, pas de fantôme
      const { count: linesCount } = await admin.from("billing_invoice_lines")
        .select("id", { head: true, count: "exact" }).eq("invoice_id", invoiceId);
      assertEquals(linesCount, 4, "aucune ligne fantôme");

      // Abonnement figé au PRIX BRUT du plan (les rabais one-time n'affectent pas frozen_unit_price)
      const { data: sub } = await admin.from("billing_subscriptions")
        .select("frozen_unit_price, frozen_name, source_order_item_id").eq("id", subIds[0]).single();

      assertEquals(Number(sub!.frozen_unit_price), monthly, "prix figé = prix brut du plan");
      assert(sub!.source_order_item_id, "traçabilité");

      // Aucun paiement créé
      const { count: payCount } = await admin.from("billing_payments")
        .select("id", { head: true, count: "exact" }).eq("invoice_id", invoiceId);
      assertEquals(payCount, 0, "capture PayPal déléguée — pas de paiement direct");
    } finally {
      await admin.from("orders").delete().eq("id", order.id);
      await admin.from("billing_customers").delete().eq("id", bc.id);
    }
  },
});
