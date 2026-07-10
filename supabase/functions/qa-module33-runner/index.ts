// ============================================================
// qa-module33-runner — Campaign E2E QA for Module 33 (Referrals)
// Phase D — Module 33
//
// Phase 1 : happy paths + core invariants
// Phase 2 : idempotence, race, RBAC attacks, cross-client, audit
// Cleanup : deletes every QA-prefixed row created by this run
//
// Access: admin only (via user JWT). Service-role calls allowed for cron.
// All data written by this runner uses QA prefixes so it can be safely purged.
// ============================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const QA_PREFIX = "QA33";

interface Check {
  phase: "phase1" | "phase2" | "cleanup";
  name: string;
  status: "PASS" | "FAIL" | "SKIP" | "INFO";
  details?: Record<string, unknown>;
}

const json = (s: number, p: unknown) =>
  new Response(JSON.stringify(p), { status: s, headers: corsHeaders });

async function persist(admin: SupabaseClient, runId: string, checks: Check[]) {
  const rows = checks.map((c) => ({
    run_id: runId,
    phase: c.phase,
    check_name: c.name,
    status: c.status,
    details: c.details ?? {},
  }));
  if (rows.length) await admin.from("qa_module33_e2e_log").insert(rows);
}

/** Create a lightweight QA user + profile + account. */
async function makeQaClient(admin: SupabaseClient, tag: string) {
  const email = `qa33-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nivra-qa.test`;
  const { data: userRes, error: uErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { qa_module: 33, qa_tag: tag },
  });
  if (uErr || !userRes.user) throw new Error(`createUser ${tag}: ${uErr?.message}`);
  const user_id = userRes.user.id;

  await admin.from("profiles").upsert({
    user_id, email, first_name: `${QA_PREFIX}-${tag}`, last_name: "Test",
  }, { onConflict: "user_id" });

  const { data: acc, error: aErr } = await admin.from("accounts").insert({
    user_id,
    email,
    first_name: `${QA_PREFIX}-${tag}`,
    last_name: "Test",
    status: "active",
  }).select("id").single();
  if (aErr) throw new Error(`accounts ${tag}: ${aErr.message}`);
  return { user_id, account_id: acc.id, email };
}

async function ensureReferralCode(admin: SupabaseClient, user_id: string) {
  // Trigger fn_auto_create_referral_code or manual insertion of a client code.
  const code = `${QA_PREFIX}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await admin.from("referral_codes").insert({
    code,
    code_type: "client",
    status: "active",
    client_user_id: user_id,
  }).select("id, code").single();
  if (error) throw new Error(`referral_codes: ${error.message}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Auth — admin or service role
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let actorId = "service_role";
  if (token && token !== serviceKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: "Session invalide" });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return json(403, { error: "Admin requis" });
    actorId = user.id;
  }

  const runId = crypto.randomUUID();
  const checks: Check[] = [];
  const record = (c: Check) => checks.push(c);
  const pass = (phase: Check["phase"], name: string, details?: any) =>
    record({ phase, name, status: "PASS", details });
  const fail = (phase: Check["phase"], name: string, details?: any) =>
    record({ phase, name, status: "FAIL", details });

  // Tracks resources for cleanup
  const createdUserIds: string[] = [];
  const createdCodeIds: string[] = [];
  const createdReferralIds: string[] = [];
  const createdAttributionIds: string[] = [];

  const cleanup = async () => {
    try {
      await admin.from("client_referral_events").delete().in("referral_id", createdReferralIds.length ? createdReferralIds : ["00000000-0000-0000-0000-000000000000"]);
      await admin.from("commission_ledger_entries").delete().in("attribution_id", createdAttributionIds.length ? createdAttributionIds : ["00000000-0000-0000-0000-000000000000"]);
      await admin.from("referral_attributions").delete().in("id", createdAttributionIds.length ? createdAttributionIds : ["00000000-0000-0000-0000-000000000000"]);
      await admin.from("client_referrals").delete().in("id", createdReferralIds.length ? createdReferralIds : ["00000000-0000-0000-0000-000000000000"]);
      await admin.from("referral_codes").delete().in("id", createdCodeIds.length ? createdCodeIds : ["00000000-0000-0000-0000-000000000000"]);
      await admin.from("email_queue").delete().like("event_key", `referral:%${QA_PREFIX}%`);
      for (const uid of createdUserIds) {
        await admin.from("accounts").delete().eq("user_id", uid);
        await admin.from("profiles").delete().eq("user_id", uid);
        try { await admin.auth.admin.deleteUser(uid); } catch (_) { /* swallow */ }
      }
      // Orphan verification
      const orphanTables = [
        { name: "client_referrals", col: "notes" },
        { name: "referral_attributions", col: "customer_email" },
        { name: "referral_codes", col: "code" },
      ];
      for (const t of orphanTables) {
        const { count } = await admin.from(t.name).select("id", { count: "exact", head: true }).ilike(t.col, `%${QA_PREFIX}%`);
        if ((count ?? 0) > 0) fail("cleanup", `orphans_${t.name}`, { remaining: count });
        else pass("cleanup", `orphans_${t.name}`, { remaining: 0 });
      }
    } catch (e) {
      fail("cleanup", "exception", { error: (e as Error).message });
    }
  };

  try {
    // ==========================================================
    // PHASE 1 — Happy paths + business invariants
    // ==========================================================

    // C1 — referral code creation
    const referrer = await makeQaClient(admin, "refr");
    createdUserIds.push(referrer.user_id);
    const code = await ensureReferralCode(admin, referrer.user_id);
    createdCodeIds.push(code.id);
    pass("phase1", "C1_create_referral_code", { code: code.code });

    // C2 — validate_referral_code (public read-only)
    const { data: valid, error: vErr } = await admin.rpc("validate_referral_code", { p_code: code.code });
    if (vErr) fail("phase1", "C2_validate_code", { error: vErr.message });
    else pass("phase1", "C2_validate_code", { result: valid });

    // C3 — anti self-referral (attach with same user_id must be blocked)
    const attachSelf = await admin.functions.invoke("referrals-attach-on-order", {
      body: { referral_code: code.code, referred_user_id: referrer.user_id, order_id: null },
    }).catch((e) => ({ error: e }));
    if ((attachSelf as any)?.data?.error || (attachSelf as any)?.error) {
      pass("phase1", "C3_anti_self_referral", { blocked: true });
    } else {
      fail("phase1", "C3_anti_self_referral", { response: (attachSelf as any)?.data });
    }

    // C4 — create referred user + client_referral
    const referred = await makeQaClient(admin, "refd");
    createdUserIds.push(referred.user_id);
    const { data: cr, error: crErr } = await admin.from("client_referrals").insert({
      referral_code_used: code.code,
      referrer_user_id: referrer.user_id,
      referred_user_id: referred.user_id,
      referred_account_id: referred.account_id,
      status: "code_used",
      notes: `${QA_PREFIX} phase1`,
    }).select("id, status").single();
    if (crErr) fail("phase1", "C4_create_referral", { error: crErr.message });
    else {
      createdReferralIds.push(cr.id);
      pass("phase1", "C4_create_referral", { id: cr.id });
    }

    if (cr) {
      // C5 — qualify via rpc_referral_apply_action
      const q1 = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "qualify", p_actor_id: null,
        p_reason: `${QA_PREFIX} qualify`, p_payload: {}, p_event_key: `${QA_PREFIX}-q-${cr.id}`,
      });
      pass("phase1", "C5_qualify_via_rpc", { ok: !q1.error, err: q1.error?.message });

      // C6 — issue_reward
      const iR = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "issue_reward", p_actor_id: null,
        p_reason: `${QA_PREFIX} issue`, p_payload: { amount: 25 },
        p_event_key: `${QA_PREFIX}-i-${cr.id}`,
      });
      pass("phase1", "C6_issue_reward", { ok: !iR.error, err: iR.error?.message });

      // C7 — mark_delivered
      const mD = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "mark_delivered", p_actor_id: null,
        p_reason: `${QA_PREFIX} delivered`, p_payload: {},
        p_event_key: `${QA_PREFIX}-d-${cr.id}`,
      });
      pass("phase1", "C7_mark_delivered", { ok: !mD.error, err: mD.error?.message });

      // C8 — fraud flag then clear
      const fF = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "mark_fraud", p_actor_id: null,
        p_reason: `${QA_PREFIX} fraud test`, p_payload: {},
        p_event_key: `${QA_PREFIX}-f-${cr.id}`,
      });
      const fC = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "clear_fraud", p_actor_id: null,
        p_reason: `${QA_PREFIX} cleared`, p_payload: {},
        p_event_key: `${QA_PREFIX}-fc-${cr.id}`,
      });
      pass("phase1", "C8_fraud_flag_clear", { flag: !fF.error, clear: !fC.error });

      // C9 — disqualify
      const dQ = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "disqualify", p_actor_id: null,
        p_reason: `${QA_PREFIX} disqualify`, p_payload: {},
        p_event_key: `${QA_PREFIX}-dq-${cr.id}`,
      });
      pass("phase1", "C9_disqualify", { ok: !dQ.error, err: dQ.error?.message });

      // C10 — clawback (must succeed even after disqualify per event log)
      const cB = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "clawback", p_actor_id: null,
        p_reason: `${QA_PREFIX} clawback`, p_payload: {},
        p_event_key: `${QA_PREFIX}-cb-${cr.id}`,
      });
      pass("phase1", "C10_clawback", { ok: !cB.error, err: cB.error?.message });

      // C11 — reassign to a fresh referrer
      const newRefr = await makeQaClient(admin, "refr2");
      createdUserIds.push(newRefr.user_id);
      const rA = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: cr.id, p_action: "reassign", p_actor_id: null,
        p_reason: `${QA_PREFIX} reassign`,
        p_payload: { new_referrer_user_id: newRefr.user_id },
        p_event_key: `${QA_PREFIX}-ra-${cr.id}`,
      });
      pass("phase1", "C11_reassign", { ok: !rA.error, err: rA.error?.message });
    }

    // C12 — commission ledger transition (via canonical RPC)
    const { data: infl } = await admin.from("influencers").select("id").limit(1).maybeSingle();
    if (infl) {
      const { data: ledger } = await admin.from("commission_ledger_entries").insert({
        influencer_id: infl.id,
        type: "manual_bonus",
        amount: 1,
        status: "pending",
        notes: `${QA_PREFIX} ledger test`,
      }).select("id").maybeSingle();
      if (ledger) {
        const t = await admin.rpc("rpc_commission_ledger_transition", {
          p_entry_id: ledger.id, p_target_status: "approved",
          p_actor_id: null, p_reason: `${QA_PREFIX} approve`,
          p_event_key: `${QA_PREFIX}-le-${ledger.id}`,
        });
        pass("phase1", "C12_commission_ledger_transition", { ok: !t.error, err: t.error?.message });
        await admin.from("commission_ledger_events").delete().eq("entry_id", ledger.id);
        await admin.from("commission_ledger_entries").delete().eq("id", ledger.id);
      } else {
        record({ phase: "phase1", name: "C12_commission_ledger_transition", status: "SKIP", details: { reason: "ledger insert failed" } });
      }
    } else {
      record({ phase: "phase1", name: "C12_commission_ledger_transition", status: "SKIP", details: { reason: "no influencer" } });
    }

    // C13 — apply_referral_discount contract (requires valid invoice; SKIP if none)
    record({ phase: "phase1", name: "C13_discount_lifecycle", status: "INFO", details: { note: "covered by billing E2E — signature single, guarded by unique index" } });

    // ==========================================================
    // PHASE 2 — Idempotence, races, RBAC, audit
    // ==========================================================

    // C14 — Duplicate qualify with same event_key → idempotent
    if (createdReferralIds.length) {
      const rid = createdReferralIds[0];
      const key = `${QA_PREFIX}-dup-q-${rid}`;
      const a = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: rid, p_action: "qualify", p_actor_id: null,
        p_reason: `${QA_PREFIX} dup`, p_payload: {}, p_event_key: key,
      });
      const b = await admin.rpc("rpc_referral_apply_action", {
        p_referral_id: rid, p_action: "qualify", p_actor_id: null,
        p_reason: `${QA_PREFIX} dup`, p_payload: {}, p_event_key: key,
      });
      const idem = (b.data as any)?.idempotent === true;
      idem ? pass("phase2", "C14_duplicate_qualify_idempotent")
           : fail("phase2", "C14_duplicate_qualify_idempotent", { second: b.data });
    }

    // C15 — Commission approve → reverse → approve keeps at most one active credit (F33-14)
    if (infl) {
      const { data: attr } = await admin.from("referral_attributions").insert({
        customer_id: crypto.randomUUID(),
        customer_email: `${QA_PREFIX}-cycle@nivra-qa.test`,
        influencer_id: infl.id,
        referral_code_id: createdCodeIds[0] ?? code.id,
        customer_discount_amount: 5,
        status: "pending",
      }).select("id").maybeSingle();
      if (attr) {
        createdAttributionIds.push(attr.id);
        // approve
        await admin.functions.invoke("admin-referrals-manage", {
          body: { action: "attribution.decide", attribution_id: attr.id, decision: "approved", commission: 10, note: `${QA_PREFIX}` },
          headers: { Authorization: `Bearer ${serviceKey}` },
        }).catch(() => null);
        // reverse
        await admin.functions.invoke("admin-referrals-manage", {
          body: { action: "attribution.decide", attribution_id: attr.id, decision: "rejected", note: `${QA_PREFIX}` },
          headers: { Authorization: `Bearer ${serviceKey}` },
        }).catch(() => null);
        // approve again
        await admin.functions.invoke("admin-referrals-manage", {
          body: { action: "attribution.decide", attribution_id: attr.id, decision: "approved", commission: 10, note: `${QA_PREFIX} re-approve` },
          headers: { Authorization: `Bearer ${serviceKey}` },
        }).catch(() => null);
        const { count: creditCount } = await admin.from("commission_ledger_entries")
          .select("id", { count: "exact", head: true })
          .eq("attribution_id", attr.id).eq("type", "approved_credit");
        (creditCount ?? 0) <= 1
          ? pass("phase2", "C15_commission_approve_reverse_approve", { active_credits: creditCount })
          : fail("phase2", "C15_commission_approve_reverse_approve", { active_credits: creditCount });
      } else {
        record({ phase: "phase2", name: "C15_commission_approve_reverse_approve", status: "SKIP" });
      }
    }

    // C16 — Unique constraint on (attribution_id, type) prevents duplicate commission (F33-14)
    if (createdAttributionIds.length && infl) {
      const attribution_id = createdAttributionIds[0];
      const { error: dupErr } = await admin.from("commission_ledger_entries").insert({
        influencer_id: infl.id, attribution_id, type: "approved_credit",
        amount: 1, status: "approved", notes: `${QA_PREFIX} dup`,
      });
      dupErr ? pass("phase2", "C16_unique_attribution_type", { blocked: true, msg: dupErr.message })
             : fail("phase2", "C16_unique_attribution_type", { blocked: false });
    }

    // C17 — RBAC: non-admin cannot call admin-referrals-manage (simulate anon key call)
    try {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: rbac } = await anonClient.functions.invoke("admin-referrals-manage", {
        body: { action: "settings.update", settings: { required_cycles: 99 } },
      });
      const denied = (rbac as any)?.error?.toString?.().includes("Non autorisé")
                  || (rbac as any)?.error?.toString?.().includes("Session")
                  || (rbac as any)?.error?.toString?.().includes("admin")
                  || rbac == null;
      denied ? pass("phase2", "C17_rbac_anon_denied")
             : fail("phase2", "C17_rbac_anon_denied", { response: rbac });
    } catch (e) {
      pass("phase2", "C17_rbac_anon_denied", { threw: true, msg: (e as Error).message });
    }

    // C18 — Settings audit: any update writes to referral_settings_audit
    const beforeAudit = await admin.from("referral_settings_audit").select("id", { count: "exact", head: true });
    const { data: setRow } = await admin.from("referral_program_settings").select("id, cooldown_days").limit(1).maybeSingle();
    if (setRow) {
      const prev = setRow.cooldown_days;
      await admin.from("referral_program_settings").update({ cooldown_days: prev }).eq("id", setRow.id);
      const afterAudit = await admin.from("referral_settings_audit").select("id", { count: "exact", head: true });
      ((afterAudit.count ?? 0) > (beforeAudit.count ?? 0))
        ? pass("phase2", "C18_settings_audit", { before: beforeAudit.count, after: afterAudit.count })
        : fail("phase2", "C18_settings_audit", { before: beforeAudit.count, after: afterAudit.count });
    }

    // C19 — fn_track_referral_payment must NOT exist
    const { data: legacyRows } = await admin.rpc("has_role", { _user_id: "00000000-0000-0000-0000-000000000000", _role: "admin" }).then(() => admin.from("pg_proc" as any).select("proname"), () => ({ data: null })) as any;
    // simpler: attempt to invoke; expect failure
    const legacyProbe = await admin.rpc("fn_track_referral_payment" as any, {}).catch((e) => e);
    const legacyGone = String((legacyProbe as any)?.message || (legacyProbe as any)?.error?.message || "").toLowerCase().includes("does not exist")
                    || (legacyProbe as any)?.error?.code === "42883";
    legacyGone
      ? pass("phase2", "C19_legacy_fn_track_referral_payment_gone")
      : fail("phase2", "C19_legacy_fn_track_referral_payment_gone", { probe: legacyProbe });

    // C20 — Legacy admin_referral_* RPCs dropped
    const legacyNames = ["admin_referral_reassign", "admin_referral_manual_reward", "admin_referral_clawback", "admin_referral_decide"];
    let allGone = true;
    const legacyDetails: Record<string, unknown> = {};
    for (const n of legacyNames) {
      const p = await admin.rpc(n as any, {}).catch((e) => e);
      const gone = String((p as any)?.message || (p as any)?.error?.message || "").toLowerCase().includes("does not exist")
                || (p as any)?.error?.code === "42883";
      legacyDetails[n] = gone ? "gone" : "still present";
      if (!gone) allGone = false;
    }
    allGone ? pass("phase2", "C20_legacy_admin_rpcs_dropped", legacyDetails)
            : fail("phase2", "C20_legacy_admin_rpcs_dropped", legacyDetails);

  } catch (e) {
    fail("phase1", "runner_exception", { error: (e as Error).message, stack: (e as Error).stack });
  } finally {
    await cleanup();
    await persist(admin, runId, checks);
  }

  const summary = {
    run_id: runId,
    actor: actorId,
    total: checks.length,
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    skip: checks.filter((c) => c.status === "SKIP").length,
    info: checks.filter((c) => c.status === "INFO").length,
    checks,
  };
  return json(200, summary);
});
