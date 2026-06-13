/**
 * billing-notify-policy-update
 *
 * One-time batch notification to all active clients explaining the
 * billing system improvements effective 2026-06-05:
 *  - Proration on plan changes (upgrade invoice / downgrade credit)
 *  - Automatic account_adjustments applied on every renewal invoice
 *  - Improved renewal reliability (catch-up window + NULL detection)
 *
 * Idempotent: uses event_key to prevent duplicate emails.
 * Only targets clients with at least one active billing_subscription.
 *
 * Invoke once via Nivra Core admin or direct POST.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVENT_KEY = "billing_policy_update_2026_06";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient(supabaseUrl, serviceKey);

    // Parse body
    let bodyJson: any = {};
    try { bodyJson = await req.json(); } catch (_e) { /* empty body ok */ }

    // Status-check mode: body with { check_status: true }
    if (bodyJson?.check_status === true) {
      const { data: rows } = await supabase
        .from("email_queue")
        .select("to_email, status, attempts, created_at, sent_at, error_message")
        .like("event_key", `${EVENT_KEY}:%`)
        .order("created_at");
      return new Response(JSON.stringify({ emails: rows || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test mode: { test_email: "support@nivra-telecom.ca" }
    // Sends ONE copy to the specified address without touching the client list.
    if (bodyJson?.test_email) {
      const testEmail = String(bodyJson.test_email);
      const testKey = `${EVENT_KEY}:test:${testEmail}`;
      // Remove any previous test entry so it can be re-sent
      await supabase.from("email_queue").delete().eq("event_key", testKey);
      const { error: testInsertErr } = await supabase.from("email_queue").insert({
        event_key: testKey,
        to_email: testEmail,
        template_key: EVENT_KEY,
        template_vars: { client_name: "Test", first_name: "Test" },
        message_type: "transactional",
        status: "queued",
        attempts: 0,
        max_attempts: 3,
      });
      if (testInsertErr) throw new Error(`Test email insert failed: ${testInsertErr.message}`);
      return new Response(
        JSON.stringify({ success: true, test_sent_to: testEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // How many already sent (idempotency check)
    const { count: alreadySent } = await supabase
      .from("email_queue")
      .select("id", { count: "exact", head: true })
      .like("event_key", `${EVENT_KEY}:%`);

    // Fetch all active subscriptions with their customer email
    const { data: activeSubs, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select(`
        id,
        customer_id,
        customer:billing_customers(id, email, first_name, last_name)
      `)
      .eq("status", "active");

    if (subErr) throw new Error(`billing_subscriptions query failed: ${subErr.message || subErr.details || JSON.stringify(subErr)}`);

    // Deduplicate by email (a client may have multiple subscriptions)
    const seen = new Set<string>();
    const toNotify: Array<{ email: string; firstName: string; customerId: string }> = [];

    for (const sub of activeSubs || []) {
      const cust = sub.customer as any;
      if (!cust?.email || seen.has(cust.email)) continue;
      seen.add(cust.email);
      toNotify.push({
        email: cust.email,
        firstName: cust.first_name || "Client",
        customerId: cust.id,
      });
    }

    console.log(`[billing-notify-policy-update] ${toNotify.length} unique active clients to notify (${alreadySent ?? 0} already queued)`);

    // Check which emails already have an entry (idempotency per recipient)
    const { data: existingKeys } = await supabase
      .from("email_queue")
      .select("event_key")
      .like("event_key", `${EVENT_KEY}:%`);

    const existingSet = new Set<string>(
      (existingKeys || []).map((r: any) => r.event_key)
    );

    // Queue emails for clients not yet notified
    let queued = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const client of toNotify) {
      const key = `${EVENT_KEY}:${client.customerId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      const { error: insertErr } = await supabase.from("email_queue").insert({
        event_key: key,
        to_email: client.email,
        template_key: EVENT_KEY,
        template_vars: {
          client_name: client.firstName,
          first_name: client.firstName,
        },
        message_type: "transactional",
        status: "queued",
        attempts: 0,
        max_attempts: 3,
      });

      if (insertErr) {
        errors.push(`${client.email}: ${insertErr.message}`);
      } else {
        queued++;
      }
    }

    console.log(`[billing-notify-policy-update] Queued: ${queued}, Skipped (already done): ${skipped}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_active_clients: toNotify.length,
        queued,
        skipped,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[billing-notify-policy-update] Error:", error);
    await reportEdgeError(error, { function: "billing-notify-policy-update" }).catch(() => {});
    const errMsg = error instanceof Error
      ? error.message
      : (typeof error === "object" && error !== null)
        ? ((error as any).message || (error as any).details || JSON.stringify(error))
        : String(error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
