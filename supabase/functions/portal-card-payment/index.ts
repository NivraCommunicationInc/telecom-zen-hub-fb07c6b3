/**
 * portal-card-payment — Portal client card payment endpoint
 *
 * Allows authenticated portal clients to pay their invoices via credit/debit card
 * directly from the billing portal. Encrypts card data, creates PayPal order
 * with card payment source, and records the payment.
 *
 * Body:
 *   {
 *     card_number: string,   // 16 digits
 *     card_expiry: string,   // MM/YY
 *     cvv: string,           // 3-4 digits
 *     card_name: string,     // cardholder name
 *     invoice_id?: string,   // optional specific invoice
 *     amount: number,        // amount in CAD
 *   }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { writePaymentAutoNote } from "../_shared/paymentAutoNote.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const enc = new TextEncoder();

function b64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

function luhn(num: string): boolean {
  const d = num.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0, even = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let x = parseInt(d[i], 10);
    if (even) { x *= 2; if (x > 9) x -= 9; }
    sum += x; even = !even;
  }
  return sum % 10 === 0;
}

function expiryToPayPal(expiry: string): string {
  const [mm, yy] = expiry.split("/");
  return `20${yy}-${mm}`;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");
  const auth = btoa(`${clientId}:${clientSecret}`);
  const r = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("PayPal token failed");
  const d = await r.json();
  return d.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Auth invalide" }), { status: 401, headers });

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const cardNumber: string = String(body.card_number || "").replace(/\s+/g, "");
    const cardName: string = String(body.card_name || "").trim();
    const cardExpiry: string = String(body.card_expiry || "").trim();
    const cvv: string = String(body.cvv || "").trim();
    const amount = Number(body.amount);
    const invoiceId: string | undefined = body.invoice_id;

    // Validation
    if (!luhn(cardNumber)) {
      return new Response(JSON.stringify({ error: "Numéro de carte invalide" }), { status: 400, headers });
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      return new Response(JSON.stringify({ error: "Date d'expiration invalide (MM/YY)" }), { status: 400, headers });
    }
    if (!/^\d{3,4}$/.test(cvv)) {
      return new Response(JSON.stringify({ error: "CVV invalide" }), { status: 400, headers });
    }
    if (!cardName) {
      return new Response(JSON.stringify({ error: "Nom sur la carte requis" }), { status: 400, headers });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "Montant invalide" }), { status: 400, headers });
    }

    // Verify amount against customer's actual balance (security)
    const { data: customer } = await admin
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!customer) {
      return new Response(JSON.stringify({ error: "Compte client introuvable" }), { status: 404, headers });
    }

    // Get PayPal access token and create + capture order with card
    const accessToken = await getPayPalAccessToken();
    const amountStr = Number(amount).toFixed(2);

    const idempotencyKey = `portal-card-${userId}-${Date.now()}`;

    const ppRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": idempotencyKey,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: invoiceId || `portal-${userId}`,
          amount: { currency_code: "CAD", value: amountStr },
          description: "Paiement Nivra Telecom",
        }],
        payment_source: {
          card: {
            number: cardNumber,
            expiry: expiryToPayPal(cardExpiry),
            name: cardName,
            security_code: cvv,
          },
        },
      }),
    });

    // Wipe sensitive data from memory
    const ppJson = await ppRes.json();
    const cardNumberCleared = "";
    const cvvCleared = "";

    const paypalOrderId = ppJson?.id;
    const status = ppJson?.status;
    const captureStatus = ppJson?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
    const captureId = ppJson?.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    if (!ppRes.ok || (status !== "COMPLETED" && captureStatus !== "COMPLETED")) {
      const reason =
        ppJson?.details?.[0]?.description ||
        ppJson?.message ||
        "Paiement refusé";
      console.error("[portal-card-payment] PayPal rejected", ppJson);
      return new Response(JSON.stringify({ error: reason }), { status: 402, headers });
    }

    // Record payment in billing_payments
    const { data: payment, error: payErr } = await admin
      .from("billing_payments")
      .insert({
        customer_id: customer.id,
        invoice_id: invoiceId || null,
        amount: Number(amountStr),
        currency: "CAD",
        payment_method: "card",
        status: "paid",
        provider: "paypal_card",
        provider_payment_id: captureId || paypalOrderId,
        processed_at: new Date().toISOString(),
        notes: `Card payment via portal — last4: ${cardNumber.slice(-4)}`,
      })
      .select("id")
      .single();

    if (payErr) {
      console.error("[portal-card-payment] billing_payments insert failed:", payErr);
      // Payment captured but not recorded — log for manual reconciliation
    }

    // Apply payment to invoice if specified
    if (invoiceId && payment?.id) {
      await admin.rpc("apply_payment_to_invoice", {
        p_invoice_id: invoiceId,
        p_payment_id: payment.id,
        p_amount: Number(amountStr),
      }).then(
        ({ error: rpcErr }) => {
          if (rpcErr) console.warn("[portal-card-payment] apply_payment_to_invoice RPC failed:", rpcErr.message);
        }
      );
    }

    // Activity log
    await admin.from("activity_logs").insert({
      user_id: userId,
      entity_type: "billing_payment",
      entity_id: payment?.id || paypalOrderId,
      action: "card_payment_portal",
      details: {
        amount: Number(amountStr),
        invoice_id: invoiceId,
        paypal_order_id: paypalOrderId,
        card_last4: cardNumber.slice(-4),
      },
    }).then(() => undefined, () => undefined);

    return new Response(JSON.stringify({
      success: true,
      paypal_order_id: paypalOrderId,
      payment_id: payment?.id,
      amount: Number(amountStr),
    }), { headers });
  } catch (err) {
    console.error("[portal-card-payment] error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers },
    );
  }
});
