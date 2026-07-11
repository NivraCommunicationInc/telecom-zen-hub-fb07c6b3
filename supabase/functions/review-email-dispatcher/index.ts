// Review request email dispatcher
// Runs hourly via pg_cron. Finds accounts where:
//   - status = 'active'
//   - installation completed 24-48h ago (installations.status='completed')
//   - review_email_sent = false
//   - client has a valid email and is not suppressed/unsubscribed
// Enqueues the `review_request_activation` template and flips review_email_sent=true.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  let dryRun = url.searchParams.get("dry_run") === "1";
  let testEmail: string | null = url.searchParams.get("test_email");
  let limit = Number(url.searchParams.get("limit") ?? "50");

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.dry_run === true) dryRun = true;
      if (typeof body?.test_email === "string") testEmail = body.test_email;
      if (typeof body?.limit === "number") limit = body.limit;
    } catch { /* no body */ }
  }

  // Find eligible accounts: installation completed between 24h and 7 days ago
  // (7-day upper bound = catch-up window if cron paused; still one-shot per account)
  const { data: candidates, error: candErr } = await supabase
    .from("accounts")
    .select(`
      id, client_id, account_number,
      installations:installations!installations_client_id_fkey(status, updated_at)
    `)
    .eq("status", "active")
    .eq("review_email_sent", false)
    .limit(limit);

  if (candErr) {
    return new Response(JSON.stringify({ error: candErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const MIN_MS = 24 * 60 * 60 * 1000;
  const MAX_MS = 7 * 24 * 60 * 60 * 1000;

  const results: any[] = [];
  let enqueued = 0;
  let skipped = 0;

  for (const acct of candidates ?? []) {
    const installs = (acct as any).installations ?? [];
    const completedInWindow = installs.some((i: any) => {
      if (i.status !== "completed" && i.status !== "installed") return false;
      const t = new Date(i.updated_at).getTime();
      const age = now - t;
      return age >= MIN_MS && age <= MAX_MS;
    });
    if (!completedInWindow) { skipped++; continue; }

    // Load client profile + preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, first_name, preferred_language")
      .eq("id", acct.client_id)
      .maybeSingle();

    const recipient = testEmail || profile?.email;
    if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) { skipped++; continue; }

    // Suppression / unsubscribe check
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email")
      .eq("email", recipient.toLowerCase())
      .maybeSingle();
    if (suppressed) { skipped++; continue; }

    const { data: prefs } = await supabase
      .from("client_email_preferences")
      .select("marketing_emails")
      .eq("client_id", acct.client_id)
      .maybeSingle();
    if (prefs && prefs.marketing_emails === false) { skipped++; continue; }

    if (dryRun) {
      results.push({ account: acct.account_number, recipient, would_send: true });
      continue;
    }

    const idempotencyKey = `review-request-${acct.id}`;
    const { error: qErr } = await enqueueCommunication({
      channel: "email",
      templateKey: "review_request_activation",
      recipient: recipient,
      idempotencyKey: idempotencyKey,
      templateVars: { firstName: profile?.first_name ?? "", language: profile?.preferred_language ?? "fr" },
      subject: "Votre service Nivra est actif — votre avis vaut 5 $ 😊",
      priority: 2,
    });

    if (qErr) {
      results.push({ account: acct.account_number, recipient, error: qErr.message });
      continue;
    }

    // Flip the flag only when not sending to a test address
    if (!testEmail) {
      await supabase
        .from("accounts")
        .update({ review_email_sent: true, review_email_sent_at: new Date().toISOString() })
        .eq("id", acct.id);
    }

    enqueued++;
    results.push({ account: acct.account_number, recipient, enqueued: true });
  }

  // Kick the drain so emails go out immediately
  if (enqueued > 0 && !dryRun) {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/email-queue-drain`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    } catch { /* best-effort */ }
  }

  return new Response(
    JSON.stringify({
      scanned: candidates?.length ?? 0,
      enqueued,
      skipped,
      dryRun,
      testEmail,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
