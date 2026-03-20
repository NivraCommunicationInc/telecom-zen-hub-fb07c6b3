import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { withSafeErrorHandling } from "../_shared/errorUtils.ts";

type Language = "fr" | "en";

interface TrackOrderRequestBody {
  orderNumber?: string;
  verificationValue?: string;
  verificationType?: "phone" | "postal_code";
  language?: Language;
}

// Normalize phone: keep only digits
const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

// Normalize postal code: remove spaces and uppercase
const normalizePostalCode = (postalCode: string): string => {
  return postalCode.replace(/\s+/g, "").toUpperCase();
};

const getClientIp = (req: Request): string => {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";

  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  return "unknown";
};

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const safeError = withSafeErrorHandling("order-tracking-lookup", corsHeaders);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as TrackOrderRequestBody;
    const language: Language = body.language === "en" ? "en" : "fr";

    const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim().toUpperCase() : "";
    const verificationValue = typeof body.verificationValue === "string" ? body.verificationValue.trim() : "";
    const verificationType = body.verificationType === "postal_code" ? "postal_code" : "phone";

    if (!orderNumber || !verificationValue) {
      return new Response(
        JSON.stringify({
          error: "validation_error",
          message:
            language === "fr"
              ? "Veuillez entrer le numéro de commande et votre information de vérification."
              : "Please enter both order number and your verification information.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate based on type
    if (verificationType === "phone") {
      const digits = normalizePhone(verificationValue);
      if (digits.length < 10) {
        return new Response(
          JSON.stringify({
            error: "validation_error",
            message: language === "fr" ? "Numéro de téléphone invalide." : "Invalid phone number.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const normalized = normalizePostalCode(verificationValue);
      // Canadian postal code: A1A1A1 format
      if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalized)) {
        return new Response(
          JSON.stringify({
            error: "validation_error",
            message: language === "fr" ? "Code postal invalide." : "Invalid postal code.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Rate limit to reduce order-number enumeration risk
    const ip = getClientIp(req);
    const rate = await checkRateLimit({
      key: `order_track:${ip}`,
      maxAttempts: 10,
      windowMs: 60 * 1000,
      lockoutMs: 5 * 60 * 1000,
    });

    if (!rate.allowed) {
      return rateLimitResponse(rate, corsHeaders, language);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return safeError(new Error("Missing server configuration"), 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, created_at, updated_at, service_type, shipping_address, shipping_city, shipping_postal_code, total_amount, client_phone"
      )
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (error) {
      throw error;
    }

    // Do not reveal whether order exists vs verification mismatch
    const notFoundMsg = language === "fr"
      ? "Aucune commande trouvée. Vérifiez le numéro de commande et votre information de sécurité."
      : "No order found. Please verify the order number and your security information.";

    if (!data) {
      return new Response(
        JSON.stringify({ error: "not_found", message: notFoundMsg }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify based on type
    let isValid = false;

    if (verificationType === "phone") {
      const orderPhone = normalizePhone(data.client_phone || "");
      const inputPhone = normalizePhone(verificationValue);
      // Match last 10 digits
      isValid = orderPhone.slice(-10) === inputPhone.slice(-10) && inputPhone.length >= 10;
    } else {
      const orderPostal = normalizePostalCode(data.shipping_postal_code || "");
      const inputPostal = normalizePostalCode(verificationValue);
      isValid = orderPostal === inputPostal;
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "not_found", message: notFoundMsg }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        order: {
          id: data.id,
          order_number: data.order_number,
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
          service_type: data.service_type,
          shipping_address: data.shipping_address,
          shipping_city: data.shipping_city,
          total_amount: data.total_amount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return safeError(error);
  }
});
