// QA runner — Module 27 (VIP / Churn risk / Tags)
// E2E validation of account-tags-actions {list, add, remove, apply_lock}
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Check = { id: string; name: string; ok: boolean; details?: unknown };

const CANONICAL_TAGS = [
  "vip", "loyal", "churn_risk", "watchlist", "at_risk", "collections",
  "escalation_required", "satisfaction_risk", "chargeback_history",
  "do_not_contact", "fraud_suspected", "litigation",
  "full_lock", "payment_lock", "portal_lock",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const keep = !!body?.keep;
  const checks: Check[] = [];
  const push = (c: Check) => checks.push(c);

  const callEF = async (accessToken: string, payload: unknown) => {
    const r = await fetch(`${url}/functions/v1/account-tags-actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    });
    let j: any = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
  };

  // --- helpers ----------------------------------------------------------
  const ensureCaller = async (email: string, role: string) => {
    const password = `Qa27!${crypto.randomUUID()}`;
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let userId: string;
    if (ep?.user_id) {
      await admin.auth.admin.updateUserById(ep.user_id, { password });
      userId = ep.user_id;
    } else {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { qa: "m27" },
      });
      if (error || !nu?.user) throw new Error(`createUser ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA27-${Date.now().toString().slice(-6)}-${role[0]}`,
        first_name: role, last_name: "QA-M27", email,
      });
    }
    // Reset role rows for this user (keep it deterministic)
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role });
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    const tj = await r.json();
    if (!tj?.access_token) throw new Error(`signin ${email}: ${JSON.stringify(tj)}`);
    return { userId, jwt: tj.access_token as string };
  };

  const ensureClient = async (email: string, label: string) => {
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let userId: string;
    if (ep?.user_id) userId = ep.user_id;
    else {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password: `Qa27!${crypto.randomUUID()}`, email_confirm: true, user_metadata: { qa: "m27_client" },
      });
      if (error || !nu?.user) throw new Error(`createClient ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA27C-${Date.now().toString().slice(-6)}-${label}`,
        first_name: `Client${label}`, last_name: "QA-M27", email,
      });
    }
    // Account
    const { data: existing } = await admin.from("accounts")
      .select("id, status").eq("client_id", userId).maybeSingle();
    if (existing) {
      await admin.from("accounts").update({ status: "active" }).eq("id", existing.id);
      return { userId, accountId: existing.id as string };
    }
    const { data: acc, error } = await admin.from("accounts").insert({
      client_id: userId,
      account_number: `QA27-${label}-${Date.now().toString().slice(-6)}`,
      account_name: `QA M27 ${label}`, status: "active",
      billing_address: "1 QA St", billing_city: "Laval",
      billing_province: "QC", billing_postal_code: "H7T 2Y5",
      primary_service_address: "1 QA St", primary_service_city: "Laval",
      primary_service_province: "QC", primary_service_postal_code: "H7T 2Y5",
    }).select("id").single();
    if (error) throw new Error(`account ${label}: ${error.message}`);
    return { userId, accountId: acc.id as string };
  };

  const cleanupTags = async (clientId: string) => {
    await admin.from("account_tags").delete().eq("client_user_id", clientId);
  };
  const cleanupLogs = async (clientId: string, callerIds: string[]) => {
    await admin.from("client_activity_logs").delete().eq("client_id", clientId);
    await admin.from("activity_logs").delete().eq("user_id", clientId);
    await admin.from("client_internal_notes").delete().eq("client_id", clientId);
    for (const id of callerIds) {
      await admin.from("admin_audit_log").delete().eq("admin_user_id", id);
    }
  };

  try {
    // ---- Setup callers & clients --------------------------------------
    const adminCaller = await ensureCaller("qa-m27-admin@nivra-test.ca", "admin");
    const salesCaller = await ensureCaller("qa-m27-sales@nivra-test.ca", "sales");
    const managerCaller = await ensureCaller("qa-m27-manager@nivra-test.ca", "supervisor");
    const clientA = await ensureClient("qa-m27-client-a@nivra-test.ca", "A");
    const clientB = await ensureClient("qa-m27-client-b@nivra-test.ca", "B");

    // Fresh state
    await cleanupTags(clientA.userId);
    await cleanupTags(clientB.userId);
    await cleanupLogs(clientA.userId, [adminCaller.userId, salesCaller.userId, managerCaller.userId]);
    await cleanupLogs(clientB.userId, [adminCaller.userId, salesCaller.userId, managerCaller.userId]);

    // ---- 1) LIST + catalogue ------------------------------------------
    {
      const r = await callEF(adminCaller.jwt, { action: "list", client_user_id: clientA.userId });
      const presets: any[] = r.body?.presets ?? [];
      const keys = presets.map((p) => p.key).sort();
      const expected = [...CANONICAL_TAGS].sort();
      push({ id: "C1", name: "list ok, 200", ok: r.status === 200 && r.body?.ok === true, details: { status: r.status } });
      push({ id: "C2", name: "catalogue = 15 canonical keys",
        ok: JSON.stringify(keys) === JSON.stringify(expected),
        details: { got: keys, missing: expected.filter((k) => !keys.includes(k)) } });
    }

    // ---- 2) ADD unknown tag -------------------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "not_a_real_tag", reason: "trying unknown tag key",
      });
      push({ id: "C3", name: "unknown tag → 400 UNKNOWN_TAG",
        ok: r.status === 400 && r.body?.code === "UNKNOWN_TAG", details: r });
    }

    // ---- 3) ADD without reason ----------------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "churn_risk",
      });
      push({ id: "C4", name: "add without reason → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.code === "REASON_REQUIRED", details: r });
    }

    // ---- 4) ADD with reason too short ---------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "churn_risk", reason: "abc",
      });
      push({ id: "C5", name: "reason < 5 chars → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.code === "REASON_REQUIRED", details: r });
    }

    // ---- 5) Role gating: sales cannot add fraud_suspected -------------
    {
      const r = await callEF(salesCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "fraud_suspected", reason: "attempted fraud tag by sales",
      });
      push({ id: "C6", name: "sales adding fraud_suspected → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.code === "FORBIDDEN_ROLE", details: r });
    }

    // ---- 6) Role gating: sales cannot add vip (admin/manager only) ----
    {
      const r = await callEF(salesCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "vip", reason: "attempted vip by sales",
      });
      push({ id: "C7", name: "sales adding vip → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.code === "FORBIDDEN_ROLE", details: r });
    }

    // ---- 7) manager CAN add vip ---------------------------------------
    let vipTagId: string | null = null;
    {
      const r = await callEF(managerCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "vip", reason: "client VIP validated",
      });
      vipTagId = r.body?.tag?.id ?? null;
      push({ id: "C8", name: "manager add vip → 200", ok: r.status === 200 && !!vipTagId, details: r });
    }

    // ---- 8) Cross-client: pass clientA id with clientB account --------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientB.accountId,
        tag_key: "churn_risk", reason: "cross-client attempt",
      });
      push({ id: "C9", name: "cross-client account → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.code === "CROSS_CLIENT_TARGET", details: r });
    }

    // ---- 9) ADD churn_risk (valid) ------------------------------------
    let churnTagId: string | null = null;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "churn_risk", reason: "downgrade signals detected",
      });
      churnTagId = r.body?.tag?.id ?? null;
      push({ id: "C10", name: "admin add churn_risk → 200", ok: r.status === 200 && !!churnTagId, details: r });
    }

    // ---- 10) Duplicate --------------------------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "churn_risk", reason: "duplicate attempt",
      });
      push({ id: "C11", name: "duplicate tag → 409 DUPLICATE_ACTIVE",
        ok: r.status === 409 && r.body?.code === "DUPLICATE_ACTIVE", details: r });
    }

    // ---- 11) expires_at in past ---------------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "watchlist", reason: "trying past expires_at",
        expires_at: new Date(Date.now() - 3600_000).toISOString(),
      });
      push({ id: "C12", name: "expires_at passé → 400 INVALID_INPUT",
        ok: r.status === 400 && r.body?.code === "INVALID_INPUT", details: r });
    }

    // ---- 12) expires_at valid + auto-hide -----------------------------
    let expiringTagId: string | null = null;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "watchlist", reason: "watch with future expiry",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      });
      expiringTagId = r.body?.tag?.id ?? null;
      push({ id: "C13", name: "expires_at futur → 200", ok: r.status === 200 && !!expiringTagId, details: r });

      // Force expiry into the past directly in DB then re-list
      if (expiringTagId) {
        await admin.from("account_tags").update({
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        }).eq("id", expiringTagId);
        const l = await callEF(adminCaller.jwt, { action: "list", client_user_id: clientA.userId });
        const shown = (l.body?.tags ?? []).map((t: any) => t.id);
        push({ id: "C14", name: "list masque les tags expirés",
          ok: !shown.includes(expiringTagId), details: { shown } });
      }
    }

    // ---- 13) Idempotency ----------------------------------------------
    {
      const key = `qa27-${crypto.randomUUID()}`;
      const r1 = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "loyal", reason: "loyal customer flag", idempotency_key: key,
      });
      const r2 = await callEF(adminCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "loyal", reason: "loyal customer flag", idempotency_key: key,
      });
      push({ id: "C15", name: "idempotency replay → 200 replay=true",
        ok: r1.status === 200 && r2.status === 200 && r2.body?.replay === true,
        details: { r1: r1.body?.tag?.id, r2 } });
    }

    // ---- 14) REMOVE without reason ------------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "remove", client_user_id: clientA.userId, tag_id: churnTagId,
      });
      push({ id: "C16", name: "remove sans motif → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.code === "REASON_REQUIRED", details: r });
    }

    // ---- 15) REMOVE non-existent --------------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "remove", client_user_id: clientA.userId,
        tag_id: "00000000-0000-0000-0000-000000000000", reason: "should not exist",
      });
      push({ id: "C17", name: "remove tag inconnu → 404 NOT_FOUND",
        ok: r.status === 404 && r.body?.code === "NOT_FOUND", details: r });
    }

    // ---- 16) REMOVE ok ------------------------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "remove", client_user_id: clientA.userId, tag_id: churnTagId,
        reason: "resolved after outreach",
      });
      push({ id: "C18", name: "remove churn_risk → 200", ok: r.status === 200, details: r });
    }

    // ---- 17) apply_lock invalid mode ----------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "apply_lock", client_user_id: clientA.userId, account_id: clientA.accountId,
        lock_mode: "bogus", reason: "invalid mode attempt with plenty of chars",
      } as any);
      push({ id: "C19", name: "apply_lock mode invalide → 400",
        ok: r.status === 400 && r.body?.code === "INVALID_INPUT", details: r });
    }

    // ---- 18) apply_lock non-admin (manager) ---------------------------
    {
      const r = await callEF(managerCaller.jwt, {
        action: "apply_lock", client_user_id: clientA.userId, account_id: clientA.accountId,
        lock_mode: "full_lock", reason: "manager attempts lock — should fail",
      });
      push({ id: "C20", name: "manager apply_lock → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.code === "FORBIDDEN_ROLE", details: r });
    }

    // ---- 19) apply_lock reason < 10 -----------------------------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "apply_lock", client_user_id: clientA.userId, account_id: clientA.accountId,
        lock_mode: "full_lock", reason: "short",
      });
      push({ id: "C21", name: "apply_lock motif < 10 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.code === "REASON_REQUIRED", details: r });
    }

    // ---- 20) apply_lock full_lock admin ok → blocked + tag ------------
    {
      const r = await callEF(adminCaller.jwt, {
        action: "apply_lock", client_user_id: clientA.userId, account_id: clientA.accountId,
        lock_mode: "full_lock", reason: "confirmed fraud on this account — locking",
      });
      const { data: acc } = await admin.from("accounts").select("status").eq("id", clientA.accountId).maybeSingle();
      const { data: tag } = await admin.from("account_tags").select("*")
        .eq("client_user_id", clientA.userId).eq("tag_key", "full_lock").maybeSingle();
      push({ id: "C22", name: "apply_lock full_lock admin → 200 + status=blocked + tag présent",
        ok: r.status === 200 && acc?.status === "blocked" && !!tag,
        details: { status: r.status, account_status: acc?.status, tag_present: !!tag } });
    }

    // ---- 21) apply_lock payment_lock (no status change) ---------------
    {
      // Reset account status to active so we can assert no change
      await admin.from("accounts").update({ status: "active" }).eq("id", clientA.accountId);
      await admin.from("account_tags").delete().eq("client_user_id", clientA.userId).eq("tag_key", "payment_lock");
      const r = await callEF(adminCaller.jwt, {
        action: "apply_lock", client_user_id: clientA.userId, account_id: clientA.accountId,
        lock_mode: "payment_lock", reason: "temporarily block payments after chargeback",
      });
      const { data: acc } = await admin.from("accounts").select("status").eq("id", clientA.accountId).maybeSingle();
      push({ id: "C23", name: "payment_lock → tag OK, status inchangé (active)",
        ok: r.status === 200 && acc?.status === "active" && !!r.body?.tag, details: { r, acc } });
    }

    // ---- 22) Parity logs ---------------------------------------------
    {
      const { count: adminCount } = await admin
        .from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("admin_user_id", adminCaller.userId)
        .eq("target_id", clientA.userId);
      const { count: cal } = await admin
        .from("client_activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientA.userId)
        .eq("action_type", "account_tag");
      const { count: al } = await admin
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", clientA.userId)
        .eq("entity_type", "account_tag");
      const { count: notes } = await admin
        .from("client_internal_notes")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientA.userId)
        .eq("note_type", "system");
      push({ id: "C24", name: "admin_audit_log > 0", ok: (adminCount ?? 0) > 0, details: { adminCount } });
      push({ id: "C25", name: "client_activity_logs account_tag > 0", ok: (cal ?? 0) > 0, details: { cal } });
      push({ id: "C26", name: "activity_logs entity_type=account_tag > 0", ok: (al ?? 0) > 0, details: { al } });
      push({ id: "C27", name: "client_internal_notes system > 0", ok: (notes ?? 0) > 0, details: { notes } });
    }

    // ---- 23) Anti-flood (seed 20 audit rows, expect 429) --------------
    {
      const nowIso = new Date().toISOString();
      const rows = Array.from({ length: 20 }).map(() => ({
        admin_user_id: salesCaller.userId,
        admin_email: "qa-m27-sales@nivra-test.ca",
        action: "account_ops.tag_add",
        target_type: "user",
        target_id: clientA.userId,
        details: { seed: "flood", ts: nowIso },
      }));
      await admin.from("admin_audit_log").insert(rows);
      const r = await callEF(salesCaller.jwt, {
        action: "add", client_user_id: clientA.userId, account_id: clientA.accountId,
        tag_key: "loyal", reason: "flood test call after seed",
      });
      push({ id: "C28", name: "anti-flood → 429 RATE_LIMIT",
        ok: r.status === 429 && r.body?.code === "RATE_LIMIT", details: r });
      // Clean seeded rows
      await admin.from("admin_audit_log").delete()
        .eq("admin_user_id", salesCaller.userId)
        .contains("details", { seed: "flood" });
    }

    // ---- 24) Cleanup -------------------------------------------------
    if (!keep) {
      await cleanupTags(clientA.userId);
      await cleanupTags(clientB.userId);
      await cleanupLogs(clientA.userId, [adminCaller.userId, salesCaller.userId, managerCaller.userId]);
      await cleanupLogs(clientB.userId, [adminCaller.userId, salesCaller.userId, managerCaller.userId]);
      await admin.from("accounts").update({ status: "active" }).eq("id", clientA.accountId);
    }

    const pass = checks.filter((c) => c.ok).length;
    const fail = checks.length - pass;
    return json({
      module: "M27",
      total: checks.length, pass, fail,
      status: fail === 0 ? "PASS" : "FAIL",
      checks,
    });
  } catch (e) {
    return json({ error: (e as Error).message, checks }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
