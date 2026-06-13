import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Quote Checkout Finalize — Converts a quote to an order + invoice.
 * Called when the client submits the quote checkout form.
 * Returns invoice_id so the frontend can open PayPal for payment.
 * 
 * After PayPal capture, the existing paypal-capture-order handles the rest.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;
const BILLABLE_ORDER_STATUSES = new Set(["submitted", "pending_admin_review", "confirmed", "completed"]);

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

    console.log("[quote-checkout-finalize] Starting for quote:", quote_id);

    // 1. Load quote
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quote_id)
      .single();

    if (qErr || !quote) throw new Error("Quote not found");

    if (!["accepted_pending_checkout", "checkout_in_progress", "checkout_completed"].includes(quote.status)) {
      throw new Error(`Quote status '${quote.status}' does not allow checkout finalization`);
    }

    // 2. Load quote lines
    const { data: lines } = await supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", quote_id)
      .order("created_at", { ascending: true });

    if (!lines || lines.length === 0) {
      throw new Error("Quote has no line items");
    }

    // 3. Save checkout data on the quote
    const fullName = `${checkout_data.first_name} ${checkout_data.last_name}`.trim();
    await supabase
      .from("quotes")
      .update({
        status: "checkout_completed",
        checkout_completed_at: new Date().toISOString(),
        prospect_name: fullName,
        prospect_email: checkout_data.email,
        prospect_phone: checkout_data.phone,
        checkout_data: {
          ...checkout_data,
          payment_method,
          completed_at: new Date().toISOString(),
        },
      })
      .eq("id", quote_id);

    // 4. Resolve canonical user/account for order creation
    const orderUserId = quote.customer_user_id;
    if (!orderUserId) {
      throw new Error("Quote is missing customer_user_id; cannot create order");
    }

    let resolvedAccountId: string | null = quote.account_id || null;
    if (!resolvedAccountId) {
      const { data: existingAccount, error: accountErr } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", orderUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (accountErr) {
        throw new Error(`Account lookup failed: ${accountErr.message}`);
      }

      resolvedAccountId = existingAccount?.id || null;
    }

    if (!resolvedAccountId) {
      throw new Error("No account found for this quote's client; cannot create order");
    }

    // 5. Check if order already exists (idempotency for retries)
    let order: any;
    if (quote.converted_order_id) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("*")
        .eq("id", quote.converted_order_id)
        .maybeSingle();
      if (existingOrder) {
        order = existingOrder;
        console.log("[quote-checkout-finalize] Reusing existing order:", order.id);
      }
    }

    if (!order) {
      // Re-check for concurrent requests that may have created an order between our initial read and now
      const { data: freshQuote } = await supabase
        .from("quotes").select("converted_order_id").eq("id", quote_id).single();
      if (freshQuote?.converted_order_id) {
        const { data: concurrentOrder } = await supabase
          .from("orders").select("*").eq("id", freshQuote.converted_order_id).maybeSingle();
        if (concurrentOrder) {
          order = concurrentOrder;
          console.log("[quote-checkout-finalize] Concurrent request detected — reusing order:", order.id);
        }
      }
    }

    if (!order) {
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

      const { data: newOrder, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: orderUserId,
          account_id: resolvedAccountId,
          service_type: "combo",
          order_number: orderNumber,
          status: "submitted",
          payment_status: "pending",
          payment_method: payment_method || "paypal",
          total_amount: quote.total_due_now || 0,
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
        })
        .select()
        .single();

      if (orderErr) throw new Error(`Order creation failed: ${orderErr.message}`);
      order = newOrder;
      console.log("[quote-checkout-finalize] Order created:", order.id, orderNumber);

      await supabase
        .from("quotes")
        .update({ converted_order_id: order.id })
        .eq("id", quote_id);
    }

    const orderNumber = order.order_number;

    // Ensure order status is billable for billing_invoices guard trigger
    if (!BILLABLE_ORDER_STATUSES.has(order.status)) {
      const { data: patchedOrder, error: patchOrderErr } = await supabase
        .from("orders")
        .update({ status: "submitted" })
        .eq("id", order.id)
        .select("*")
        .single();

      if (patchOrderErr) {
        throw new Error(`Failed to patch order status for billing: ${patchOrderErr.message}`);
      }

      order = patchedOrder;
    }

    // 6. Get or create billing customer
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from("billing_customers")
      .select("id")
      .eq("email", checkout_data.email)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from("billing_customers")
        .insert({
          user_id: quote.customer_user_id || null,
          first_name: checkout_data.first_name,
          last_name: checkout_data.last_name,
          email: checkout_data.email,
          phone: checkout_data.phone,
          status: "active",
        })
        .select()
        .single();
      if (custErr) throw new Error(`Customer creation failed: ${custErr.message}`);
      customerId = newCustomer.id;
    }

    // 7. Get or create subscription + invoice from quote financials
    const cycleStart = new Date().toISOString().split("T")[0];
    const cycleEndDate = new Date();
    cycleEndDate.setDate(cycleEndDate.getDate() + 30);
    const cycleEnd = cycleEndDate.toISOString().split("T")[0];

    // Build service description from quote lines
    const recurringLines = lines.filter((l: any) => l.billing_frequency === "monthly");
    const oneTimeLines = lines.filter((l: any) => l.billing_frequency === "one_time");
    const planName = recurringLines.map((l: any) => l.label).join(" + ") || "Services Nivra";
    const planPrice = recurringLines.reduce((sum: number, l: any) => sum + (l.unit_price * l.quantity), 0);

    let subscription: any;
    const { data: existingSubscription, error: existingSubErr } = await supabase
      .from("billing_subscriptions")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSubErr) throw new Error(`Subscription lookup failed: ${existingSubErr.message}`);

    if (existingSubscription) {
      subscription = existingSubscription;
    } else {
      const { data: createdSubscription, error: subErr } = await supabase
        .from("billing_subscriptions")
        .insert({
          customer_id: customerId,
          plan_code: `quote-${quote.quote_number}`,
          plan_name: planName,
          plan_price: planPrice,
          service_category: "combo",
          cycle_start_date: cycleStart,
          cycle_end_date: cycleEnd,
          status: "pending",
          order_id: order.id,
        })
        .select()
        .single();

      if (subErr) throw new Error(`Subscription creation failed: ${subErr.message}`);
      subscription = createdSubscription;
    }

    // Use quote's calculated totals
    const subtotal = quote.subtotal || 0;
    const tpsAmount = quote.tps_amount || Math.round(subtotal * TPS_RATE * 100) / 100;
    const tvqAmount = quote.tvq_amount || Math.round(subtotal * TVQ_RATE * 100) / 100;
    const total = quote.total_due_now || Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;
    let invoice: any;
    const { data: existingInvoice, error: existingInvErr } = await supabase
      .from("billing_invoices")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInvErr) throw new Error(`Invoice lookup failed: ${existingInvErr.message}`);

    if (existingInvoice) {
      invoice = existingInvoice;
    } else {
      // Generate invoice number
      const { data: invoiceNumberData } = await supabase.rpc("generate_billing_invoice_number");
      const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;

      const { data: createdInvoice, error: invErr } = await supabase
        .from("billing_invoices")
        .insert({
          subscription_id: subscription.id,
          customer_id: customerId,
          invoice_number: invoiceNumber,
          type: "initial",
          subtotal,
          tps_amount: tpsAmount,
          tvq_amount: tvqAmount,
          total,
          currency: "CAD",
          payment_method: payment_method || "paypal",
          status: "pending",
          cycle_start_date: cycleStart,
          cycle_end_date: cycleEnd,
          due_date: cycleEnd,
          order_id: order.id,
          billing_snapshot_client: {
            first_name: checkout_data.first_name,
            last_name: checkout_data.last_name,
            email: checkout_data.email,
            phone: checkout_data.phone,
          },
          notes: `Soumission: ${quote.quote_number}`,
        })
        .select()
        .single();

      if (invErr) throw new Error(`Invoice creation failed: ${invErr.message}`);
      invoice = createdInvoice;
    }

    const invoiceNumber = invoice.invoice_number;

    // Create invoice lines from quote lines
    const invoiceLines = lines.map((line: any) => ({
      invoice_id: invoice.id,
      description: line.label,
      unit_price: line.unit_price,
      quantity: line.quantity || 1,
      line_total: (line.unit_price || 0) * (line.quantity || 1),
      line_type: line.billing_frequency === "monthly" ? "service" : "fee",
    }));

    const { count: existingInvoiceLineCount, error: lineCountErr } = await supabase
      .from("billing_invoice_lines")
      .select("id", { head: true, count: "exact" })
      .eq("invoice_id", invoice.id);

    if (lineCountErr) throw new Error(`Invoice lines lookup failed: ${lineCountErr.message}`);

    if (!existingInvoiceLineCount) {
      await supabase.from("billing_invoice_lines").insert(invoiceLines);
    }

    // Log events
    await supabase.from("quote_events").insert({
      quote_id: quote_id,
      event_type: "checkout_completed",
      actor_role: "client",
      message: `Checkout complété par ${fullName}. Commande ${orderNumber} créée. Facture ${invoiceNumber} en attente de paiement.`,
      metadata: {
        order_id: order.id,
        order_number: orderNumber,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        payment_method,
      },
    });

    console.log("[quote-checkout-finalize] Complete:", {
      order_id: order.id,
      order_number: orderNumber,
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      total,
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: orderNumber,
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        customer_id: customerId,
        total,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[quote-checkout-finalize] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
