import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * STRIPE — CREATE PAYMENT INTENT
 *
 * Creates a PaymentIntent for embedded Stripe Elements.
 * Returns the client_secret for frontend confirmation.
 *
 * Used by: client portal, admin POS, Core admin, staff POS
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { invoice_id, amount, description, customer_email, customer_id } = body;

    if (!invoice_id) throw new Error("invoice_id is required");
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    // Fetch invoice
    const { data: invoice, error: invError } = await db
      .from("billing_invoices")
      .select("*, customer:billing_customers(id, email, first_name, last_name)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) throw new Error("Invoice not found");

    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Invoice already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const email = customer_email || invoice.customer?.email;
    const amountCents = Math.round(amount * 100);

    // Find or create Stripe customer
    let stripeCustomerId: string | undefined;
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email,
          name: invoice.customer
            ? `${invoice.customer.first_name} ${invoice.customer.last_name}`
            : undefined,
        });
        stripeCustomerId = newCustomer.id;
      }
    }

    const metadata = {
      invoice_id,
      invoice_number: invoice.invoice_number,
      customer_id: customer_id || invoice.customer_id,
      source: "portal",
    };

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "cad",
      customer: stripeCustomerId,
      metadata,
      description: description || `Facture ${invoice.invoice_number} — Nivra Telecom`,
      automatic_payment_methods: { enabled: true },
    });

    console.log(
      `[stripe-create-payment-intent] PI created: ${paymentIntent.id} for invoice ${invoice.invoice_number}`
    );

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[stripe-create-payment-intent] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
