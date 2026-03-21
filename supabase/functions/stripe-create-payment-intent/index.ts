import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createNivraPaymentIntent } from "../_shared/nivraPaymentIntentFactory.ts";

/**
 * STRIPE — CREATE PAYMENT INTENT (V3 — Centralized Factory)
 *
 * Uses the shared NivraPaymentIntentFactory for ALL PaymentIntent creation.
 * No local PI creation logic — everything flows through the factory with hard validation.
 *
 * Used by: public checkout, client portal, admin POS, Core admin, staff POS
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
    const isCheckoutPreconfirm = intent_context === "checkout_preconfirm";

    if (!amount || amount <= 0) throw new Error("Invalid amount");

    // ═══ FETCH INVOICE + CUSTOMER + ORDER CONTEXT ═══
    let invoice: any = null;
    let order: any = null;
    let account: any = null;
    let invoiceLines: any[] = [];

    if (invoice_id) {
      const { data: fetchedInvoice, error: invError } = await db
        .from("billing_invoices")
        .select("id, invoice_number, status, customer_id, order_id, subscription_id, subtotal, tps_amount, tvq_amount, total, billing_snapshot_account_number, billing_snapshot_client, customer:billing_customers(id, email, first_name, last_name, phone, stripe_customer_id)")
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

      // Fetch invoice lines for pricing breakdown
      const { data: lines } = await db
        .from("billing_invoice_lines")
        .select("description, line_type, line_total")
        .eq("invoice_id", invoice_id);
      invoiceLines = lines || [];

      // Fetch order details if linked
      if (invoice.order_id) {
        const { data: orderData } = await db
          .from("orders")
          .select("id, order_number, account_id, pricing_snapshot, total_amount, plan_name, plan_type, service_address, service_city, service_postal_code, service_province")
          .eq("id", invoice.order_id)
          .single();
        order = orderData;
      }

      // Fetch account if available
      const accountId = order?.account_id;
      if (accountId) {
        const { data: acctData } = await db
          .from("accounts")
          .select("id, account_number, billing_address, billing_city, billing_province, billing_postal_code")
          .eq("id", accountId)
          .single();
        account = acctData;
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ═══ RESOLVE CONTEXT ═══
    const customerObj = invoice?.customer;
    const email = customer_email || customerObj?.email;
    const customerName = customerObj ? `${customerObj.first_name || ""} ${customerObj.last_name || ""}`.trim() : undefined;
    const pricingSnapshot = order?.pricing_snapshot;
    const isInvoicePayment = !isCheckoutPreconfirm && Boolean(invoice_id || intent_context === "invoice_payment");

    // Service name
    const serviceName = order?.plan_name ||
      pricingSnapshot?.plan_name ||
      invoiceLines.find((l: any) => l.line_type === "service" || l.line_type === "recurring")?.description ||
      "Nivra Telecom";

    // Pricing breakdown from invoice lines
    const monthlyAmount = invoiceLines
      .filter((l: any) => l.line_type === "service" || l.line_type === "recurring")
      .reduce((s: number, l: any) => s + (l.line_total || 0), 0);
    const oneTimeAmount = invoiceLines
      .filter((l: any) => ["equipment", "fee", "activation", "installation", "delivery"].includes(l.line_type))
      .reduce((s: number, l: any) => s + (l.line_total || 0), 0);
    const discountAmount = invoiceLines
      .filter((l: any) => l.line_type === "discount" || l.line_type === "promo")
      .reduce((s: number, l: any) => s + Math.abs(l.line_total || 0), 0);

    // Billing address
    const billingAddress = (() => {
      const line1 = account?.billing_address || order?.service_address;
      if (!line1) return undefined;
      return {
        line1,
        city: account?.billing_city || order?.service_city || undefined,
        state: account?.billing_province || order?.service_province || "QC",
        postal_code: account?.billing_postal_code || order?.service_postal_code || undefined,
        country: "CA",
      };
    })();

    // ═══ CALL CENTRALIZED FACTORY ═══
    const result = await createNivraPaymentIntent({
      stripe,
      customer_email: email,
      invoice_id: invoice_id || "",
      invoice_number: invoice?.invoice_number || "",
      service_name: serviceName,
      total_amount: amount,
      order_id: order?.id,
      order_number: order?.order_number ? String(order.order_number) : undefined,
      subscription_id: invoice?.subscription_id || undefined,
      customer_name: customerName,
      customer_phone: customerObj?.phone || undefined,
      customer_id: customer_id || invoice?.customer_id || undefined,
      account_id: account?.id || undefined,
      account_number: account?.account_number ? String(account.account_number) : undefined,
      existing_stripe_customer_id: customerObj?.stripe_customer_id || undefined,
      billing_address: billingAddress,
      subtotal: invoice?.subtotal,
      tax_tps: invoice?.tps_amount,
      tax_tvq: invoice?.tvq_amount,
      monthly_amount: monthlyAmount > 0 ? monthlyAmount : undefined,
      one_time_amount: oneTimeAmount > 0 ? oneTimeAmount : undefined,
      discount_amount: discountAmount > 0 ? discountAmount : undefined,
      plan_type: order?.plan_type || pricingSnapshot?.plan_type || undefined,
      capture_method: isInvoicePayment ? "automatic" : "manual",
      source: isInvoicePayment ? "portal_invoice_payment" : "portal_checkout_preconfirm",
      intent_context: isInvoicePayment ? "invoice_payment" : "checkout_preconfirm",
    });

    // Persist stripe_customer_id back to billing_customers if new
    if (result.stripe_customer_id && customerObj?.id && !customerObj.stripe_customer_id) {
      await db
        .from("billing_customers")
        .update({ stripe_customer_id: result.stripe_customer_id })
        .eq("id", customerObj.id);
    }

    return new Response(
      JSON.stringify({
        client_secret: result.client_secret,
        payment_intent_id: result.payment_intent_id,
        livemode: result.livemode,
        publishable_key: publishableKey || undefined,
        payment_intent_status: result.status,
        capture_method: result.capture_method,
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
