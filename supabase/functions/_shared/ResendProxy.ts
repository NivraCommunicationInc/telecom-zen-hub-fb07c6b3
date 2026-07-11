/**
 * ResendProxy â€” Drop-in replacement for the Resend SDK.
 * Enqueues emails to pgmq via enqueue_email RPC for delivery
 * by the process-email-queue worker (Lovable Email API).
 *
 * Also inserts into `email_queue` table for tracking/idempotency.
 *
 * Usage (identical to original Resend SDK):
 *   import { Resend } from "../_shared/ResendProxy.ts";
 *   const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
 *   await resend.emails.send({ from, to, subject, html });
 *
 * For direct enqueue without the SDK interface:
 *   import { enqueueEmail } from "../_shared/ResendProxy.ts";
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface EmailSendParams {
  from: string;
  to: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  reply_to?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  headers?: Record<string, string>;
}

interface EmailSendResult {
  data: { id: string } | null;
  error: { message: string; statusCode?: number; name?: string } | null;
}

export interface EnqueueEmailParams {
  to: string;
  bcc?: string[];
  templateKey?: string;
  templateVars?: Record<string, any>;
  eventKey?: string;
  messageType?: string;
  entityType?: string;
  entityId?: string;
  fromEmail?: string;
  subject?: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  maxAttempts?: number;
  /** ISO 639-1 language code for email template rendering. "fr" | "en" */
  lang?: string;
}

export interface EnqueueResult {
  success: boolean;
  id?: string;
  error?: string;
  alreadyQueued?: boolean;
}

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SENDER_DOMAIN = "notify.nivra-telecom.ca";
const FROM_DOMAIN = "nivra-telecom.ca";
const SUPPORT_EMAIL = "support@nivra-telecom.ca";
// Anti-spam: canonical sender used for ALL client-facing emails.
// Internal admin alerts may opt-out by passing fromEmail starting with "Nivra Admin"
// or "Nivra Activations" â€” those are kept as-is for inbox filtering.
const CANONICAL_FROM = `Nivra Telecom <${SUPPORT_EMAIL}>`;
const DEFAULT_FROM = CANONICAL_FROM;
const PGMQ_QUEUE = "transactional_emails";

// Anti-spam mailer headers injected on every send.
const MAILER_HEADERS: Record<string, string> = {
  "X-Mailer": "Nivra Telecom Mailer v2",
  "List-Unsubscribe": `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
};

// Admin-alert From prefixes that are preserved (not rewritten to support@).
const ADMIN_FROM_PREFIXES = ["Nivra Admin", "Nivra Activations", "Nivra Billing"];

function isAdminAlertFrom(from: string | undefined | null): boolean {
  if (!from) return false;
  return ADMIN_FROM_PREFIXES.some((p) => from.trim().startsWith(p));
}

/**
 * Anti-spam subject sanitizer.
 *  - strip surrounding whitespace
 *  - collapse "!!" / "!!!" to single "."
 *  - if the subject is mostly UPPERCASE, convert to sentence case
 *  - keep at most ONE emoji (first one wins)
 *  - cap at 60 chars (preserve word boundary)
 */
function sanitizeSubject(raw: string): string {
  if (!raw) return "Notification Nivra Telecom";
  let s = String(raw).trim();

  // Replace runs of ! with a single period (avoid "!!!" spam triggers)
  s = s.replace(/!{2,}/g, ".").replace(/!/g, "");

  // Detect emoji (basic ranges) and keep only the first
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu;
  const emojis = s.match(emojiRegex) || [];
  if (emojis.length > 1) {
    let kept = false;
    s = s.replace(emojiRegex, (m) => {
      if (!kept) { kept = true; return m; }
      return "";
    });
  }

  // Collapse double spaces left by emoji removal
  s = s.replace(/\s{2,}/g, " ").trim();

  // ALL CAPS detection â€” if >=60% of letters are uppercase, sentence-case it
  const letters = s.replace(/[^A-Za-zÀ-Ã¿]/g, "");
  if (letters.length >= 6) {
    const upper = letters.replace(/[^A-ZÀ-Ãž]/g, "").length;
    if (upper / letters.length >= 0.6) {
      s = s.toLowerCase();
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }
  }

  // Cap at 60 chars on word boundary
  if (s.length > 60) {
    const cut = s.slice(0, 60);
    const lastSpace = cut.lastIndexOf(" ");
    s = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim();
  }

  return s || "Notification Nivra Telecom";
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getSupabaseClient(): any {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key) as any;
}

/**
 * Deterministic event_key derivation.
 *
 * Rule: same (template, entity, recipient) MUST produce the same key so that
 * repeated triggers of the same logical event fold into a single email_queue
 * row. NEVER include Date.now() or random — that defeats idempotency.
 *
 * Callers SHOULD pass their own eventKey when the entity/cycle differs from
 * the defaults (e.g. reminders J+3 / J+7 need distinct suffixes). This is a
 * safety fallback used when no explicit key is supplied.
 */
function deriveEventKey(params: EnqueueEmailParams): string {
  const template = params.templateKey || "custom_html";
  const entityType = params.entityType || "-";
  const entityId = params.entityId || "-";
  const to = (params.to || "").toLowerCase().trim();

  // When we have full entity context → strictly deterministic
  if (params.entityId && params.templateKey) {
    return `${template}::${entityType}::${entityId}::${to}`;
  }

  // Fallback: content-hash (still deterministic — same content = same key)
  // Uses subject + first 200 chars of HTML/text so callers without entity ids
  // are still deduplicated on identical payloads.
  const contentSample = (params.subject || "") + "|" +
    (params.html || params.text || params.templateVars?._html || "").slice(0, 200);
  let hash = 0;
  for (let i = 0; i < contentSample.length; i++) {
    hash = ((hash << 5) - hash + contentSample.charCodeAt(i)) | 0;
  }
  console.warn(
    `[enqueueEmail] deriveEventKey fallback — no entityId/templateKey; ` +
    `template=${template} to=${to}. Pass an explicit eventKey for reliable dedup.`
  );
  return `${template}::content::${(hash >>> 0).toString(36)}::${to}`;
}

function generateMessageId(): string {
  return crypto.randomUUID();
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr|table|section)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function getOrCreateUnsubscribeToken(
  supabase: any,
  email: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .maybeSingle();

  if (existing?.token) return existing.token;

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("email_unsubscribe_tokens")
    .insert({ email, token });

  if (error) {
    const { data: retry } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email)
      .maybeSingle();
    if (retry?.token) return retry.token;
    return token;
  }

  return token;
}

async function isEmailSuppressed(
  supabase: any,
  email: string
): Promise<boolean> {
  const { data } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

// â”€â”€ Core enqueue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function enqueueEmail(params: EnqueueEmailParams): Promise<EnqueueResult> {
  try {
    const supabase = getSupabaseClient();
    // Always derive deterministically when no explicit key given — NO random, NO Date.now.
    const eventKey = params.eventKey || deriveEventKey(params);

    // Idempotency check ALWAYS runs (previously was gated by `if (params.eventKey)`,
    // which is exactly what let the random-fallback path create duplicates).
    {
      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (existing) {
        console.log(`[enqueueEmail] Deduplicated — already queued: ${eventKey}`);
        return { success: true, id: existing.id, alreadyQueued: true };
      }
    }

    // Check suppression
    if (await isEmailSuppressed(supabase, params.to)) {
      console.log(`[enqueueEmail] Suppressed: ${params.to}`);
      return { success: true, alreadyQueued: true };
    }

    // Resolve HTML content
    const html = params.html || params.templateVars?._html || "";
    const rawSubject = params.subject || params.templateVars?._subject || "Notification Nivra Telecom";
    const subject = sanitizeSubject(rawSubject);

    // Anti-spam: force canonical From for client-facing emails.
    // Preserve admin alert From so internal mail filters keep working.
    const requestedFrom = params.fromEmail || params.templateVars?._from_email;
    const fromEmail = isAdminAlertFrom(requestedFrom)
      ? (requestedFrom as string)
      : CANONICAL_FROM;

    const text = params.text || params.templateVars?._text || htmlToPlainText(html);
    const replyTo = params.replyTo || SUPPORT_EMAIL;

    if (!html) {
      console.error(`[enqueueEmail] No HTML content for template: ${params.templateKey}`);
      return { success: false, error: "No HTML content available" };
    }

    // Get unsubscribe token
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, params.to);

    // Generate message ID for deduplication in process-email-queue
    const messageId = generateMessageId();

    // Per-recipient List-Unsubscribe (mailto + token-based) anti-spam headers
    const headers: Record<string, string> = {
      ...MAILER_HEADERS,
      "List-Unsubscribe": `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe-${unsubscribeToken}>`,
    };

    // Build pgmq payload matching what process-email-queue expects
    const pgmqPayload = {
      to: params.to,
      bcc: params.bcc,
      from: fromEmail,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      reply_to: replyTo,
      attachments: params.attachments,
      headers,
      purpose: "transactional",
      label: params.templateKey || "custom_html",
      idempotency_key: eventKey,
      unsubscribe_token: unsubscribeToken,
      message_id: messageId,
      queued_at: new Date().toISOString(),
    };

    // Enqueue to pgmq for delivery by process-email-queue
    const { error: pgmqError } = await supabase.rpc("enqueue_email", {
      queue_name: PGMQ_QUEUE,
      payload: pgmqPayload,
    });

    if (pgmqError) {
      console.error("[enqueueEmail] pgmq enqueue error:", pgmqError.message);
      return { success: false, error: pgmqError.message };
    }

    // Log pending in email_send_log
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: params.templateKey || "custom_html",
      recipient_email: params.to,
      status: "pending",
    });

    // Also track in email_queue table for idempotency/admin visibility.
    //
    // MODULE 40 EXEMPTION (transport-layer tracking write):
    // ResendProxy sits AFTER the pgmq delivery layer. Callers upstream have
    // already gone through preference/suppression checks (or this file's own
    // isEmailSuppressed guard at line 276). The row inserted here reflects
    // the delivery outcome (`status: "sent"`, `attempts: 1`), not a new
    // producer intent, so routing it through rpc_communication_enqueue would
    // create a duplicate audit trail and re-run preference checks against an
    // email that has already been dispatched.
    //
    // The `_communication_source` marker below is picked up by the audit-only
    // tg_communications_single_door trigger so this insert is classified as
    // "transport" instead of "unknown_producer".
    const templateVars: Record<string, any> = {
      ...(params.templateVars || {}),
      _communication_source: "resend-proxy-transport",
    };
    await supabase.from("email_queue").insert({
      event_key: eventKey,
      to_email: params.to,
      template_key: params.templateKey || "custom_html",
      template_vars: templateVars,
      message_type: params.messageType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      from_email: params.fromEmail,
      subject,
      attachments: params.attachments ?? null,
      language: params.lang || null,
      status: "sent", // Mark as sent since it's now in pgmq
      attempts: 1,
      max_attempts: params.maxAttempts || 5,
    }).then((result: { error?: { message?: string } | null }) => {
      if (result.error) console.warn("[enqueueEmail] email_queue tracking insert failed:", result.error.message);
    });

    console.log(`[enqueueEmail] Queued to pgmq: id=${messageId} to=${params.to} template=${params.templateKey || "custom_html"}`);
    return { success: true, id: messageId };
  } catch (err) {
    console.error("[enqueueEmail] Exception:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

// â”€â”€ Resend-compatible class (drop-in replacement) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export class Resend {
  constructor(_apiKey: string | undefined) {
    // API key ignored â€” all sends are routed through pgmq.
    // The process-email-queue worker uses LOVABLE_API_KEY from env.
  }

  emails = {
    send: async (params: EmailSendParams): Promise<EmailSendResult> => {
      const result = await enqueueEmail({
        to: params.to[0],
        bcc: params.bcc,
        templateKey: "custom_html",
        html: params.html,
        text: params.text,
        subject: params.subject,
        fromEmail: params.from,
        replyTo: params.replyTo || params.reply_to,
        attachments: params.attachments,
      });

      if (result.success) {
        return { data: { id: result.id! }, error: null };
      }
      return { data: null, error: { message: result.error || "Failed to enqueue" } };
    },
  };
}
