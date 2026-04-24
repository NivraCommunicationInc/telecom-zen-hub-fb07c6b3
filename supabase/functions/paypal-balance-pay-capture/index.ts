/**
 * paypal-balance-pay-capture
 * Captures a PayPal balance order and applies the amount FIFO to all unpaid invoices
 * via the apply_balance_payment RPC.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("PAYPAL_SECRET")!;
  const auth = btoa(`${clientId}:${clientSecret}`);
  const r = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("PayPal token error");
  return (await r.json()).access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { paypal_order_id } = await req.json();
    if (!paypal_order_id) {
      return new Response(JSON.stringify({ error: "paypal_order_id requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Resolve customer
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("id, first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!customer) {
      return new Response(JSON.stringify({ error: "Compte introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Capture
    const accessToken = await getPayPalAccessToken();
    const captureResp = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${paypal_order_id}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `cap_${paypal_order_id}`,
        },
      }
    );

    if (!captureResp.ok) {
      const raw = await captureResp.text();
      console.error("[balance-capture] PayPal error:", raw);
      return new Response(JSON.stringify({ error: "Échec de la capture PayPal", details: raw }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const captureData = await captureResp.json();
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = Number(capture?.amount?.value || 0);
    const captureId = capture?.id;

    if (!capturedAmount || capturedAmount <= 0) {
      return new Response(JSON.stringify({ error: "Montant capturé invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Apply via RPC FIFO
    const { data: applyResult, error: applyError } = await supabase.rpc("apply_balance_payment", {
      p_customer_id: customer.id,
      p_amount: capturedAmount,
      p_provider: "paypal",
      p_provider_payment_id: captureId,
      p_provider_order_id: paypal_order_id,
      p_method: "paypal",
      p_source: "client_portal_balance",
      p_created_by_name: `${customer.first_name} ${customer.last_name}`.trim(),
      p_created_by_role: "client",
    });

    if (applyError) {
      console.error("[balance-capture] RPC error:", applyError);
      return new Response(JSON.stringify({ error: "Erreur d'application: " + applyError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "paypal_balance_payment",
      entity_id: null,
      action: "balance_captured_and_applied",
      details: {
        paypal_order_id,
        capture_id: captureId,
        captured_amount: capturedAmount,
        apply_result: applyResult,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      captured_amount: capturedAmount,
      capture_id: captureId,
      apply_result: applyResult,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[balance-capture] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
