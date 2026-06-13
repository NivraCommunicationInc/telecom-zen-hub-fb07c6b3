/**
 * lookup-phone-carrier
 *
 * Given a Canadian phone number, returns:
 *   - valid (boolean)
 *   - carrier (string) — detected carrier name
 *   - carrier_normalized (string) — mapped to Nivra dropdown value
 *   - line_type ("mobile" | "fixed_line" | "voip" | "toll_free" | unknown)
 *   - location (province/city string)
 *   - portable (boolean) — eligible for port-in
 *   - area_code_supported (boolean) — in Nivra's supported area codes
 *   - formatted (string) — formatted local number
 *
 * Requires env var: NUMVERIFY_API_KEY
 * Falls back to format-only validation if key is missing.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Supported Nivra area codes (Quebec + some Ontario)
const SUPPORTED_AREA_CODES = new Set([
  "514", "438", "418", "450", "579", "819", "367", "263", "354", "468",
  "613", "343", "705", "249", "416", "647", "437",
]);

// Map Numverify carrier names → Nivra checkout dropdown values
const CARRIER_MAP: Record<string, string> = {
  "bell": "Bell",
  "rogers": "Rogers",
  "telus": "Telus",
  "fido": "Fido",
  "koodo": "Koodo",
  "vidéotron": "Vidéotron",
  "videotron": "Vidéotron",
  "fizz": "Fizz",
  "public mobile": "Public Mobile",
  "freedom": "Freedom Mobile",
  "shaw": "Freedom Mobile",
  "wind": "Freedom Mobile",
  "eastlink": "Eastlink",
  "virgin": "Bell",
  "lucky": "Rogers",
  "chatr": "Rogers",
};

function normalizeCarrier(raw: string): string {
  if (!raw) return "Autre";
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(CARRIER_MAP)) {
    if (lower.includes(key)) return val;
  }
  return raw; // keep original if no match
}

function stripPhone(p: string): string {
  return p.replace(/\D/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone_number } = await req.json();
    const digits = stripPhone(String(phone_number || ""));

    if (digits.length < 10) {
      return new Response(
        JSON.stringify({ valid: false, error: "Numéro trop court" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalize to 10-digit local or 11-digit with country code
    const local = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits.slice(-10);
    const areaCode = local.slice(0, 3);
    const formatted = `(${areaCode}) ${local.slice(3, 6)}-${local.slice(6)}`;
    const e164 = `+1${local}`;
    const areaCodeSupported = SUPPORTED_AREA_CODES.has(areaCode);

    const apiKey = Deno.env.get("NUMVERIFY_API_KEY");

    // No API key — return format-only result
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          valid: true,
          carrier: null,
          carrier_normalized: null,
          line_type: null,
          location: null,
          portable: true,
          area_code_supported: areaCodeSupported,
          formatted,
          e164,
          source: "format_only",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call Numverify — use HTTPS (works on free tier too)
    const url = `https://apilayer.net/api/validate?access_key=${apiKey}&number=${encodeURIComponent(e164)}&country_code=CA&format=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let resp: Response;
    try {
      resp = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      throw new Error(`Numverify HTTP ${resp.status}`);
    }

    const data = await resp.json();

    if (data.error) {
      // API quota exceeded or invalid key — fallback gracefully
      console.warn("[lookup-phone-carrier] Numverify error:", data.error);
      return new Response(
        JSON.stringify({
          valid: true,
          carrier: null,
          carrier_normalized: null,
          line_type: null,
          location: null,
          portable: true,
          area_code_supported: areaCodeSupported,
          formatted,
          e164,
          source: "format_only",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lineType: string = data.line_type || "unknown";
    const portable = data.valid === true && !["toll_free", "premium_rate", "unknown"].includes(lineType);
    const carrierRaw: string = data.carrier || "";
    const carrierNormalized = normalizeCarrier(carrierRaw);

    return new Response(
      JSON.stringify({
        valid: data.valid === true,
        carrier: carrierRaw || null,
        carrier_normalized: carrierRaw ? carrierNormalized : null,
        line_type: lineType,
        location: data.location || null,
        portable,
        area_code_supported: areaCodeSupported,
        formatted,
        e164,
        source: "numverify",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[lookup-phone-carrier]", msg);
    return new Response(
      JSON.stringify({ valid: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
