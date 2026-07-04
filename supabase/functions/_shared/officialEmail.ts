/**
 * OFFICIAL EMAIL HELPER — SINGLE ENTRY POINT
 * =========================================================================
 * TOUS les emails du site (client, staff, partenaire, admin, notifications)
 * DOIVENT passer par cette fonction. Elle garantit que le HTML final est
 * généré par le template officiel Nivra (violetShell → baseStyles bleu
 * corporate #0066CC).
 *
 * INTERDIT :
 *  - resend.emails.send() avec un `html` inline ailleurs dans le codebase
 *  - Toute construction de <html>...</html> hors de violetShell
 *  - Tout autre design/template email
 */

import { violetShell, type VioletShellOpts } from "./violetEmailShell.ts";
import { Resend } from "./ResendProxy.ts";

const FROM_DEFAULT = "Nivra Telecom <support@nivra-telecom.ca>";
const REPLY_TO_DEFAULT = "support@nivra-telecom.ca";

export interface OfficialEmailInput extends VioletShellOpts {
  /** Recipient email(s) */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** From address — defaults to Nivra Telecom */
  from?: string;
  /** Reply-to — defaults to support@nivra-telecom.ca */
  replyTo?: string;
  /** CC / BCC */
  cc?: string | string[];
  bcc?: string | string[];
  /** Optional attachments (passed through to Resend) */
  attachments?: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>;
}

export interface OfficialEmailResult {
  success: boolean;
  id?: string;
  error?: unknown;
}

/**
 * Send an email using the OFFICIAL Nivra template.
 * Every field except `to`, `subject`, and one of `bodyHtml`/`cardRows`
 * has sensible defaults. See VioletShellOpts for full customization.
 */
export async function sendOfficialEmail(input: OfficialEmailInput): Promise<OfficialEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[officialEmail] RESEND_API_KEY missing");
    return { success: false, error: "resend_api_key_missing" };
  }
  const resend = new Resend(apiKey);

  const html = violetShell({
    preheader: input.preheader ?? input.subject,
    badge: input.badge ?? "NIVRA TELECOM",
    heroTitle: input.heroTitle ?? input.subject,
    heroSub: input.heroSub,
    greeting: input.greeting,
    bodyHtml: input.bodyHtml,
    cardTitle: input.cardTitle,
    cardRows: input.cardRows,
    cardEmphasizeLast: input.cardEmphasizeLast,
    ctaPrimaryUrl: input.ctaPrimaryUrl,
    ctaPrimaryLabel: input.ctaPrimaryLabel,
    ctaSecondaryUrl: input.ctaSecondaryUrl,
    ctaSecondaryLabel: input.ctaSecondaryLabel,
    helpHtml: input.helpHtml,
    helpVariant: input.helpVariant,
    afterCardHtml: input.afterCardHtml,
    extraBodyHtml: input.extraBodyHtml,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: input.from ?? FROM_DEFAULT,
      to: Array.isArray(input.to) ? input.to : [input.to],
      cc: input.cc,
      bcc: input.bcc,
      reply_to: input.replyTo ?? REPLY_TO_DEFAULT,
      subject: input.subject,
      html,
      attachments: input.attachments,
    } as any);
    if (error) return { success: false, error };
    return { success: true, id: (data as any)?.id };
  } catch (e) {
    return { success: false, error: e };
  }
}
