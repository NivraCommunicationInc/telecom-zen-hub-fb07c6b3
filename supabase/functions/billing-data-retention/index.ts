/**
 * billing-data-retention — P2 GAP #5+#6 (Loi 25 / PIPEDA compliance)
 *
 * Daily cron at 3h AM. Finds accounts cancelled more than 90 days ago and:
 *  1) Anonymizes PII fields on profiles
 *  2) Deletes KYC documents and activation request payloads
 *  3) Logs every anonymization in data_retention_log
 *  4) Sends a daily admin email summary if any anonymizations occurred
 *
 * Preserved (legal/financial obligations, 7-year retention):
 *  - account_number, billing history (amounts only)
 *  - order history (amounts, no PII)
 *
 * Removed:
 *  - profiles.first_name, last_name, full_name, email, phone, date_of_birth
 *  - profiles.service_address/city/province/postal_code, id_type, id_number, id_expiration
 *  - KYC documents in storage
 *  - activation_requests.client_notes, contact_phone, wifi_password_encrypted
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_RECIPIENTS = ["support@nivra-telecom.ca", "nivratelecom@gmail.com"];

const ANONYMIZED_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "date_of_birth",
  "service_address",
  "service_city",
  "service_postal_code",
  "id_type",
  "id_number",
  "id_expiration",
  "id_province",
  "avatar_url",
  "emergency_contact_name",
  "emergency_contact_phone",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = body?.dry_run === true;
  } catch {
    /* default: live */
  }

  const startedAt = new Date().toISOString();
  console.log(`[data-retention] Starting (dry_run=${dryRun}) at ${startedAt}`);

  const stats = {
    candidates_found: 0,
    anonymized: 0,
    documents_deleted: 0,
    errors: 0,
    anonymized_clients: [] as Array<{ client_id: string; account_number: string | null }>,
    error_messages: [] as string[],
  };

  try {
    // 1) Find accounts cancelled more than 90 days ago
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString();

    const { data: candidates, error: candidatesErr } = await supabase
      .from("accounts")
      .select("id, client_id, account_number, cancelled_at")
      .eq("status", "cancelled")
      .not("cancelled_at", "is", null)
      .lt("cancelled_at", cutoffStr);

    if (candidatesErr) {
      throw new Error(`Candidates query error: ${candidatesErr.message}`);
    }

    stats.candidates_found = candidates?.length || 0;
    console.log(`[data-retention] Found ${stats.candidates_found} candidates for anonymization`);

    for (const acct of candidates || []) {
      try {
        // Skip if already anonymized (idempotency check via log)
        const { data: existingLog } = await supabase
          .from("data_retention_log")
          .select("id")
          .eq("client_id", acct.client_id)
          .maybeSingle();

        if (existingLog) {
          console.log(`[data-retention] Client ${acct.client_id} already anonymized, skipping`);
          continue;
        }

        if (dryRun) {
          console.log(`[data-retention] DRY-RUN would anonymize client ${acct.client_id} (account ${acct.account_number})`);
          stats.anonymized_clients.push({ client_id: acct.client_id, account_number: acct.account_number });
          stats.anonymized++;
          continue;
        }

        // 2) Anonymize profile PII
        const anonymizedEmail = `anonymised-${acct.client_id}@deleted.nivra.ca`;
        const profileUpdate: Record<string, unknown> = {
          first_name: "Anonymisé",
          last_name: "Anonymisé",
          full_name: "Anonymisé",
          email: anonymizedEmail,
          phone: null,
          date_of_birth: null,
          service_address: null,
          service_city: null,
          service_postal_code: null,
          id_type: null,
          id_number: null,
          id_expiration: null,
          id_province: null,
          avatar_url: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          updated_at: new Date().toISOString(),
        };

        const { error: profileErr } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("id", acct.client_id);

        if (profileErr) {
          stats.errors++;
          stats.error_messages.push(`profile ${acct.client_id}: ${profileErr.message}`);
          continue;
        }

        // 3) Delete KYC documents from storage
        let documentsDeleted = 0;
        try {
          const { data: idFiles } = await supabase.storage
            .from("id-documents")
            .list(acct.client_id, { limit: 100 });

          if (idFiles && idFiles.length > 0) {
            const paths = idFiles.map((f) => `${acct.client_id}/${f.name}`);
            const { error: rmErr } = await supabase.storage
              .from("id-documents")
              .remove(paths);
            if (!rmErr) documentsDeleted += paths.length;
          }
        } catch (storageErr) {
          console.warn(`[data-retention] storage cleanup error for ${acct.client_id}:`, storageErr);
        }

        // 4) Anonymize activation requests payloads (keep records, scrub PII)
        await supabase
          .from("activation_requests")
          .update({
            client_notes: null,
            contact_phone: "ANONYMIZED",
            wifi_network_name: "ANONYMIZED",
            wifi_password_encrypted: "ANONYMIZED",
          })
          .eq("client_id", acct.client_id);

        // 5) Log to data_retention_log via service role (bypasses RLS)
        await supabase.from("data_retention_log").insert({
          client_id: acct.client_id,
          account_id: acct.id,
          account_number: acct.account_number,
          cancelled_at: acct.cancelled_at,
          fields_anonymized: ANONYMIZED_FIELDS,
          documents_deleted: documentsDeleted,
          triggered_by: "cron_billing_data_retention",
          notes: `Auto-anonymized 90+ days after cancellation. Email replaced with ${anonymizedEmail}`,
        });

        stats.anonymized++;
        stats.documents_deleted += documentsDeleted;
        stats.anonymized_clients.push({ client_id: acct.client_id, account_number: acct.account_number });

        console.log(`[data-retention] ✓ Anonymized client ${acct.client_id} (account ${acct.account_number}, ${documentsDeleted} docs deleted)`);
      } catch (err: unknown) {
        stats.errors++;
        const msg = err instanceof Error ? err.message : String(err);
        stats.error_messages.push(`account ${acct.id}: ${msg}`);
        console.error(`[data-retention] error for ${acct.id}:`, msg);
      }
    }

    // 6) Send admin email if any anonymizations occurred (live mode only)
    if (!dryRun && stats.anonymized > 0) {
      const reportDate = new Date().toISOString().split("T")[0];
      for (const recipient of ADMIN_RECIPIENTS) {
        const eventKey = `data_retention_${reportDate}_${recipient}`;
        const { data: existing } = await supabase
          .from("email_queue")
          .select("id")
          .or(`event_key.eq.${eventKey},idempotency_key.eq.${eventKey}`)
          .maybeSingle();
        if (existing) continue;

        await supabase.from("email_queue").insert({
          event_key: eventKey,
          idempotency_key: eventKey,
          to_email: recipient,
          from_email: "Nivra Telecom <support@nivra-telecom.ca>",
          subject: `📋 ${stats.anonymized} compte${stats.anonymized > 1 ? "s" : ""} anonymisé${stats.anonymized > 1 ? "s" : ""} — Conformité Loi 25`,
          template_key: "admin_alert_anonymization",
          template_vars: {
            anonymized_count: stats.anonymized,
            documents_deleted: stats.documents_deleted,
            report_date: reportDate,
          },
          status: "queued",
          attempts: 0,
          max_attempts: 3,
        });
      }
    }

    console.log(`[data-retention] Completed: ${stats.anonymized} anonymized, ${stats.documents_deleted} docs deleted, ${stats.errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[data-retention] FATAL:`, msg);
    return new Response(
      JSON.stringify({ success: false, error: msg, stats }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
