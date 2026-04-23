/**
 * paypal-verify-subscription
 * ----------------------------------------------------------------------------
 * Confirme côté Nivra Core qu'une entente PayPal de paiement pré-autorisé
 * est bien active après le retour du client depuis PayPal.
 *
 * Fait:
 *  1) Appelle PayPal `GET /v1/billing/subscriptions/{id}` pour lire l'état réel.
 *  2) Met à jour `billing_subscriptions` avec le statut canonique
 *     (active / suspended / cancelled / approval_pending) + l'ID PayPal.
 *  3) Synchronise le client `billing_customers` (autopay_enabled, autopay_consent_at,
 *     autopay_discount_active) si l'entente est active.
 *  4) Logge l'opération dans `activity_logs` pour traçabilité.
 *
 * Authentification: requête authentifiée du client (Bearer token).
 * Le client ne peut vérifier qu'une subscription qui lui appartient
 * (jointure billing_customers.user_id = auth.uid()).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyRequest {
  paypal_subscription_id: string;
}

interface PayPalSubscriptionResponse {
  id: string;
  status: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
  status_update_time?: string;
  plan_id?: string;
  start_time?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { amount?: { value?: string; currency_code?: string }; time?: string };
  };
  subscriber?: { email_address?: string };
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) throw new Error("Failed to get PayPal access token");
  const data = await response.json();
  return data.access_token;
}

function mapPayPalStatusToLocal(status: PayPalSubscriptionResponse["status"]) {
  switch (status) {
    case "ACTIVE":
      return { sub_status: "active", recurring_setup_status: "active", auto_billing_enabled: true };
    case "APPROVED":
      return { sub_status: "pending", recurring_setup_status: "approved", auto_billing_enabled: true };
    case "APPROVAL_PENDING":
      return { sub_status: "pending", recurring_setup_status: "pending", auto_billing_enabled: false };
    case "SUSPENDED":
      return { sub_status: "suspended", recurring_setup_status: "suspended", auto_billing_enabled: false };
    case "CANCELLED":
    case "EXPIRED":
      return { sub_status: "cancelled", recurring_setup_status: "cancelled", auto_billing_enabled: false };
    default:
      return { sub_status: "pending", recurring_setup_status: "pending", auto_billing_enabled: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Authentification client ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // ── Validation entrée ──────────────────────────────────────────────────
    const body: VerifyRequest = await req.json();
    const paypalSubscriptionId = body?.paypal_subscription_id?.trim();
    if (!paypalSubscriptionId) {
      return new Response(
        JSON.stringify({ error: "paypal_subscription_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[PayPalVerify] User", userId, "verifying subscription", paypalSubscriptionId);

    // ── Vérification ownership ─────────────────────────────────────────────
    const { data: customer, error: custErr } = await supabase
      .from("billing_customers")
      .select("id, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (custErr || !customer) {
      return new Response(
        JSON.stringify({ error: "Aucun profil de facturation trouvé" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: localSub, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select("id, customer_id, status, plan_name")
      .eq("paypal_subscription_id", paypalSubscriptionId)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (subErr || !localSub) {
      return new Response(
        JSON.stringify({
          error: "Cette entente PayPal n'est pas associée à votre compte",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Appel API PayPal ───────────────────────────────────────────────────
    const accessToken = await getPayPalAccessToken();
    const paypalResp = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${paypalSubscriptionId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!paypalResp.ok) {
      const errText = await paypalResp.text();
      console.error("[PayPalVerify] PayPal API error:", errText);
      return new Response(
        JSON.stringify({
          error: "Impossible de joindre PayPal pour vérifier l'entente",
          details: errText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paypalSub: PayPalSubscriptionResponse = await paypalResp.json();
    const mapped = mapPayPalStatusToLocal(paypalSub.status);
    const isActive = paypalSub.status === "ACTIVE";

    console.log("[PayPalVerify] PayPal status:", paypalSub.status, "→ local:", mapped.sub_status);

    // ── Mise à jour billing_subscriptions ──────────────────────────────────
    const { error: updateSubErr } = await supabase
      .from("billing_subscriptions")
      .update({
        status: mapped.sub_status,
        recurring_setup_status: mapped.recurring_setup_status,
        auto_billing_enabled: mapped.auto_billing_enabled,
      })
      .eq("id", localSub.id);

    if (updateSubErr) {
      console.warn("[PayPalVerify] Subscription update warning:", updateSubErr);
    }

    // ── Mise à jour billing_customers (autopay) ────────────────────────────
    if (isActive) {
      const { error: updateCustErr } = await supabase
        .from("billing_customers")
        .update({
          autopay_enabled: true,
          autopay_discount_active: true,
          autopay_consent_at: new Date().toISOString(),
        })
        .eq("id", customer.id);

      if (updateCustErr) {
        console.warn("[PayPalVerify] Customer update warning:", updateCustErr);
      }

      // ── Email de confirmation au client (Violet Bold template) ───────────
      try {
        const { data: custFull } = await supabase
          .from("billing_customers")
          .select("email, first_name, last_name")
          .eq("id", customer.id)
          .maybeSingle();

        const { data: acct } = await supabase
          .from("accounts")
          .select("account_number")
          .eq("client_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const recipientEmail = custFull?.email || customer.email;
        if (recipientEmail) {
          const fullName = `${custFull?.first_name ?? ""} ${custFull?.last_name ?? ""}`.trim() || "Client";
          await supabase.from("email_queue").insert({
            event_key: `autopay_activated_${localSub.id}_${Date.now()}`,
            to_email: recipientEmail,
            template_key: "autopay_activated",
            template_vars: {
              client_name: fullName,
              first_name: custFull?.first_name ?? null,
              account_number: acct?.account_number ?? "—",
              paypal_subscription_id: paypalSubscriptionId,
              activated_at: new Date().toISOString(),
              plan_name: localSub.plan_name,
            },
            status: "queued",
            attempts: 0,
            max_attempts: 5,
          });
        }
      } catch (e) {
        console.warn("[PayPalVerify] Activation email enqueue failed:", e);
      }
    }

    // ── Audit ──────────────────────────────────────────────────────────────
    await supabase.from("activity_logs").insert({
      user_id: userId,
      entity_type: "paypal_subscription",
      entity_id: paypalSubscriptionId,
      action: isActive ? "verified_active" : "verified_inactive",
      details: {
        paypal_status: paypalSub.status,
        local_status: mapped.sub_status,
        billing_subscription_id: localSub.id,
        next_billing_time: paypalSub.billing_info?.next_billing_time ?? null,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        is_active: isActive,
        paypal_status: paypalSub.status,
        local_status: mapped.sub_status,
        auto_billing_enabled: mapped.auto_billing_enabled,
        next_billing_time: paypalSub.billing_info?.next_billing_time ?? null,
        plan_name: localSub.plan_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[PayPalVerify] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
