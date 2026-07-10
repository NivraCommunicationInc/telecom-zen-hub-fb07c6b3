// ============================================================
// referrals-attach-on-order (F33-2)
// Attach a referral code to a newly-created order + apply the discount
// entirely server-side. Client browsers never write to client_referrals /
// referral_attributions / billing_subscriptions directly.
//
// Callable from:
//   - GuestCheckout (public, no auth): validates referral_code + order_id + email/user_id
//   - ClientNewOrder (authed):        same, but auth token attaches user
//
// Idempotent via idempotency_key (per-order retry safe, F33-5).
// Anti-fraud:
//   - self-referral blocked
//   - order already attached blocked
//   - code must be active
//   - code type dispatch: 'client' → client_referrals, 'influencer' → referral_attributions
// ============================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  referral_code: string;
  order_id: string;
  referred_user_id: string;
  referred_email?: string;
  idempotency_key: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { referral_code, order_id, referred_user_id, idempotency_key } = body;
  if (!referral_code || !order_id || !referred_user_id || !idempotency_key) {
    return json(400, {
      error: "referral_code, order_id, referred_user_id, idempotency_key requis",
    });
  }

  // ============ 1) Load and validate the code ============
  const { data: code, error: codeErr } = await admin
    .from("referral_codes")
    .select("id, code, code_type, status, influencer_id, owner_user_id, owner_account_id, usage_limit_total, usage_count, referred_discount_amount, referred_discount_months")
    .eq("code", referral_code.trim().toUpperCase())
    .maybeSingle();
  if (codeErr) return json(500, { error: codeErr.message });
  if (!code) return json(404, { error: "Code introuvable" });
  if (code.status !== "active") return json(400, { error: "Code inactif" });
  if (code.usage_limit_total && code.usage_count >= code.usage_limit_total) {
    return json(400, { error: "Limite d'utilisation atteinte" });
  }

  // ============ 2) Anti-fraud minimal ============
  if (code.owner_user_id && code.owner_user_id === referred_user_id) {
    return json(400, { error: "Auto-parrainage interdit" });
  }

  // Order ownership: must exist and match referred_user
  const { data: order } = await admin
    .from("orders").select("id, user_id, order_number").eq("id", order_id).maybeSingle();
  if (!order) return json(404, { error: "Commande introuvable" });
  if (order.user_id && order.user_id !== referred_user_id) {
    return json(403, { error: "Commande n'appartient pas à ce client" });
  }

  // ============ 3) Route based on code_type ============

  // ---------- CLIENT referral (peer-to-peer) ----------
  if (code.code_type === "client") {
    if (!code.owner_user_id) {
      return json(400, { error: "Code client sans propriétaire" });
    }

    // Idempotence: order already attached?
    const { data: existing } = await admin
      .from("client_referrals").select("id, referrer_user_id")
      .eq("referred_order_id", order_id).maybeSingle();
    if (existing) {
      return json(200, {
        ok: true, idempotent: true, kind: "client_referral", id: existing.id,
      });
    }

    // Referrer's account
    const { data: refAcct } = await admin
      .from("accounts").select("id").eq("client_id", code.owner_user_id).limit(1).maybeSingle();
    const { data: refBc } = await admin
      .from("billing_customers").select("id").eq("user_id", code.owner_user_id).limit(1).maybeSingle();

    // Referred client account
    const { data: refdAcct } = await admin
      .from("accounts").select("id").eq("client_id", referred_user_id).limit(1).maybeSingle();

    // Load settings for reward defaults (F33-7: single source)
    const { data: settings } = await admin
      .from("referral_program_settings").select("*").limit(1).maybeSingle();

    // Insert client_referrals server-side (UNIQUE on referred_order_id protects retries)
    const { data: inserted, error: insErr } = await admin
      .from("client_referrals").insert({
        referral_code_used: code.code,
        referrer_user_id: code.owner_user_id,
        referrer_account_id: refAcct?.id || null,
        referrer_billing_customer_id: refBc?.id || null,
        referred_user_id,
        referred_account_id: refdAcct?.id || null,
        referred_order_id: order_id,
        status: "pending",
        qualifying_cycles_paid: 0,
        required_cycles: settings?.required_cycles ?? 2,
        reward_status: "not_eligible",
        reward_type: "visa_mastercard_gift_card",
        reward_amount: Number(settings?.commission_value_default ?? 25),
        discount_total_months: code.referred_discount_months ?? 10,
      }).select("id").maybeSingle();
    if (insErr) {
      // Unique violation on referred_order_id or referred_user_id → treat as idempotent
      if (insErr.code === "23505") {
        return json(200, { ok: true, idempotent: true, kind: "client_referral" });
      }
      return json(500, { error: insErr.message });
    }

    // Activate discount on billing_subscription of the new order (server-side)
    const { data: bc } = await admin
      .from("billing_customers").select("id").eq("user_id", referred_user_id).limit(1).maybeSingle();
    if (bc?.id) {
      await admin
        .from("billing_subscriptions")
        .update({
          referral_discount_active: true,
          referral_discount_amount: Number(code.referred_discount_amount ?? 5),
          referral_discount_months_remaining: code.referred_discount_months ?? 10,
          referral_code_used: code.code,
        } as Record<string, unknown>)
        .eq("customer_id", bc.id)
        .eq("order_id", order_id);
    }

    // Increment code usage
    await admin.rpc("increment_referral_usage", { code_id: code.id });

    // Event log
    await admin.from("client_referral_events").insert({
      referral_id: inserted?.id,
      event_type: "attached_to_order",
      new_status: "pending",
      details: { order_id, code: code.code, idempotency_key },
      actor_type: "system",
    });

    return json(200, { ok: true, kind: "client_referral", id: inserted?.id });
  }

  // ---------- INFLUENCER referral ----------
  if (code.code_type === "influencer" || code.influencer_id) {
    if (!code.influencer_id) return json(400, { error: "Code influenceur sans influencer_id" });

    const { data: existing } = await admin
      .from("referral_attributions").select("id")
      .eq("order_id", order_id).maybeSingle();
    if (existing) {
      return json(200, { ok: true, idempotent: true, kind: "attribution", id: existing.id });
    }

    // Discount comes from order snapshot only (never client-provided)
    const { data: orderRow } = await admin
      .from("orders").select("pricing_snapshot").eq("id", order_id).maybeSingle();
    const snapshot = (orderRow?.pricing_snapshot ?? {}) as Record<string, unknown>;
    const customer_discount_amount = Number(
      (snapshot.referral_discount_amount as number) ??
      (snapshot.promo_discount_amount as number) ?? 0,
    );

    const { data: inserted, error: insErr } = await admin
      .from("referral_attributions").insert({
        referral_code_id: code.id,
        influencer_id: code.influencer_id,
        order_id,
        customer_id: referred_user_id,
        customer_email: (body.referred_email || "").toLowerCase() || null,
        customer_discount_amount,
        status: "pending",
      }).select("id").maybeSingle();
    if (insErr) {
      if (insErr.code === "23505") {
        return json(200, { ok: true, idempotent: true, kind: "attribution" });
      }
      return json(500, { error: insErr.message });
    }

    await admin.rpc("increment_referral_usage", { code_id: code.id });

    return json(200, { ok: true, kind: "attribution", id: inserted?.id });
  }

  return json(400, { error: "Type de code inconnu" });
});
