// QA Module 24 — E2E runner for client-account-admin.
// Uses service role to mint JWTs for an admin and a non-admin staff, then
// exercises every checklist item and returns a structured report.
// This function must NEVER touch a real client — it only targets the QA
// account tagged `qa_test_account`.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function mintAccessToken(email: string): Promise<string> {
  // 1) Generate a magic link (returns hashed_token via properties)
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);
  const hashed = (data as any)?.properties?.hashed_token;
  if (!hashed) throw new Error(`No hashed_token for ${email}`);
  // 2) verifyOtp with anon client to obtain access_token
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: v, error: vErr } = await anon.auth.verifyOtp({
    token_hash: hashed,
    type: "magiclink",
  });
  if (vErr) throw new Error(`verifyOtp(${email}): ${vErr.message}`);
  const token = v.session?.access_token;
  if (!token) throw new Error(`No access_token for ${email}`);
  return token;
}

async function callAdminFn(jwt: string, body: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/client-account-admin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json, cacheControl: r.headers.get("cache-control") };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const qs = new URL(req.url).searchParams;
  const secret = qs.get("secret") || (await req.json().catch(() => ({})))?.secret;
  if (secret !== "qa-module24-2026") {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const report: Record<string, any> = { started_at: new Date().toISOString(), steps: [] };
  const record = (name: string, result: any) => {
    report.steps.push({ name, ...result });
    console.log(`[M24 QA] ${name}`, JSON.stringify(result).slice(0, 400));
  };

  try {
    // Resolve fixtures
    const { data: tag } = await admin.from("account_tags")
      .select("client_user_id, account_id")
      .eq("tag_key", "qa_test_account").maybeSingle();
    if (!tag) throw new Error("QA account not provisioned");

    const qaClientId = tag.client_user_id as string;
    const qaAccountId = tag.account_id as string;
    const { data: qaUser } = await admin.auth.admin.getUserById(qaClientId);
    const qaEmail = qaUser?.user?.email!;

    // Admin + non-admin staff
    const ADMIN_EMAIL = "nivratelecom@gmail.com";
    const STAFF_EMAIL = "support@nivra-telecom.ca";
    const adminJwt = await mintAccessToken(ADMIN_EMAIL);
    const staffJwt = await mintAccessToken(STAFF_EMAIL);
    record("fixtures", { qaEmail, qaClientId, qaAccountId, ADMIN_EMAIL, STAFF_EMAIL });

    const runStart = new Date().toISOString();

    // ---- 1. send_password_reset (nominal) ----
    const r_reset = await callAdminFn(adminJwt, {
      action: "send_password_reset", client_user_id: qaClientId,
    });
    record("1_send_password_reset_nominal", r_reset);

    // Anti-flood (same action within 60s) — expect 429
    const r_reset_flood = await callAdminFn(adminJwt, {
      action: "send_password_reset", client_user_id: qaClientId,
    });
    record("10_anti_flood_password_reset", r_reset_flood);

    // Anti-enum: non-existent email
    const r_reset_unknown = await callAdminFn(adminJwt, {
      action: "send_password_reset", client_email: "unknown-qa@nivra-test.ca",
    });
    record("1_send_password_reset_unknown", r_reset_unknown);

    // ---- 2. send_invite (existing) ----
    const r_invite = await callAdminFn(adminJwt, {
      action: "send_invite", client_email: qaEmail,
    });
    record("2_send_invite_existing", r_invite);

    // send_invite unknown → generic
    const r_invite_unknown = await callAdminFn(adminJwt, {
      action: "send_invite", client_email: `qa-noexist-${Date.now()}@nivra-test.ca`,
    });
    record("2_send_invite_unknown", r_invite_unknown);

    // ---- 3. resend_welcome ----
    const r_welcome = await callAdminFn(adminJwt, {
      action: "resend_welcome", client_user_id: qaClientId,
    });
    record("3_resend_welcome", r_welcome);

    const r_welcome_unknown = await callAdminFn(adminJwt, {
      action: "resend_welcome", client_email: "ghost-qa@nivra-test.ca",
    });
    record("3_resend_welcome_unknown", r_welcome_unknown);

    // ---- 4. force_confirm_email ----
    const r_confirm = await callAdminFn(adminJwt, {
      action: "force_confirm_email", client_user_id: qaClientId,
    });
    record("4_force_confirm_email", r_confirm);

    const r_confirm_unknown = await callAdminFn(adminJwt, {
      action: "force_confirm_email", client_email: "ghost2-qa@nivra-test.ca",
    });
    record("4_force_confirm_email_unknown", r_confirm_unknown);

    // ---- 5. set_temporary_password ----
    // Non-admin staff → 403
    const r_temp_staff = await callAdminFn(staffJwt, {
      action: "set_temporary_password", client_user_id: qaClientId, reason: "QA staff denial test",
    });
    record("5_set_temp_pwd_staff_denied", r_temp_staff);

    // Motif < 5 chars → 400
    const r_temp_short = await callAdminFn(adminJwt, {
      action: "set_temporary_password", client_user_id: qaClientId, reason: "hi",
    });
    record("5_set_temp_pwd_reason_short", r_temp_short);

    // Nominal → 200 + Cache-Control no-store
    const r_temp_ok = await callAdminFn(adminJwt, {
      action: "set_temporary_password", client_user_id: qaClientId, reason: "QA nominal test set_temp_pwd",
    });
    record("5_set_temp_pwd_ok", r_temp_ok);

    // ---- 6. force_logout ----
    const r_logout_noreason = await callAdminFn(adminJwt, {
      action: "force_logout", client_user_id: qaClientId,
    });
    record("6_force_logout_no_reason", r_logout_noreason);

    const r_logout_ok = await callAdminFn(adminJwt, {
      action: "force_logout", client_user_id: qaClientId, reason: "QA force_logout nominal",
    });
    record("6_force_logout_ok", r_logout_ok);

    // ---- 7. disable_portal_access ----
    const r_disable_staff = await callAdminFn(staffJwt, {
      action: "disable_portal_access", client_user_id: qaClientId, reason: "QA staff denial",
    });
    record("7_disable_portal_staff_denied", r_disable_staff);

    const r_disable_ok = await callAdminFn(adminJwt, {
      action: "disable_portal_access", client_user_id: qaClientId, reason: "QA disable portal nominal",
    });
    record("7_disable_portal_ok", r_disable_ok);

    // ---- 8. enable_portal_access ----
    const r_enable_ok = await callAdminFn(adminJwt, {
      action: "enable_portal_access", client_user_id: qaClientId, reason: "QA enable portal nominal",
    });
    record("8_enable_portal_ok", r_enable_ok);

    // ---- 9. CROSS_ROLE_TARGET — target = staff user ----
    const { data: staffLookup } = await admin.from("profiles")
      .select("user_id").eq("email", STAFF_EMAIL).maybeSingle();
    const staffUserId = (staffLookup as any)?.user_id;
    const r_cross_role = await callAdminFn(adminJwt, {
      action: "send_password_reset", client_user_id: staffUserId,
    });
    record("9_cross_role_target", { staffUserId, ...r_cross_role });

    // NOT_A_CLIENT — random uuid with no accounts.client_id link
    // We'll create a synthetic auth user with no accounts row.
    const throwaway = `qa-not-a-client-${Date.now()}@nivra-test.ca`;
    const { data: tuser } = await admin.auth.admin.createUser({
      email: throwaway, password: `Nv-${crypto.randomUUID().slice(0, 10)}!9`, email_confirm: true,
    });
    const throwId = tuser?.user?.id!;
    const r_not_client = await callAdminFn(adminJwt, {
      action: "force_confirm_email", client_user_id: throwId,
    });
    record("9_not_a_client_target", { throwId, ...r_not_client });
    await admin.auth.admin.deleteUser(throwId).catch(() => {});

    // ---- 11. Final DB checks ----
    const { data: auditNoAdmin } = await admin.from("admin_audit_log")
      .select("id, action, admin_user_id, created_at")
      .gte("created_at", runStart).is("admin_user_id", null).limit(20);
    record("11_audit_null_admin", { count: auditNoAdmin?.length ?? 0, rows: auditNoAdmin });

    const { data: auditRows } = await admin.from("admin_audit_log")
      .select("action, created_at, details")
      .gte("created_at", runStart)
      .eq("target_id", qaClientId).order("created_at").limit(200);
    // Check no temp_password leak
    const leak = (auditRows || []).find((r: any) =>
      r.action?.includes("temp_password") && JSON.stringify(r.details || {}).match(/Nv-[A-Za-z0-9]+!9/));
    record("11_temp_password_leak", { leaked: Boolean(leak) });

    const { data: activity } = await admin.from("client_activity_logs")
      .select("action_type, summary, created_at")
      .gte("created_at", runStart).eq("client_id", qaClientId).limit(50);
    record("11_client_activity_logs", { count: activity?.length ?? 0 });

    const { data: notes } = await admin.from("client_internal_notes")
      .select("body, created_at, note_type")
      .gte("created_at", runStart).eq("client_id", qaClientId).limit(50);
    record("11_client_internal_notes", { count: notes?.length ?? 0 });

    const { data: eq } = await admin.from("email_queue")
      .select("template_key, to_email, status, created_at")
      .gte("created_at", runStart).limit(100);
    record("11_email_queue", { count: eq?.length ?? 0, rows: eq });

    // ---- Cleanup ----
    // Reset portal access
    await admin.from("profiles").update({ security_status: "active" }).eq("user_id", qaClientId);
    // Delete QA emails from queue
    const emailsToDrop = (eq || []).map((e: any) => e.to_email);
    if (emailsToDrop.length) {
      await admin.from("email_queue").delete().in("to_email", emailsToDrop).gte("created_at", runStart);
    }
    record("cleanup", { profile_reset: true, emails_dropped: emailsToDrop.length });

    report.ok = true;
    report.finished_at = new Date().toISOString();
    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    report.ok = false;
    report.error = (e as Error).message;
    report.stack = (e as Error).stack;
    return new Response(JSON.stringify(report, null, 2), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
