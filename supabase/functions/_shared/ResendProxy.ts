/**
 * ResendProxy — Drop-in replacement for the Resend SDK.
 * Instead of sending emails directly, it inserts into `email_queue`
 * so that the process-email-queue worker handles delivery, retries,
 * and tracking.
 *
 * Usage (identical to original Resend SDK):
 *   import { Resend } from "../_shared/ResendProxy.ts";
 *   const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
 *   await resend.emails.send({ from, to, subject, html });
 *
 * For direct enqueue without the SDK interface:
 *   import { enqueueEmail } from "../_shared/ResendProxy.ts";
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ── Core enqueue ───────────────────────────────────────────────────

export async function enqueueEmail(params: EnqueueEmailParams): Promise<EnqueueResult> {
  try {
    const supabase = getSupabaseClient();
    const eventKey = params.eventKey || generateEventKey(params.to);

    // Idempotency check
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

    // Build template vars with passthrough fields
    const templateVars: Record<string, any> = { ...(params.templateVars || {}) };
    if (params.html) templateVars._html = params.html;
    if (params.text) templateVars._text = params.text;
    if (params.fromEmail) templateVars._from_email = params.fromEmail;
    if (params.replyTo) templateVars._reply_to = params.replyTo;
    if (params.subject) templateVars._subject = params.subject;
    if (params.attachments && params.attachments.length > 0) {
      templateVars._attachments = params.attachments;
    }

    const { data, error } = await supabase
      .from("email_queue")
      .insert({
        event_key: eventKey,
        to_email: params.to,
        template_key: params.templateKey || "custom_html",
        template_vars: templateVars,
        message_type: params.messageType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        from_email: params.fromEmail,
        subject: params.subject,
        status: "queued",
        attempts: 0,
        max_attempts: params.maxAttempts || 5,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[enqueueEmail] Insert error:", error.message);
      return { success: false, error: error.message };
    }

    console.log(`[enqueueEmail] Queued: id=${data.id} to=${params.to} template=${params.templateKey || "custom_html"}`);
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("[enqueueEmail] Exception:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}

// ── Resend-compatible class (drop-in replacement) ──────────────────

export class Resend {
  constructor(_apiKey: string | undefined) {
    // API key ignored — all sends are routed through email_queue.
    // The process-email-queue worker uses RESEND_API_KEY from env.
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
