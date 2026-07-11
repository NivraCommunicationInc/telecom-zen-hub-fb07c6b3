/**
 * send-reassurance-blast
 * Queues a client_technical_notice email to all active clients.
 *
 * Client is "active" if:
 *   A) accounts.status = 'active'
 *   B) has any service_instances.status = 'active'
 *
 * Email resolved from profiles table via user_id.
 *
 * { preview: true }   → full recipient list + count, no send
 * { confirm: true }   → queues all emails
 *
 * Requires: { secret: "NIVRA_REASSURANCE_2026" }
 * Idempotent: event_key "reassurance_2026_06_21_${email}"
 */
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const EVENT_KEY_PREFIX = "reassurance_2026_06_21";
const EXCLUDED_EMAILS = new Set([
  "test@nivra-telecom.ca",
  "test2@nivra-telecom.ca",
  "demo@nivra-telecom.ca",
]);

interface Recipient { email: string; first_name: string; source: string; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }

  if (body.secret !== "NIVRA_REASSURANCE_2026") return json({ error: "Unauthorized" }, 401);

  // ── Collect user_ids from both sources ────────────────────────────────
  const userIdToSource = new Map<string, string>();

  // Source A: accounts.status = 'active'
  const { data: activeAccounts, error: errA } = await supabase
    .from("accounts")
    .select("client_id")
    .eq("status", "active")
    .limit(2000);

  if (errA) return json({ error: `accounts query: ${errA.message}` }, 500);
  for (const a of activeAccounts ?? []) {
    if (a.client_id) userIdToSource.set(a.client_id, "accounts_active");
  }

  // Source B: service_instances.status = 'active' → account → user_id
  const { data: activeSvcInstances, error: errB } = await supabase
    .from("service_instances")
    .select("account_id")
    .eq("status", "active")
    .limit(2000);

  if (errB) return json({ error: `service_instances query: ${errB.message}` }, 500);

  const svcAccountIds = [...new Set(
    (activeSvcInstances ?? []).map((s: any) => s.account_id).filter(Boolean)
  )];

  if (svcAccountIds.length > 0) {
    const { data: svcAccounts, error: errC } = await supabase
      .from("accounts")
      .select("client_id")
      .in("id", svcAccountIds)
      .limit(2000);

    if (errC) return json({ error: `accounts (service) query: ${errC.message}` }, 500);
    for (const a of svcAccounts ?? []) {
      if (a.client_id && !userIdToSource.has(a.client_id)) {
        userIdToSource.set(a.client_id, "service_active");
      }
    }
  }

  // ── Resolve emails from profiles ──────────────────────────────────────
  const allUserIds = [...userIdToSource.keys()];
  const recipients: Recipient[] = [];

  if (allUserIds.length > 0) {
    const { data: profiles, error: errP } = await supabase
      .from("profiles")
      .select("user_id, email, first_name")
      .in("user_id", allUserIds)
      .not("email", "is", null)
      .neq("email", "")
      .limit(2000);

    if (errP) return json({ error: `profiles query: ${errP.message}` }, 500);

    const seen = new Set<string>();
    for (const p of profiles ?? []) {
      if (!p.email || !p.email.includes("@")) continue;
      const key = p.email.toLowerCase();
      if (seen.has(key) || EXCLUDED_EMAILS.has(key)) continue;
      seen.add(key);
      recipients.push({
        email: p.email,
        first_name: p.first_name || "Client",
        source: userIdToSource.get(p.user_id) ?? "unknown",
      });
    }
  }

  if (body.preview) {
    return json({
      preview: true,
      recipient_count: recipients.length,
      recipients: recipients.map(r => ({ email: r.email, first_name: r.first_name, source: r.source })),
    });
  }

  if (!body.confirm) {
    return json({ error: "Pass preview:true to check list, or confirm:true to send." }, 400);
  }

  // ── Queue emails ──────────────────────────────────────────────────────
  let queued = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    try {
      const eventKey = `${EVENT_KEY_PREFIX}_${r.email.toLowerCase()}`;

      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const { error: insertErr } = await enqueueCommunication({
        channel: "email",
        templateKey: "client_technical_notice",
        recipient: r.email,
        idempotencyKey: eventKey,
        templateVars: { first_name: r.first_name },
        subject: "Information importante — Nivra Telecom",
        priority: 0,
      });

      if (insertErr) {
        errors.push(`${r.email}: ${insertErr.message}`);
      } else {
        queued++;
      }
    } catch (e: any) {
      errors.push(`${r.email}: ${e.message}`);
    }
  }

  return json({
    ok: true,
    queued,
    skipped,
    errors: errors.slice(0, 10),
    total_eligible: recipients.length,
  });
});
