import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generates a PayPal client token required for Advanced Card Payments (CardFields).
 * The client token is short-lived and allows the JS SDK to render secure card fields.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    // 1. Get access token
    const auth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("[PayPal] Token error:", err);
      throw new Error("Failed to get PayPal access token");
    }

    const tokenData = await tokenResponse.json();

    // 2. Generate client token
    const clientTokenResponse = await fetch("https://api-m.paypal.com/v1/identity/generate-token", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        "Accept-Language": "en_US",
      },
    });

    if (!clientTokenResponse.ok) {
      const err = await clientTokenResponse.text();
      console.error("[PayPal] Client token error:", err);
      throw new Error("Failed to generate PayPal client token");
    }

    const clientTokenData = await clientTokenResponse.json();

    return new Response(
      JSON.stringify({
        client_token: clientTokenData.client_token,
        expires_in: clientTokenData.expires_in || 3600,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[PayPal] Client token error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
