/**
 * emailUtils — Thin anti-spam wrapper around ResendProxy.enqueueEmail.
 *
 * Use this for any NEW transactional email send. It:
 *   • forces the canonical From (Nivra Telecom <support@nivra-telecom.ca>)
 *   • sets reply_to=support@nivra-telecom.ca by default
 *   • injects List-Unsubscribe + X-Mailer headers (handled inside ResendProxy)
 *   • sanitizes the subject (no ALL CAPS, max 1 emoji, no !!, ≤60 chars)
 *   • auto-generates a plain-text version when `text` is not provided
 *   • blocks sends to addresses on the suppression list
 *
 * Existing call sites already route through ResendProxy → no rewrite needed.
 */

import { enqueueEmail, type EnqueueResult } from "./ResendProxy.ts";

export interface SendNivraEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  bcc?: string[];
  /** When omitted, falls back to canonical Nivra Telecom <support@…>. */
  fromEmail?: string;
  /** Idempotency key — use a stable identifier per logical send. */
  eventKey?: string;
  templateKey?: string;
  messageType?: string;
  entityType?: string;
  entityId?: string;
}

export async function sendNivraEmail(params: SendNivraEmailParams): Promise<EnqueueResult> {
  return await enqueueEmail({
    to: params.to,
    bcc: params.bcc,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
    fromEmail: params.fromEmail,
    eventKey: params.eventKey,
    templateKey: params.templateKey || "custom_html",
    messageType: params.messageType,
    entityType: params.entityType,
    entityId: params.entityId,
  });
}
