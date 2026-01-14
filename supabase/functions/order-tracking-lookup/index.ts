import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { withSafeErrorHandling } from "../_shared/errorUtils.ts";

type Language = "fr" | "en";

interface TrackOrderRequestBody {
  orderNumber?: string;
  email?: string;
  language?: Language;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!orderNumber || !email) {
      return new Response(
        JSON.stringify({
          error: "validation_error",
          message:
            language === "fr"
              ? "Veuillez entrer le numéro de commande et votre courriel."
              : "Please enter both order number and your email.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({
          error: "validation_error",
          message: language === "fr" ? "Courriel invalide." : "Invalid email.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit to reduce order-number enumeration risk
    const ip = getClientIp(req);
    const rate = await checkRateLimit({
      key: `order_track:${ip}`,
      maxAttempts: 12,
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
        "id, order_number, status, created_at, updated_at, service_type, shipping_address, shipping_city, total_amount, client_email"
      )
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (error) {
      throw error;
    }

    // Do not reveal whether order exists vs email mismatch
    if (!data) {
      return new Response(
        JSON.stringify({
          error: "not_found",
          message:
            language === "fr"
              ? "Aucune commande trouvée. Vérifiez le numéro de commande et le courriel."
              : "No order found. Please verify the order number and email.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderEmail = (data.client_email || "").trim().toLowerCase();
    if (orderEmail !== email) {
      return new Response(
        JSON.stringify({
          error: "not_found",
          message:
            language === "fr"
              ? "Aucune commande trouvée. Vérifiez le numéro de commande et le courriel."
              : "No order found. Please verify the order number and email.",
        }),
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
