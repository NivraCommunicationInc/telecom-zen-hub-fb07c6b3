import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  subscription_id: string; // billing_subscriptions.id
  action: "suspend" | "activate";
  reason?: string;
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");
  const auth = btoa(`${clientId}:${clientSecret}`);
  const r = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("[PayPalSyncState] Token error:", t);
    throw new Error("Failed to get PayPal access token");
  }
  return (await r.json()).access_token;
}

async function getPayPalSubStatus(id: string, token: string): Promise<string | null> {
  const r = await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    console.warn("[PayPalSyncState] GET sub failed:", r.status, t);
    return null;
  }
  const d = await r.json();
  return d.status ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    console.log("[PayPalSyncState] Request:", body);

    if (!body.subscription_id || !["suspend", "activate"].includes(body.action)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select("id, paypal_subscription_id, customer_id, plan_name")
      .eq("id", body.subscription_id)
      .single();

    if (subErr || !sub) throw new Error(`Subscription not found: ${body.subscription_id}`);

    if (!sub.paypal_subscription_id) {
      console.log("[PayPalSyncState] No PayPal binding, nothing to do");
      return new Response(
        JSON.stringify({ success: true, status: "no_paypal_binding" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getPayPalAccessToken();
    const currentStatus = await getPayPalSubStatus(sub.paypal_subscription_id, token);
    console.log("[PayPalSyncState] PayPal current status:", currentStatus);

    // Idempotency: skip if already in desired state
    if (body.action === "suspend" && currentStatus === "SUSPENDED") {
      return new Response(
        JSON.stringify({ success: true, status: "already_suspended" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (body.action === "activate" && currentStatus === "ACTIVE") {
      return new Response(
        JSON.stringify({ success: true, status: "already_active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (currentStatus === "CANCELLED" || currentStatus === "EXPIRED") {
      console.warn("[PayPalSyncState] Cannot sync, sub is", currentStatus);
      return new Response(
        JSON.stringify({ success: false, status: `paypal_${currentStatus.toLowerCase()}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const endpoint = body.action === "suspend" ? "suspend" : "activate";
    const resp = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${sub.paypal_subscription_id}/${endpoint}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: body.reason || (body.action === "suspend" ? "Service paused" : "Service resumed"),
        }),
      }
    );

    if (resp.status !== 204) {
      const t = await resp.text();
      console.error("[PayPalSyncState] PayPal error:", resp.status, t);
      throw new Error(`PayPal ${endpoint} failed: ${resp.status}`);
    }

    // Activity log
    try {
      await supabase.from("activity_logs").insert({
        action: `paypal_subscription_${body.action}ed`,
        entity_type: "billing_subscription",
        entity_id: body.subscription_id,
        details: {
          paypal_subscription_id: sub.paypal_subscription_id,
          reason: body.reason ?? null,
          previous_paypal_status: currentStatus,
        },
      });
    } catch (e) {
      console.warn("[PayPalSyncState] Log insert failed:", e);
    }

    return new Response(
      JSON.stringify({ success: true, status: `${body.action}ed` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[PayPalSyncState] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
