import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";
import { activateSubscriptionForOrder } from "../_shared/activateSubscriptionForOrder.ts";

/**
 * RETRY SUBSCRIPTION ACTIVATION
 * 
 * Admin-only endpoint to retry subscription creation for orders
 * that were captured but missed the subscription activation step.
 * 
 * Body: { invoice_id, stripe_customer_id?, payment_method_id? }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin auth - accepts JWT or service-role key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");
    
    const token = authHeader.replace("Bearer ", "");
    
    // Try user auth first
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    
    if (!authErr && userData.user) {
      // Verify admin/staff role
      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!adminUser) {
        const { data: staffUser } = await supabase
          .from("staff_users")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (!staffUser) throw new Error("Admin or staff access required");
      }
      console.log("[retry-sub] Authenticated as admin/staff user");
    } else {
      // Service role key auth — compare token directly
      const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!srk || token !== srk) {
        throw new Error("Authentication failed — invalid token");
      }
      console.log("[retry-sub] Service role invocation — admin bypass");
    }

    const body = await req.json();
    const { invoice_id, stripe_customer_id, payment_method_id } = body;

    if (!invoice_id) throw new Error("invoice_id is required");

    const stripeKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // If no PM provided, try to extract from the most recent payment for this invoice
    let resolvedPM = payment_method_id;
    let resolvedCustomer = stripe_customer_id;

    if (!resolvedPM || !resolvedCustomer) {
      const { data: payment } = await supabase
        .from("billing_payments")
        .select("stripe_payment_intent_id, provider_payment_id")
        .eq("invoice_id", invoice_id)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (payment?.stripe_payment_intent_id) {
        try {
          const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
          if (!resolvedPM && pi.payment_method) {
            resolvedPM = typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method as any).id;
          }
          if (!resolvedCustomer && pi.customer) {
            resolvedCustomer = typeof pi.customer === "string" ? pi.customer : (pi.customer as any).id;
          }
        } catch (e: any) {
          console.warn(`[retry-sub] Could not retrieve PI: ${e.message}`);
        }
      }
    }

    console.log(`[retry-sub] Retrying for invoice=${invoice_id}, customer=${resolvedCustomer}, pm=${resolvedPM}`);

    const result = await activateSubscriptionForOrder({
      stripe,
      supabase,
      invoice_id,
      payment_method_id: resolvedPM,
      stripe_customer_id: resolvedCustomer,
      trigger_source: "admin_retry",
    });

    console.log(`[retry-sub] Result: ${JSON.stringify(result)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[retry-sub] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
