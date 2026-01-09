import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePaymentRequest {
  orderId?: string;
  billingId?: string;
  clientId: string;
  amountCAD: number;
  currency: string; // BTC, ETH, XRP, SOL
  description?: string;
  callbackUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate request
    const body: CreatePaymentRequest = await req.json();
    const { orderId, billingId, clientId, amountCAD, currency, description, callbackUrl } = body;

    if (!clientId || !amountCAD || amountCAD <= 0 || !currency) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: clientId, amountCAD, currency" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch gateway settings
    const { data: settings, error: settingsError } = await supabase
      .from("payment_gateway_settings")
      .select("*")
      .eq("provider", "nowpayments")
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.is_enabled) {
      return new Response(
        JSON.stringify({ error: "Crypto payments are currently disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate currency is enabled
    const enabledCurrencies = settings.enabled_currencies as string[];
    if (!enabledCurrencies.includes(currency.toUpperCase())) {
      return new Response(
        JSON.stringify({ error: `Currency ${currency} is not enabled` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API key from environment
    const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
    if (!apiKey) {
      console.error("NOWPAYMENTS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment gateway API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API base URL based on mode
    const baseUrl = settings.mode === "production" 
      ? "https://api.nowpayments.io/v1"
      : "https://api-sandbox.nowpayments.io/v1";

    // Create unique order_id for NOWPayments
    const nowOrderId = `${orderId || billingId || 'manual'}_${Date.now()}`;

    // Build IPN callback URL
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const ipnCallbackUrl = callbackUrl || `${projectUrl}/functions/v1/nowpayments-ipn`;

    // Create payment via NOWPayments API
    const paymentPayload = {
      price_amount: amountCAD,
      price_currency: "cad",
      pay_currency: currency.toLowerCase(),
      order_id: nowOrderId,
      order_description: description || `Payment for order ${orderId || billingId || 'N/A'}`,
      ipn_callback_url: ipnCallbackUrl,
      is_fee_paid_by_user: false,
    };

    console.log("Creating NOWPayments payment:", JSON.stringify(paymentPayload));

    const nowResponse = await fetch(`${baseUrl}/payment`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentPayload),
    });

    const nowData = await nowResponse.json();

    if (!nowResponse.ok) {
      console.error("NOWPayments API error:", nowData);
      return new Response(
        JSON.stringify({ error: nowData.message || "Failed to create crypto payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("NOWPayments response:", JSON.stringify(nowData));

    // Insert record into crypto_payments
    const { data: cryptoPayment, error: insertError } = await supabase
      .from("crypto_payments")
      .insert({
        order_id: orderId || null,
        billing_id: billingId || null,
        client_id: clientId,
        provider: "nowpayments",
        payment_id: String(nowData.payment_id),
        payment_status: nowData.payment_status || "created",
        price_amount: amountCAD,
        price_currency: "cad",
        pay_amount: nowData.pay_amount,
        pay_currency: nowData.pay_currency,
        pay_address: nowData.pay_address,
        invoice_url: nowData.invoice_url || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting crypto_payment:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to record payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log to admin audit
    await supabase.from("admin_security_audit").insert({
      admin_user_id: clientId,
      action: "crypto_payment_created",
      target_type: "crypto_payment",
      target_id: cryptoPayment.id,
      details: {
        order_id: orderId,
        billing_id: billingId,
        amount_cad: amountCAD,
        currency: currency,
        payment_id: nowData.payment_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        cryptoPaymentId: cryptoPayment.id,
        paymentId: nowData.payment_id,
        payAddress: nowData.pay_address,
        payAmount: nowData.pay_amount,
        payCurrency: nowData.pay_currency,
        invoiceUrl: nowData.invoice_url,
        status: nowData.payment_status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in create-crypto-payment:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
