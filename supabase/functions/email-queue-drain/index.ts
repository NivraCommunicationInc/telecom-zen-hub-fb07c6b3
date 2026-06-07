/**
 * Edge Function: email-queue-drain
 *
 * Processes rows in `email_queue` with status='queued' that were inserted
 * directly (bypassing the canonical `enqueueEmail` helper). For each row,
 * it renders the HTML body via inlined templates, then enqueues the email
 * onto the pgmq `transactional_emails` queue (consumed by the existing
 * `process-email-queue` worker that calls Lovable Email API).
 *
 * Status transitions:
 *   queued        → sent          (successfully enqueued to pgmq)
 *   queued        → failed        (transient error, attempts < max_attempts)
 *   queued/failed → dlq           (max_attempts reached or unrenderable)
 *
 * Trigger:
 *   - pg_cron every 1 minute
 *   - Manual POST (drain_now=true) to flush immediately
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { renderQueueTemplate } from "../_shared/customQueueTemplates.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

// Sends an SMS fallback via OpenPhone when transactional email hits DLQ.
async function trySmsAndFallback(
  supabase: ReturnType<typeof createClient>,
  rowId: string,
  toEmail: string,
  messageType: string | null,
): Promise<void> {
  // Only for transactional emails, not marketing blasts
  if (messageType !== "transactional" && messageType !== null) return;

  const OPENPHONE_API_KEY = Deno.env.get("OPENPHONE_API_KEY");
  const OPENPHONE_PHONE_ID = Deno.env.get("OPENPHONE_DEFAULT_PHONE_ID");
  if (!OPENPHONE_API_KEY || !OPENPHONE_PHONE_ID) return;

  // Look up phone from billing_customers or profiles
  let phone: string | null = null;
  const { data: cust } = await supabase
    .from("billing_customers")
    .select("phone")
    .eq("email", toEmail)
    .maybeSingle();
  if (cust?.phone) phone = cust.phone;

  if (!phone) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("email", toEmail)
      .maybeSingle();
    if (profile?.phone) phone = profile.phone;
  }

  if (!phone) return;

  // Normalize to E.164
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return;
  const e164 = digits.length === 10 ? `+1${digits}` : digits.startsWith("1") && digits.length === 11 ? `+${digits}` : `+${digits}`;

  const portalUrl = Deno.env.get("PORTAL_URL") || "https://client.nivra-telecom.ca";
  const text = `Nivra Telecom: Un message important n'a pas pu être livré à votre courriel. Connectez-vous à votre portail: ${portalUrl}`;

  try {
    const res = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: { "Authorization": OPENPHONE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, from: OPENPHONE_PHONE_ID, to: [e164] }),
    });
    if (res.ok) {
      await supabase
        .from("email_queue")
        .update({ sms_fallback_sent: true, sms_fallback_at: new Date().toISOString() })
        .eq("id", rowId);
      console.log(`[email-queue-drain] SMS fallback sent to ${e164} for queue row ${rowId}`);
    }
  } catch (smsErr) {
    console.warn("[email-queue-drain] SMS fallback failed (non-blocking):", smsErr);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const MAX_BATCH = 50;

interface QueueAttachment {
  filename: string;
  content: string;
  contentType?: string;
}

interface QueueRow {
  id: string;
  event_key: string;
  to_email: string;
  template_key: string;
  template_vars: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  from_email: string | null;
  subject: string | null;
  message_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  attachments: QueueAttachment[] | null;
  language: string | null;
}

interface ResolvedEmail {
  html: string;
  subject: string;
  from?: string;
}

function resolveCustomHtml(row: QueueRow): ResolvedEmail | null {
  const v = row.template_vars || {};
  const html = (v.html as string) || (v._html as string) || "";
  if (!html) return null;
  const subject = (v.subject as string) || (v._subject as string) || row.subject || "Notification Nivra";
  const from = (v._from_email as string) || row.from_email || undefined;
  return { html, subject, from };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Determine batch size from query string (manual drain can request larger)
  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const requestedEventKey = typeof body?.event_key === "string" ? body.event_key : url.searchParams.get("event_key");
  const batchSize = Math.min(
    parseInt(url.searchParams.get("limit") || "20", 10) || 20,
    MAX_BATCH,
  );

  // 1. Fetch eligible queued rows
  let q = supabase
    .from("email_queue")
    .select("id, event_key, to_email, template_key, template_vars, attempts, max_attempts, from_email, subject, message_type, entity_type, entity_id, attachments, language")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (requestedEventKey) q = q.eq("event_key", requestedEventKey);
  const { data: rows, error: fetchErr } = await q;

  if (fetchErr) {
    console.error("[email-queue-drain] fetch error:", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: "No queued emails" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; status: string; reason?: string }> = [];

  for (const row of rows as QueueRow[]) {
    try {
      // Atomic lock: only succeeds if status is still queued/failed (concurrent-safe)
      const { data: lockedRow, error: lockErr } = await supabase
        .from("email_queue")
        .update({ status: "processing", attempts: (row.attempts || 0) + 1 })
        .eq("id", row.id)
        .in("status", ["queued", "failed"])
        .select("id")
        .maybeSingle();

      if (lockErr || !lockedRow) {
        // Another instance already grabbed this row — skip silently
        results.push({ id: row.id, status: "skipped", reason: lockErr?.message ?? "concurrent_lock" });
        continue;
      }

      // Resolve HTML + subject
      let resolved: ResolvedEmail | null = null;

      if (row.template_key === "custom_html") {
        resolved = resolveCustomHtml(row);
      }
      // Fallback: if custom_html had no inline html, OR for any other template_key,
      // try the inlined template renderer.
      if (!resolved || !resolved.html) {
        // Resolve language: use stored value, or look up client's preferred_language
        let rowLang = row.language;
        if (!rowLang) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("preferred_language")
            .eq("email", row.to_email)
            .maybeSingle();
          rowLang = (prof as any)?.preferred_language || null;
        }
        const lang = (rowLang === "en" ? "en" : "fr") as "fr" | "en";
        const tmpl = renderQueueTemplate(row.template_key, row.template_vars || {}, lang);
        if (tmpl) {
          resolved = { html: tmpl.html, subject: tmpl.subject, from: row.from_email || undefined };
        }
      }

      if (!resolved || !resolved.html) {
        // Unrenderable — DLQ immediately
        await supabase
          .from("email_queue")
          .update({
            status: "dlq",
            last_error: `No template available for key '${row.template_key}'`,
          })
          .eq("id", row.id);
        results.push({ id: row.id, status: "dlq", reason: "no_template" });
        continue;
      }

      // Sanity validation — placeholder leak detector. Logs only, never blocks.
      // If a template renders any "---", "undefined", or "null" literal in its
      // final HTML, that means a template variable was missing a fallback.
      // The email is still sent, but a warning is logged for investigation.
      try {
        const placeholderPatterns = [/---/g, /\bundefined\b/g, /\bnull\b/g];
        const hits: string[] = [];
        for (const re of placeholderPatterns) {
          const m = resolved.html.match(re);
          if (m && m.length > 0) hits.push(`${re.source} (${m.length}x)`);
        }
        if (hits.length > 0) {
          console.warn(
            `[email-queue-drain] Placeholder leak in template '${row.template_key}' (queue id=${row.id}): ${hits.join(", ")}`,
          );
        }
      } catch (_e) {
        // never let validation block the send
      }

      // Forward to canonical pgmq pipeline (including PDF attachments if present)
      const enqRes = await enqueueEmail({
        to: row.to_email,
        templateKey: row.template_key,
        subject: resolved.subject,
        html: resolved.html,
        fromEmail: resolved.from,
        eventKey: `drain_${row.id}`,
        messageType: row.message_type || row.template_key,
        entityType: row.entity_type || "email_queue",
        entityId: row.entity_id || row.id,
        attachments: Array.isArray(row.attachments) && row.attachments.length > 0
          ? row.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType || "application/pdf",
            }))
          : undefined,
      });

      if (!enqRes.success) {
        const newAttempts = (row.attempts || 0) + 1;
        const willRetry = newAttempts < (row.max_attempts || 5);
        await supabase
          .from("email_queue")
          .update({
            status: willRetry ? "failed" : "dlq",
            last_error: (enqRes.error || "enqueue failed").slice(0, 500),
          })
          .eq("id", row.id);
        if (!willRetry) {
          trySmsAndFallback(supabase, row.id, row.to_email, row.message_type).catch(() => {});
        }
        results.push({ id: row.id, status: willRetry ? "failed" : "dlq", reason: enqRes.error });
        continue;
      }

      // Success — mark sent, capture provider message id
      await supabase
        .from("email_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: enqRes.id || null,
        })
        .eq("id", row.id);
      results.push({ id: row.id, status: "sent" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[email-queue-drain] row ${row.id} error:`, errorMsg);
      await reportEdgeError(err, { function: "email-queue-drain", queue_row_id: row.id, template_key: row.template_key }).catch(() => {});
      const newAttempts = (row.attempts || 0) + 1;
      const willRetry = newAttempts < (row.max_attempts || 5);
      await supabase
        .from("email_queue")
        .update({
          status: willRetry ? "failed" : "dlq",
          last_error: errorMsg.slice(0, 500),
        })
        .eq("id", row.id);
      if (!willRetry) {
        trySmsAndFallback(supabase, row.id, row.to_email, row.message_type).catch(() => {});
      }
      results.push({ id: row.id, status: willRetry ? "failed" : "dlq", reason: errorMsg });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const dlq = results.filter((r) => r.status === "dlq").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log(`[email-queue-drain] processed=${results.length} sent=${sent} failed=${failed} dlq=${dlq}`);

  return new Response(
    JSON.stringify({ processed: results.length, sent, failed, dlq, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
