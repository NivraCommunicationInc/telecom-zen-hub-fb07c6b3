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

/** Minimum amount used when plan_price is 0/unknown — actual charge happens at next renewal. */
const MIN_RECURRING_AMOUNT = 1.0;

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
    // ─────────────────────────────────────────────────────────────────────
    // FIX 1 — AUTHENTICATION (the only hard gate before PayPal call).
    // ─────────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentification requise", code: "AUTH_REQUIRED" }),
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
        JSON.stringify({ success: false, error: "Session invalide", code: "INVALID_SESSION" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    userId = claimsData.claims.sub as string;

    const body: CreateSubscriptionRequest = await req.json().catch(() => ({} as CreateSubscriptionRequest));
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    // ─────────────────────────────────────────────────────────────────────
    // Resolve the customer's existing subscription if present.
    // Never block enrollment because a subscription/order/invoice is missing.
    // ─────────────────────────────────────────────────────────────────────
    let billingSubscriptionId = body.billing_subscription_id?.trim() || "";

    const { data: customer } = await adminSupabase
      .from("billing_customers")
      .select("id, email, first_name, last_name, phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (!billingSubscriptionId && customer) {
      const { data: candidate } = await adminSupabase
        .from("billing_subscriptions")
        .select("id, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (candidate?.id) {
        billingSubscriptionId = candidate.id;
      }
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
      const { data: created } = await adminSupabase
        .from("paypal_autopay_attempts")
        .insert({
          user_id: userId,
          billing_subscription_id: billingSubscriptionId,
          status: "started",
          current_step: "click",
          ip_address: ipAddress,
          user_agent: userAgent,
          steps: [{ step: "click", status: "ok", at: new Date().toISOString() }],
        })
        .select("id")
        .single();
      if (created) attemptId = created.id;
    }

    // ═══ Load customer's latest subscription if available; otherwise use placeholder context ═══
    await appendStep(adminSupabase, attemptId!, "load_subscription", "info");

    let subscription: any = null;
    if (billingSubscriptionId) {
      const { data } = await adminSupabase
        .from("billing_subscriptions")
        .select(
          `id, customer_id, order_id, last_invoice_id, plan_code, plan_name, plan_price,
           paypal_subscription_id, recurring_setup_status, next_renewal_at, cycle_end_date`,
        )
        .eq("id", billingSubscriptionId)
        .maybeSingle();
      subscription = data ?? null;
    }

    if (!customer) {
      const fallbackName = (body.customer_name || String(claimsData.claims.email || "Client")).trim();
      const [firstName, ...lastNameParts] = fallbackName.split(/\s+/).filter(Boolean);
      const customerEmail = body.customer_email?.trim() || String(claimsData.claims.email || "").trim();

      if (!customerEmail) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Adresse courriel introuvable sur votre compte.",
            code: "MISSING_EMAIL",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: createdCustomer, error: createCustomerError } = await adminSupabase
        .from("billing_customers")
        .insert({
          user_id: userId,
          email: customerEmail,
          first_name: firstName || "Client",
          last_name: lastNameParts.join(" ") || "Nivra",
          phone: "",
          status: "active",
        })
        .select("id, email, first_name, last_name, phone")
        .single();

      if (createCustomerError) throw createCustomerError;

      if (!subscription) {
        const { data: createdSubscription, error: createSubscriptionError } = await adminSupabase
          .from("billing_subscriptions")
          .insert({
            customer_id: createdCustomer.id,
            plan_code: "PAYPAL_PREAUTH",
            plan_name: "Paiement pré-autorisé",
            plan_price: 0,
            status: "pending",
            auto_billing_enabled: false,
          })
          .select(
            "id, customer_id, order_id, last_invoice_id, plan_code, plan_name, plan_price, paypal_subscription_id, recurring_setup_status, next_renewal_at, cycle_end_date",
          )
          .single();

        if (createSubscriptionError) throw createSubscriptionError;
        subscription = createdSubscription;
        billingSubscriptionId = createdSubscription.id;
      }
    }

    const effectiveCustomer = customer ?? {
      id: subscription?.customer_id,
      email: body.customer_email?.trim() || String(claimsData.claims.email || "").trim(),
      first_name: "Client",
      last_name: "Nivra",
      phone: "",
    };

    // ─────────────────────────────────────────────────────────────────────
    // FIX 5 — Double-enrollment guard. Returns 200 + ALREADY_ENROLLED.
    // ─────────────────────────────────────────────────────────────────────
    if (subscription?.paypal_subscription_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Le paiement automatique est déjà actif sur votre compte.",
          code: "ALREADY_ENROLLED",
          paypal_subscription_id: subscription.paypal_subscription_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // FIX 4 — Order/invoice are best-effort. We DO NOT block if missing.
    // ─────────────────────────────────────────────────────────────────────
    let orderId: string | null = subscription?.order_id ?? null;
    let orderNumber: string = subscription?.id || billingSubscriptionId || crypto.randomUUID();
    let accountId: string | null = null;

    if (orderId) {
      const { data: order } = await adminSupabase
        .from("orders")
        .select("id, order_number, account_id")
        .eq("id", orderId)
        .maybeSingle();
      if (order) {
        orderNumber = String(order.order_number || subscription.id);
        accountId = order.account_id || null;
      }
    }

    // Fallback: derive account_id from the customer's most recent account.
    if (!accountId) {
      const { data: account } = await adminSupabase
        .from("accounts")
        .select("id")
        .eq("client_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      accountId = account?.id ?? null;
    }

    if (!accountId) {
      accountId = subscription?.id || billingSubscriptionId || userId;
    }

    // Best-effort invoice lookup — do not block if missing.
    let invoiceId: string | null = (subscription?.last_invoice_id as string | null) ?? null;
    if (!invoiceId && orderId) {
      const { data: invoice } = await adminSupabase
        .from("billing_invoices")
        .select("id")
        .eq("order_id", orderId)
        .eq("customer_id", subscription.customer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invoiceId = invoice?.id ?? null;
    }
    if (!invoiceId) {
      // Fallback: most recent invoice for this customer (any).
      const { data: invoice } = await adminSupabase
        .from("billing_invoices")
        .select("id")
        .eq("customer_id", subscription.customer_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      invoiceId = invoice?.id ?? null;
    }

    const nextBillingAnchor =
      (subscription as any)?.next_renewal_at ||
      ((subscription as any)?.cycle_end_date
        ? new Date(`${(subscription as any).cycle_end_date}T00:00:00.000Z`).toISOString()
        : null);

    await adminSupabase
      .from("paypal_autopay_attempts")
      .update({
        customer_id: subscription.customer_id,
        billing_subscription_id: subscription.id,
      })
      .eq("id", attemptId!);

    const fallbackName = (body.customer_name || "Client Nivra").trim();
    const [fallbackFirstName, ...fallbackLastNameParts] = fallbackName.split(/\s+/).filter(Boolean);
    const customerFirstName = effectiveCustomer.first_name?.trim() || fallbackFirstName || "Client";
    const customerLastName = effectiveCustomer.last_name?.trim() || fallbackLastNameParts.join(" ") || "Nivra";
    const customerEmail =
      effectiveCustomer.email?.trim() || body.customer_email?.trim() || String(claimsData.claims.email || "").trim();

    if (!customerEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Adresse courriel introuvable sur votre compte.",
          code: "MISSING_EMAIL",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // FIX 2 — Plan price fallback. If 0/unknown, use $1.00 placeholder.
    // The actual charge is determined by the invoice generated each cycle.
    // ─────────────────────────────────────────────────────────────────────
    const rawPrice = Number(subscription?.plan_price || 0);
    const recurringAmount = rawPrice > 0 ? rawPrice : MIN_RECURRING_AMOUNT;

    await appendStep(adminSupabase, attemptId!, "create_paypal_subscription", "info", {
      recurringAmount,
      planPriceProvided: rawPrice,
    });

    const result = await createNivraPayPalSubscription({
      supabase: adminSupabase,
      customer_id: subscription.customer_id,
      customer_email: customerEmail,
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_phone: effectiveCustomer.phone?.trim() || "",
      order_id: orderId || subscription.id,
      order_number: orderNumber,
      account_id: accountId,
      invoice_id: invoiceId || subscription.id,
      subscription_start_time: nextBillingAnchor || undefined,
      recurring_monthly_total: recurringAmount,
      plan_label: subscription.plan_name || "Nivra Telecom",
      plan_code: subscription.plan_code || "NIVRA",
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    // Always 200 — the client maps `code` to a friendly message.
    return new Response(
      JSON.stringify({
        success: false,
        error: "Impossible de créer l'autorisation PayPal. Veuillez réessayer ou contacter le support.",
        code: "PAYPAL_CREATE_FAILED",
        debug_id: debugId,
        attempt_id: attemptId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
