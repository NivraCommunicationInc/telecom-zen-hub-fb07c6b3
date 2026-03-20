import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";
import { activateSubscriptionForOrder } from "../_shared/activateSubscriptionForOrder.ts";

/**
 * ============================================================================
 * STRIPE — WEBHOOK HANDLER
 * ============================================================================
 *
 * Receives Stripe webhook events and processes payment state changes.
 *
 * MANUAL CAPTURE FLOW:
 * - payment_intent.amount_capturable_updated → Card authorized (hold placed)
 * - payment_intent.succeeded → Card captured (admin captured, or autopay)
 *   ★ THIS IS THE CANONICAL TRIGGER FOR STRIPE SUBSCRIPTION CREATION
 * - checkout.session.completed → Checkout page completed
 *
 * Uses apply_payment_to_invoice RPC only for CAPTURED payments.
 * Authorization events only update the payment record status.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    let event: Stripe.Event;

    // PRODUCTION HARDENING: Webhook signature verification is MANDATORY.
    if (!webhookSecret) {
      console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is NOT configured — rejecting request for security");
      return new Response(
        JSON.stringify({ error: "Webhook signature verification not configured — refusing to process" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log(`[stripe-webhook] Event received: ${event.type} (${event.id})`);

    // ─────────────────────────────────────────────────────────────
    // SHARED HELPER: apply payment idempotently (ONLY for captured/succeeded)
    // ─────────────────────────────────────────────────────────────
    async function applyPayment(
      invoiceId: string,
      amountPaid: number,
      paymentIntentId: string,
      customerId: string | null,
      eventSource: string,
    ) {
      // Idempotency: check if this payment_intent was already processed
      const { data: existingPayment } = await supabase
        .from("billing_payments")
        .select("id, authorization_status")
        .eq("provider_payment_id", paymentIntentId)
        .maybeSingle();

      if (existingPayment) {
        // If it exists as "authorized", upgrade to "confirmed/captured"
        if (existingPayment.authorization_status === "authorized") {
          await supabase.from("billing_payments").update({
            status: "confirmed" as any,
            authorization_status: "captured",
            captured_at: new Date().toISOString(),
            captured_by: "stripe_webhook",
            received_at: new Date().toISOString(),
          }).eq("id", existingPayment.id);

          // Update invoice
          const { data: inv } = await supabase.from("billing_invoices")
            .select("amount_paid, total, paid_at")
            .eq("id", invoiceId)
            .single();

          if (inv) {
            const newAmountPaid = (inv.amount_paid ?? 0) + amountPaid;
            const newBalanceDue = Math.max(0, (inv.total ?? 0) - newAmountPaid);
            const isFullyPaid = newBalanceDue <= 0;

            await supabase.from("billing_invoices").update({
              amount_paid: newAmountPaid,
              balance_due: newBalanceDue,
              status: (isFullyPaid ? "paid" : "partially_paid") as any,
              paid_at: isFullyPaid ? new Date().toISOString() : inv.paid_at,
            }).eq("id", invoiceId);
          }

          console.log(`[stripe-webhook] ✓ Existing authorized payment ${existingPayment.id} upgraded to captured`);
          return { upgraded_from_authorized: true };
        }

        console.log(`[stripe-webhook] Payment ${paymentIntentId} already processed (via ${eventSource}) — idempotent skip`);
        return { already_processed: true };
      }

      // ★ USE THE CANONICAL RPC — SINGLE SOURCE OF TRUTH ★
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "apply_payment_to_invoice",
        {
          p_invoice_id: invoiceId,
          p_amount: amountPaid,
          p_method: "card",
          p_provider: "stripe",
          p_provider_payment_id: paymentIntentId,
          p_source: "live",
          p_created_by_name: "stripe_webhook",
          p_created_by_role: "system",
          p_customer_id: customerId || null,
        }
      );

      if (rpcError) {
        console.error(`[stripe-webhook] RPC error (${eventSource}):`, rpcError);
        throw new Error(`apply_payment_to_invoice failed: ${rpcError.message}`);
      }

      console.log(`[stripe-webhook] ✓ Payment applied via RPC (${eventSource}):`, rpcResult);

      // Queue confirmation email
      if (customerId) {
        const { data: customer } = await supabase
          .from("billing_customers")
          .select("email, first_name, last_name")
          .eq("id", customerId)
          .maybeSingle();

        if (customer?.email) {
          const { data: invoice } = await supabase
            .from("billing_invoices")
            .select("invoice_number, total, paid_at, cycle_start_date, cycle_end_date")
            .eq("id", invoiceId)
            .single();

          await supabase.from("email_queue").insert({
            event_key: `stripe_confirmed_${invoiceId}_${paymentIntentId}`,
            to_email: customer.email,
            to_name: `${customer.first_name} ${customer.last_name}`,
            template_type: "billing_payment_confirmed",
            template_data: {
              clientName: `${customer.first_name} ${customer.last_name}`,
              invoiceNumber: invoice?.invoice_number || "N/A",
              planName: "Service Nivra",
              total: amountPaid.toFixed(2),
              paidAt: new Date().toLocaleDateString("fr-CA"),
              cycleStart: invoice?.cycle_start_date || "",
              cycleEnd: invoice?.cycle_end_date || "",
              paymentMethod: "Carte (Stripe)",
            },
            priority: "high",
          });
        }
      }

      return { rpc_result: rpcResult };
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: payment_intent.amount_capturable_updated
    // ★ Card authorized (hold placed), NOT yet captured
    // ─────────────────────────────────────────────────────────────
    if (event.type === "payment_intent.amount_capturable_updated") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata || {};
      const invoiceId = metadata.invoice_id;
      const customerId = metadata.customer_id;
      const paymentIntentId = paymentIntent.id;
      const authorizedAmount = (paymentIntent.amount_capturable || paymentIntent.amount) / 100;
      const isCheckoutPreconfirm =
        metadata.intent_context === "checkout_preconfirm" ||
        metadata.source === "portal_checkout_preconfirm";

      console.log(`[stripe-webhook] payment_intent.amount_capturable_updated: PI=${paymentIntentId}, amount=${authorizedAmount}`);

      if (isCheckoutPreconfirm) {
        console.log(`[stripe-webhook] preconfirm authorization ignored for PI ${paymentIntentId}`);
        return new Response(
          JSON.stringify({ received: true, skipped_preconfirm: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!invoiceId) {
        console.warn(`[stripe-webhook] amount_capturable_updated without invoice_id metadata — skipping PI ${paymentIntentId}`);
        return new Response(
          JSON.stringify({ received: true, skipped_no_invoice: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if payment record already exists
      const { data: existingPayment } = await supabase
        .from("billing_payments")
        .select("id")
        .eq("provider_payment_id", paymentIntentId)
        .maybeSingle();

      if (!existingPayment) {
        const { data: invoiceNumberData } = await supabase.rpc("generate_payment_number");
        const paymentNumber = invoiceNumberData || `PAY-${Date.now()}`;

        await supabase.from("billing_payments").insert({
          invoice_id: invoiceId,
          customer_id: customerId || null,
          method: "card" as any,
          provider: "stripe",
          provider_payment_id: paymentIntentId,
          amount: authorizedAmount,
          status: "pending" as any,
          source: "live" as any,
          payment_number: paymentNumber,
          created_by_name: "stripe_webhook",
          created_by_role: "system",
          stripe_payment_intent_id: paymentIntentId,
          authorized_amount: authorizedAmount,
          authorization_status: "authorized",
          authorized_at: new Date().toISOString(),
        });

        console.log(`[stripe-webhook] ✓ Authorization recorded for PI ${paymentIntentId}`);
      } else {
        await supabase.from("billing_payments").update({
          authorization_status: "authorized",
          authorized_amount: authorizedAmount,
          authorized_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
        }).eq("id", existingPayment.id);
      }

      // Update order authorization status
      const { data: invData } = await supabase.from("billing_invoices")
        .select("order_id")
        .eq("id", invoiceId)
        .single();

      if (invData?.order_id) {
        await supabase.from("orders").update({
          payment_authorization_status: "authorized",
        }).eq("id", invData.order_id);
      }

      return new Response(
        JSON.stringify({ received: true, authorization_recorded: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: checkout.session.completed
    // ─────────────────────────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const invoiceId = metadata.invoice_id;
      const customerId = metadata.customer_id;

      if (!invoiceId) {
        console.warn("[stripe-webhook] checkout.session.completed without invoice_id metadata — skipping");
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = (session.amount_total || 0) / 100;
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id;

      // Check if the PI is in requires_capture state (manual capture mode)
      if (paymentIntentId && paymentIntentId.startsWith("pi_")) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status === "requires_capture") {
          console.log(`[stripe-webhook] checkout.session.completed but PI requires_capture — authorization only, skipping apply`);
          return new Response(
            JSON.stringify({ received: true, authorization_only: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      console.log(`[stripe-webhook] checkout.session.completed: invoice=${invoiceId}, amount=${amountPaid}, pi=${paymentIntentId}`);

      const result = await applyPayment(invoiceId, amountPaid, paymentIntentId, customerId, "checkout.session.completed");

      return new Response(
        JSON.stringify({ received: true, invoice_id: invoiceId, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: payment_intent.succeeded
    // ★ CANONICAL TRIGGER FOR STRIPE SUBSCRIPTION CREATION
    // Fires when payment is CAPTURED:
    //   - Admin manual capture → payment_intent.succeeded
    //   - Portal auto-capture → payment_intent.succeeded
    //   - Any other Stripe capture → payment_intent.succeeded
    // ─────────────────────────────────────────────────────────────
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata || {};
      const invoiceId = metadata.invoice_id;
      const customerId = metadata.customer_id;
      const isCheckoutPreconfirm =
        metadata.intent_context === "checkout_preconfirm" ||
        metadata.source === "portal_checkout_preconfirm";

      if (isCheckoutPreconfirm) {
        console.log("[stripe-webhook] payment_intent.succeeded for preconfirm checkout PI — skipping");
        return new Response(JSON.stringify({ received: true, skipped_preconfirm: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!invoiceId) {
        console.log("[stripe-webhook] payment_intent.succeeded without invoice_id metadata — skipping");
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100;
      const paymentIntentId = paymentIntent.id;

      console.log(`[stripe-webhook] payment_intent.succeeded: invoice=${invoiceId}, amount=${amountPaid}, pi=${paymentIntentId}`);

      // Step A: Apply payment (marks invoice as paid)
      const paymentResult = await applyPayment(invoiceId, amountPaid, paymentIntentId, customerId, "payment_intent.succeeded");

      // Step B: ★ ACTIVATE STRIPE SUBSCRIPTION (blocking for recurring orders)
      // Extract payment method from the succeeded PI
      const pmId = typeof paymentIntent.payment_method === "string"
        ? paymentIntent.payment_method
        : (paymentIntent.payment_method as any)?.id || undefined;

      // Extract Stripe customer ID from PI
      const stripeCustomerId = typeof paymentIntent.customer === "string"
        ? paymentIntent.customer
        : (paymentIntent.customer as any)?.id || undefined;

      let subscriptionActivation: any = null;
      try {
        subscriptionActivation = await activateSubscriptionForOrder({
          stripe,
          supabase,
          invoice_id: invoiceId,
          payment_method_id: pmId,
          stripe_customer_id: stripeCustomerId,
          trigger_source: "stripe_webhook_pi_succeeded",
        });

        console.log(`[stripe-webhook] Subscription activation result: ${JSON.stringify({
          activated: subscriptionActivation.activated,
          skipped: subscriptionActivation.skipped,
          stripe_setup_status: subscriptionActivation.stripe_setup_status,
          stripe_subscription_id: subscriptionActivation.stripe_subscription_id || null,
        })}`);
      } catch (subErr: any) {
        console.error(`[stripe-webhook] Subscription activation error: ${subErr.message}`);
        subscriptionActivation = { activated: false, error: subErr.message, stripe_setup_status: "failed" };
      }

      return new Response(
        JSON.stringify({
          received: true,
          invoice_id: invoiceId,
          ...paymentResult,
          subscription: subscriptionActivation,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: payment_intent.canceled
    // ─────────────────────────────────────────────────────────────
    if (event.type === "payment_intent.canceled") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata || {};
      const paymentIntentId = paymentIntent.id;
      const isCheckoutPreconfirm =
        metadata.intent_context === "checkout_preconfirm" ||
        metadata.source === "portal_checkout_preconfirm";

      if (isCheckoutPreconfirm) {
        console.log(`[stripe-webhook] preconfirm PI cancelled — no billing mutation required (${paymentIntentId})`);
        return new Response(
          JSON.stringify({ received: true, cancelled: true, skipped_preconfirm: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingPayment } = await supabase
        .from("billing_payments")
        .select("id")
        .eq("provider_payment_id", paymentIntentId)
        .maybeSingle();

      if (existingPayment) {
        await supabase.from("billing_payments").update({
          status: "cancelled" as any,
          authorization_status: "cancelled",
        }).eq("id", existingPayment.id);

        console.log(`[stripe-webhook] ✓ Authorization cancelled for PI ${paymentIntentId}`);
      }

      return new Response(
        JSON.stringify({ received: true, cancelled: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: customer.subscription.created / updated
    // ─────────────────────────────────────────────────────────────
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata || {};
      const orderId = metadata.order_id;

      console.log(`[stripe-webhook] ${event.type}: sub=${subscription.id}, status=${subscription.status}, order=${orderId}`);

      const { data: nivraSub } = await supabase
        .from("billing_subscriptions")
        .select("id, customer_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (nivraSub) {
        const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await supabase.from("billing_subscriptions").update({
          stripe_status: subscription.status,
          stripe_current_period_start: periodStart,
          stripe_current_period_end: periodEnd,
          next_renewal_at: periodEnd,
          stripe_cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          stripe_canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
          ...(subscription.status === "active" ? { status: "active" } : {}),
          ...(subscription.status === "past_due" ? { status: "past_due" } : {}),
          ...(subscription.status === "canceled" ? { status: "expired" } : {}),
          ...(subscription.status === "unpaid" ? { status: "suspended" } : {}),
        }).eq("id", nivraSub.id);

        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: nivraSub.id,
          customer_id: nivraSub.customer_id,
          action: `stripe_${event.type.replace("customer.subscription.", "")}`,
          details: {
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: periodStart,
            current_period_end: periodEnd,
          },
          reason: `Stripe webhook: ${event.type}`,
        });

        console.log(`[stripe-webhook] ✓ Subscription ${subscription.id} synced: ${subscription.status}`);
      } else {
        console.warn(`[stripe-webhook] No Nivra subscription found for stripe_subscription_id=${subscription.id}`);
      }

      return new Response(
        JSON.stringify({ received: true, subscription_synced: !!nivraSub }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: customer.subscription.deleted
    // ─────────────────────────────────────────────────────────────
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[stripe-webhook] customer.subscription.deleted: sub=${subscription.id}`);

      const { data: nivraSub } = await supabase
        .from("billing_subscriptions")
        .select("id, customer_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (nivraSub) {
        await supabase.from("billing_subscriptions").update({
          stripe_status: "canceled",
          status: "expired",
          stripe_canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", nivraSub.id);

        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: nivraSub.id,
          customer_id: nivraSub.customer_id,
          action: "stripe_deleted",
          details: { stripe_subscription_id: subscription.id },
          reason: "Stripe webhook: customer.subscription.deleted",
        });

        console.log(`[stripe-webhook] ✓ Subscription ${subscription.id} expired in Nivra`);
      }

      return new Response(
        JSON.stringify({ received: true, subscription_expired: !!nivraSub }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: invoice.paid (Stripe Subscription invoice)
    // ─────────────────────────────────────────────────────────────
    if (event.type === "invoice.paid") {
      const stripeInvoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof stripeInvoice.subscription === "string"
        ? stripeInvoice.subscription
        : stripeInvoice.subscription?.id;

      console.log(`[stripe-webhook] invoice.paid: inv=${stripeInvoice.id}, sub=${subscriptionId}, amount=${(stripeInvoice.amount_paid || 0) / 100}`);

      if (subscriptionId) {
        const { data: nivraSub } = await supabase
          .from("billing_subscriptions")
          .select("id, customer_id, order_id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (nivraSub) {
          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: nivraSub.id,
            customer_id: nivraSub.customer_id,
            action: "stripe_invoice_paid",
            source_type: "stripe_invoice",
            source_id: stripeInvoice.id,
            details: {
              stripe_invoice_id: stripeInvoice.id,
              amount_paid: (stripeInvoice.amount_paid || 0) / 100,
              billing_reason: stripeInvoice.billing_reason,
              period_start: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000).toISOString() : null,
              period_end: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000).toISOString() : null,
            },
            reason: `Stripe invoice paid: ${stripeInvoice.id}`,
          });
          console.log(`[stripe-webhook] ✓ Subscription invoice payment recorded for ${subscriptionId}`);
        }
      }

      return new Response(
        JSON.stringify({ received: true, invoice_recorded: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: invoice.payment_failed
    // ─────────────────────────────────────────────────────────────
    if (event.type === "invoice.payment_failed") {
      const stripeInvoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof stripeInvoice.subscription === "string"
        ? stripeInvoice.subscription
        : stripeInvoice.subscription?.id;

      console.log(`[stripe-webhook] invoice.payment_failed: inv=${stripeInvoice.id}, sub=${subscriptionId}`);

      if (subscriptionId) {
        const { data: nivraSub } = await supabase
          .from("billing_subscriptions")
          .select("id, customer_id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (nivraSub) {
          await supabase.from("billing_system_alerts").insert({
            alert_type: "subscription_payment_failed",
            entity_type: "subscription",
            entity_id: nivraSub.id,
            entity_reference: subscriptionId,
            details: {
              stripe_invoice_id: stripeInvoice.id,
              amount_due: (stripeInvoice.amount_due || 0) / 100,
              attempt_count: stripeInvoice.attempt_count,
              next_payment_attempt: stripeInvoice.next_payment_attempt
                ? new Date(stripeInvoice.next_payment_attempt * 1000).toISOString()
                : null,
            },
          });

          await supabase.from("billing_subscription_trace_audit").insert({
            subscription_id: nivraSub.id,
            customer_id: nivraSub.customer_id,
            action: "stripe_payment_failed",
            source_type: "stripe_invoice",
            source_id: stripeInvoice.id,
            details: {
              stripe_invoice_id: stripeInvoice.id,
              amount_due: (stripeInvoice.amount_due || 0) / 100,
              attempt_count: stripeInvoice.attempt_count,
            },
            reason: `Stripe invoice payment failed: attempt ${stripeInvoice.attempt_count}`,
          });

          console.log(`[stripe-webhook] ✓ Payment failure recorded for subscription ${subscriptionId}`);
        }
      }

      return new Response(
        JSON.stringify({ received: true, failure_recorded: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unhandled event type — acknowledge receipt
    console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[stripe-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
