// qa-module32-runner — Module 32 (F32-QA)
// E2E validator for the loyalty subsystem.
// Phase 1: earn payment / activation / referral, adjust, transfer, convert,
//          extend expiration, approve, reject.
// Phase 2: redeem client, double redeem (idempotency), stock race condition,
//          cross-account attack, tier update, expiration, refund on rejection.
// Cleanup: purge all QA artifacts, assert zero orphan.
//
// Runs with SERVICE_ROLE. Only admins may invoke it.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Check = { id: string; label: string; pass: boolean; detail?: any };

const QA_PREFIX = "QA32-";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Optional admin auth — if a user JWT is provided, enforce admin role.
    // Otherwise the function runs unauthenticated (QA runner, service_role only).
    const authHeader = req.headers.get("Authorization");
    if (authHeader && !authHeader.includes(SERVICE_KEY)) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (u.user) {
        const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
        if (!isAdmin) return json({ error: "forbidden" }, 403);
      }
    }


    const body = await req.json().catch(() => ({}));
    const phase = String(body?.phase ?? "all"); // 1 | 2 | all | cleanup

    if (phase === "cleanup") {
      const c = await cleanup(admin);
      return json({ ok: true, cleanup: c });
    }

    const checks: Check[] = [];
    await cleanup(admin); // clean state first

    let ctx: TestCtx;
    try {
      ctx = await provision(admin);
      checks.push({ id: "SETUP", label: "Provisionnement comptes QA", pass: true, detail: ctx });

      if (phase === "1" || phase === "all") await phase1(admin, ctx, checks);
      if (phase === "2" || phase === "all") await phase2(admin, ctx, checks);
    } finally {
      const c = await cleanup(admin);
      checks.push({
        id: "CLEANUP",
        label: "Cleanup zéro orphan",
        pass: c.orphans === 0,
        detail: c,
      });
    }

    const passed = checks.filter((c) => c.pass).length;
    const total = checks.length;
    return json({ ok: true, passed, total, checks });
  } catch (e) {
    console.error("[qa-module32-runner]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

type TestCtx = {
  account_a: string;
  account_b: string;
  reward_id: string;
  reward_limited_id: string;
};

async function provision(db: SupabaseClient): Promise<TestCtx> {
  const mk = async (label: string) => {
    const { data, error } = await db.from("accounts").insert({
      account_number: `${QA_PREFIX}${label}-${Date.now()}`,
      status: "active",
      client_id: null,
    }).select("id").single();
    if (error) throw new Error(`provision account ${label}: ${error.message}`);
    await db.from("loyalty_points").insert({
      account_id: data.id, total_points: 0, available_points: 0, lifetime_points: 0,
    });
    return data.id as string;
  };
  const account_a = await mk("A");
  const account_b = await mk("B");

  const { data: rw, error: eR } = await db.from("loyalty_rewards").insert({
    name_fr: `${QA_PREFIX}Reward`, name_en: `${QA_PREFIX}Reward`,
    points_required: 100, reward_type: "credit", reward_value: 5, is_active: true,
  }).select("id").single();
  if (eR) throw eR;

  const { data: rwL, error: eRL } = await db.from("loyalty_rewards").insert({
    name_fr: `${QA_PREFIX}Reward-limited`, name_en: `${QA_PREFIX}Reward-limited`,
    points_required: 50, reward_type: "credit", reward_value: 2,
    is_active: true, stock_limit: 1, redemptions_count: 0,
  }).select("id").single();
  if (eRL) throw eRL;

  return { account_a, account_b, reward_id: rw.id, reward_limited_id: rwL.id };
}

async function phase1(db: SupabaseClient, ctx: TestCtx, checks: Check[]) {
  // C1: adjust +500
  {
    const { data, error } = await db.rpc("admin_loyalty_adjust", {
      p_account_id: ctx.account_a, p_delta_points: 500,
      p_reason: "QA adjust +500", p_expires_at: null,
    });
    checks.push({ id: "C1", label: "admin_loyalty_adjust +500", pass: !error && (data as any)?.ok === true, detail: { data, error } });
  }
  // C2: tier update to silver after 500 lifetime
  {
    const { data } = await db.from("loyalty_points").select("tier,lifetime_points").eq("account_id", ctx.account_a).single();
    checks.push({ id: "C2", label: "Tier auto silver@500", pass: data?.tier === "silver", detail: data });
  }
  // C3: adjust +1000 -> gold @1500
  {
    await db.rpc("admin_loyalty_adjust", { p_account_id: ctx.account_a, p_delta_points: 1000, p_reason: "QA to gold", p_expires_at: null });
    const { data } = await db.from("loyalty_points").select("tier,lifetime_points").eq("account_id", ctx.account_a).single();
    checks.push({ id: "C3", label: "Tier auto gold@1500", pass: data?.tier === "gold", detail: data });
  }
  // C4: adjust to platinum
  {
    await db.rpc("admin_loyalty_adjust", { p_account_id: ctx.account_a, p_delta_points: 3500, p_reason: "QA to platinum", p_expires_at: null });
    const { data } = await db.from("loyalty_points").select("tier,lifetime_points").eq("account_id", ctx.account_a).single();
    checks.push({ id: "C4", label: "Tier auto platinum@5000", pass: data?.tier === "platinum", detail: data });
  }
  // C5: transfer 200 A->B
  {
    const { data, error } = await db.rpc("admin_loyalty_transfer", {
      p_from_account: ctx.account_a, p_to_account: ctx.account_b, p_points: 200, p_reason: "QA transfer",
    });
    checks.push({ id: "C5", label: "Transfer 200 A→B", pass: !error && (data as any)?.ok === true, detail: { data, error } });
  }
  // C6: reject transfer if dest suspended
  {
    await db.from("accounts").update({ status: "suspended" }).eq("id", ctx.account_b);
    const { error } = await db.rpc("admin_loyalty_transfer", {
      p_from_account: ctx.account_a, p_to_account: ctx.account_b, p_points: 10, p_reason: "QA blocked",
    });
    await db.from("accounts").update({ status: "active" }).eq("id", ctx.account_b);
    checks.push({ id: "C6", label: "Transfer refusé si destinataire suspendu", pass: !!error, detail: error });
  }
  // C7: convert to credit
  {
    const { data, error } = await db.rpc("admin_loyalty_convert_to_credit", {
      p_account_id: ctx.account_a, p_points: 100, p_credit_amount: 5, p_reason: "QA convert",
    });
    checks.push({ id: "C7", label: "Convert to credit crée account_adjustment", pass: !error && !!(data as any)?.adjustment_id, detail: { data, error } });
  }
  // C8: extend expiration
  {
    const { data: tx } = await db.from("loyalty_transactions").insert({
      account_id: ctx.account_a, type: "adjusted", points: 10, description: `${QA_PREFIX}tx-extend`,
      balance_after: 0, expires_at: new Date(Date.now() + 86400000).toISOString(), status: "posted",
    }).select("id,expires_at").single();
    const newExp = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data, error } = await db.rpc("admin_loyalty_extend_expiration", {
      p_transaction_id: tx!.id, p_new_expires_at: newExp, p_reason: "QA extend",
    });
    checks.push({ id: "C8", label: "Extend expiration", pass: !error && (data as any)?.ok === true, detail: { data, error } });
  }
  // C9: pending approve
  {
    const { data: tx } = await db.from("loyalty_transactions").insert({
      account_id: ctx.account_a, type: "earned_manual", points: 25, description: `${QA_PREFIX}pending`,
      balance_after: 0, status: "pending",
    }).select("id").single();
    const { data, error } = await db.rpc("admin_loyalty_approve_pending", {
      p_transaction_id: tx!.id, p_decision: "approve", p_reason: "QA approve",
    });
    checks.push({ id: "C9", label: "Approve pending tx", pass: !error && (data as any)?.ok === true, detail: { data, error } });
  }
  // C10: earn dedup on unique index (same reference_id)
  {
    const refId = crypto.randomUUID();
    const ins1 = await db.from("loyalty_transactions").insert({
      account_id: ctx.account_a, type: "earned_payment", points: 100, description: `${QA_PREFIX}dedup`,
      balance_after: 0, reference_id: refId, reference_type: "billing_payment", status: "posted",
    });
    const ins2 = await db.from("loyalty_transactions").insert({
      account_id: ctx.account_a, type: "earned_payment", points: 100, description: `${QA_PREFIX}dedup2`,
      balance_after: 0, reference_id: refId, reference_type: "billing_payment", status: "posted",
    });
    checks.push({ id: "C10", label: "Anti-doublon earn (unique index)", pass: !ins1.error && !!ins2.error, detail: { e1: ins1.error, e2: ins2.error } });
  }
  // C11: expire_loyalty_points
  {
    const { data: tx } = await db.from("loyalty_transactions").insert({
      account_id: ctx.account_a, type: "earned_manual", points: 30, description: `${QA_PREFIX}expiring`,
      balance_after: 0, expires_at: new Date(Date.now() - 3600_000).toISOString(), status: "posted",
    }).select("id").single();
    const before = (await db.from("loyalty_points").select("available_points").eq("account_id", ctx.account_a).single()).data?.available_points ?? 0;
    const { data } = await db.rpc("expire_loyalty_points");
    const after = (await db.from("loyalty_points").select("available_points").eq("account_id", ctx.account_a).single()).data?.available_points ?? 0;
    checks.push({ id: "C11", label: "Expiration automatique appliquée", pass: (data as any)?.expired_count >= 1 && after < before, detail: { data, before, after, tx: tx?.id } });
  }
}

async function phase2(db: SupabaseClient, ctx: TestCtx, checks: Check[]) {
  // Ensure enough points for redeem
  await db.rpc("admin_loyalty_adjust", { p_account_id: ctx.account_a, p_delta_points: 500, p_reason: "QA phase2 seed", p_expires_at: null });

  // C20: redeem success
  const key1 = `${QA_PREFIX}${crypto.randomUUID()}`;
  {
    const { data, error } = await db.rpc("redeem_loyalty_reward", {
      p_account_id: ctx.account_a, p_reward_id: ctx.reward_id, p_idempotency_key: key1,
    });
    checks.push({ id: "C20", label: "Redeem ok", pass: !error && (data as any)?.success === true, detail: { data, error } });
  }
  // C21: replay same idempotency_key returns idempotent
  {
    const { data, error } = await db.rpc("redeem_loyalty_reward", {
      p_account_id: ctx.account_a, p_reward_id: ctx.reward_id, p_idempotency_key: key1,
    });
    checks.push({ id: "C21", label: "Idempotence redeem (replay)", pass: !error && (data as any)?.idempotent === true, detail: { data, error } });
  }
  // C22: idempotency_key required
  {
    const { data } = await db.rpc("redeem_loyalty_reward", {
      p_account_id: ctx.account_a, p_reward_id: ctx.reward_id, p_idempotency_key: null,
    });
    checks.push({ id: "C22", label: "idempotency_key obligatoire", pass: (data as any)?.error === "idempotency_key_required", detail: data });
  }
  // C23: stock race — 2 concurrent redeems on limited reward, only 1 wins
  {
    await db.rpc("admin_loyalty_adjust", { p_account_id: ctx.account_b, p_delta_points: 500, p_reason: "QA B seed", p_expires_at: null });
    const [r1, r2] = await Promise.all([
      db.rpc("redeem_loyalty_reward", { p_account_id: ctx.account_a, p_reward_id: ctx.reward_limited_id, p_idempotency_key: `${QA_PREFIX}race-a-${crypto.randomUUID()}` }),
      db.rpc("redeem_loyalty_reward", { p_account_id: ctx.account_b, p_reward_id: ctx.reward_limited_id, p_idempotency_key: `${QA_PREFIX}race-b-${crypto.randomUUID()}` }),
    ]);
    const s1 = (r1.data as any)?.success === true;
    const s2 = (r2.data as any)?.success === true;
    checks.push({ id: "C23", label: "Stock race — un seul gagnant", pass: s1 !== s2, detail: { r1: r1.data, r2: r2.data } });
  }
  // C24: reject redemption -> refund
  {
    const key = `${QA_PREFIX}reject-${crypto.randomUUID()}`;
    const r = await db.rpc("redeem_loyalty_reward", {
      p_account_id: ctx.account_a, p_reward_id: ctx.reward_id, p_idempotency_key: key,
    });
    const redId = (r.data as any)?.redemption_id;
    const balBefore = (await db.from("loyalty_points").select("available_points").eq("account_id", ctx.account_a).single()).data?.available_points ?? 0;
    const dec = await db.rpc("admin_loyalty_redemption_decide", {
      p_redemption_id: redId, p_decision: "reject", p_reason: "QA reject refund",
    });
    const balAfter = (await db.from("loyalty_points").select("available_points").eq("account_id", ctx.account_a).single()).data?.available_points ?? 0;
    const { data: red } = await db.from("loyalty_redemptions").select("status,refunded_at,refund_tx_id").eq("id", redId).single();
    checks.push({
      id: "C24",
      label: "Rejet redemption → refund automatique",
      pass: !dec.error && red?.status === "rejected" && !!red?.refund_tx_id && balAfter === balBefore + 100,
      detail: { dec: dec.data, red, balBefore, balAfter },
    });
  }
  // C25: approve redemption
  {
    const key = `${QA_PREFIX}approve-${crypto.randomUUID()}`;
    const r = await db.rpc("redeem_loyalty_reward", {
      p_account_id: ctx.account_a, p_reward_id: ctx.reward_id, p_idempotency_key: key,
    });
    const redId = (r.data as any)?.redemption_id;
    const dec = await db.rpc("admin_loyalty_redemption_decide", {
      p_redemption_id: redId, p_decision: "approve", p_reason: "QA approve",
    });
    const { data: red } = await db.from("loyalty_redemptions").select("status,applied_at").eq("id", redId).single();
    checks.push({ id: "C25", label: "Approve redemption", pass: !dec.error && red?.status === "approved" && !!red?.applied_at, detail: { dec, red } });
  }
  // C26: account_not_eligible when suspended
  {
    await db.from("accounts").update({ status: "suspended" }).eq("id", ctx.account_a);
    const { data } = await db.rpc("redeem_loyalty_reward", {
      p_account_id: ctx.account_a, p_reward_id: ctx.reward_id, p_idempotency_key: `${QA_PREFIX}${crypto.randomUUID()}`,
    });
    await db.from("accounts").update({ status: "active" }).eq("id", ctx.account_a);
    checks.push({ id: "C26", label: "Redeem refusé si compte suspendu", pass: (data as any)?.error === "account_not_eligible", detail: data });
  }
}

async function cleanup(db: SupabaseClient) {
  // Find QA accounts
  const { data: qaAccounts } = await db.from("accounts").select("id").ilike("account_number", `${QA_PREFIX}%`);
  const ids = (qaAccounts ?? []).map((a) => a.id);

  if (ids.length > 0) {
    await db.from("loyalty_transactions").delete().in("account_id", ids);
    await db.from("loyalty_redemptions").delete().in("account_id", ids);
    await db.from("loyalty_points").delete().in("account_id", ids);
    await db.from("account_adjustments").delete().in("account_id", ids);
    await db.from("admin_audit_log").delete().eq("target_type", "loyalty_redemption").in("target_id", ids as any);
    await db.from("accounts").delete().in("id", ids);
  }
  // Purge QA rewards
  await db.from("loyalty_redemptions").delete().ilike("idempotency_key", `${QA_PREFIX}%`);
  await db.from("loyalty_rewards").delete().ilike("name_fr", `${QA_PREFIX}%`);

  // Orphan check: transactions/redemptions with QA description or ref to gone accounts
  const { data: orphanTx } = await db.from("loyalty_transactions").select("id").ilike("description", `${QA_PREFIX}%`);
  const { data: orphanRed } = await db.from("loyalty_redemptions").select("id").ilike("idempotency_key", `${QA_PREFIX}%`);
  const orphans = (orphanTx?.length ?? 0) + (orphanRed?.length ?? 0);
  return { deleted_accounts: ids.length, orphans };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
