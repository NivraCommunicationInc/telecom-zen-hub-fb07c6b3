/**
 * paypal-balance-pay-create
 * Creates a single PayPal order for the FULL UNPAID BALANCE of a customer.
 * Calculated server-side from billing_invoices (sum of balance_due).
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
  if (!r.ok) throw new Error(`PayPal token error: ${await r.text()}`);
  return (await r.json()).access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Resolve customer
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("id, first_name, last_name, email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!customer) {
      return new Response(JSON.stringify({ error: "Aucun compte de facturation trouvé" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Compute account balance EXACTLY like the client portal ledger:
    // balance = sum(non-cancelled invoice totals) - sum(confirmed payments)
    const { data: invoicesData } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, total, balance_due, status")
      .eq("customer_id", customer.id)
      .not("status", "in", '("cancelled","refunded","void")');

    const { data: paymentsData } = await supabase
      .from("billing_payments")
      .select("amount, status")
      .eq("customer_id", customer.id)
      .eq("status", "confirmed");

    const totalDebits = (invoicesData || []).reduce((s, inv: any) => s + (Number(inv.total) || 0), 0);
    const totalCredits = (paymentsData || []).reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
    const totalBalance = Math.round((totalDebits - totalCredits) * 100) / 100;

    const CLOSED_STATUSES = ["paid", "paid_by_promo", "void", "cancelled", "refunded"];
    const invoices = (invoicesData || []).filter((inv: any) =>
      !CLOSED_STATUSES.includes(inv.status) && (Number(inv.balance_due) || 0) > 0
    ).map((inv: any) => ({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      balance_due: Number(inv.balance_due) || 0,
    }));

    if (totalBalance <= 0) {
      return new Response(JSON.stringify({ error: "Aucun solde à payer", total_balance: 0 }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const amount = Number(totalBalance.toFixed(2));
    const accessToken = await getPayPalAccessToken();

    const baseUrl = Deno.env.get("APP_BASE_URL")?.split(",")[0] || "https://nivra-telecom.ca";
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "CAD", value: amount.toFixed(2) },
        description: `Nivra Telecom - Paiement de balance (${invoices.length} facture${invoices.length > 1 ? "s" : ""})`,
        custom_id: `balance_${customer.id}`,
      }],
      application_context: {
        brand_name: "Nivra Telecom",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: `${baseUrl}/portal/balance-payment-success`,
        cancel_url: `${baseUrl}/portal/billing`,
      },
    };

    const orderResponse = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `nivra_balance_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const raw = await orderResponse.text();
      console.error("[paypal-balance-pay-create] Error:", raw);
      return new Response(JSON.stringify({ error: "Erreur PayPal", details: raw }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const orderData = await orderResponse.json();

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "paypal_balance_payment",
      entity_id: null,
      action: "balance_order_created",
      details: {
        paypal_order_id: orderData.id,
        amount,
        invoice_count: invoices.length,
        invoice_ids: invoices.map(i => i.invoice_id),
        customer_id: customer.id,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      paypal_order_id: orderData.id,
      amount,
      currency: "CAD",
      invoice_count: invoices.length,
      links: orderData.links,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paypal-balance-pay-create] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
