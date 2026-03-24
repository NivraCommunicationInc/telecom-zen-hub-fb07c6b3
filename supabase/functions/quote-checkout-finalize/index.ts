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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

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

    if (!["accepted_pending_checkout", "checkout_in_progress"].includes(quote.status)) {
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

    // 4. Create order in orders table
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: quote.customer_user_id || null,
        order_number: orderNumber,
        status: "pending",
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
    console.log("[quote-checkout-finalize] Order created:", order.id, orderNumber);

    // Link quote to order
    await supabase
      .from("quotes")
      .update({ converted_order_id: order.id })
      .eq("id", quote_id);

    // 5. Get or create billing customer
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

    // 6. Create subscription + invoice from quote financials
    const cycleStart = new Date().toISOString().split("T")[0];
    const cycleEndDate = new Date();
    cycleEndDate.setDate(cycleEndDate.getDate() + 30);
    const cycleEnd = cycleEndDate.toISOString().split("T")[0];

    // Build service description from quote lines
    const recurringLines = lines.filter((l: any) => l.billing_frequency === "monthly");
    const oneTimeLines = lines.filter((l: any) => l.billing_frequency === "one_time");
    const planName = recurringLines.map((l: any) => l.label).join(" + ") || "Services Nivra";
    const planPrice = recurringLines.reduce((sum: number, l: any) => sum + (l.unit_price * l.quantity), 0);

    // Create subscription
    const { data: subscription, error: subErr } = await supabase
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

    // Generate invoice number
    const { data: invoiceNumberData } = await supabase.rpc("generate_billing_invoice_number");
    const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;

    // Use quote's calculated totals
    const subtotal = quote.subtotal || 0;
    const tpsAmount = quote.tps_amount || Math.round(subtotal * TPS_RATE * 100) / 100;
    const tvqAmount = quote.tvq_amount || Math.round(subtotal * TVQ_RATE * 100) / 100;
    const total = quote.total_due_now || Math.round((subtotal + tpsAmount + tvqAmount) * 100) / 100;

    const { data: invoice, error: invErr } = await supabase
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

    // Create invoice lines from quote lines
    const invoiceLines = lines.map((line: any) => ({
      invoice_id: invoice.id,
      description: line.label,
      unit_price: line.unit_price,
      quantity: line.quantity || 1,
      line_total: (line.unit_price || 0) * (line.quantity || 1),
      line_type: line.billing_frequency === "monthly" ? "service" : "fee",
    }));

    await supabase.from("billing_invoice_lines").insert(invoiceLines);

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
  } catch (error: unknown) {
    console.error("[quote-checkout-finalize] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
