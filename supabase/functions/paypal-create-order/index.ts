import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseJsonSafe(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

interface CustomerInfo {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    admin_area_2?: string; // City
    admin_area_1?: string; // Province/State
    postal_code?: string;
    country_code?: string;
  };
}

interface CreatePayPalOrderRequest {
  invoice_id?: string;
  amount: number;
  currency?: string;
  description?: string;
  // For subscription payments
  subscription_id?: string;
  // For new orders
  order_id?: string;
  // Customer info for pre-filling PayPal
  customer?: CustomerInfo;
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

    // Build payer info if customer data is provided
    let payer: Record<string, unknown> | undefined;
    if (body.customer) {
      const c = body.customer;
      payer = {};
      
      // Name
      if (c.first_name || c.last_name) {
        payer.name = {
          given_name: c.first_name || "",
          surname: c.last_name || "",
        };
      }
      
      // Email
      if (c.email) {
        payer.email_address = c.email;
      }
      
      // Phone
      if (c.phone) {
        // PayPal expects phone in specific format
        const cleanPhone = c.phone.replace(/\D/g, "");
        if (cleanPhone.length >= 10) {
          payer.phone = {
            phone_type: "MOBILE",
            phone_number: {
              national_number: cleanPhone.slice(-10), // Last 10 digits
            },
          };
        }
      }
      
      // Address
      if (c.address) {
        payer.address = {
          address_line_1: c.address.address_line_1 || "",
          address_line_2: c.address.address_line_2 || "",
          admin_area_2: c.address.admin_area_2 || "", // City
          admin_area_1: c.address.admin_area_1 || "QC", // Province
          postal_code: c.address.postal_code || "",
          country_code: c.address.country_code || "CA",
        };
      }
      
      console.log("[PayPal] Payer info:", JSON.stringify(payer));
    }

    // Create PayPal order
    const orderPayload: Record<string, unknown> = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: body.amount.toFixed(2),
        },
        description: body.description || "Nivra Telecom - Paiement",
        custom_id: body.invoice_id || body.order_id || `order_${Date.now()}`,
        // Add shipping info if address is provided
        ...(body.customer?.address ? {
          shipping: {
            name: {
              full_name: `${body.customer.first_name || ""} ${body.customer.last_name || ""}`.trim() || "Client",
            },
            address: {
              address_line_1: body.customer.address.address_line_1 || "",
              address_line_2: body.customer.address.address_line_2 || "",
              admin_area_2: body.customer.address.admin_area_2 || "",
              admin_area_1: body.customer.address.admin_area_1 || "QC",
              postal_code: body.customer.address.postal_code || "",
              country_code: body.customer.address.country_code || "CA",
            },
          },
        } : {}),
      }],
      application_context: {
        brand_name: "Nivra Telecom",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        shipping_preference: body.customer?.address ? "SET_PROVIDED_ADDRESS" : "NO_SHIPPING",
        return_url: `${Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca"}/portal/payment-success`,
        cancel_url: `${Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca"}/portal/payment-cancelled`,
      },
    };
    
    // Add payer info if available
    if (payer && Object.keys(payer).length > 0) {
      orderPayload.payer = payer;
    }

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
      const raw = await orderResponse.text();
      console.error("[PayPal] Order creation error:", raw);

      const paypalError = parseJsonSafe(raw);
      const issue = paypalError?.details?.[0]?.issue;
      const detailDescription = paypalError?.details?.[0]?.description;
      const baseMessage = paypalError?.message || raw;
      const debugId = paypalError?.debug_id;

      // Messages orientés support (FR) pour les erreurs fréquentes
      let friendly = "Erreur PayPal lors de la création de la commande.";
      if (issue === "PAYEE_ACCOUNT_RESTRICTED") {
        friendly = "Paiement PayPal indisponible: le compte marchand PayPal est restreint (à débloquer côté PayPal).";
      } else if (issue) {
        friendly = `Erreur PayPal: ${issue}${detailDescription ? ` — ${detailDescription}` : ""}.`;
      } else if (baseMessage) {
        friendly = `Erreur PayPal: ${baseMessage}`;
      }

      const msg = `${friendly}${debugId ? ` (debug_id: ${debugId})` : ""}`;
      const e: any = new Error(msg);
      e.paypal = paypalError;
      throw e;
    }

    const orderData = await orderResponse.json();
    console.log("[PayPal] Order created:", orderData.id);

    // Log the PayPal order creation (entity_id must be UUID or null, so we store paypal_order_id in details)
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_order",
      entity_id: body.order_id || null, // Use the Nivra order_id if provided (must be UUID)
      action: "created",
      details: {
        paypal_order_id: orderData.id,
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

    const paypal = (error && typeof error === "object" && "paypal" in error)
      ? (error as any).paypal
      : undefined;

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        ...(paypal ? { paypal } : {}),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
