// deno-lint-ignore-file no-explicit-any
/**
 * calculate-phone-fraud-score — Module 43 Phase 2 (hardened)
 *
 * Read-only fraud-risk scoring for phone checkout.
 *
 * Hardening vs. legacy:
 *   - JWT required (getClaims). Callers must be authenticated.
 *   - Zod-strict input validation.
 *   - Non-staff callers can only score their own user_id.
 *   - Ad-hoc rate limit (20 req / 5 min per identifier) via public.rate_limits.
 *
 * Levels: low ≤30, medium 31–60, high ≥61.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  user_id: z.string().regex(uuidRe, "user_id must be a UUID"),
  order_amount: z.number().finite().min(0).max(100_000),
  account_id: z.string().regex(uuidRe).nullish(),
  shipping_address: z.object({
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    province: z.string().trim().max(50).optional(),
    postal_code: z.string().trim().max(20).optional(),
  }).nullish(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Ad-hoc rate limit: 20 calls / 5-min window per identifier.
async function rateLimitOk(admin: any, identifier: string): Promise<boolean> {
  const windowMinutes = 5;
  const maxRequests = 20;
  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const action_type = "calculate-phone-fraud-score";

  const { data: rows } = await admin
    .from("rate_limits")
    .select("id, request_count, window_start")
    .eq("identifier", identifier)
    .eq("action_type", action_type)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1);

  const current = rows?.[0];
  if (current) {
    if ((current.request_count ?? 0) >= maxRequests) return false;
    await admin.from("rate_limits").update({
      request_count: (current.request_count ?? 0) + 1,
    }).eq("id", current.id);
  } else {
    await admin.from("rate_limits").insert({
      identifier,
      action_type,
      window_start: new Date().toISOString(),
      request_count: 1,
    });
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Auth (JWT required)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return json({ error: "unauthorized" }, 401);
  }
  const callerId = claimsData.claims.sub as string;

  // Input validation
  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "validation_failed", details: parsed.error.flatten() }, 400);
  }
  const { user_id, order_amount, shipping_address, account_id } = parsed.data;

  const admin = createClient(supabaseUrl, serviceKey);

  // Only staff can score another user; regular users can only score themselves.
  if (user_id !== callerId) {
    const { isStaff } = await checkStaffAuth(admin, callerId);
    if (!isStaff) return json({ error: "forbidden" }, 403);
  }

  // Rate limit (per caller)
  const ok = await rateLimitOk(admin, callerId);
  if (!ok) return json({ error: "rate_limited" }, 429);

  const factors: Record<string, number> = {};
  let score = 0;

  // 1. Account age
  try {
    const { data: firstOrder } = await admin
      .from("orders")
      .select("created_at")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstOrder?.created_at) {
      const days = (Date.now() - new Date(firstOrder.created_at).getTime()) / 86_400_000;
      if (days < 7) { score += 25; factors.new_account = 25; }
    } else {
      score += 25; factors.new_account = 25;
    }
  } catch (e) { console.warn("[fraud] account-age failed", e); }

  // 2. No previous orders
  try {
    const { count } = await admin.from("orders")
      .select("id", { count: "exact", head: true }).eq("user_id", user_id);
    if ((count ?? 0) === 0) { score += 15; factors.no_history = 15; }
  } catch (e) { console.warn("[fraud] order-count failed", e); }

  // 3. Shipping ≠ billing
  try {
    if (account_id && shipping_address) {
      const { data: acct } = await admin.from("accounts")
        .select("billing_city, billing_province").eq("id", account_id).maybeSingle();
      if (acct) {
        const cityMismatch =
          (shipping_address.city ?? "").trim().toLowerCase() !==
          (acct.billing_city ?? "").trim().toLowerCase();
        const provMismatch =
          (shipping_address.province ?? "").trim().toUpperCase() !==
          (acct.billing_province ?? "").trim().toUpperCase();
        if (cityMismatch || provMismatch) { score += 20; factors.different_address = 20; }
      }
    }
  } catch (e) { console.warn("[fraud] address failed", e); }

  // 4. ≥1 phone orders in last 30d
  try {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { count } = await admin.from("phone_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id).gte("created_at", since);
    if ((count ?? 0) >= 1) { score += 30; factors.multiple_orders = 30; }
  } catch (e) { console.warn("[fraud] phone-history failed", e); }

  // 5. High amount
  if (order_amount > 800) { score += 15; factors.high_amount = 15; }

  // 6. KYC not approved
  try {
    const { data: lastOrder } = await admin.from("orders")
      .select("kyc_status").eq("user_id", user_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if ((lastOrder?.kyc_status ?? "") !== "approved") {
      score += 20; factors.kyc_not_verified = 20;
    }
  } catch (e) { console.warn("[fraud] kyc failed", e); }

  const level: "low" | "medium" | "high" =
    score <= 30 ? "low" : score <= 60 ? "medium" : "high";

  return json({ score, level, factors });
});
