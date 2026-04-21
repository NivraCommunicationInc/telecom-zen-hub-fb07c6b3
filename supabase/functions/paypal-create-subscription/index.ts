import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createNivraPayPalSubscription } from "../_shared/nivraPayPalSubscriptionFactory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateSubscriptionRequest {
  billing_subscription_id?: string;
  customer_email?: string;
  customer_name?: string;
  attempt_id?: string; // Optional — for retry from existing attempt
}

/**
 * Append a step to a paypal_autopay_attempts row (best-effort, never throws).
 */
async function appendStep(
  admin: ReturnType<typeof createClient>,
  attemptId: string,
  step: string,
  status: "ok" | "error" | "info",
  details?: Record<string, unknown>,
) {
  try {
    const { data: row } = await admin
      .from("paypal_autopay_attempts")
      .select("steps")
      .eq("id", attemptId)
      .maybeSingle();
    const steps = Array.isArray((row as any)?.steps) ? (row as any).steps : [];
    steps.push({ step, status, at: new Date().toISOString(), ...details });
    await admin
      .from("paypal_autopay_attempts")
      .update({ current_step: step, steps })
      .eq("id", attemptId);
  } catch (e) {
    console.error("[appendStep] non-blocking failure:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

  let attemptId: string | null = null;
  let userId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentification requise", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Session invalide", code: "INVALID_SESSION" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    userId = claimsData.claims.sub as string;

    const body: CreateSubscriptionRequest = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    // ═══ Server-side eligibility check (Nivra Core source of truth) ═══
    const { data: elig, error: eligError } = await adminSupabase.rpc("check_autopay_eligibility", {
      target_user_id: userId,
    });
    if (eligError) {
      console.error("[paypal-create-subscription] eligibility check failed:", eligError);
    }
    const eligibility = (elig as any) || {};
    if (!eligibility.eligible) {
      return new Response(
        JSON.stringify({
          error: "Non éligible au paiement pré-autorisé",
          code: "NOT_ELIGIBLE",
          reason: eligibility.reason || "unknown",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const billingSubscriptionId =
      body.billing_subscription_id?.trim() || (eligibility.subscription_id as string);

    if (!billingSubscriptionId) {
      return new Response(
        JSON.stringify({ error: "billing_subscription_id requis", code: "MISSING_SUB_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ═══ Create or reuse attempt log ═══
    if (body.attempt_id) {
      attemptId = body.attempt_id;
      await adminSupabase
        .from("paypal_autopay_attempts")
        .update({
          status: "started",
          current_step: "retry",
          error_message: null,
          paypal_debug_id: null,
          completed_at: null,
        })
        .eq("id", attemptId)
        .eq("user_id", userId);
      await appendStep(adminSupabase, attemptId!, "retry", "info", { billingSubscriptionId });
    } else {
      const { data: created, error: createErr } = await adminSupabase
        .from("paypal_autopay_attempts")
        .insert({
          user_id: userId,
          billing_subscription_id: billingSubscriptionId,
          status: "started",
          current_step: "click",
          ip_address: ipAddress,
          user_agent: userAgent,
          steps: [
            { step: "click", status: "ok", at: new Date().toISOString() },
          ],
        })
        .select("id")
        .single();
      if (!createErr && created) attemptId = created.id;
    }

    // ═══ Load subscription + customer ═══
    await appendStep(adminSupabase, attemptId!, "load_subscription", "info");

    const { data: subscription, error: subscriptionError } = await adminSupabase
      .from("billing_subscriptions")
      .select(
        `id, customer_id, order_id, last_invoice_id, plan_code, plan_name, plan_price, status,
         paypal_subscription_id, recurring_setup_status,
         customer:billing_customers(id, email, first_name, last_name, phone, user_id)`,
      )
      .eq("id", billingSubscriptionId)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      throw new Error("Abonnement introuvable");
    }

    const customer = Array.isArray(subscription.customer) ? subscription.customer[0] : subscription.customer;

    if (!customer || customer.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Accès refusé à cet abonnement", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (subscription.paypal_subscription_id) {
      return new Response(
        JSON.stringify({
          error: "Un paiement pré-autorisé PayPal existe déjà pour cet abonnement",
          code: "ALREADY_ENROLLED",
          paypal_subscription_id: subscription.paypal_subscription_id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!subscription.order_id) throw new Error("Aucune commande liée à cet abonnement");

    const { data: order, error: orderError } = await adminSupabase
      .from("orders")
      .select("id, order_number, account_id")
      .eq("id", subscription.order_id)
      .maybeSingle();

    if (orderError || !order) throw new Error("Commande introuvable pour cet abonnement");
    if (!order.account_id) throw new Error("Compte client introuvable pour cet abonnement");

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
    if (!invoiceId) throw new Error("Aucune facture liée n'a été trouvée pour activer le pré-autorisé");

    await adminSupabase
      .from("paypal_autopay_attempts")
      .update({
        customer_id: subscription.customer_id,
        billing_subscription_id: subscription.id,
      })
      .eq("id", attemptId!);

    const fallbackName = (body.customer_name || "Client Nivra").trim();
    const [fallbackFirstName, ...fallbackLastNameParts] = fallbackName.split(/\s+/).filter(Boolean);
    const customerFirstName = customer.first_name?.trim() || fallbackFirstName || "Client";
    const customerLastName = customer.last_name?.trim() || fallbackLastNameParts.join(" ") || "Nivra";
    const customerEmail =
      customer.email?.trim() || body.customer_email?.trim() || String(claimsData.claims.email || "").trim();

    if (!customerEmail) throw new Error("Adresse courriel client introuvable");

    await appendStep(adminSupabase, attemptId!, "create_paypal_subscription", "info");

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

    await adminSupabase
      .from("paypal_autopay_attempts")
      .update({
        status: "awaiting_approval",
        current_step: "redirected",
        paypal_subscription_id: result.paypal_subscription_id,
        paypal_plan_id: result.paypal_plan_id,
        approval_url: result.approval_url,
      })
      .eq("id", attemptId!);
    await appendStep(adminSupabase, attemptId!, "redirected", "ok", {
      paypal_subscription_id: result.paypal_subscription_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        attempt_id: attemptId,
        paypal_subscription_id: result.paypal_subscription_id,
        paypal_plan_id: result.paypal_plan_id,
        approval_url: result.approval_url,
        recurring_setup_status: result.recurring_setup_status,
        plan_reused: result.plan_reused,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[PayPal] Error:", errMsg);

    // Try to extract PayPal debug_id from error message
    let debugId: string | null = null;
    const debugMatch = errMsg.match(/"debug_id":"([^"]+)"/);
    if (debugMatch) debugId = debugMatch[1];

    if (attemptId) {
      try {
        await adminSupabase
          .from("paypal_autopay_attempts")
          .update({
            status: "failed",
            current_step: "error",
            error_message: errMsg,
            paypal_debug_id: debugId,
            completed_at: new Date().toISOString(),
          })
          .eq("id", attemptId);
        await appendStep(adminSupabase, attemptId, "error", "error", { debugId, errMsg });
      } catch (logErr) {
        console.error("[PayPal] failed to log attempt error:", logErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: errMsg,
        code: "PAYPAL_CREATE_FAILED",
        debug_id: debugId,
        attempt_id: attemptId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
