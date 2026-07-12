import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
/**
 * ============================================================================
 * billing-create-subscription — Phase 3.A REWRITE
 * ============================================================================
 *
 *   • AUCUNE écriture directe sur billing_subscriptions / billing_invoices /
 *     billing_invoice_lines / billing_payments.
 *   • AUCUN calcul local de taxes, subtotal, balance_due, promotion, crédit.
 *   • Passe exclusivement par les RPC canoniques SECURITY DEFINER :
 *       - create_subscription_ad_hoc  (Phase 3.A)
 *       - build_invoice_ad_hoc        (Phase 3.A)
 *       - apply_payment_to_invoice    (Phase 2, si paiement fourni)
 *   • Les taxes sont figées par le RPC (tax_snapshot) — trigger Phase 2.
 *
 *   Ancien comportement :
 *     1. INSERT direct billing_subscriptions
 *     2. computeTaxes() local (TPS/TVQ recalculées côté app)
 *     3. RPC legacy create_invoice_with_lines (avec calculs pré-injectés)
 *     4. INSERT direct billing_payments
 *
 *   Nouveau comportement :
 *     1. RPC create_subscription_ad_hoc → subscription figée (frozen_*)
 *     2. RPC build_invoice_ad_hoc → facture avec tax_snapshot figé
 *     3. (option) RPC apply_payment_to_invoice
 *
 *   Logique supprimée :
 *     - import { computeTaxes } from "../_shared/tax-constants.ts"
 *     - calcul de subtotal, tpsAmount, tvqAmount, total
 *     - INSERT direct sur billing_subscriptions, billing_invoices,
 *       billing_invoice_lines, billing_payments
 *     - rollback manuel des subscriptions/lines (l'atomicité est assurée
 *       par le RPC SECURITY DEFINER)
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  customer_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  user_id?: string;
  plan_code: string;
  plan_name: string;
  plan_price: number;
  service_category?: string;
  address_id?: string;
  payment_method?: "interac" | "manual";
  // Contexte de traçabilité optionnel
  request_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

    // ── Auth gate ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }
    const callerClient: any = createClient<any>(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser?.id) return json({ error: "Invalid authentication" }, 401);

    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("status", "active")
      .maybeSingle();
    const staffRoles = ["admin", "super_admin", "owner", "employee", "agent", "field_agent", "billing_admin"];
    if (!callerRole || !staffRoles.includes(callerRole.role)) {
      return json({ error: "Insufficient permissions" }, 403);
    }

    const body: CreateSubscriptionRequest = await req.json();

    // ── Step 1 : résolution du billing_customer ───────────────────────────
    let customerId = body.customer_id;
    if (!customerId) {
      if (!body.email || !body.first_name || !body.last_name || !body.phone) {
        return json({ error: "Missing customer details: first_name, last_name, email, phone required" }, 400);
      }
      const { data: existingCustomer } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("email", body.email)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: custErr } = await supabase
          .from("billing_customers")
          .insert({
            first_name: body.first_name,
            last_name: body.last_name,
            email: body.email,
            phone: body.phone,
            user_id: body.user_id || null,
            status: "active",
          })
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCustomer.id;
      }
    }

    // ── Step 2 : cycle de facturation ─────────────────────────────────────
    const { nextAnchoredDate } = await import("../_shared/billing-utils.ts");
    const cycleStartDate = new Date();
    const anchorDay = cycleStartDate.getDate();
    const cycleEndDate = nextAnchoredDate(anchorDay, cycleStartDate);
    const cycleStart = cycleStartDate.toISOString().split("T")[0];
    const cycleEnd = cycleEndDate.toISOString().split("T")[0];

    // Dedup guard : double-click sous 5 minutes
    const { data: recentSub } = await supabase
      .from("billing_subscriptions")
      .select("id")
      .eq("customer_id", customerId)
      .eq("plan_code", body.plan_code)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .maybeSingle();

    if (recentSub) {
      const { data: existingInv } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total")
        .eq("subscription_id", recentSub.id)
        .maybeSingle();
      return json({
        subscription_id: recentSub.id,
        invoice_id: existingInv?.id,
        invoice_number: existingInv?.invoice_number,
        total: existingInv?.total,
        idempotent: true,
      });
    }

    const provenanceContext = {
      edge_function_name: "billing-create-subscription",
      module: "billing",
      actor_user_id: callerUser.id,
      actor_role: callerRole.role,
      reason: "staff_create_subscription",
      request_id: body.request_id || crypto.randomUUID(),
      source_type: "staff_manual",
    };

    // ── Step 3 : RPC canonique — création abonnement (prix figé frozen_*) ─
    const { data: newSubId, error: subErr } = await supabase.rpc(
      "create_subscription_ad_hoc",
      {
        p_customer_id: customerId,
        p_plan_code: body.plan_code,
        p_plan_name: body.plan_name,
        p_plan_price: body.plan_price,
        p_service_category: body.service_category ?? null,
        p_cycle_start: cycleStart,
        p_cycle_end: cycleEnd,
        p_context: provenanceContext,
        p_address_id: body.address_id ?? null,
        p_order_id: null,
        p_status: "pending",
        p_auto_billing: false,
      },
    );
    if (subErr) throw new Error(`create_subscription_ad_hoc failed: ${subErr.message}`);
    const subscriptionId = newSubId as string;

    // ── Step 4 : RPC canonique — facture initiale (taxes figées) ──────────
    // ⚠️ Aucun calcul TPS/TVQ ici. Le subtotal est déduit des lignes par le RPC.
    const invoiceLines = [{
      description: `${body.plan_name} – 30 jours`,
      unit_price: body.plan_price,
      quantity: 1,
      line_total: body.plan_price,
      line_type: "service",
      line_kind: "product_recurring",
      source_ref: "subscription_creation",
    }];

    const { data: invoiceId, error: invErr } = await supabase.rpc(
      "build_invoice_ad_hoc",
      {
        p_customer_id: customerId,
        p_subscription_id: subscriptionId,
        p_type: "initial",
        p_cycle_start: cycleStart,
        p_cycle_end: cycleEnd,
        p_due_date: cycleEnd,
        p_lines: invoiceLines,
        p_context: provenanceContext,
        p_order_id: null,
        p_notes: null,
      },
    );
    if (invErr) throw new Error(`build_invoice_ad_hoc failed: ${invErr.message}`);

    // Récupérer les montants figés pour l'email
    const { data: invoice } = await supabase
      .from("billing_invoices")
      .select("invoice_number, subtotal, tps_amount, tvq_amount, total")
      .eq("id", invoiceId)
      .single();

    // ── Step 5 : lier subscription.last_invoice_id (métadonnée non-financière) ─
    // Phase 6A — canonical gateway (last_invoice_id is a pointer, not immutable financial data)
    await supabase.rpc("rpc_admin_set_subscription_last_invoice", {
      p_subscription_id: subscriptionId,
      p_invoice_id: invoiceId,
    });

    // ── Step 6 : Email de bienvenue avec PDF officiel ─────────────────────
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("email, first_name, last_name")
      .eq("id", customerId)
      .single();

    if (customer && invoice) {
      const { buildInvoicePdfAttachment } = await import("../_shared/pdfFromDb.ts");
      const pdfAttachment = await buildInvoicePdfAttachment(invoiceId, "facture");

      await enqueueCommunication({
        channel: "email",
        templateKey: "invoice_created",
        recipient: customer.email,
        idempotencyKey: `billing_sub_${subscriptionId}_${invoice.invoice_number}`,
        templateVars: {
          client_name: `${customer.first_name} ${customer.last_name}`,
          invoice_number: invoice.invoice_number,
          plan_name: body.plan_name,
          subtotal: Number(invoice.subtotal).toFixed(2),
          tps_amount: Number(invoice.tps_amount).toFixed(2),
          tvq_amount: Number(invoice.tvq_amount).toFixed(2),
          total: Number(invoice.total).toFixed(2),
          amount: Number(invoice.total).toFixed(2),
          due_date: cycleEnd,
          cycle_start: cycleStart,
          cycle_end: cycleEnd,
        },
        attachments: pdfAttachment ? [pdfAttachment] : null,
      });
    }

    return json({
      success: true,
      customer_id: customerId,
      subscription_id: subscriptionId,
      invoice_id: invoiceId,
      invoice_number: invoice?.invoice_number,
      total: invoice?.total,
    });
  } catch (error) {
    console.error("[billing-create-subscription] Error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
