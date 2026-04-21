import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createNivraPayPalSubscription } from "../_shared/nivraPayPalSubscriptionFactory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateSubscriptionRequest {
  billing_subscription_id?: string;
  customer_email?: string;
  customer_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const body: CreateSubscriptionRequest = await req.json();
    const billingSubscriptionId = body.billing_subscription_id?.trim();

    if (!billingSubscriptionId) {
      return new Response(
        JSON.stringify({ error: "billing_subscription_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscription, error: subscriptionError } = await adminSupabase
      .from("billing_subscriptions")
      .select(`
        id,
        customer_id,
        order_id,
        last_invoice_id,
        plan_code,
        plan_name,
        plan_price,
        status,
        paypal_subscription_id,
        recurring_setup_status,
        customer:billing_customers(id, email, first_name, last_name, phone, user_id)
      `)
      .eq("id", billingSubscriptionId)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      throw new Error("Abonnement introuvable");
    }

    const customer = Array.isArray(subscription.customer) ? subscription.customer[0] : subscription.customer;

    if (!customer || customer.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Accès refusé à cet abonnement" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (subscription.paypal_subscription_id) {
      return new Response(
        JSON.stringify({
          error: "Un paiement pré-autorisé PayPal existe déjà pour cet abonnement",
          paypal_subscription_id: subscription.paypal_subscription_id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscription.order_id) {
      throw new Error("Aucune commande liée à cet abonnement");
    }

    const { data: order, error: orderError } = await adminSupabase
      .from("orders")
      .select("id, order_number, account_id")
      .eq("id", subscription.order_id)
      .maybeSingle();

    if (orderError || !order) {
      throw new Error("Commande introuvable pour cet abonnement");
    }

    if (!order.account_id) {
      throw new Error("Compte client introuvable pour cet abonnement");
    }

    let invoiceId = subscription.last_invoice_id as string | null;

    if (!invoiceId) {
      const { data: invoice } = await adminSupabase
        .from("billing_invoices")
        .select("id")
        .eq("order_id", subscription.order_id)
        .eq("customer_id", subscription.customer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      invoiceId = invoice?.id ?? null;
    }

    if (!invoiceId) {
      throw new Error("Aucune facture liée n'a été trouvée pour activer le pré-autorisé");
    }

    const fallbackName = (body.customer_name || "Client Nivra").trim();
    const [fallbackFirstName, ...fallbackLastNameParts] = fallbackName.split(/\s+/).filter(Boolean);
    const customerFirstName = customer.first_name?.trim() || fallbackFirstName || "Client";
    const customerLastName = customer.last_name?.trim() || fallbackLastNameParts.join(" ") || "Nivra";
    const customerEmail = customer.email?.trim() || body.customer_email?.trim() || String(claimsData.claims.email || "").trim();

    if (!customerEmail) {
      throw new Error("Adresse courriel client introuvable");
    }

    const result = await createNivraPayPalSubscription({
      supabase: adminSupabase,
      customer_id: subscription.customer_id,
      customer_email: customerEmail,
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_phone: customer.phone?.trim() || "",
      order_id: subscription.order_id,
      order_number: String(order.order_number || subscription.id),
      account_id: order.account_id,
      invoice_id: invoiceId,
      recurring_monthly_total: Number(subscription.plan_price),
      plan_label: subscription.plan_name,
      plan_code: subscription.plan_code,
      nivra_subscription_id: subscription.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paypal_subscription_id: result.paypal_subscription_id,
        paypal_plan_id: result.paypal_plan_id,
        approval_url: result.approval_url,
        recurring_setup_status: result.recurring_setup_status,
        plan_reused: result.plan_reused,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[PayPal] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
