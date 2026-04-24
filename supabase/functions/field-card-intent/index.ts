/**
 * field-card-intent — FIX 2
 *
 * Receives raw card data from a field agent, encrypts the card number with
 * AES-256-GCM, hashes the CVV with bcrypt, and stores the row in
 * `card_payment_intents`. The plaintext card number and CVV are NEVER
 * persisted and are only held in memory for the duration of this request.
 *
 * Encryption key:
 *   Derived from SUPABASE_SERVICE_ROLE_KEY (HKDF-SHA256). This is acceptable
 *   for an interim solution; for production we recommend dedicating a
 *   CARD_ENCRYPTION_KEY secret managed through key rotation.
 *
 * Body:
 *   { quote_id, amount, card_number, card_name, card_expiry, cvv,
 *     customer_email?, customer_name? }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import * as bcrypt from "npm:bcryptjs@2.4.3";

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

async function encryptCard(plain: string): Promise<{ ciphertext: string; iv: string; tag: string }> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  // WebCrypto AES-GCM concatenates ciphertext|tag — split last 16 bytes as tag.
  const u8 = new Uint8Array(buf);
  const tag = u8.slice(u8.length - 16);
  const ct = u8.slice(0, u8.length - 16);
  return { ciphertext: b64(ct), iv: b64(iv), tag: b64(tag) };
}

function detectBrand(num: string): string {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]|^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6011|^65|^64[4-9]/.test(n)) return "discover";
  return "unknown";
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
    const agentId = userData?.user?.id;
    if (!agentId) return new Response(JSON.stringify({ error: "Auth invalide" }), { status: 401, headers });

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const cardNumber: string = String(body.card_number || "").replace(/\s+/g, "");
    const cardName: string = String(body.card_name || "").trim();
    const cardExpiry: string = String(body.card_expiry || "").trim();
    const cvv: string = String(body.cvv || "").trim();
    const amount = Number(body.amount);
    const quoteId: string | undefined = body.quote_id;

    // Validation
    if (!quoteId) return new Response(JSON.stringify({ error: "quote_id requis" }), { status: 400, headers });
    if (!luhn(cardNumber)) return new Response(JSON.stringify({ error: "Numéro de carte invalide" }), { status: 400, headers });
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return new Response(JSON.stringify({ error: "Date d'expiration invalide (MM/YY)" }), { status: 400, headers });
    if (!/^\d{3,4}$/.test(cvv)) return new Response(JSON.stringify({ error: "CVV invalide" }), { status: 400, headers });
    if (!cardName) return new Response(JSON.stringify({ error: "Nom sur la carte requis" }), { status: 400, headers });
    if (!Number.isFinite(amount) || amount <= 0) return new Response(JSON.stringify({ error: "Montant invalide" }), { status: 400, headers });

    // Verify quote ownership
    const { data: quote } = await admin
      .from("field_quotes").select("id, agent_id").eq("id", quoteId).maybeSingle();
    if (!quote || quote.agent_id !== agentId) {
      return new Response(JSON.stringify({ error: "Soumission introuvable" }), { status: 404, headers });
    }

    // Create the field_payment_intent (so admin sees the order in the same place)
    const { data: fpi, error: fpiErr } = await admin
      .from("field_payment_intents")
      .insert({
        quote_id: quoteId,
        agent_id: agentId,
        amount: Number(amount.toFixed(2)),
        currency: "CAD",
        status: "pending",
        payment_method: "card_manual",
        customer_email: body.customer_email ?? null,
        customer_name: body.customer_name ?? null,
      })
      .select("id")
      .single();
    if (fpiErr || !fpi) throw fpiErr ?? new Error("Intent creation failed");

    // Encrypt card data
    const { ciphertext, iv, tag } = await encryptCard(cardNumber);
    const cvvHash = await bcrypt.hash(cvv, 10);
    const last4 = cardNumber.slice(-4);

    const { data: cpi, error: cpiErr } = await admin
      .from("card_payment_intents")
      .insert({
        order_reference: quoteId,
        agent_id: agentId,
        field_payment_intent_id: fpi.id,
        encrypted_card_number: ciphertext,
        encryption_iv: iv,
        encryption_auth_tag: tag,
        card_last4: last4,
        card_brand: detectBrand(cardNumber),
        card_expiry: cardExpiry,
        card_name: cardName,
        cvv_hash: cvvHash,
        amount: Number(amount.toFixed(2)),
        currency: "CAD",
        customer_email: body.customer_email ?? null,
        customer_name: body.customer_name ?? null,
        status: "pending_processing",
      })
      .select("id, card_last4, card_brand")
      .single();
    if (cpiErr || !cpi) throw cpiErr ?? new Error("Card intent creation failed");

    return new Response(JSON.stringify({
      success: true,
      intent_id: fpi.id,
      card_intent_id: cpi.id,
      card_last4: cpi.card_last4,
      card_brand: cpi.card_brand,
    }), { headers });
  } catch (err: any) {
    console.error("[field-card-intent] error", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers },
    );
  }
});
