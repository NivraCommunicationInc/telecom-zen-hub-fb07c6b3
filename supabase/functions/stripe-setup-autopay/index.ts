import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * ============================================================================
 * STRIPE — SETUP AUTOPAY (SetupIntent for recurring card payments)
 * ============================================================================
 *
 * Creates a Stripe SetupIntent for securely collecting and saving
 * a payment method for preauthorized monthly charges.
 *
 * ACTIONS:
 * - create_setup: Create SetupIntent + return client_secret
 * - confirm_enrollment: After frontend confirms, save PM to customer
 * - disable: Remove autopay enrollment
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

  // ═══ STRIPE KILL-SWITCH — 2026-03-21 ═══
  console.warn("[stripe-setup-autopay] BLOCKED — Stripe disabled in production");
  return new Response(
    JSON.stringify({ error: "Stripe autopay setup is disabled. Use PayPal instead." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization required");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) throw new Error("Authentication failed");

    const body = await req.json();
    const { action, customer_id } = body;
    const userId = userData.user.id;
    const userEmail = userData.user.email;

    if (!action) throw new Error("action is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ─── CREATE SETUP INTENT ───
    if (action === "create_setup") {
      if (!customer_id) throw new Error("customer_id is required");

      // Get billing customer
      const { data: billingCustomer } = await supabase
        .from("billing_customers")
        .select("id, email, first_name, last_name, stripe_customer_id")
        .eq("id", customer_id)
        .single();

      if (!billingCustomer) throw new Error("Billing customer not found");

      // Find or create Stripe customer
      let stripeCustomerId = billingCustomer.stripe_customer_id;

      if (!stripeCustomerId) {
        const customers = await stripe.customers.list({ email: billingCustomer.email, limit: 1 });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        } else {
          const newCustomer = await stripe.customers.create({
            email: billingCustomer.email,
            name: `${billingCustomer.first_name} ${billingCustomer.last_name}`.trim(),
            metadata: { nivra_customer_id: customer_id },
          });
          stripeCustomerId = newCustomer.id;
        }

        // Save Stripe customer ID
        await supabase.from("billing_customers").update({
          stripe_customer_id: stripeCustomerId,
        }).eq("id", customer_id);
      }

      // Create SetupIntent
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        metadata: {
          nivra_customer_id: customer_id,
          purpose: "autopay_enrollment",
        },
      });

      console.log(`[stripe-setup-autopay] SetupIntent created: ${setupIntent.id} for customer ${customer_id}`);

      return new Response(
        JSON.stringify({
          client_secret: setupIntent.client_secret,
          setup_intent_id: setupIntent.id,
          stripe_customer_id: stripeCustomerId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CONFIRM ENROLLMENT ───
    if (action === "confirm_enrollment") {
      if (!customer_id) throw new Error("customer_id is required");
      const { setup_intent_id } = body;
      if (!setup_intent_id) throw new Error("setup_intent_id is required");

      // Retrieve SetupIntent to get payment method
      const setupIntent = await stripe.setupIntents.retrieve(setup_intent_id);

      if (setupIntent.status !== "succeeded") {
        throw new Error(`SetupIntent status is '${setupIntent.status}', expected 'succeeded'`);
      }

      const paymentMethodId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

      if (!paymentMethodId) throw new Error("No payment method on SetupIntent");

      // Get customer's Stripe ID
      const { data: billingCustomer } = await supabase
        .from("billing_customers")
        .select("stripe_customer_id")
        .eq("id", customer_id)
        .single();

      if (!billingCustomer?.stripe_customer_id) throw new Error("No Stripe customer ID");

      // Set as default payment method
      await stripe.customers.update(billingCustomer.stripe_customer_id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Update billing_customers with autopay data
      await supabase.from("billing_customers").update({
        autopay_enabled: true,
        default_payment_method_id: paymentMethodId,
        autopay_consent_at: new Date().toISOString(),
        autopay_discount_active: true,
      }).eq("id", customer_id);

      console.log(`[stripe-setup-autopay] ✓ Autopay enrolled for customer ${customer_id}, PM ${paymentMethodId}`);

      return new Response(
        JSON.stringify({
          success: true,
          autopay_enabled: true,
          payment_method_id: paymentMethodId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── DISABLE AUTOPAY ───
    if (action === "disable") {
      if (!customer_id) throw new Error("customer_id is required");

      await supabase.from("billing_customers").update({
        autopay_enabled: false,
        autopay_discount_active: false,
        default_payment_method_id: null,
      }).eq("id", customer_id);

      console.log(`[stripe-setup-autopay] ✓ Autopay disabled for customer ${customer_id}`);

      return new Response(
        JSON.stringify({ success: true, autopay_enabled: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("[stripe-setup-autopay] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
