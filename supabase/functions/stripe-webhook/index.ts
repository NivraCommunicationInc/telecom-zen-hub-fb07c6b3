import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ============================================================================
 * STRIPE — WEBHOOK HANDLER
 * ============================================================================
 *
 * Receives Stripe webhook events and processes payment confirmations.
 * Uses apply_payment_to_invoice RPC (SINGLE SOURCE OF TRUTH).
 *
 * SUPPORTED EVENTS:
 * - checkout.session.completed → apply payment to invoice
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
    // Without it, anyone can forge payment confirmations.
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
    // SHARED HELPER: apply payment idempotently
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
        .select("id")
        .eq("provider_payment_id", paymentIntentId)
        .maybeSingle();

      if (existingPayment) {
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
    // EVENT: checkout.session.completed
    // Primary path — fires when user completes Stripe Checkout
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

      console.log(`[stripe-webhook] checkout.session.completed: invoice=${invoiceId}, amount=${amountPaid}, pi=${paymentIntentId}`);

      const result = await applyPayment(invoiceId, amountPaid, paymentIntentId, customerId, "checkout.session.completed");

      return new Response(
        JSON.stringify({ received: true, invoice_id: invoiceId, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // EVENT: payment_intent.succeeded
    // Safety net — fires independently of Checkout Sessions.
    // If checkout.session.completed already processed this PI,
    // the idempotency check in applyPayment() will skip gracefully.
    // ─────────────────────────────────────────────────────────────
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata || {};
      const invoiceId = metadata.invoice_id;
      const customerId = metadata.customer_id;

      if (!invoiceId) {
        console.log("[stripe-webhook] payment_intent.succeeded without invoice_id metadata — skipping");
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountPaid = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100;
      const paymentIntentId = paymentIntent.id;

      console.log(`[stripe-webhook] payment_intent.succeeded: invoice=${invoiceId}, amount=${amountPaid}, pi=${paymentIntentId}`);

      const result = await applyPayment(invoiceId, amountPaid, paymentIntentId, customerId, "payment_intent.succeeded");

      return new Response(
        JSON.stringify({ received: true, invoice_id: invoiceId, ...result }),
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
