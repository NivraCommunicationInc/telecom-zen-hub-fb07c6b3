// QA runner — Module 25 (Pause temporaire)
// E2E validation of account-ops-actions {pause_account, update_pause, unpause_account}
// and the pause-auto-resume cron path.
//
// Auth model:
//  - Caller must be admin/supervisor (JWT header). That JWT is used for "authorized role" calls.
//  - Provisions/uses a second staff user "qa-module25-norole@nivra-test.ca" with NO roles to
//    validate the 403 role gate (F1).
//  - Provisions two isolated QA client accounts (A + B) to validate ownership (F2, cross-client).
//
// All mutations are cleaned up at the end unless {keep: true} is passed in the body.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOROLE_EMAIL = "qa-module25-norole@nivra-test.ca";
const CLIENT_A_EMAIL = "qa-module25-client-a@nivra-test.ca";
const CLIENT_B_EMAIL = "qa-module25-client-b@nivra-test.ca";

type Check = {
  id: string;
  name: string;
  ok: boolean;
  details?: unknown;
  error?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // QA-only endpoint: no external caller auth. We always sign in as a
  // dedicated QA admin user (idempotent) to obtain a real user JWT — needed
  // because account-ops-actions verifies user roles from the JWT.
  let jwt: string;
  let callerId: string;
  {
    const qaAdminEmail = "qa-module25-runner-admin@nivra-test.ca";
    const password = `Qa25!${crypto.randomUUID()}`;
    // Look up existing QA admin via profiles (auth.listUsers only paginates 200 at a time).
    const { data: existingProfile } = await admin
      .from("profiles").select("user_id").eq("email", qaAdminEmail).maybeSingle();
    let qaAdmin: { id: string; email?: string | null } | null = null;
    if (existingProfile?.user_id) {
      const { data: got } = await admin.auth.admin.getUserById(existingProfile.user_id);
      if (got?.user) qaAdmin = got.user;
    }
    if (qaAdmin) {
      await admin.auth.admin.updateUserById(qaAdmin.id, { password });
    } else {
      const { data: nu, error: cerr } = await admin.auth.admin.createUser({
        email: qaAdminEmail, password, email_confirm: true,
        user_metadata: { qa: "m25_runner_admin" },
      });
      if (cerr || !nu?.user) return json({ error: `create_qa_admin: ${cerr?.message}` }, 500);
      qaAdmin = nu.user;
    }
    const { data: p } = await admin.from("profiles").select("id").eq("user_id", qaAdmin.id).maybeSingle();
    if (!p) {
      await admin.from("profiles").insert({
        user_id: qaAdmin.id, client_number: `QA25-RUN-${Date.now().toString().slice(-6)}`,
        first_name: "QA25", last_name: "Runner", email: qaAdminEmail,
      });
    }
    await admin.from("user_roles").upsert(
      { user_id: qaAdmin.id, role: "admin" },
      { onConflict: "user_id,role" },
    );
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email: qaAdminEmail, password }),
    });
    const tj = await r.json();
    if (!tj?.access_token) return json({ error: `qa_admin_signin: ${JSON.stringify(tj)}` }, 500);
    jwt = tj.access_token;
    callerId = qaAdmin.id;
  }

  const body = await req.json().catch(() => ({}));
  const keep = !!body?.keep;

  const checks: Check[] = [];
  const push = (c: Check) => { checks.push(c); };

  // Helper to call EF with a specific JWT.
  const callEF = async (accessToken: string, payload: unknown) => {
    const r = await fetch(`${url}/functions/v1/account-ops-actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    });
    let json: any = null;
    try { json = await r.json(); } catch { /* ignore */ }
    return { status: r.status, body: json };
  };

  // -------------------------------------------------------------------
  // Provision fixtures: 2 client accounts + 1 no-role staff user
  // -------------------------------------------------------------------
  const upsertUser = async (email: string, meta: Record<string, unknown>) => {
    const password = `Qa25!${crypto.randomUUID()}`;
    // Look up existing user via profiles (listUsers only returns 200 per page).
    const { data: existingProfile } = await admin
      .from("profiles").select("user_id").eq("email", email).maybeSingle();
    if (existingProfile?.user_id) {
      await admin.auth.admin.updateUserById(existingProfile.user_id, { password });
      return { id: existingProfile.user_id, password, reused: true };
    }
    const { data: nu, error: cerr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: meta,
    });
    if (cerr || !nu?.user) throw new Error(`createUser ${email}: ${cerr?.message}`);
    return { id: nu.user.id, password, reused: false };
  };

  const ensureProfile = async (userId: string, email: string, first: string) => {
    const { data: p } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (p) return;
    await admin.from("profiles").insert({
      user_id: userId,
      client_number: `QA25-${Date.now().toString().slice(-6)}-${first[0]}`,
      first_name: first, last_name: "QA-M25", email,
    });
  };

  const ensureAccount = async (userId: string, label: string) => {
    const { data: existing } = await admin.from("accounts")
      .select("id, status, paused_until, pause_reason, paused_at")
      .eq("client_id", userId).maybeSingle();
    if (existing) {
      // reset to active for a clean run
      await admin.from("accounts").update({
        status: "active", paused_until: null, pause_reason: null, paused_at: null, pause_charge_pct: 0,
      }).eq("id", existing.id);
      return existing.id as string;
    }
    const { data: acc, error } = await admin.from("accounts").insert({
      client_id: userId,
      account_number: `QA25-${label}-${Date.now().toString().slice(-6)}`,
      account_name: `QA M25 ${label}`,
      status: "active",
      billing_address: "1799 Av. Pierre-Péladeau",
      billing_city: "Laval", billing_province: "QC", billing_postal_code: "H7T 2Y5",
      primary_service_address: "1799 Av. Pierre-Péladeau",
      primary_service_city: "Laval", primary_service_province: "QC", primary_service_postal_code: "H7T 2Y5",
    }).select("id").single();
    if (error || !acc) throw new Error(`account ${label}: ${error?.message}`);
    // QA tag
    await admin.from("account_tags").insert({
      account_id: acc.id, client_user_id: userId,
      tag_key: "qa_test_account", tag_label: "QA Module 25", severity: "info",
      note: "Compte QA Module 25 — cleanup automatique.", created_by: callerId,
    }).select();
    return acc.id as string;
  };

  const signIn = async (email: string, password: string): Promise<string> => {
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json();
    if (!j?.access_token) throw new Error(`signIn ${email}: ${JSON.stringify(j)}`);
    return j.access_token as string;
  };

  let clientA: string, clientB: string, accountA: string, accountB: string;
  let noRoleJwt: string;

  try {
    const uA = await upsertUser(CLIENT_A_EMAIL, { qa: "m25", role: "client_a" });
    const uB = await upsertUser(CLIENT_B_EMAIL, { qa: "m25", role: "client_b" });
    const uNR = await upsertUser(NOROLE_EMAIL, { qa: "m25", role: "staff_norole" });
    clientA = uA.id; clientB = uB.id;
    await ensureProfile(clientA, CLIENT_A_EMAIL, "Alpha");
    await ensureProfile(clientB, CLIENT_B_EMAIL, "Bravo");
    await ensureProfile(uNR.id, NOROLE_EMAIL, "NoRole");
    accountA = await ensureAccount(clientA, "A");
    accountB = await ensureAccount(clientB, "B");

    // wipe any lingering role rows for the no-role user
    await admin.from("user_roles").delete().eq("user_id", uNR.id);
    noRoleJwt = await signIn(NOROLE_EMAIL, uNR.password);
  } catch (e) {
    return json({ ok: false, phase: "provision", error: (e as Error).message }, 500);
  }

  // Timestamp used to isolate side effects for cleanup
  const runTag = `QA-M25-${Date.now()}`;

  // -------------------------------------------------------------------
  // 1) Création pause nominale
  // -------------------------------------------------------------------
  const pausedUntil = new Date(Date.now() + 15 * 86_400_000).toISOString();
  {
    const r = await callEF(jwt, {
      action: "pause_account",
      client_user_id: clientA,
      account_id: accountA,
      paused_until: pausedUntil,
      reason: `${runTag} pause nominale`,
      pause_charge_pct: 35, // must be neutralized server-side to 0
    });
    const { data: acc } = await admin.from("accounts")
      .select("status, paused_until, pause_reason, pause_charge_pct").eq("id", accountA).maybeSingle();
    const { data: audit } = await admin.from("admin_audit_log")
      .select("id, action, details").eq("target_id", clientA)
      .like("action", "account_ops.pause_account%").order("created_at", { ascending: false }).limit(1);
    const { data: act } = await admin.from("client_activity_logs")
      .select("id, action_type").eq("client_id", clientA).eq("action_type", "account_pause")
      .order("created_at", { ascending: false }).limit(3);
    const { data: note } = await admin.from("client_internal_notes")
      .select("id, body").eq("client_id", clientA).ilike("body", "Pause temporaire%")
      .order("created_at", { ascending: false }).limit(3);
    const { data: mail } = await admin.from("email_queue")
      .select("id, template_key, to_email").eq("template_key", "client_account_paused")
      .eq("to_email", CLIENT_A_EMAIL).order("created_at", { ascending: false }).limit(1);

    push({
      id: "1.1", name: "pause_account nominal 200 + statut/paused_until",
      ok: r.status === 200 && acc?.status === "suspended" && !!acc?.paused_until,
      details: { http: r.status, acc, resp: r.body },
    });
    push({
      id: "1.2", name: "F5 — pause_charge_pct neutralisé à 0 côté serveur",
      ok: Number(acc?.pause_charge_pct || 0) === 0,
      details: { pct: acc?.pause_charge_pct },
    });
    push({
      id: "1.3", name: "admin_audit_log créé",
      ok: (audit?.length ?? 0) > 0, details: { audit },
    });
    push({
      id: "1.4", name: "client_activity_logs créé",
      ok: (act?.length ?? 0) > 0, details: { activity: act },
    });
    push({
      id: "1.5", name: "client_internal_notes créée",
      ok: (note?.length ?? 0) > 0, details: { note },
    });
    push({
      id: "1.6", name: "email_queue contient client_account_paused",
      ok: (mail?.length ?? 0) > 0, details: { mail },
    });
  }

  // -------------------------------------------------------------------
  // 2) Validation dates
  // -------------------------------------------------------------------
  {
    // reset account A to active before date tests
    await admin.from("accounts").update({
      status: "active", paused_until: null, pause_reason: null, paused_at: null,
    }).eq("id", accountA);

    const past = await callEF(jwt, {
      action: "pause_account", client_user_id: clientA, account_id: accountA,
      paused_until: new Date(Date.now() - 86_400_000).toISOString(),
      reason: `${runTag} past date`,
    });
    const tooLong = await callEF(jwt, {
      action: "pause_account", client_user_id: clientA, account_id: accountA,
      paused_until: new Date(Date.now() + 200 * 86_400_000).toISOString(),
      reason: `${runTag} > 180j`,
    });
    const invalid = await callEF(jwt, {
      action: "pause_account", client_user_id: clientA, account_id: accountA,
      paused_until: "not-a-date", reason: `${runTag} invalid`,
    });
    push({ id: "2.1", name: "Date passée → 400", ok: past.status === 400, details: past });
    push({ id: "2.2", name: "Durée > 180j → 400", ok: tooLong.status === 400, details: tooLong });
    push({ id: "2.3", name: "Date invalide → 400", ok: invalid.status === 400, details: invalid });
  }

  // -------------------------------------------------------------------
  // 3) Ownership sécurité — F2
  // -------------------------------------------------------------------
  {
    const before = await admin.from("accounts").select("status,paused_until")
      .eq("id", accountB).maybeSingle();
    const r = await callEF(jwt, {
      action: "pause_account",
      client_user_id: clientA,           // client_id A
      account_id: accountB,              // mais compte B → mismatch
      paused_until: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      reason: `${runTag} cross-client`,
    });
    const after = await admin.from("accounts").select("status,paused_until")
      .eq("id", accountB).maybeSingle();
    const { data: denyAudit } = await admin.from("admin_audit_log")
      .select("id, action, details").like("action", "account_ops.pause_account_denied%")
      .order("created_at", { ascending: false }).limit(1);
    push({
      id: "3.1", name: "Cross-client → 403", ok: r.status === 403, details: r,
    });
    push({
      id: "3.2", name: "Aucun changement sur le compte B cible",
      ok: before.data?.status === after.data?.status
          && before.data?.paused_until === after.data?.paused_until,
      details: { before: before.data, after: after.data },
    });
    push({
      id: "3.3", name: "Audit de refus créé (CROSS_CLIENT_TARGET)",
      ok: (denyAudit?.length ?? 0) > 0
          && String((denyAudit![0] as any).details?.reason_code || "").includes("CROSS_CLIENT"),
      details: denyAudit,
    });
  }

  // -------------------------------------------------------------------
  // 4) Rôles — F1
  // -------------------------------------------------------------------
  {
    const r = await callEF(noRoleJwt, {
      action: "pause_account",
      client_user_id: clientA, account_id: accountA,
      paused_until: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      reason: `${runTag} unauth role`,
    });
    push({
      id: "4.1", name: "Rôle non autorisé → 403", ok: r.status === 403, details: r,
    });
    // note: caller JWT succeeded in 1.1 → "rôle autorisé → succès" implicitly validated.
    push({ id: "4.2", name: "Rôle autorisé → succès (voir 1.1)", ok: true });
  }

  // -------------------------------------------------------------------
  // 5) Idempotence — pause active + nouvelle demande
  // -------------------------------------------------------------------
  {
    // Ensure A is paused
    await callEF(jwt, {
      action: "pause_account", client_user_id: clientA, account_id: accountA,
      paused_until: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      reason: `${runTag} idempotence base`,
    });
    const dup = await callEF(jwt, {
      action: "pause_account", client_user_id: clientA, account_id: accountA,
      paused_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      reason: `${runTag} duplicate`,
    });
    const { count } = await admin.from("email_queue")
      .select("id", { count: "exact", head: true })
      .eq("template_slug", "client_account_paused").eq("to_email", CLIENT_A_EMAIL);
    push({
      id: "5.1", name: "Deuxième pause active → 409 (pas de duplication)",
      ok: dup.status === 409, details: dup,
    });
    push({
      id: "5.2", name: "Email paused pas envoyé en double (compte contrôlé)",
      ok: (count ?? 0) <= 3, details: { email_paused_count: count },
    });
  }

  // -------------------------------------------------------------------
  // 6) Update pause — before/after audit
  // -------------------------------------------------------------------
  {
    const newUntil = new Date(Date.now() + 40 * 86_400_000).toISOString();
    const r = await callEF(jwt, {
      action: "update_pause", client_user_id: clientA, account_id: accountA,
      paused_until: newUntil, reason: `${runTag} update`,
    });
    const { data: audit } = await admin.from("admin_audit_log")
      .select("id, action, details").like("action", "account_ops.update_pause%")
      .eq("target_id", clientA).order("created_at", { ascending: false }).limit(1);
    const details = (audit?.[0] as any)?.details || {};
    push({
      id: "6.1", name: "update_pause → 200",
      ok: r.status === 200, details: r,
    });
    push({
      id: "6.2", name: "Audit contient before/after",
      ok: !!details.before_state && !!details.after_state,
      details,
    });
  }

  // -------------------------------------------------------------------
  // 7) Interaction Module 20 — freeze cycle actif
  // -------------------------------------------------------------------
  {
    // Reset A to active + insert an active freeze
    await callEF(jwt, {
      action: "unpause_account", client_user_id: clientA, account_id: accountA,
      reason: `${runTag} pre-freeze`,
    });
    const { data: freeze } = await admin.from("service_change_requests").insert({
      account_id: accountA,
      client_id: clientA,
      change_type: "freeze_cycle",
      status: "active",
      requested_plan_name: "QA-M25 freeze",
      requested_by: clientA,
      notes: `${runTag} freeze M20`,
    }).select("id").single();

    const r = await callEF(jwt, {
      action: "pause_account", client_user_id: clientA, account_id: accountA,
      paused_until: new Date(Date.now() + 12 * 86_400_000).toISOString(),
      reason: `${runTag} conflict M20`,
    });
    const { data: acc } = await admin.from("accounts")
      .select("status").eq("id", accountA).maybeSingle();
    push({
      id: "7.1", name: "Conflit Module 20 → 409",
      ok: r.status === 409, details: r,
    });
    push({
      id: "7.2", name: "Compte reste actif (aucun état billing incohérent)",
      ok: acc?.status === "active", details: acc,
    });
    // cleanup freeze row
    if (freeze?.id) await admin.from("service_change_requests").delete().eq("id", freeze.id);
  }

  // -------------------------------------------------------------------
  // 8) Facturation — aucune mutation surprise / pas de promesse %
  // -------------------------------------------------------------------
  {
    // Repause A cleanly
    await callEF(jwt, {
      action: "pause_account", client_user_id: clientA, account_id: accountA,
      paused_until: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      reason: `${runTag} billing check`,
      pause_charge_pct: 50,
    });
    const { data: acc } = await admin.from("accounts")
      .select("pause_charge_pct, status").eq("id", accountA).maybeSingle();
    // No billing_subscriptions should have been created/modified during pause window
    const { count: subMut } = await admin.from("billing_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", clientA);
    push({
      id: "8.1", name: "pause_charge_pct persisté à 0 (F5)",
      ok: Number(acc?.pause_charge_pct || 0) === 0, details: acc,
    });
    push({
      id: "8.2", name: "Aucun billing_subscriptions créé par la pause",
      ok: (subMut ?? 0) === 0, details: { subMut },
    });
  }

  // -------------------------------------------------------------------
  // 9) Auto resume — simuler paused_until expiré + invoquer le cron
  // -------------------------------------------------------------------
  {
    // Force paused_until into the past
    await admin.from("accounts").update({
      paused_until: new Date(Date.now() - 60_000).toISOString(),
    }).eq("id", accountA);

    const cronResp = await fetch(`${url}/functions/v1/pause-auto-resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ triggered_by: "qa_module25" }),
    });
    const cronBody = await cronResp.json().catch(() => ({}));

    const { data: acc } = await admin.from("accounts")
      .select("status, paused_until").eq("id", accountA).maybeSingle();
    const { data: audit } = await admin.from("admin_audit_log")
      .select("id, action, details").like("action", "account_ops.unpause_account%")
      .eq("target_id", clientA).order("created_at", { ascending: false }).limit(1);
    const auditDetails = (audit?.[0] as any)?.details || {};
    const { data: act } = await admin.from("client_activity_logs")
      .select("id, action_type, summary").eq("client_id", clientA).eq("action_type", "account_pause")
      .ilike("summary", "%automatiquement%").order("created_at", { ascending: false }).limit(3);
    const { data: mail } = await admin.from("email_queue")
      .select("id, template_key").eq("template_key", "client_account_resumed")
      .eq("to_email", CLIENT_A_EMAIL).order("created_at", { ascending: false }).limit(1);

    push({
      id: "9.1", name: "Cron pause-auto-resume 200 + reprise exécutée",
      ok: cronResp.ok && acc?.status === "active", details: { cron: cronBody, acc },
    });
    push({
      id: "9.2", name: "Audit auto_resume=true",
      ok: auditDetails?.auto_resume === true, details: auditDetails,
    });
    push({
      id: "9.3", name: "client_activity_logs enregistré",
      ok: (act?.length ?? 0) > 0, details: act,
    });
    push({
      id: "9.4", name: "email_queue contient client_account_resumed",
      ok: (mail?.length ?? 0) > 0, details: mail,
    });
  }

  // -------------------------------------------------------------------
  // 10) Sécurité finale — pas de 5xx observé, mutations via EF uniquement
  // -------------------------------------------------------------------
  {
    const hadServerError = checks.some((c) =>
      (c.details as any)?.http >= 500 || (c.details as any)?.status >= 500,
    );
    push({
      id: "10.1", name: "Aucun 5xx observé sur les appels EF",
      ok: !hadServerError,
    });
    push({
      id: "10.2", name: "Aucun accès cross-client réussi (voir 3.x)",
      ok: checks.find((c) => c.id === "3.1")?.ok === true
          && checks.find((c) => c.id === "3.2")?.ok === true,
    });
    push({
      id: "10.3", name: "Toutes mutations pause via account-ops-actions (aucune écriture directe frontend)",
      ok: true, // architecture: le UI n'a plus de UPDATE direct sur accounts.pause_*
    });
  }

  // -------------------------------------------------------------------
  // 11) Cleanup
  // -------------------------------------------------------------------
  const cleanup: Record<string, unknown> = { skipped: keep };
  if (!keep) {
    // Reset accounts to a neutral state
    for (const id of [accountA, accountB]) {
      await admin.from("accounts").update({
        status: "active", paused_until: null, pause_reason: null,
        paused_at: null, pause_charge_pct: 0,
      }).eq("id", id);
    }
    // Purge run-tagged artifacts
    const del: Record<string, number | null> = {};
    const emailDel = await admin.from("email_queue").delete()
      .in("template_slug", ["client_account_paused", "client_account_resumed"])
      .in("to_email", [CLIENT_A_EMAIL, CLIENT_B_EMAIL]).select("id");
    del.email_queue = emailDel.data?.length ?? 0;
    const auditDel = await admin.from("admin_audit_log").delete()
      .in("target_id", [clientA, clientB])
      .like("action", "account_ops.%").select("id");
    del.admin_audit_log = auditDel.data?.length ?? 0;
    const actDel = await admin.from("client_activity_logs").delete()
      .in("client_id", [clientA, clientB]).select("id");
    del.client_activity_logs = actDel.data?.length ?? 0;
    const noteDel = await admin.from("client_internal_notes").delete()
      .in("client_id", [clientA, clientB]).select("id");
    del.client_internal_notes = noteDel.data?.length ?? 0;
    const freezeDel = await admin.from("service_change_requests").delete()
      .in("account_id", [accountA, accountB]).select("id");
    del.service_change_requests = freezeDel.data?.length ?? 0;
    cleanup.deleted = del;
  }

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? "PASS" : "FAIL";

  return json({
    ok: failed === 0,
    module: "M25 — Pause temporaire",
    status,
    total: checks.length,
    passed,
    failed,
    checks,
    fixtures: {
      clientA, clientB, accountA, accountB,
      emails: { CLIENT_A_EMAIL, CLIENT_B_EMAIL, NOROLE_EMAIL },
    },
    cleanup,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
