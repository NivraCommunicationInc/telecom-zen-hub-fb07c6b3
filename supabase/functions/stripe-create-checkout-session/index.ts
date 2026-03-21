import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * ============================================================================
 * STRIPE — CREATE CHECKOUT SESSION
 * ============================================================================
 *
 * Creates a Stripe Checkout Session for invoice payment.
 * Stripe handles the full card collection UI — no PCI burden on Nivra.
 *
 * FLOW:
 * 1. Receive invoice_id + amount
 * 2. Create Stripe Checkout Session (mode: "payment")
 * 3. Return session URL for redirect
 * 4. On success, stripe-webhook handles payment confirmation
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateCheckoutRequest {
  invoice_id: string;
  amount: number;
  description?: string;
  customer_email?: string;
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ═══ STRIPE KILL-SWITCH — 2026-03-21 ═══
  console.warn("[stripe-create-checkout-session] BLOCKED — Stripe disabled in production");
  return new Response(
    JSON.stringify({ error: "Stripe checkout is disabled. Use PayPal instead." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateCheckoutRequest = await req.json();

    if (!body.invoice_id) throw new Error("invoice_id is required");
    if (!body.amount || body.amount <= 0) throw new Error("Invalid amount");

    // Get invoice details
    const { data: invoice, error: invError } = await supabase
      .from("billing_invoices")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name)
      `)
      .eq("id", body.invoice_id)
      .single();

    if (invError || !invoice) throw new Error("Invoice not found");

    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Invoice already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customerEmail = body.customer_email || invoice.customer?.email;
    const origin = req.headers.get("origin") || "https://nivra-telecom.ca";

    // Check for existing Stripe customer
    let stripeCustomerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      }
    }

    // Amount in cents (CAD)
    const amountCents = Math.round(body.amount * 100);

    const paymentMetadata = {
      invoice_id: body.invoice_id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      source: "portal",
    };

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: amountCents,
            product_data: {
              name: body.description || `Facture ${invoice.invoice_number}`,
              description: `Nivra Telecom — Facture ${invoice.invoice_number}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: paymentMetadata,
      payment_intent_data: {
        metadata: paymentMetadata,
      },
      success_url: body.success_url || `${origin}/portal/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancel_url || `${origin}/portal/billing`,
    });

    console.log(`[stripe-create-checkout-session] Session created: ${session.id} for invoice ${invoice.invoice_number}`);

    return new Response(
      JSON.stringify({
        url: session.url,
        session_id: session.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[stripe-create-checkout-session] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
