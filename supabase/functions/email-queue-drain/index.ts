/**
 * email-queue-drain — processes email_queue rows (status='queued' or 'failed').
 * Renders HTML via customQueueTemplates (lazy import to avoid cold-start timeout),
 * then sends directly via Resend API. No pgmq / ResendProxy dependency.
 *
 * Trigger: pg_cron every 1 minute | manual POST.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { recordHeartbeat } from "../_shared/cronHeartbeat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BATCH = 20;
const CANONICAL_FROM = "Nivra Telecom <support@nivra-telecom.ca>";

interface QueueRow {
  id: string;
  event_key: string;
  to_email: string;
  template_key: string;
  template_vars: Record<string, unknown> | null;
  subject: string | null;
  from_email: string | null;
  language: string | null;
  attempts: number;
  max_attempts: number;
  
  attachments: Array<{ filename: string; content?: string; path?: string }> | null;
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  fromEmail?: string | null,
  attachments?: Array<{ filename: string; content?: string; path?: string }> | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      from: fromEmail || CANONICAL_FROM,
      to: [to],
      subject,
      html,
    };
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (r.ok) return { ok: true };
    const txt = await r.text();
    return { ok: false, error: `Resend ${r.status}: ${txt.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * fallbackHtml — Emit a MINIMAL branded body ONLY when the queue row carries
 * an explicit action link (reset_link / action_link). Any other unrenderable
 * template MUST be sent to DLQ — we never ship a "Template: xxx" body to a
 * client. Handled by the caller: if this returns null, mark the row `dlq`.
 */
function fallbackHtml(subject: string, _templateKey: string, vars: Record<string, unknown>): string | null {
  const resetLink = (vars.reset_link || vars.action_link) as string | undefined;
  if (!resetLink) return null;
  return `<html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<h2 style="color:#7c3aed">Nivra Telecom</h2>
<p>${subject}</p>
<p><a href="${resetLink}" style="background:#7c3aed;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Accéder à votre compte</a></p>
<p style="color:#6b7280;font-size:13px">Ce lien est valide 24 heures. Si vous n'avez pas demandé cela, ignorez cet email.</p>
<hr><p style="color:#9ca3af;font-size:12px">Nivra Telecom • support@nivra-telecom.ca</p>
</body></html>`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const _cronStartedAt = new Date();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const url = new URL(req.url);
  const batchSize = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, MAX_BATCH);

  // Fetch queued rows (status queued or failed with remaining retries)
  const { data: rows, error: fetchErr } = await supabase
    .from("email_queue")
    .select("id, event_key, to_email, template_key, template_vars, subject, from_email, language, attempts, max_attempts, attachments")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: "No queued emails" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Lazy-load template renderer — avoids loading 403KB file at boot time
  let renderQueueTemplate: ((key: string, vars: Record<string, unknown>, lang: "fr" | "en") => { html: string; subject: string } | null) | null = null;

  const results: Array<{ id: string; status: string; reason?: string }> = [];

  for (const row of rows as QueueRow[]) {
    // Atomic lock: transition to 'processing' only from queued/failed
    const { data: locked, error: lockErr } = await supabase
      .from("email_queue")
      .update({ status: "processing", attempts: (row.attempts || 0) + 1 })
      .eq("id", row.id)
      .in("status", ["queued", "failed"])
      .select("id")
      .maybeSingle();

    if (lockErr || !locked) {
      results.push({ id: row.id, status: "skipped", reason: "concurrent_lock" });
      continue;
    }

    try {
      const vars = { ...(row.template_vars || {}) };
      const lang = (row.language === "en" ? "en" : "fr") as "fr" | "en";

      let html = "";
      let subject = row.subject || "Notification Nivra Telecom";

      // Try template rendering (lazy load on first email needing it)
      if (!renderQueueTemplate) {
        try {
          const mod = await import("../_shared/customQueueTemplates.ts");
          renderQueueTemplate = mod.renderQueueTemplate;
        } catch (_e) {
          console.warn("[email-queue-drain] customQueueTemplates failed to load, using fallback HTML");
        }
      }

      if (renderQueueTemplate) {
        const tmpl = renderQueueTemplate(row.template_key, vars, lang);
        if (tmpl) {
          html = tmpl.html;
          subject = tmpl.subject;
        }
      }

      if (!html) {
        const fb = fallbackHtml(subject, row.template_key, vars);
        if (!fb) {
          // Ghost template — refuse to send a content-free email to a real
          // client. Send row to DLQ with a clear reason so ops can add a
          // proper case or remove the trigger.
          await supabase
            .from("email_queue")
            .update({
              status: "dlq",
              last_error: `template_not_defined:${row.template_key}`,
            })
            .eq("id", row.id);
          results.push({ id: row.id, status: "dlq", reason: `template_not_defined:${row.template_key}` });
          continue;
        }
        html = fb;
      }


      const sendResult = await sendViaResend(resendApiKey, row.to_email, subject, html, row.from_email, row.attachments);

      if (sendResult.ok) {
        await supabase
          .from("email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        results.push({ id: row.id, status: "sent" });
      } else {
        const newAttempts = (row.attempts || 0) + 1;
        const willRetry = newAttempts < (row.max_attempts || 5);
        await supabase
          .from("email_queue")
          .update({
            status: willRetry ? "failed" : "dlq",
            last_error: (sendResult.error || "send failed").slice(0, 500),
          })
          .eq("id", row.id);
        results.push({ id: row.id, status: willRetry ? "failed" : "dlq", reason: sendResult.error });
      }
    } catch (err) {
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

  const sent = results.filter(r => r.status === "sent").length;
  const dlq = results.filter(r => r.status === "dlq").length;
  const failed = results.filter(r => r.status === "failed").length;

  console.log(`[email-queue-drain] processed=${results.length} sent=${sent} failed=${failed} dlq=${dlq}`);

  return new Response(
    JSON.stringify({ processed: results.length, sent, failed, dlq }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
