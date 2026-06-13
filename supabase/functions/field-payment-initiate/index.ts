/**
 * field-payment-initiate â€” FIX 1
 *
 * Creates a temporary `field_payment_intents` row + PayPal order WITHOUT
 * creating any Core order/invoice/commission. The PayPal capture webhook
 * (paypal-webhook) is responsible for materializing the real order once
 * payment is confirmed.
 *
 * Body:
 *   {
 *     quote_id: string;          // required (caller saved the quote first)
 *     amount: number;            // total to charge (CAD)
 *     customer_email?: string;
 *     customer_name?: string;
 *     description?: string;
 *   }
 *
 * Returns:
 *   { intent_id, paypal_order_id, approval_url, expires_at }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");
  const auth = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) throw new Error("Failed to get PayPal access token");
  const data = await resp.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify caller
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Auth invalide" }), { status: 401, headers });
    }
    const agentId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const quoteId: string | undefined = body.quote_id;
    const amountRaw = Number(body.amount);
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "quote_id requis" }), { status: 400, headers });
    }
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      return new Response(JSON.stringify({ error: "Montant invalide" }), { status: 400, headers });
    }
    const amount = Number(amountRaw.toFixed(2));

    // Verify quote exists and belongs to agent
    const { data: quote, error: qErr } = await admin
      .from("field_quotes")
      .select("id, agent_id, total")
      .eq("id", quoteId)
      .maybeSingle();
    if (qErr || !quote) {
      return new Response(JSON.stringify({ error: "Soumission introuvable" }), { status: 404, headers });
    }
    if (quote.agent_id !== agentId) {
      return new Response(JSON.stringify({ error: "AccÃ¨s refusÃ©" }), { status: 403, headers });
    }
    // Enforce amount matches the quote total (prevent under-charging fraud)
    if (Math.round(amount * 100) !== Math.round(Number(quote.total) * 100)) {
      return new Response(JSON.stringify({ error: "Le montant ne correspond pas Ã  la soumission" }), { status: 400, headers });
    }

    // 1) Create the payment intent row first (so we own the UUID)
    const { data: intent, error: iErr } = await admin
      .from("field_payment_intents")
      .insert({
        quote_id: quoteId,
        agent_id: agentId,
        amount,
        currency: "CAD",
        status: "pending",
        payment_method: "paypal",
        customer_email: body.customer_email ?? null,
        customer_name: body.customer_name ?? null,
      })
      .select("id, expires_at")
      .single();
    if (iErr || !intent) throw iErr ?? new Error("Intent creation failed");

    // 2) Create PayPal order with custom_id = "fpi:<intent_id>" so the
    //    webhook can find this intent when the capture completes.
    const accessToken = await getPayPalAccessToken();
    const ppPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "CAD", value: amount.toFixed(2) },
        description: body.description || "Nivra Telecom â€” Vente terrain",
        custom_id: `fpi:${intent.id}`,
      }],
      application_context: {
        brand_name: "Nivra Telecom",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca"}/portal/payment-success`,
        cancel_url: `${Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca"}/portal/payment-cancelled`,
      },
    };

    const ppResp = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `fpi_${intent.id}`,
      },
      body: JSON.stringify(ppPayload),
    });
    if (!ppResp.ok) {
      const raw = await ppResp.text();
      console.error("[field-payment-initiate] PayPal error:", raw);
      // Mark intent as cancelled so it doesn't sit pending forever
      await admin.from("field_payment_intents").update({ status: "cancelled" }).eq("id", intent.id);
      return new Response(JSON.stringify({ error: "Erreur PayPal", details: raw }), { status: 400, headers });
    }
    const ppData = await ppResp.json();
    const approvalLink = (ppData.links || []).find(
      (l: any) => l.rel === "payer-action" || l.rel === "approve",
    );
    const approvalUrl = approvalLink?.href || null;

    await admin
      .from("field_payment_intents")
      .update({
        paypal_order_id: ppData.id,
        paypal_approval_url: approvalUrl,
      })
      .eq("id", intent.id);

    return new Response(JSON.stringify({
      success: true,
      intent_id: intent.id,
      paypal_order_id: ppData.id,
      approval_url: approvalUrl,
      expires_at: intent.expires_at,
    }), { headers });
  } catch (err) {
    console.error("[field-payment-initiate] error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers },
    );
  }
});
