import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceBillingRateLimit } from "../_shared/billingRateLimit.ts";

/**
 * ============================================================================
 * BILLING V3 - CREATE ORDER — Phase 3.A REWRITE (cause 58953)
 * ============================================================================
 *
 *   • AUCUNE écriture directe sur billing_invoices / billing_invoice_lines /
 *     billing_subscriptions / billing_payments.
 *   • AUCUN calcul TPS/TVQ, subtotal, balance_due, promotion, crédit ici.
 *   • Passe exclusivement par les RPC canoniques SECURITY DEFINER :
 *       - build_invoice_from_order       (Phase 2)
 *       - create_subscriptions_from_order (Phase 2)
 *       - apply_payment_to_invoice        (Phase 2)
 *       - build_invoice_ad_hoc            (Phase 3.A, fallback sans order_id)
 *   • Le rabais « nouveau client », les promotions et les frais d'activation
 *     doivent avoir été matérialisés dans les `order_items` en amont
 *     (par orchestrate_order / compute_checkout_pricing). Cette fonction
 *     ne les recalcule PLUS.
 *
 *   ─────────────────────────────────────────────────────────────────────
 *   ⚠️ RÈGLE MÉTIER INTACTE
 *   ─────────────────────────────────────────────────────────────────────
 *   Le cycle de facturation démarre au paiement confirmé, jamais à la
 *   commande. Le RPC apply_payment_to_invoice met la facture à `paid`
 *   uniquement lorsque amount_paid ≥ total.
 *   ─────────────────────────────────────────────────────────────────────
 *
 *   ─────────────────────────────────────────────────────────────────────
 *   Ancien comportement (source du bug 58953)
 *   ─────────────────────────────────────────────────────────────────────
 *   • Itération sur body.services → UN abonnement + UNE facture PAR service
 *     → duplication de lignes fantômes quand orchestrate_order avait déjà
 *       créé les subscriptions/invoices canoniques
 *   • computeTaxes() local (TPS 5% + TVQ 9.975% recalculés dans le JS)
 *   • Insert direct billing_invoices avec `activation_fee`, `amount_paid`,
 *     `paid_at`, `balance_due`, `notes` reconstruits
 *   • Rabais welcome 50% recalculé dans l'Edge Function
 *   • Insert direct billing_invoice_lines avec discount négatifs
 *   • Insert direct billing_payments
 *   • Rollback manuel des subscriptions/invoices en cas d'erreur
 *
 *   ─────────────────────────────────────────────────────────────────────
 *   Nouveau comportement (systémique)
 *   ─────────────────────────────────────────────────────────────────────
 *   1. Résolution auth, profil, adresse, billing_customer (inchangé)
 *   2. RPC build_invoice_from_order(order_id) → UNE facture canonique
 *      dérivée de order_items (subtotal + tax_snapshot figés en DB)
 *   3. RPC create_subscriptions_from_order(order_id) → abonnements figés
 *      (frozen_* : nom, code, unit_price, cycle, ancre) — 1 sub par
 *      order_item récurrent, sans reconstruction locale
 *   4. Si le paiement est déjà capturé : RPC apply_payment_to_invoice
 *   5. Email de bienvenue avec PDF officiel (lecture pure de la facture)
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceItem {
  plan_code: string;
  plan_name: string;
  plan_price: number;
  category: string;
}

interface CreateOrderRequest {
  user_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone: string;
  services: ServiceItem[];
  order_id?: string;
  order_number?: string;
  payment_method?: "paypal" | "interac" | "etransfer" | "credit_card" | "promo_free";
  payment_status?: "paid" | "captured" | "pending" | "pre_authorized";
  payment_reference?: string;
  total_amount?: number;
  request_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = await enforceBillingRateLimit(req, "billing-create-order", corsHeaders);
  if (rl) return rl;

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
    const callerId = callerUser.id;

    const body: CreateOrderRequest = await req.json();

    // ── IDOR guard ────────────────────────────────────────────────────────
    if (body.user_id && body.user_id !== callerId) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .maybeSingle();
      const staffRoles = ["admin", "super_admin", "owner", "employee", "agent", "field_agent"];
      if (!roleRow || !staffRoles.includes(roleRow.role)) {
        return json({ error: "Cannot create order for another user" }, 403);
      }
    }

    // ── Hydrate identity from profile ─────────────────────────────────────
    if (body.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone")
        .eq("user_id", body.user_id)
        .maybeSingle();
      if (profile) {
        if (profile.first_name) body.first_name = profile.first_name;
        if (profile.last_name) body.last_name = profile.last_name;
        if (profile.email) body.email = profile.email;
        if (profile.phone && !body.phone) body.phone = profile.phone;
      }
    }

    if (!body.email || !body.first_name || !body.last_name || !body.phone) {
      return json({ error: "Missing required customer fields: email, first_name, last_name, phone" }, 400);
    }
    if (!body.services || body.services.length === 0) {
      return json({ error: "At least one service is required" }, 400);
    }

    // Détection paiement PayPal capturé (règle métier inchangée)
    const isPayPalPaid = (
      body.payment_method === "paypal" &&
      !!body.payment_reference &&
      (body.payment_status === "paid" || body.payment_status === "captured")
    );
    const effectivePaymentMethod = body.payment_method === "etransfer" ? "interac" : (body.payment_method || "interac");

    // ── Résolution du billing_customer ────────────────────────────────────
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("email", body.email)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      if (body.user_id) {
        await supabase
          .from("billing_customers")
          .update({ user_id: body.user_id })
          .eq("id", customerId)
          .is("user_id", null);
      }
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from("billing_customers")
        .insert({
          user_id: body.user_id || null,
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          phone: body.phone,
          status: "active",
        })
        .select("id")
        .single();
      if (custErr) throw custErr;
      customerId = newCustomer.id;
    }

    const provenanceContext = {
      edge_function_name: "billing-create-order",
      module: "billing",
      actor_user_id: callerId,
      reason: "order_created",
      request_id: body.request_id ?? crypto.randomUUID(),
      source_type: "order",
      source_id: body.order_id ?? null,
    };

    // ════════════════════════════════════════════════════════════════════
    // CHEMIN A — order_id fourni : UNIQUE chemin autorisé pour production
    // ════════════════════════════════════════════════════════════════════
    if (body.order_id) {
      // 1. RPC canonique — facture depuis order_items (subtotal + taxes figés)
      const { data: invoiceId, error: invErr } = await supabase.rpc(
        "build_invoice_from_order",
        { p_order_id: body.order_id, p_context: provenanceContext },
      );
      if (invErr) throw new Error(`build_invoice_from_order failed: ${invErr.message}`);

      // 2. RPC canonique — abonnements figés (frozen_*)
      const { data: subIds, error: subErr } = await supabase.rpc(
        "create_subscriptions_from_order",
        { p_order_id: body.order_id, p_context: provenanceContext },
      );
      if (subErr) throw new Error(`create_subscriptions_from_order failed: ${subErr.message}`);

      // 3. RPC canonique — application du paiement si capturé
      let paymentId: string | null = null;
      if (isPayPalPaid) {
        const { data: invRow } = await supabase
          .from("billing_invoices")
          .select("total")
          .eq("id", invoiceId)
          .single();
        const { data: pid, error: payErr } = await supabase.rpc(
          "apply_payment_to_invoice",
          {
            p_invoice_id: invoiceId,
            p_amount: invRow.total,
            p_method: "paypal",
            p_provider: "paypal",
            p_external_reference: body.payment_reference,
            p_source: "live",
            p_context: provenanceContext,
          },
        );
        if (payErr) throw new Error(`apply_payment_to_invoice failed: ${payErr.message}`);
        paymentId = pid as string;
      }

      // 4. Lecture de la facture finale (aucun recalcul côté app)
      const { data: invoice } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, subtotal, tps_amount, tvq_amount, total, status, cycle_start_date, cycle_end_date, due_date")
        .eq("id", invoiceId)
        .single();

      // 5. Email
      await queueOrderEmail(supabase, {
        isPaid: isPayPalPaid,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerEmail: body.email,
        customerName: `${body.first_name} ${body.last_name}`,
        planNames: body.services.map((s) => s.plan_name).join(", "),
        subtotal: invoice.subtotal,
        tps: invoice.tps_amount,
        tvq: invoice.tvq_amount,
        total: invoice.total,
        cycleStart: invoice.cycle_start_date,
        cycleEnd: invoice.cycle_end_date,
        dueDate: invoice.due_date,
        paymentMethod: effectivePaymentMethod,
        paymentReference: body.payment_reference ?? null,
      });

      return json({
        success: true,
        customer_id: customerId,
        order_id: body.order_id,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        subscription_ids: subIds ?? [],
        payment_id: paymentId,
        subtotal: invoice.subtotal,
        tps_amount: invoice.tps_amount,
        tvq_amount: invoice.tvq_amount,
        total: invoice.total,
        payment_method: effectivePaymentMethod,
        invoice_status: invoice.status,
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // CHEMIN B — Legacy sans order_id : construction ad-hoc à partir des
    // services fournis. Utilisé uniquement par les anciens callers en
    // attendant leur migration. Aucun calcul de taxes local.
    // ════════════════════════════════════════════════════════════════════
    console.warn("[billing-create-order] Legacy path (no order_id). Prefer creating orders + order_items upstream.");
    const cycleStartDate = new Date();
    const { nextAnchoredDate } = await import("../_shared/billing-utils.ts");
    const cycleEndDate = nextAnchoredDate(cycleStartDate.getDate(), cycleStartDate);
    const cycleStart = cycleStartDate.toISOString().split("T")[0];
    const cycleEnd = cycleEndDate.toISOString().split("T")[0];

    // Une seule facture agrégée (jamais plusieurs comme dans l'ancien code)
    const invoiceLines = body.services.map((s) => ({
      description: `${s.plan_name} – 30 jours`,
      unit_price: s.plan_price,
      quantity: 1,
      line_total: s.plan_price,
      line_type: "service",
      line_kind: "product_recurring",
      source_ref: "legacy_direct",
    }));

    const { data: invoiceId, error: invErr } = await supabase.rpc(
      "build_invoice_ad_hoc",
      {
        p_customer_id: customerId,
        p_subscription_id: null,
        p_type: "initial",
        p_cycle_start: cycleStart,
        p_cycle_end: cycleEnd,
        p_due_date: cycleEnd,
        p_lines: invoiceLines,
        p_context: provenanceContext,
        p_order_id: null,
        p_notes: body.order_number ? `Commande: ${body.order_number}` : null,
      },
    );
    if (invErr) throw new Error(`build_invoice_ad_hoc failed: ${invErr.message}`);

    // Un seul abonnement principal (le premier service). Les modules qui ont
    // besoin de plusieurs abonnements doivent créer des order_items et passer
    // par le chemin A.
    const primary = body.services[0];
    const { data: subId, error: subErr } = await supabase.rpc(
      "create_subscription_ad_hoc",
      {
        p_customer_id: customerId,
        p_plan_code: primary.plan_code,
        p_plan_name: primary.plan_name,
        p_plan_price: primary.plan_price,
        p_service_category: primary.category ?? null,
        p_cycle_start: cycleStart,
        p_cycle_end: cycleEnd,
        p_context: provenanceContext,
        p_address_id: null,
        p_order_id: null,
        p_status: isPayPalPaid ? "active" : "pending",
        p_auto_billing: isPayPalPaid,
      },
    );
    if (subErr) throw new Error(`create_subscription_ad_hoc failed: ${subErr.message}`);

    let paymentId: string | null = null;
    if (isPayPalPaid) {
      const { data: invRow } = await supabase
        .from("billing_invoices").select("total").eq("id", invoiceId).single();
      const { data: pid, error: payErr } = await supabase.rpc(
        "apply_payment_to_invoice",
        {
          p_invoice_id: invoiceId,
          p_amount: invRow.total,
          p_method: "paypal",
          p_provider: "paypal",
          p_external_reference: body.payment_reference,
          p_source: "live",
          p_context: provenanceContext,
        },
      );
      if (payErr) throw new Error(`apply_payment_to_invoice failed: ${payErr.message}`);
      paymentId = pid as string;
    }

    const { data: invoice } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, subtotal, tps_amount, tvq_amount, total, status")
      .eq("id", invoiceId)
      .single();

    await queueOrderEmail(supabase, {
      isPaid: isPayPalPaid,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      customerEmail: body.email,
      customerName: `${body.first_name} ${body.last_name}`,
      planNames: body.services.map((s) => s.plan_name).join(", "),
      subtotal: invoice.subtotal,
      tps: invoice.tps_amount,
      tvq: invoice.tvq_amount,
      total: invoice.total,
      cycleStart, cycleEnd, dueDate: cycleEnd,
      paymentMethod: effectivePaymentMethod,
      paymentReference: body.payment_reference ?? null,
    });

    return json({
      success: true,
      customer_id: customerId,
      subscription_id: subId,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      payment_id: paymentId,
      subtotal: invoice.subtotal,
      tps_amount: invoice.tps_amount,
      tvq_amount: invoice.tvq_amount,
      total: invoice.total,
      payment_method: effectivePaymentMethod,
      invoice_status: invoice.status,
    });
  } catch (error) {
    console.error("[billing-create-order] Error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

async function queueOrderEmail(supabase: any, args: {
  isPaid: boolean;
  invoiceId: string;
  invoiceNumber: string;
  customerEmail: string;
  customerName: string;
  planNames: string;
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
  paymentMethod: string;
  paymentReference: string | null;
}) {
  const templateKey = args.isPaid ? "payment_confirmed" : "invoice_created";
  const { buildInvoicePdfAttachment, buildReceiptPdfAttachment } = await import("../_shared/pdfFromDb.ts");
  const pdfAttachment = args.isPaid
    ? await buildReceiptPdfAttachment(args.invoiceId, "recu-paiement")
    : await buildInvoicePdfAttachment(args.invoiceId, "facture");

  await supabase.from("email_queue").insert({
    event_key: `billing_order_${args.invoiceId}_${Date.now()}`,
    to_email: args.customerEmail,
    template_key: templateKey,
    template_vars: {
      client_name: args.customerName,
      invoice_number: args.invoiceNumber,
      plan_name: args.planNames,
      subtotal: Number(args.subtotal).toFixed(2),
      tps_amount: Number(args.tps).toFixed(2),
      tvq_amount: Number(args.tvq).toFixed(2),
      total: Number(args.total).toFixed(2),
      amount: Number(args.total).toFixed(2),
      due_date: args.dueDate,
      cycle_start: args.cycleStart,
      cycle_end: args.cycleEnd,
      payment_method: args.paymentMethod === "paypal" ? "PayPal" : "Interac e-Transfer",
      payment_email: "support@nivra-telecom.ca",
      reference: args.paymentReference,
    },
    attachments: pdfAttachment ? [pdfAttachment] : null,
    status: "queued",
    attempts: 0,
    max_attempts: 5,
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
