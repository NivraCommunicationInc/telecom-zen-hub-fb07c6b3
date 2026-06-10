/**
 * core-process-card-payment
 *
 * Admin-only endpoint that processes a `card_manual` field-sale payment.
 *
 * Flow:
 *  1. Verify caller is an admin.
 *  2. Load `card_payment_intents` row + linked `field_payment_intents`.
 *  3. Decrypt the card number (AES-256-GCM, key derived via HKDF-SHA256).
 *  4. Create a PayPal order with `payment_source.card` (advanced card payments).
 *  5. Capture the order. If approved:
 *       - Mark `field_payment_intents.status = 'paid'`
 *       - Run the existing field order/invoice materialization path
 *         (`field-order-engine` finalize) to create order + invoice + commission.
 *       - DELETE the `card_payment_intents` row (security — plaintext key removed).
 *       - Return success with the resulting order_id.
 *  6. If rejected, leave the intent in place so the admin can retry within 48 h.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(): Promise<CryptoKey> {
  const seed = Deno.env.get("CARD_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!seed) throw new Error("Missing key material");
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(seed), { name: "HKDF" }, false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode("nivra-card-encryption-v1"),
      info: enc.encode("aes-256-gcm"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function decryptCard(ciphertextB64: string, ivB64: string, tagB64: string): Promise<string> {
  const key = await deriveKey();
  const ct = fromB64(ciphertextB64);
  const tag = fromB64(tagB64);
  const iv = fromB64(ivB64);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct, 0);
  combined.set(tag, ct.length);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  return dec.decode(buf);
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");
  const auth = btoa(`${clientId}:${clientSecret}`);
  const r = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("PayPal token failed");
  const d = await r.json();
  return d.access_token as string;
}

function expiryToPayPal(expiry: string): string {
  // "MM/YY" -> "20YY-MM"
  const [mm, yy] = expiry.split("/");
  return `20${yy}-${mm}`;
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
    const adminId = userData?.user?.id;
    if (!adminId) return new Response(JSON.stringify({ error: "Auth invalide" }), { status: 401, headers });

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify admin role
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: adminId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Réservé aux administrateurs" }), { status: 403, headers });
    }

    const body = await req.json();
    const cardIntentId: string | undefined = body.card_intent_id;
    if (!cardIntentId) {
      return new Response(JSON.stringify({ error: "card_intent_id requis" }), { status: 400, headers });
    }

    // Load card intent
    const { data: cpi, error: cpiErr } = await admin
      .from("card_payment_intents")
      .select("*")
      .eq("id", cardIntentId)
      .maybeSingle();
    if (cpiErr || !cpi) {
      return new Response(JSON.stringify({ error: "Intention de paiement introuvable" }), { status: 404, headers });
    }
    if (cpi.status === "processed") {
      return new Response(JSON.stringify({ error: "Déjà traitée" }), { status: 409, headers });
    }
    if (new Date(cpi.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Données expirées (48 h dépassées)" }), { status: 410, headers });
    }

    // Decrypt card number
    let cardNumber = "";
    try {
      cardNumber = await decryptCard(cpi.encrypted_card_number, cpi.encryption_iv, cpi.encryption_auth_tag);
    } catch (e) {
      console.error("[core-process-card-payment] decrypt failed", e);
      return new Response(JSON.stringify({ error: "Déchiffrement impossible" }), { status: 500, headers });
    }

    // Mark as processing (best effort)
    await admin.from("card_payment_intents")
      .update({ status: "processing", processed_by: adminId })
      .eq("id", cardIntentId);

    // Create + capture PayPal order with card
    const accessToken = await getPayPalAccessToken();
    const amount = Number(cpi.amount).toFixed(2);
    const ppRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `cpi-${cardIntentId}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: cpi.order_reference,
          amount: { currency_code: cpi.currency || "CAD", value: amount },
        }],
        payment_source: {
          card: {
            number: cardNumber,
            expiry: expiryToPayPal(cpi.card_expiry),
            name: cpi.card_name,
            security_code: undefined, // CVV is not retrievable (bcrypt-hashed only)
          },
        },
      }),
    });

    const ppJson = await ppRes.json();
    // Wipe plaintext from memory ASAP
    cardNumber = "";

    const paypalOrderId = ppJson?.id;
    const status = ppJson?.status;
    const captureStatus = ppJson?.purchase_units?.[0]?.payments?.captures?.[0]?.status;

    if (!ppRes.ok || (status !== "COMPLETED" && captureStatus !== "COMPLETED")) {
      const reason =
        ppJson?.details?.[0]?.description ||
        ppJson?.message ||
        "Paiement refusé par PayPal";
      console.error("[core-process-card-payment] PayPal rejected", ppJson);
      await admin.from("card_payment_intents")
        .update({ status: "pending_processing" })
        .eq("id", cardIntentId);
      return new Response(JSON.stringify({ error: reason, paypal: ppJson }), { status: 402, headers });
    }

    // Mark field_payment_intent as paid → invoke field-order-engine to materialize
    if (cpi.field_payment_intent_id) {
      await admin.from("field_payment_intents")
        .update({ status: "paid", paid_at: new Date().toISOString(), paypal_order_id: paypalOrderId })
        .eq("id", cpi.field_payment_intent_id);
    }

    // Materialize the order/invoice/commission via the canonical engine.
    // The field-order-engine "finalize" route accepts the field_payment_intent_id
    // and creates the order in Core (payment_method = 'card_manual').
    let resultOrderId: string | null = null;
    const finRes = await admin.functions.invoke("field-order-engine", {
      body: {
        action: "finalize_paid_intent",
        field_payment_intent_id: cpi.field_payment_intent_id,
        paypal_order_id: paypalOrderId,
        payment_method: "card_manual",
        processed_by: adminId,
      },
    });
    if (finRes.error || !(finRes.data as any)?.order_id) {
      console.error("[core-process-card-payment] finalize failed", finRes.error, finRes.data);
      await admin.from("card_payment_intents")
        .update({ status: "pending_processing" })
        .eq("id", cardIntentId);
      throw new Error((finRes.error as any)?.message || (finRes.data as any)?.error || "Paiement capturé, mais création de commande Core échouée");
    }
    resultOrderId = (finRes.data as any).order_id;

    // SECURITY: delete the card intent row (plaintext-derivable data gone).
    await admin.from("card_payment_intents").delete().eq("id", cardIntentId);

    return new Response(JSON.stringify({
      success: true,
      paypal_order_id: paypalOrderId,
      capture_status: captureStatus || status,
      order_id: resultOrderId,
    }), { headers });
  } catch (err: any) {
    console.error("[core-process-card-payment] error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
