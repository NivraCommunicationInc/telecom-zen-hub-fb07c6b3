/**
 * core-paypal-order-link â€” Generates a PayPal one-time payment link for an
 * existing Core `orders` row. Optionally emails the link to the client.
 *
 * Body:
 *   {
 *     order_id: string;
 *     mode: "email" | "direct";
 *     to_email?: string;     // required when mode === "email"
 *     amount?: number;       // overrides orders.total_amount when provided
 *   }
 *
 * Returns: { approval_url, paypal_order_id, expires_in_hours: 48 }
 *
 * Auth: Caller must be admin / employee / supervisor / billing_admin.
 * Side effects:
 *   - Creates a PayPal CAPTURE order with custom_id = "co:<order_id>"
 *   - UPDATE orders SET payment_status='link_sent', payment_reference=<paypal_id>
 *   - When mode==="email", enqueues a transactional email via sendNivraEmail
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Auth invalide" }), { status: 401, headers });
    }
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorization gate
    const allowedRoles = ["admin", "employee", "supervisor", "billing_admin"];
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const hasRole = (roles || []).some((r: any) => allowedRoles.includes(r.role));
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "AccÃ¨s refusÃ©" }), { status: 403, headers });
    }

    const body = await req.json();
    const orderId: string | undefined = body.order_id;
    const mode: string = body.mode === "email" ? "email" : "direct";
    const toEmail: string | undefined = body.to_email;

    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });
    }
    if (mode === "email" && !toEmail) {
      return new Response(JSON.stringify({ error: "to_email requis pour mode email" }), { status: 400, headers });
    }

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_number, total_amount, client_email, client_first_name, client_last_name, status")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) {
      return new Response(JSON.stringify({ error: "Commande introuvable" }), { status: 404, headers });
    }

    const amountRaw = Number(body.amount ?? order.total_amount);
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      return new Response(JSON.stringify({ error: "Montant invalide" }), { status: 400, headers });
    }
    const amount = Number(amountRaw.toFixed(2));

    const accessToken = await getPayPalAccessToken();
    const appBase = Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca";
    const ppPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "CAD", value: amount.toFixed(2) },
        description: `Nivra Telecom â€” Commande ${order.order_number || order.id.slice(0, 8)}`,
        custom_id: `co:${order.id}`,
      }],
      application_context: {
        brand_name: "Nivra Telecom",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${appBase}/portal/payment-success`,
        cancel_url: `${appBase}/portal/payment-cancelled`,
      },
    };

    const ppResp = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `co_${order.id}_${Date.now()}`,
      },
      body: JSON.stringify(ppPayload),
    });
    if (!ppResp.ok) {
      const raw = await ppResp.text();
      console.error("[core-paypal-order-link] PayPal error:", raw);
      return new Response(JSON.stringify({ error: "Erreur PayPal", details: raw }), { status: 400, headers });
    }
    const ppData = await ppResp.json();
    const approvalLink = (ppData.links || []).find(
      (l: any) => l.rel === "payer-action" || l.rel === "approve",
    );
    const approvalUrl = approvalLink?.href || null;
    if (!approvalUrl) {
      return new Response(JSON.stringify({ error: "PayPal n'a pas renvoyÃ© de lien d'approbation" }), { status: 500, headers });
    }

    // Stamp order
    await admin
      .from("orders")
      .update({
        payment_status: "link_sent",
        payment_method: order.status === "confirmed" ? undefined : "paypal",
        payment_reference: ppData.id,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", order.id);

    // Email
    if (mode === "email" && toEmail) {
      const { sendNivraEmail } = await import("../_shared/emailUtils.ts");
      const fullName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") || "client";
      const html = `
        <div style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#0066CC;margin:0 0 16px;">Lien de paiement â€” Nivra Telecom</h2>
          <p>Bonjour ${fullName},</p>
          <p>Voici le lien sÃ©curisÃ© pour rÃ©gler votre commande
            <strong>${order.order_number || order.id.slice(0, 8)}</strong>
            d'un montant de <strong>${amount.toFixed(2)} $ CAD</strong>.</p>
          <p style="margin:24px 0;">
            <a href="${approvalUrl}"
               style="background:#0066CC;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Payer maintenant via PayPal
            </a>
          </p>
          <p style="color:#666;font-size:13px;">Ce lien est valide pendant 48 heures.</p>
          <p style="color:#666;font-size:13px;">Si le bouton ne fonctionne pas, copiez ce lien :<br/>
            <span style="word-break:break-all;">${approvalUrl}</span>
          </p>
        </div>
      `;
      await sendNivraEmail({
        to: toEmail,
        subject: `Lien de paiement â€” Commande ${order.order_number || order.id.slice(0, 8)}`,
        html,
        eventKey: `core_paylink_${order.id}_${ppData.id}`,
        templateKey: "payment_link_request",
        messageType: "transactional",
        entityType: "order",
        entityId: order.id,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      paypal_order_id: ppData.id,
      approval_url: approvalUrl,
      expires_in_hours: 48,
    }), { headers });
  } catch (err) {
    console.error("[core-paypal-order-link] error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
