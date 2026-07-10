// loyalty-account-actions — Module 32 (F32-13)
// Wrapper canonique pour toutes les mutations loyalty : ownership, RBAC,
// rate limit, audit et notifications.
// Les lectures restent RLS-based (pas de proxy inutile).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMITS: Record<string, { max: number; windowSec: number }> = {
  redeem: { max: 5, windowSec: 60 },
  transfer: { max: 10, windowSec: 60 },
  adjust: { max: 30, windowSec: 60 },
  convert: { max: 10, windowSec: 60 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userRes.user) return json({ error: "unauthorized" }, 401);
    const actor = userRes.user;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: actor.id, _role: "admin" });

    const body = await req.json();
    const action = String(body?.action ?? "");

    // Rate limit
    const limit = RATE_LIMITS[action];
    if (limit) {
      const bucket = `loyalty:${action}:${actor.id}`;
      const since = new Date(Date.now() - limit.windowSec * 1000).toISOString();
      const { count } = await admin.from("rate_limit_attempts")
        .select("*", { count: "exact", head: true })
        .eq("key", bucket).gte("created_at", since);
      if ((count ?? 0) >= limit.max) return json({ error: "rate_limited" }, 429);
      await admin.from("rate_limit_attempts").insert({ key: bucket });
    }

    const audit = async (act: string, target: string, targetId: string | null, details: any) => {
      await admin.from("admin_audit_log").insert({
        admin_user_id: actor.id, admin_email: actor.email,
        action: `loyalty.${act}`, target_type: target, target_id: targetId, details,
      });
    };

    // CLIENT actions ---------------------------------------------------
    if (action === "redeem") {
      const { account_id, reward_id, idempotency_key } = body;
      // Ownership: la RPC vérifie déjà (client_id = auth.uid())
      const { data, error } = await userClient.rpc("redeem_loyalty_reward", {
        p_account_id: account_id, p_reward_id: reward_id, p_idempotency_key: idempotency_key,
      });
      if (error) throw error;
      await audit("redeem", "loyalty_redemption", data?.redemption_id ?? null, { account_id, reward_id, result: data });
      return json(data);
    }

    // ADMIN actions ----------------------------------------------------
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    if (action === "adjust") {
      const { account_id, delta, reason, expires_at } = body;
      const { data, error } = await admin.rpc("admin_loyalty_adjust", {
        p_account_id: account_id, p_delta_points: delta, p_reason: reason, p_expires_at: expires_at ?? null,
      });
      if (error) throw error;
      return json(data);
    }
    if (action === "transfer") {
      const { from_account, to_account, points, reason } = body;
      const { data, error } = await admin.rpc("admin_loyalty_transfer", {
        p_from_account: from_account, p_to_account: to_account, p_points: points, p_reason: reason,
      });
      if (error) throw error;
      return json(data);
    }
    if (action === "convert") {
      const { account_id, points, amount, reason } = body;
      const { data, error } = await admin.rpc("admin_loyalty_convert_to_credit", {
        p_account_id: account_id, p_points: points, p_credit_amount: amount, p_reason: reason,
      });
      if (error) throw error;
      return json(data);
    }
    if (action === "extend") {
      const { transaction_id, new_expires_at, reason } = body;
      const { data, error } = await admin.rpc("admin_loyalty_extend_expiration", {
        p_transaction_id: transaction_id, p_new_expires_at: new_expires_at, p_reason: reason,
      });
      if (error) throw error;
      return json(data);
    }
    if (action === "decide_tx") {
      const { transaction_id, decision, reason } = body;
      const { data, error } = await admin.rpc("admin_loyalty_approve_pending", {
        p_transaction_id: transaction_id, p_decision: decision, p_reason: reason,
      });
      if (error) throw error;
      return json(data);
    }
    if (action === "decide_redemption") {
      const { redemption_id, decision, reason } = body;
      const { data, error } = await admin.rpc("admin_loyalty_redemption_decide", {
        p_redemption_id: redemption_id, p_decision: decision, p_reason: reason,
      });
      if (error) throw error;
      return json(data);
    }
    if (action === "expire_now") {
      const { data, error } = await admin.rpc("expire_loyalty_points");
      if (error) throw error;
      return json(data);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[loyalty-account-actions]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
