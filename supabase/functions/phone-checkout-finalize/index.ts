/**
 * phone-checkout-finalize
 *
 * Called from the frontend after PayPal capture succeeds.
 * Marks the draft order as paid, reserves the phone, and (best-effort)
 * dispatches a KYC reminder email + fraud score.
 *
 * Idempotent: safe to call twice.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FinalizeBody {
  order_id: string;
  phone_id: string;
  capture_id: string;
  selected_color?: string;
  selected_storage?: string;
  payer_address?: Record<string, unknown> | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = (await req.json()) as FinalizeBody;
    if (!body.order_id || !body.capture_id || !body.phone_id) {
      return jsonError("Missing required fields", 400);
    }

    // 1) Fetch the draft order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, status, payment_status, total_amount, client_email, client_first_name, client_last_name, order_number")
      .eq("id", body.order_id)
      .maybeSingle();

    if (orderErr || !order) {
      console.error("[phone-checkout-finalize] order fetch", orderErr);
      return jsonError("Order not found", 404);
    }

    // Idempotency: if already confirmed, just return success
    if (order.payment_status === "paid" && order.status !== "pending_payment") {
      return new Response(
        JSON.stringify({ success: true, already_finalized: true, order_id: order.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Mark order as paid + confirmed
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        payment_status: "paid",
        amount_paid: order.total_amount,
        payment_reference: body.capture_id,
        processed_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateErr) {
      console.error("[phone-checkout-finalize] order update", updateErr);
      return jsonError(`Order update failed: ${updateErr.message}`, 500);
    }

    // 3) Reserve the phone (best effort â€” don't block on failure)
    try {
      await supabase
        .from("phone_inventory")
        .update({
          status: "reserved",
          order_id: order.id,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", body.phone_id)
        .eq("status", "available");
    } catch (e) {
      console.warn("[phone-checkout-finalize] inventory reserve failed", e);
    }

    // 4) Insert phone_orders row for KYC tracking (best-effort)
    try {
      await supabase.from("phone_orders").insert({
        order_id: order.id,
        phone_inventory_id: body.phone_id,
        user_id: order.user_id,
        status: "pending_kyc",
        fraud_score: 0,
        fraud_factors: [],
        fraud_level: "pending",
        selected_color: body.selected_color ?? null,
        selected_storage: body.selected_storage ?? null,
      });
    } catch (e) {
      console.warn("[phone-checkout-finalize] phone_orders insert", e);
    }

    // 5) Fire-and-forget: fraud score
    supabase.functions.invoke("calculate-phone-fraud-score", {
      body: { order_id: order.id, payer_address: body.payer_address },
    }).catch((e) => console.warn("[phone-checkout-finalize] fraud score skipped", e));

    // 6) Fire-and-forget: KYC email
    supabase.functions.invoke("send-kyc-request", {
      body: {
        order_id: order.id,
        user_id: order.user_id,
        email: order.client_email,
        first_name: order.client_first_name,
        order_number: order.order_number,
      },
    }).catch((e) => console.warn("[phone-checkout-finalize] kyc email skipped", e));

    return new Response(
      JSON.stringify({ success: true, order_id: order.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[phone-checkout-finalize] fatal", err);
    return jsonError(err?.message ?? "Internal error", 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
