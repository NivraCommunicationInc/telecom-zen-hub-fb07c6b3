import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePayPalOrderRequest {
  invoice_id?: string;
  amount: number;
  currency?: string;
  description?: string;
  // For subscription payments
  subscription_id?: string;
  // For new orders
  order_id?: string;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[PayPal] Token error:", error);
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreatePayPalOrderRequest = await req.json();
    console.log("[PayPal] Creating order:", body);

    if (!body.amount || body.amount <= 0) {
      throw new Error("Invalid amount");
    }

    const accessToken = await getPayPalAccessToken();
    const currency = body.currency || "CAD";

    // Create PayPal order
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: body.amount.toFixed(2),
        },
        description: body.description || "Nivra Telecom - Paiement",
        custom_id: body.invoice_id || body.order_id || `order_${Date.now()}`,
      }],
      application_context: {
        brand_name: "Nivra Telecom",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivratelecom.ca"}/portal/payment-success`,
        cancel_url: `${Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivratelecom.ca"}/portal/payment-cancelled`,
      },
    };

    console.log("[PayPal] Order payload:", JSON.stringify(orderPayload));

    const orderResponse = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `nivra_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      console.error("[PayPal] Order creation error:", error);
      throw new Error(`PayPal order creation failed: ${error}`);
    }

    const orderData = await orderResponse.json();
    console.log("[PayPal] Order created:", orderData.id);

    // Log the PayPal order creation
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_order",
      entity_id: orderData.id,
      action: "created",
      details: {
        amount: body.amount,
        currency,
        invoice_id: body.invoice_id,
        order_id: body.order_id,
        subscription_id: body.subscription_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        paypal_order_id: orderData.id,
        status: orderData.status,
        links: orderData.links,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[PayPal] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
