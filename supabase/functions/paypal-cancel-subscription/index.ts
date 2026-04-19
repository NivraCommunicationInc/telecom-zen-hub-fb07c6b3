import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelSubscriptionRequest {
  subscription_id: string; // billing_subscriptions.id
  account_id?: string;
  reason?: string;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }
  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("[PayPal Cancel] Token error:", text);
    throw new Error("Failed to get PayPal access token");
  }
  const data = await response.json();
  return data.access_token;
}

/**
 * Cancel a PayPal billing agreement (pre-authorized payment).
 * Keeps the billing_subscriptions row active but removes the PayPal binding,
 * so future invoices fall back to manual payment.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CancelSubscriptionRequest = await req.json();
    console.log("[PayPal Cancel] Request:", body);

    if (!body.subscription_id) {
      throw new Error("Missing required field: subscription_id");
    }

    // Identify caller (best-effort)
    let cancelledByUserId: string | null = null;
    let cancelledByEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      try {
        const supaAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supaAuth.auth.getUser();
        if (user) {
          cancelledByUserId = user.id;
          cancelledByEmail = user.email ?? null;
        }
      } catch (e) {
        console.warn("[PayPal Cancel] Could not resolve caller:", e);
      }
    }

    // Load subscription with customer info
    const { data: subscription, error: subError } = await supabase
      .from("billing_subscriptions")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name, user_id)
      `)
      .eq("id", body.subscription_id)
      .single();

    if (subError || !subscription) {
      throw new Error(`Subscription not found: ${body.subscription_id}`);
    }

    const paypalSubscriptionId: string | null = subscription.paypal_subscription_id;
    let paypalCancelStatus: string = "no_paypal_binding";

    // Cancel at PayPal if a binding exists
    if (paypalSubscriptionId) {
      try {
        const accessToken = await getPayPalAccessToken();
        const cancelResp = await fetch(
          `https://api-m.paypal.com/v1/billing/subscriptions/${paypalSubscriptionId}/cancel`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reason: body.reason || "Customer requested cancellation",
            }),
          }
        );
        if (cancelResp.status === 204) {
          paypalCancelStatus = "cancelled";
        } else if (cancelResp.status === 422) {
          // Already cancelled / invalid state — not fatal, still clear the binding
          const text = await cancelResp.text();
          console.warn("[PayPal Cancel] PayPal 422 (likely already cancelled):", text);
          paypalCancelStatus = "already_cancelled";
        } else {
          const text = await cancelResp.text();
          console.error("[PayPal Cancel] PayPal error:", cancelResp.status, text);
          throw new Error(`PayPal cancellation failed: ${cancelResp.status}`);
        }
      } catch (e) {
        // If PayPal call hard-fails, surface the error rather than silently clearing
        throw e;
      }
    }

    // Clear PayPal binding on subscription (keep status active)
    const { error: updateError } = await supabase
      .from("billing_subscriptions")
      .update({
        paypal_subscription_id: null,
        auto_billing_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.subscription_id);
    if (updateError) {
      console.error("[PayPal Cancel] Subscription update error:", updateError);
    }

    // Clear customer-level autopay flags (best effort)
    if (subscription.customer_id) {
      await supabase
        .from("billing_customers")
        .update({
          autopay_enabled: false,
          autopay_discount_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.customer_id);
    }

    // Activity log
    try {
      await supabase.from("activity_logs").insert({
        action: "paypal_subscription_cancelled",
        entity_type: "billing_subscription",
        entity_id: body.subscription_id,
        user_id: cancelledByUserId ?? subscription.customer?.user_id ?? null,
        actor_email: cancelledByEmail,
        reason: body.reason || null,
        details: {
          paypal_subscription_id: paypalSubscriptionId,
          paypal_cancel_status: paypalCancelStatus,
          account_id: body.account_id ?? null,
          customer_id: subscription.customer_id,
        },
      });
    } catch (e) {
      console.warn("[PayPal Cancel] Activity log insert failed:", e);
    }

    // Send email to client (queue)
    try {
      if (subscription.customer?.email) {
        const fullName = `${subscription.customer.first_name ?? ""} ${subscription.customer.last_name ?? ""}`.trim() || "Client";
        await supabase.from("email_queue").insert({
          event_key: `paypal_cancel_${body.subscription_id}_${Date.now()}`,
          to_email: subscription.customer.email,
          template_key: "paypal_autopay_cancelled",
          template_vars: {
            client_name: fullName,
            plan_name: subscription.plan_name,
            cancelled_at: new Date().toISOString(),
          },
          status: "queued",
          attempts: 0,
          max_attempts: 5,
        });
      }
    } catch (e) {
      console.warn("[PayPal Cancel] Email queue insert failed:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        paypal_cancel_status: paypalCancelStatus,
        subscription_id: body.subscription_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[PayPal Cancel] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
