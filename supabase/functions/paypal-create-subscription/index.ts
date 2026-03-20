import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  plan_name: string;
  plan_price: number;
  customer_email: string;
  customer_name: string;
  customer_id?: string;
  billing_subscription_id?: string;
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
    const baseUrl = Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca";

    const body: CreateSubscriptionRequest = await req.json();
    console.log("[PayPal] Creating subscription plan for:", body.plan_name);

    if (!body.plan_price || body.plan_price <= 0) {
      throw new Error("Invalid plan price");
    }

    const accessToken = await getPayPalAccessToken();

    // Step 1: Create or get Product
    const productId = `NIVRA_${body.plan_name.toUpperCase().replace(/\s+/g, "_")}`;
    
    // Try to create product (will fail silently if exists)
    try {
      await fetch("https://api-m.paypal.com/v1/catalogs/products", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: productId,
          name: body.plan_name,
          description: `Abonnement mensuel Nivra Telecom - ${body.plan_name}`,
          type: "SERVICE",
          category: "TELECOM_SERVICES",
        }),
      });
    } catch (e) {
      console.log("[PayPal] Product may already exist");
    }

    // Step 2: Create Billing Plan
    const planPayload = {
      product_id: productId,
      name: `${body.plan_name} - Mensuel`,
      description: `Abonnement mensuel automatique pour ${body.plan_name}`,
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // Unlimited
          pricing_scheme: {
            fixed_price: {
              value: body.plan_price.toFixed(2),
              currency_code: "CAD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
      taxes: {
        percentage: "14.975", // TPS + TVQ
        inclusive: false,
      },
    };

    const planResponse = await fetch("https://api-m.paypal.com/v1/billing/plans", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `plan_${Date.now()}`,
      },
      body: JSON.stringify(planPayload),
    });

    if (!planResponse.ok) {
      const error = await planResponse.text();
      console.error("[PayPal] Plan creation error:", error);
      throw new Error(`Failed to create billing plan: ${error}`);
    }

    const planData = await planResponse.json();
    console.log("[PayPal] Plan created:", planData.id);

    // Step 3: Create Subscription
    const subscriptionPayload = {
      plan_id: planData.id,
      subscriber: {
        name: {
          given_name: body.customer_name.split(" ")[0] || body.customer_name,
          surname: body.customer_name.split(" ").slice(1).join(" ") || "",
        },
        email_address: body.customer_email,
      },
      application_context: {
        brand_name: "Nivra Telecom",
        locale: "fr-CA",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${baseUrl}/portal/subscription-success`,
        cancel_url: `${baseUrl}/portal/subscription-cancelled`,
      },
      custom_id: body.billing_subscription_id || `sub_${Date.now()}`,
    };

    const subscriptionResponse = await fetch("https://api-m.paypal.com/v1/billing/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `sub_${Date.now()}`,
      },
      body: JSON.stringify(subscriptionPayload),
    });

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.text();
      console.error("[PayPal] Subscription creation error:", error);
      throw new Error(`Failed to create subscription: ${error}`);
    }

    const subscriptionData = await subscriptionResponse.json();
    console.log("[PayPal] Subscription created:", subscriptionData.id);

    // Find approval link
    const approvalLink = subscriptionData.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve"
    )?.href;

    // Log the subscription creation
    await supabase.from("activity_logs").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "paypal_subscription",
      entity_id: subscriptionData.id,
      action: "created",
      details: {
        plan_id: planData.id,
        plan_name: body.plan_name,
        plan_price: body.plan_price,
        customer_email: body.customer_email,
        billing_subscription_id: body.billing_subscription_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        paypal_subscription_id: subscriptionData.id,
        paypal_plan_id: planData.id,
        status: subscriptionData.status,
        approval_url: approvalLink,
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
