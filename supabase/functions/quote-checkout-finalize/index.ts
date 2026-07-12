import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * quote-checkout-finalize — Phase 3.A.1.b (canonical rewrite)
 *
 * Invariants respectés :
 *  - AUCUNE écriture directe sur billing_invoices / billing_invoice_lines /
 *    billing_subscriptions / billing_payments / account_adjustments.
 *  - AUCUN calcul local de subtotal / TPS / TVQ / total / balance.
 *  - La facture et les abonnements sont générés exclusivement par les RPC
 *    canoniques build_invoice_from_order + create_subscriptions_from_order.
 *  - Le paiement (PayPal) est délégué à paypal-create-order / paypal-capture,
 *    lesquels utilisent apply_payment_to_invoice. Cette fonction ne touche
 *    jamais au paiement elle-même.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BILLABLE_ORDER_STATUSES = new Set([
  "submitted",
  "pending_admin_review",
  "confirmed",
  "completed",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { quote_id, checkout_data, payment_method } = body;

    if (!quote_id || !checkout_data) {
      throw new Error("quote_id and checkout_data are required");
    }

    // 1. Load quote + lines
    const { data: quote, error: qErr } = await supabase
      .from("quotes").select("*").eq("id", quote_id).single();
    if (qErr || !quote) throw new Error("Quote not found");

    if (!["accepted_pending_checkout", "checkout_in_progress", "checkout_completed"].includes(quote.status)) {
      throw new Error(`Quote status '${quote.status}' does not allow checkout finalization`);
    }

    const { data: lines } = await supabase
      .from("quote_lines").select("*").eq("quote_id", quote_id)
      .order("created_at", { ascending: true });
    if (!lines || lines.length === 0) throw new Error("Quote has no line items");

    // 2. Update quote checkout state
    const fullName = `${checkout_data.first_name} ${checkout_data.last_name}`.trim();
    await supabase.from("quotes").update({
      status: "checkout_completed",
      checkout_completed_at: new Date().toISOString(),
      prospect_name: fullName,
      prospect_email: checkout_data.email,
      prospect_phone: checkout_data.phone,
      checkout_data: { ...checkout_data, payment_method, completed_at: new Date().toISOString() },
    }).eq("id", quote_id);

    // 3. Resolve canonical user + account
    const orderUserId = quote.customer_user_id;
    if (!orderUserId) throw new Error("Quote is missing customer_user_id; cannot create order");

    let resolvedAccountId: string | null = quote.account_id || null;
    if (!resolvedAccountId) {
      const { data: existingAccount } = await supabase
        .from("accounts").select("id").eq("client_id", orderUserId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      resolvedAccountId = existingAccount?.id || null;
    }
    if (!resolvedAccountId) throw new Error("No account found for this quote's client");

    // 4. Create-or-reuse order (idempotent)
    let order: any;
    if (quote.converted_order_id) {
      const { data: existingOrder } = await supabase
        .from("orders").select("*").eq("id", quote.converted_order_id).maybeSingle();
      if (existingOrder) order = existingOrder;
    }

    if (!order) {
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const { data: newOrder, error: orderErr } = await supabase.from("orders").insert({
        user_id: orderUserId,
        account_id: resolvedAccountId,
        service_type: "combo",
        order_number: orderNumber,
        status: "submitted",
        payment_status: "pending",
        payment_method: payment_method || "paypal",
        // total_amount / subtotal / tps / tvq laissés NULL — les RPC canoniques
        // sont la seule source de vérité. Les colonnes sont patchées après.
        notes: `Créé depuis soumission ${quote.quote_number}`,
        internal_notes: `Source: Quote ${quote.quote_number} (${quote.id})`,
        shipping_address: checkout_data.address || null,
        shipping_city: checkout_data.city || null,
        shipping_province: checkout_data.province || "QC",
        shipping_postal_code: checkout_data.postal_code || null,
        client_first_name: checkout_data.first_name,
        client_last_name: checkout_data.last_name,
        client_email: checkout_data.email,
        client_phone: checkout_data.phone,
        environment: "live",
      }).select().single();
      if (orderErr) throw new Error(`Order creation failed: ${orderErr.message}`);
      order = newOrder;

      await supabase.from("quotes").update({ converted_order_id: order.id }).eq("id", quote_id);
    }

    // ── BUG-CORE-002C Phase 1: appointments hold ONLY for technician installs ──
    try {
      const rawMode = String(checkout_data?.install_mode || checkout_data?.installation_mode || "").toLowerCase().trim();
      let installationMethod: "auto" | "technician" | null = null;
      if (rawMode === "technician") installationMethod = "technician";
      else if (rawMode === "self") installationMethod = "auto";
      else if (rawMode) {
        console.warn(`[quote-checkout-finalize] invalid install_mode='${rawMode}' — no hold created`);
      }

      const SLOT_WINDOW: Record<string, string> = {
        morning: "09:00-12:00",
        afternoon: "13:00-17:00",
        evening: "17:00-20:00",
      };
      const rawSlot = String(checkout_data?.install_slot || checkout_data?.time_slot || "").toLowerCase();
      const explicitWindow = /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(rawSlot) ? rawSlot : null;
      const slotWindow = explicitWindow || SLOT_WINDOW[rawSlot] || null;
      const rawDate = checkout_data?.install_date || checkout_data?.installation_date || null;
      const slotDate = rawDate ? String(rawDate).slice(0, 10) : null;

      if (installationMethod === "technician" && slotDate && slotWindow) {
        const startTime = slotWindow.split("-")[0];
        const scheduledAt = new Date(`${slotDate}T${startTime}:00`).toISOString();
        const { data: existingAppt } = await supabase
          .from("appointments").select("id").eq("order_id", order.id).maybeSingle();
        if (!existingAppt) {
          const { error: apptErr } = await supabase.from("appointments").insert({
            order_id: order.id,
            client_id: orderUserId,
            client_email: checkout_data.email,
            client_phone: checkout_data.phone,
            service_address: checkout_data.address || null,
            service_city: checkout_data.city || null,
            service_postal_code: checkout_data.postal_code || null,
            title: `Installation — ${order.order_number}`,
            scheduled_at: scheduledAt,
            status: "hold",
            installation_method: installationMethod,
            internal_notes: `[BUG-CORE-002C] Hold technicien créé depuis quote checkout • quote=${quote_id} • window=${slotWindow}`,
          } as any);
          if (apptErr) console.warn(`[quote-checkout-finalize] appointment hold insert failed (non-blocking):`, apptErr.message);
        }
      } else if (installationMethod === "auto") {
        console.log(`[quote-checkout-finalize] auto-install order ${order.order_number} — no appointment hold`);
      }
    } catch (holdErr) {
      console.warn(`[quote-checkout-finalize] appointment hold exception (non-blocking):`, holdErr);
    }

    // Ensure order is in a billable status for the invoice trigger guard
    if (!BILLABLE_ORDER_STATUSES.has(order.status)) {
      const { data: patchedOrder, error: patchErr } = await supabase
        .from("orders").update({ status: "submitted" }).eq("id", order.id).select("*").single();
      if (patchErr) throw new Error(`Failed to patch order status: ${patchErr.message}`);
      order = patchedOrder;
    }

    // 5. Materialize order_items from quote_lines (idempotent).
    //    Recurring lines → is_recurring=true → subscriptions creation.
    //    Non-recurring → fees / discounts / equipment.
    const { count: existingItemsCount } = await supabase
      .from("order_items").select("id", { head: true, count: "exact" }).eq("order_id", order.id);

    if (!existingItemsCount) {
      const items = lines.map((l: any, idx: number) => {
        const isRecurring = l.billing_frequency === "monthly";
        const unit = Number(l.unit_price || 0);
        const qty = Number(l.quantity || 1);
        return {
          order_id: order.id,
          item_number: idx + 1,
          plan_code: l.plan_code || l.code || `QLINE-${idx + 1}`,
          plan_name: l.label,
          service_type: isRecurring ? (l.service_category || "combo") : "fee",
          unit_price: unit,
          quantity: qty,
          line_total: Number((unit * qty).toFixed(2)),
          is_recurring: isRecurring,
        };
      });
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw new Error(`order_items insert failed: ${itemsErr.message}`);
    }

    // 6. Ensure billing_customer exists (canonical prerequisite)
    let billingCustomerId: string;
    const { data: existingCustomer } = await supabase
      .from("billing_customers").select("id").eq("user_id", orderUserId).maybeSingle();
    if (existingCustomer) {
      billingCustomerId = existingCustomer.id;
    } else {
      const { data: byEmail } = await supabase
        .from("billing_customers").select("id").ilike("email", checkout_data.email).maybeSingle();
      if (byEmail) {
        billingCustomerId = byEmail.id;
        await supabase.from("billing_customers").update({ user_id: orderUserId })
          .eq("id", billingCustomerId).is("user_id", null);
      } else {
        const { data: newCust, error: custErr } = await supabase.from("billing_customers").insert({
          user_id: orderUserId,
          first_name: checkout_data.first_name,
          last_name: checkout_data.last_name,
          email: checkout_data.email,
          phone: checkout_data.phone,
          status: "active",
        }).select("id").single();
        if (custErr) throw new Error(`billing_customer creation failed: ${custErr.message}`);
        billingCustomerId = newCust.id;
      }
    }

    const provenanceContext = {
      edge_function_name: "quote-checkout-finalize",
      module: "billing",
      actor_user_id: orderUserId,
      reason: "quote_checkout_finalized",
      request_id: crypto.randomUUID(),
      source_type: "quote",
      source_id: quote_id,
    };

    // 7. RPC canonique — facture depuis order_items (aucun calcul local)
    const { data: invoiceId, error: invErr } = await supabase.rpc(
      "build_invoice_from_order",
      { p_order_id: order.id, p_context: provenanceContext },
    );
    if (invErr) throw new Error(`build_invoice_from_order failed: ${invErr.message}`);

    // 8. RPC canonique — abonnements figés
    const { error: subErr } = await supabase.rpc(
      "create_subscriptions_from_order",
      { p_order_id: order.id, p_context: provenanceContext },
    );
    if (subErr) throw new Error(`create_subscriptions_from_order failed: ${subErr.message}`);

    // 9. Read canonical invoice + patch orders columns for downstream views
    const { data: invoice } = await supabase.from("billing_invoices")
      .select("id, invoice_number, subtotal, tps_amount, tvq_amount, total, status")
      .eq("id", invoiceId).single();

    await supabase.from("orders").update({
      subtotal: invoice.subtotal,
      tps_amount: invoice.tps_amount,
      tvq_amount: invoice.tvq_amount,
      total_amount: invoice.total,
    }).eq("id", order.id);

    // 10. Quote event log
    await supabase.from("quote_events").insert({
      quote_id,
      event_type: "checkout_completed",
      actor_role: "client",
      message: `Checkout complété par ${fullName}. Commande ${order.order_number} — facture ${invoice.invoice_number} (canonical).`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_method,
        canonical: true,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_id: billingCustomerId,
      total: invoice.total,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[quote-checkout-finalize] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
