/**
 * ResendProxy — Drop-in replacement for the Resend SDK.
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

// ── Types ──────────────────────────────────────────────────────────

interface EmailSendParams {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
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
}

export interface EnqueueResult {
  success: boolean;
  id?: string;
  error?: string;
  alreadyQueued?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────

const SENDER_DOMAIN = "notify.nivra-telecom.ca";
const FROM_DOMAIN = "nivra-telecom.ca";
const DEFAULT_FROM = `Nivra Telecom <noreply@${FROM_DOMAIN}>`;
const PGMQ_QUEUE = "transactional_emails";

// ── Helpers ────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key);
}

function generateEventKey(to: string): string {
  return `q_${to}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

// ── Unsubscribe token management ──────────────────────────────────

async function getOrCreateUnsubscribeToken(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<string> {
  // Check for existing token
  const { data: existing } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .maybeSingle();

  if (existing?.token) return existing.token;

  // Create new token
  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("email_unsubscribe_tokens")
    .insert({ email, token })
    .single();

  if (error) {
    // Race condition: another process created it
    const { data: retry } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email)
      .maybeSingle();
    if (retry?.token) return retry.token;
    // Fallback: use a deterministic token
    return token;
  }

  return token;
}

// ── Suppression check ─────────────────────────────────────────────

async function isEmailSuppressed(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<boolean> {
  const { data } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

// ── Core enqueue ───────────────────────────────────────────────────

export async function enqueueEmail(params: EnqueueEmailParams): Promise<EnqueueResult> {
  try {
    const supabase = getSupabaseClient();
    const eventKey = params.eventKey || generateEventKey(params.to);

    // Idempotency check on email_queue table
    if (params.eventKey) {
      const { data: existing } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (existing) {
        console.log(`[enqueueEmail] Already queued: ${eventKey}`);
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
    const subject = params.subject || params.templateVars?._subject || "Notification Nivra Telecom";
    const fromEmail = params.fromEmail || params.templateVars?._from_email || DEFAULT_FROM;
    const text = params.text || params.templateVars?._text || htmlToPlainText(html);

    if (!html) {
      console.error(`[enqueueEmail] No HTML content for template: ${params.templateKey}`);
      return { success: false, error: "No HTML content available" };
    }

    // Get unsubscribe token
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, params.to);

    // Generate message ID for deduplication in process-email-queue
    const messageId = generateMessageId();

    // Build pgmq payload matching what process-email-queue expects
    const pgmqPayload = {
      to: params.to,
      from: fromEmail,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
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

    // Also track in email_queue table for idempotency/admin visibility
    const templateVars: Record<string, any> = { ...(params.templateVars || {}) };
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
      status: "sent", // Mark as sent since it's now in pgmq
      attempts: 1,
      max_attempts: params.maxAttempts || 5,
    }).then(({ error }) => {
      if (error) console.warn("[enqueueEmail] email_queue tracking insert failed:", error.message);
    });

    console.log(`[enqueueEmail] Queued to pgmq: id=${messageId} to=${params.to} template=${params.templateKey || "custom_html"}`);
    return { success: true, id: messageId };
  } catch (err: any) {
    console.error("[enqueueEmail] Exception:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

// ── Resend-compatible class (drop-in replacement) ──────────────────

export class Resend {
  constructor(_apiKey: string | undefined) {
    // API key ignored — all sends are routed through pgmq.
    // The process-email-queue worker uses LOVABLE_API_KEY from env.
  }

  emails = {
    send: async (params: EmailSendParams): Promise<EmailSendResult> => {
      const result = await enqueueEmail({
        to: params.to[0],
        templateKey: "custom_html",
        html: params.html,
        text: params.text,
        subject: params.subject,
        fromEmail: params.from,
        replyTo: params.reply_to,
        attachments: params.attachments,
      });

      if (result.success) {
        return { data: { id: result.id! }, error: null };
      }
      return { data: null, error: { message: result.error || "Failed to enqueue" } };
    },
  };
}
