import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * STRIPE — CREATE PAYMENT INTENT (V2 — Full Business Context)
 *
 * Creates a PaymentIntent with complete customer identity, order/invoice
 * metadata, pricing breakdown, and billing address for Stripe Dashboard.
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
    const stripeAccount = await stripe.accounts.retrieve();
    console.log(`[stripe-create-payment-intent] Stripe account: ${stripeAccount.id} (${isLiveMode ? "LIVE" : "TEST"})`);

    // ═══ RESOLVE CUSTOMER IDENTITY ═══
    const customerObj = invoice?.customer;
    const email = customer_email || customerObj?.email;
    const customerName = customerObj ? `${customerObj.first_name || ""} ${customerObj.last_name || ""}`.trim() : undefined;
    const customerPhone = customerObj?.phone || undefined;
    const amountCents = Math.round(amount * 100);

    // ═══ RESOLVE BILLING ADDRESS ═══
    const billingAddress: Stripe.AddressParam | undefined = (() => {
      // Prefer account billing address, fallback to order service address
      const addr = account || order;
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

    // ═══ FIND OR CREATE STRIPE CUSTOMER (with full identity) ═══
    let stripeCustomerId: string | undefined = customerObj?.stripe_customer_id || undefined;

    if (!stripeCustomerId && email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        // Update existing customer with latest info
        await stripe.customers.update(stripeCustomerId, {
          ...(customerName ? { name: customerName } : {}),
          ...(customerPhone ? { phone: customerPhone } : {}),
          ...(billingAddress ? { address: billingAddress } : {}),
        });
      } else {
        const newCustomer = await stripe.customers.create({
          email,
          ...(customerName ? { name: customerName } : {}),
          ...(customerPhone ? { phone: customerPhone } : {}),
          ...(billingAddress ? { address: billingAddress } : {}),
        });
        stripeCustomerId = newCustomer.id;
      }

      // Persist stripe_customer_id back to billing_customers if we have one
      if (stripeCustomerId && customerObj?.id && !customerObj.stripe_customer_id) {
        await db
          .from("billing_customers")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", customerObj.id);
        console.log(`[stripe-create-payment-intent] Linked Stripe customer ${stripeCustomerId} to billing_customer ${customerObj.id}`);
      }
    }

    // ═══ BUILD RICH METADATA ═══
    const isInvoicePayment = Boolean(invoice_id || intent_context === "invoice_payment");
    const pricingSnapshot = order?.pricing_snapshot;

    // Compute pricing breakdown from invoice lines
    const monthlyAmount = invoiceLines
      .filter((l: any) => l.line_type === "service" || l.line_type === "recurring")
      .reduce((s: number, l: any) => s + (l.line_total || 0), 0);
    const oneTimeAmount = invoiceLines
      .filter((l: any) => ["equipment", "fee", "activation", "installation", "delivery"].includes(l.line_type))
      .reduce((s: number, l: any) => s + (l.line_total || 0), 0);
    const discountAmount = invoiceLines
      .filter((l: any) => l.line_type === "discount" || l.line_type === "promo")
      .reduce((s: number, l: any) => s + Math.abs(l.line_total || 0), 0);

    // Service name from order or invoice lines
    const serviceName = order?.plan_name ||
      pricingSnapshot?.plan_name ||
      invoiceLines.find((l: any) => l.line_type === "service" || l.line_type === "recurring")?.description ||
      "Nivra Telecom";

    const metadata: Record<string, string> = {
      source: isInvoicePayment ? "portal_invoice_payment" : "portal_checkout_preconfirm",
      intent_context: isInvoicePayment ? "invoice_payment" : "checkout_preconfirm",
    };

    // Order context
    if (invoice_id) metadata.invoice_id = invoice_id;
    if (invoice?.invoice_number) metadata.invoice_number = invoice.invoice_number;
    if (order?.id) metadata.order_id = order.id;
    if (order?.order_number) metadata.order_number = String(order.order_number);
    if (account?.id) metadata.account_id = account.id;
    if (account?.account_number) metadata.account_number = String(account.account_number);
    const resolvedCustomerId = customer_id || invoice?.customer_id;
    if (resolvedCustomerId) metadata.customer_id = resolvedCustomerId;
    if (invoice?.subscription_id) metadata.subscription_id = invoice.subscription_id;

    // Service context
    metadata.service_name = serviceName;
    if (order?.plan_type || pricingSnapshot?.plan_type) {
      metadata.plan_type = order?.plan_type || pricingSnapshot?.plan_type;
    }
    metadata.billing_cycle = "monthly";

    // Pricing breakdown (from canonical invoice data)
    if (invoice) {
      metadata.subtotal = String(invoice.subtotal || 0);
      metadata.tax_tps = String(invoice.tps_amount || 0);
      metadata.tax_tvq = String(invoice.tvq_amount || 0);
      metadata.total_amount = String(invoice.total || amount);
    }
    if (monthlyAmount > 0) metadata.monthly_amount = String(monthlyAmount);
    if (oneTimeAmount > 0) metadata.one_time_amount = String(oneTimeAmount);
    if (discountAmount > 0) metadata.discount_amount = String(discountAmount);

    // ═══ BUILD DESCRIPTION ═══
    const richDescription = order?.order_number
      ? `Nivra Telecom — Commande ${order.order_number} — ${serviceName}`
      : invoice?.invoice_number
        ? `Nivra Telecom — Facture ${invoice.invoice_number} — ${serviceName}`
        : description || "Nivra Telecom — Paiement";

    // Checkout preconfirm stays manual authorization; invoice payments are immediate capture.
    const captureMethod: "manual" | "automatic" = isInvoicePayment ? "automatic" : "manual";

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "cad",
      customer: stripeCustomerId,
      capture_method: captureMethod,
      metadata,
      description: richDescription,
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
    });

    console.log(
      `[stripe-create-payment-intent] PI created: ${paymentIntent.id} | ${richDescription} | metadata keys: ${Object.keys(metadata).join(", ")}`
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
