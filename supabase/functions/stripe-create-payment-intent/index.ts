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
    const stripeKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    if (!stripeKey.startsWith("sk_test_")) {
      throw new Error("Stripe checkout public est forcé en mode test: STRIPE_SECRET_KEY doit commencer par sk_test_.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { invoice_id, amount, description, customer_email, customer_id } = body;

    if (!amount || amount <= 0) throw new Error("Invalid amount");

    let invoice: {
      id: string;
      invoice_number: string;
      status: string | null;
      customer_id: string | null;
      customer?: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
      } | null;
    } | null = null;

    if (invoice_id) {
      const { data: fetchedInvoice, error: invError } = await db
        .from("billing_invoices")
        .select("*, customer:billing_customers(id, email, first_name, last_name)")
        .eq("id", invoice_id)
        .single();

      if (invError || !fetchedInvoice) throw new Error("Invoice not found");
      if (fetchedInvoice.status === "paid") {
        return new Response(
          JSON.stringify({ error: "Invoice already paid" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      invoice = fetchedInvoice;
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const stripeAccount = await stripe.accounts.retrieve();
    console.log(`[stripe-create-payment-intent] Stripe account: ${stripeAccount.id} (test-only)`);

    const email = customer_email || invoice?.customer?.email;
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
          name: invoice?.customer
            ? `${invoice.customer.first_name} ${invoice.customer.last_name}`.trim()
            : undefined,
        });
        stripeCustomerId = newCustomer.id;
      }
    }

    const metadata: Record<string, string> = {
      source: "portal_checkout_public",
    };

    if (invoice_id) metadata.invoice_id = invoice_id;
    if (invoice?.invoice_number) metadata.invoice_number = invoice.invoice_number;

    const resolvedCustomerId = customer_id || invoice?.customer_id;
    if (resolvedCustomerId) metadata.customer_id = resolvedCustomerId;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "cad",
      customer: stripeCustomerId,
      metadata,
      description: description || (invoice
        ? `Facture ${invoice.invoice_number} — Nivra Telecom`
        : "Checkout public — Nivra Telecom"),
      automatic_payment_methods: { enabled: true },
    });

    console.log(
      `[stripe-create-payment-intent] PI created: ${paymentIntent.id}${invoice?.invoice_number ? ` for invoice ${invoice.invoice_number}` : " (checkout public)"}`
    );

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        livemode: paymentIntent.livemode,
        payment_intent_status: paymentIntent.status,
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
