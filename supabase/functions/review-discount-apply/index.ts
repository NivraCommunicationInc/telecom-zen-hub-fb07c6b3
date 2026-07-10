// review-discount-apply — Client 360 module: manage the $5 review discount.
// Actions:
//   - "confirm_pending" : mark review_discount_pending=true on the account
//                         (staff has seen the Google review posted by the client)
//   - "apply_credit"    : create a 1-month $5 credit via account_adjustments,
//                         flag review_discount_applied_at, clear pending.
//   - "reset"           : clear pending flag (false alarm / reversal).
//
// Every action requires an audit reason (min 3 chars) and is logged in
// admin_audit_log with module_tag='review_discount'.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDIT_AMOUNT = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader) return json({ ok: false, error: "auth required" }, 401);

    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes, error: userErr } = await authed.auth.getUser();
    if (userErr || !userRes?.user) return json({ ok: false, error: "invalid session" }, 401);
    const user = userRes.user;

    const [{ data: isAdmin }, { data: isStaff }, { data: isCore }] = await Promise.all([
      authed.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      authed.rpc("has_role", { _user_id: user.id, _role: "staff" }),
      authed.rpc("has_role", { _user_id: user.id, _role: "core" }),
    ]);
    if (!isAdmin && !isStaff && !isCore) {
      return json({ ok: false, error: "insufficient_privilege" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { action, account_id, __audit_reason: reason } = body ?? {};

    if (!account_id) return json({ ok: false, error: "account_id required" }, 400);
    if (!action || !["confirm_pending", "apply_credit", "reset"].includes(action)) {
      return json({ ok: false, error: "invalid action" }, 400);
    }
    if (!reason || String(reason).trim().length < 3) {
      return json({ ok: false, error: "audit reason required (min 3 chars)" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: acct, error: acctErr } = await admin
      .from("accounts")
      .select("id, client_id, account_number, review_email_sent, review_discount_pending, review_discount_applied_at, review_discount_amount_cents")
      .eq("id", account_id)
      .maybeSingle();
    if (acctErr || !acct) return json({ ok: false, error: "account not found" }, 404);

    const before = { ...acct };

    if (action === "confirm_pending") {
      const { error } = await admin
        .from("accounts")
        .update({ review_discount_pending: true })
        .eq("id", account_id);
      if (error) return json({ ok: false, error: error.message }, 500);
    }

    if (action === "reset") {
      const { error } = await admin
        .from("accounts")
        .update({ review_discount_pending: false })
        .eq("id", account_id);
      if (error) return json({ ok: false, error: error.message }, 500);
    }

    if (action === "apply_credit") {
      if (acct.review_discount_applied_at) {
        return json({ ok: false, error: "credit_already_applied" }, 409);
      }
      // Insert single-cycle $5 credit consumed by billing-lifecycle
      const { error: adjErr } = await admin.from("account_adjustments").insert({
        account_id,
        type: "credit",
        amount: CREDIT_AMOUNT,
        months_total: 1,
        months_remaining: 1,
        applied_count: 0,
        status: "active",
        description: "Rabais de 5 $ — avis Google confirmé",
        created_by: user.id,
      });
      if (adjErr) return json({ ok: false, error: adjErr.message }, 500);

      const { error: acctUpdErr } = await admin
        .from("accounts")
        .update({
          review_discount_pending: false,
          review_discount_applied_at: new Date().toISOString(),
          review_discount_amount_cents: CREDIT_AMOUNT * 100,
        })
        .eq("id", account_id);
      if (acctUpdErr) return json({ ok: false, error: acctUpdErr.message }, 500);
    }

    await admin.from("admin_audit_log").insert({
      actor_id: user.id,
      action: `review_discount_${action}`,
      module_tag: "review_discount",
      target_type: "account",
      target_id: account_id,
      reason: String(reason).trim(),
      metadata: { before, action, amount: action === "apply_credit" ? CREDIT_AMOUNT : null },
    });

    return json({ ok: true, action });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
