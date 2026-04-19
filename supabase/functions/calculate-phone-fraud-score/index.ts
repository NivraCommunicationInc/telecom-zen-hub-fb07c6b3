// deno-lint-ignore-file no-explicit-any
/**
 * calculate-phone-fraud-score
 *
 * Computes a fraud-risk score for a phone purchase based on:
 *   - account age (created < 7 days)        → +25
 *   - no previous orders                    → +15
 *   - shipping address ≠ billing/profile    → +20
 *   - ≥1 phone orders in last 30 days       → +30
 *   - order amount > $800                   → +15
 *   - KYC not approved                      → +20
 *
 * Levels: low ≤30, medium 31–60, high ≥61.
 *
 * SAFE TO CALL: read-only, no mutations. Returns { score, level, factors }.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ScoreRequest {
  user_id: string;
  order_amount: number;
  shipping_address?: {
    address?: string;
    city?: string;
    province?: string;
    postal_code?: string;
  } | null;
  account_id?: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: ScoreRequest;
  try {
    payload = (await req.json()) as ScoreRequest;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { user_id, order_amount, shipping_address, account_id } = payload || {};
  if (!user_id || typeof order_amount !== "number") {
    return json({ error: "user_id and order_amount required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const factors: Record<string, number> = {};
  let score = 0;

  // ---- 1. Account age (uses orders.created_at as proxy for first interaction) ----
  try {
    const { data: firstOrder } = await supabase
      .from("orders")
      .select("created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstOrder?.created_at) {
      const days =
        (Date.now() - new Date(firstOrder.created_at).getTime()) / 86_400_000;
      if (days < 7) {
        score += 25;
        factors.new_account = 25;
      }
    } else {
      // No order history at all → treat as brand new
      score += 25;
      factors.new_account = 25;
    }
  } catch (e) {
    console.warn("[fraud] account-age check failed", e);
  }

  // ---- 2. No previous orders ----
  try {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id);

    if ((count ?? 0) === 0) {
      score += 15;
      factors.no_history = 15;
    }
  } catch (e) {
    console.warn("[fraud] order-count check failed", e);
  }

  // ---- 3. Shipping address ≠ account billing address ----
  try {
    if (account_id && shipping_address) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("billing_city, billing_province")
        .eq("id", account_id)
        .maybeSingle();

      if (acct) {
        const cityMismatch =
          (shipping_address.city ?? "").trim().toLowerCase() !==
          (acct.billing_city ?? "").trim().toLowerCase();
        const provMismatch =
          (shipping_address.province ?? "").trim().toUpperCase() !==
          (acct.billing_province ?? "").trim().toUpperCase();
        if (cityMismatch || provMismatch) {
          score += 20;
          factors.different_address = 20;
        }
      }
    }
  } catch (e) {
    console.warn("[fraud] address check failed", e);
  }

  // ---- 4. ≥1 phone orders in last 30 days ----
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { count } = await supabase
      .from("phone_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("created_at", since);

    if ((count ?? 0) >= 1) {
      score += 30;
      factors.multiple_orders = 30;
    }
  } catch (e) {
    console.warn("[fraud] phone-history check failed", e);
  }

  // ---- 5. High amount ----
  if (order_amount > 800) {
    score += 15;
    factors.high_amount = 15;
  }

  // ---- 6. KYC not approved (latest order) ----
  try {
    const { data: lastOrder } = await supabase
      .from("orders")
      .select("kyc_status")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if ((lastOrder?.kyc_status ?? "") !== "approved") {
      score += 20;
      factors.kyc_not_verified = 20;
    }
  } catch (e) {
    console.warn("[fraud] kyc check failed", e);
  }

  const level: "low" | "medium" | "high" =
    score <= 30 ? "low" : score <= 60 ? "medium" : "high";

  return json({ score, level, factors });
});
