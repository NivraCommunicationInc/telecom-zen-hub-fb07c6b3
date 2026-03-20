import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const extractPublishableKey = (raw?: string | null): string => {
  if (!raw) return "";
  const unquoted = raw.trim().replace(/^['\"]+|['\"]+$/g, "");
  if (!unquoted) return "";

  const extracted = unquoted.match(/pk_(?:live|test)_[A-Za-z0-9_]+/);
  return extracted?.[0] ?? unquoted;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    // Production-ready: accept both test and live keys
    if (!stripeKey.startsWith("sk_test_") && !stripeKey.startsWith("sk_live_")) {
      throw new Error("STRIPE_SECRET_KEY invalide: doit commencer par sk_test_ ou sk_live_.");
    }
    const isLiveMode = stripeKey.startsWith("sk_live_");
    console.log(`[stripe-create-payment-intent] Mode: ${isLiveMode ? "LIVE" : "TEST"}`);

    const publishableKey = extractPublishableKey(
      Deno.env.get(isLiveMode ? "VITE_STRIPE_PUBLISHABLE_KEY_LIVE" : "VITE_STRIPE_PUBLISHABLE_KEY_TEST") ||
      Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY") ||
      Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY_LIVE") ||
      Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY_TEST")
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { invoice_id, amount, description, customer_email, customer_id, intent_context } = body;

    if (!amount || amount <= 0) throw new Error("Invalid amount");

    let invoice: {
      id: string;
      invoice_number: string;
      status: string | null;
      customer_id: string | null;
      order_id: string | null;
      subscription_id: string | null;
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
        .select("id, invoice_number, status, customer_id, order_id, subscription_id, customer:billing_customers(id, email, first_name, last_name)")
        .eq("id", invoice_id)
        .single();

      if (invError || !fetchedInvoice) throw new Error("Invoice not found");
      if (fetchedInvoice.status === "paid") {
        return new Response(
          JSON.stringify({ error: "Invoice already paid" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!fetchedInvoice.order_id && !fetchedInvoice.subscription_id) {
        throw new Error("Invoice is not billable yet: missing confirmed order/subscription reference");
      }

      invoice = fetchedInvoice;
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const stripeAccount = await stripe.accounts.retrieve();
    console.log(`[stripe-create-payment-intent] Stripe account: ${stripeAccount.id} (${isLiveMode ? "LIVE" : "TEST"})`);

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

    const isInvoicePayment = Boolean(invoice_id || intent_context === "invoice_payment");
    const metadata: Record<string, string> = {
      source: isInvoicePayment ? "portal_invoice_payment" : "portal_checkout_preconfirm",
      intent_context: isInvoicePayment ? "invoice_payment" : "checkout_preconfirm",
    };

    if (invoice_id) metadata.invoice_id = invoice_id;
    if (invoice?.invoice_number) metadata.invoice_number = invoice.invoice_number;

    const resolvedCustomerId = customer_id || invoice?.customer_id;
    if (resolvedCustomerId) metadata.customer_id = resolvedCustomerId;

    // Checkout preconfirm stays manual authorization; invoice payments are immediate capture.
    const captureMethod: "manual" | "automatic" = isInvoicePayment ? "automatic" : "manual";

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "cad",
      customer: stripeCustomerId,
      capture_method: captureMethod,
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
        publishable_key: publishableKey || undefined,
        payment_intent_status: paymentIntent.status,
        capture_method: paymentIntent.capture_method,
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
