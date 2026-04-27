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
  const batchSize = Math.min(
    parseInt(url.searchParams.get("limit") || "20", 10) || 20,
    MAX_BATCH,
  );

  // 1. Fetch eligible queued rows
  const { data: rows, error: fetchErr } = await supabase
    .from("email_queue")
    .select("id, event_key, to_email, template_key, template_vars, attempts, max_attempts, from_email, subject, message_type, entity_type, entity_id, attachments")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(batchSize);

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
      // Mark as processing to prevent double-processing
      const { error: lockErr } = await supabase
        .from("email_queue")
        .update({ status: "processing", attempts: (row.attempts || 0) + 1 })
        .eq("id", row.id)
        .in("status", ["queued", "failed"]);

      if (lockErr) {
        results.push({ id: row.id, status: "lock_failed", reason: lockErr.message });
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
        const tmpl = renderQueueTemplate(row.template_key, row.template_vars || {});
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
      const newAttempts = (row.attempts || 0) + 1;
      const willRetry = newAttempts < (row.max_attempts || 5);
      await supabase
        .from("email_queue")
        .update({
          status: willRetry ? "failed" : "dlq",
          last_error: errorMsg.slice(0, 500),
        })
        .eq("id", row.id);
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
