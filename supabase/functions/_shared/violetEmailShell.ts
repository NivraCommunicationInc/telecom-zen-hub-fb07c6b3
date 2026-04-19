/**
 * Shared "Violet Bold" email shell — single source of truth for all
 * transactional Nivra emails. Mirrors the design used in
 * _shared/customQueueTemplates.ts so every email looks identical
 * regardless of which edge function triggers the send.
 */

export const VIOLET_BRAND = {
  primary: "#7c3aed",
  dark: "#1e1b4b",
  heroBg: "#f5f3ff",
  cardBorder: "#ede9fe",
  cardBgLast: "#f5f3ff",
  textBody: "#4b5563",
  textMuted: "#6b7280",
  footerAccent: "#a5b4fc",
  footerLow: "#6b7280",
  divider: "#2d2b55",
};

export const VIOLET_FONT_STACK =
  "'Helvetica Neue',Arial,Helvetica,sans-serif";

const APP_URL = "https://nivra-telecom.ca";
const PORTAL_URL = `${APP_URL}/portail`;
const SUPPORT_EMAIL = "support@nivratelecom.ca";

export function violetEsc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface VioletShellOpts {
  preheader?: string;
  badge: string;
  heroTitle: string;
  heroSub?: string;
  greeting?: string;
  bodyHtml?: string;
  cardTitle?: string;
  cardRows?: Array<[string, string]>;
  cardEmphasizeLast?: boolean;
  ctaPrimaryUrl?: string;
  ctaPrimaryLabel?: string;
  ctaSecondaryUrl?: string;
  ctaSecondaryLabel?: string;
  helpHtml?: string;
  helpVariant?: "info" | "warning";
  afterCardHtml?: string;
  /** Extra raw HTML appended INSIDE the body block (after CTA, before help). */
  extraBodyHtml?: string;
}

function rowsBlockViolet(
  rows: Array<[string, string]>,
  emphasizeLast: boolean,
): string {
  return rows
    .map(([label, value], i) => {
      const isLast = emphasizeLast && i === rows.length - 1;
      if (isLast) {
        return `<tr><td style="padding:12px 18px;background:${VIOLET_BRAND.cardBgLast};font-family:${VIOLET_FONT_STACK};font-size:13px;font-weight:700;color:${VIOLET_BRAND.dark};border-top:1px solid ${VIOLET_BRAND.cardBorder};">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td style="color:${VIOLET_BRAND.dark};font-size:13px;font-weight:700;">${violetEsc(label)}</td>
            <td align="right" style="color:${VIOLET_BRAND.dark};font-size:13px;font-weight:700;">${violetEsc(value)}</td>
          </tr></table>
        </td></tr>`;
      }
      return `<tr><td style="padding:10px 18px;border-bottom:1px solid ${VIOLET_BRAND.heroBg};font-family:${VIOLET_FONT_STACK};font-size:13px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
          <td style="color:${VIOLET_BRAND.textMuted};font-size:13px;">${violetEsc(label)}</td>
          <td align="right" style="color:${VIOLET_BRAND.dark};font-size:13px;font-weight:500;">${violetEsc(value)}</td>
        </tr></table>
      </td></tr>`;
    })
    .join("");
}

export function violetShell(opts: VioletShellOpts): string {
  const {
    preheader = "",
    badge,
    heroTitle,
    heroSub,
    greeting,
    bodyHtml,
    cardTitle,
    cardRows,
    cardEmphasizeLast = true,
    ctaPrimaryUrl,
    ctaPrimaryLabel,
    ctaSecondaryUrl,
    ctaSecondaryLabel,
    helpHtml,
    helpVariant = "info",
    afterCardHtml,
    extraBodyHtml,
  } = opts;

  const helpBorder = helpVariant === "warning" ? "#f59e0b" : VIOLET_BRAND.primary;
  const f = VIOLET_FONT_STACK;

  const cardHtml =
    cardTitle && cardRows && cardRows.length > 0
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff;border:1.5px solid ${VIOLET_BRAND.cardBorder};border-radius:12px;margin:20px 0;border-collapse:separate;overflow:hidden;">
          <tr><td style="background:${VIOLET_BRAND.dark};padding:10px 18px;font-family:${f};">
            <div style="font-size:10px;font-weight:700;color:${VIOLET_BRAND.footerAccent};text-transform:uppercase;letter-spacing:2px;">${violetEsc(cardTitle)}</div>
          </td></tr>
          ${rowsBlockViolet(cardRows, cardEmphasizeLast)}
        </table>`
      : "";

  const ctaPrimary =
    ctaPrimaryUrl && ctaPrimaryLabel
      ? `<a href="${violetEsc(ctaPrimaryUrl)}" style="display:inline-block;background:${VIOLET_BRAND.primary};color:#ffffff;padding:15px 44px;border-radius:99px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.5px;font-family:${f};">${violetEsc(ctaPrimaryLabel)}</a>`
      : "";

  const ctaSecondary =
    ctaSecondaryUrl && ctaSecondaryLabel
      ? `<a href="${violetEsc(ctaSecondaryUrl)}" style="display:inline-block;background:transparent;color:${VIOLET_BRAND.primary};padding:13px 32px;border-radius:99px;font-weight:600;font-size:13px;text-decoration:none;border:2px solid ${VIOLET_BRAND.primary};margin-left:10px;font-family:${f};">${violetEsc(ctaSecondaryLabel)}</a>`
      : "";

  const ctaBlock =
    ctaPrimary || ctaSecondary
      ? `<div style="text-align:center;margin:28px 0;">${ctaPrimary}${ctaSecondary}</div>`
      : "";

  const helpBlock = helpHtml
    ? `<div style="background:#faf9ff;border-left:4px solid ${helpBorder};padding:14px 18px;font-size:13px;color:${VIOLET_BRAND.textBody};margin-top:8px;line-height:1.6;font-family:${f};">${helpHtml}</div>`
    : `<div style="background:#faf9ff;border-left:4px solid ${VIOLET_BRAND.primary};padding:14px 18px;font-size:13px;color:${VIOLET_BRAND.textBody};margin-top:8px;line-height:1.6;font-family:${f};"><strong style="color:${VIOLET_BRAND.dark};">Besoin d'aide ?</strong> Écrivez-nous à <strong style="color:${VIOLET_BRAND.primary};">${SUPPORT_EMAIL}</strong> — réponse en moins de 2h.</div>`;

  const greetingBlock = greeting
    ? `<div style="font-size:15px;color:${VIOLET_BRAND.dark};margin-bottom:14px;font-weight:700;font-family:${f};">${violetEsc(greeting)}</div>`
    : "";

  const bodyTextBlock = bodyHtml
    ? `<div style="font-size:14px;color:${VIOLET_BRAND.textBody};line-height:1.8;margin-bottom:20px;font-family:${f};">${bodyHtml}</div>`
    : "";

  const afterCardBlock = afterCardHtml
    ? `<div style="font-size:14px;color:${VIOLET_BRAND.textBody};line-height:1.8;margin-bottom:20px;font-family:${f};">${afterCardHtml}</div>`
    : "";

  const heroSubBlock = heroSub
    ? `<div style="font-size:14px;color:${VIOLET_BRAND.textMuted};max-width:420px;margin:0 auto;line-height:1.6;font-family:${f};">${violetEsc(heroSub)}</div>`
    : "";

  const extraBlock = extraBodyHtml ? extraBodyHtml : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${violetEsc(heroTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:${f};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${violetEsc(preheader)}</span>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff;">
<tr><td align="center" style="padding:0;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;">

<tr><td style="height:5px;background:${VIOLET_BRAND.primary};line-height:5px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>

<tr><td style="background:${VIOLET_BRAND.dark};padding:24px 32px;font-family:${f};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
    <td style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;">NIVRA<span style="color:${VIOLET_BRAND.primary};">.</span></td>
    <td align="right" style="color:${VIOLET_BRAND.footerAccent};font-size:11px;">Sans contrat · Support québécois</td>
  </tr></table>
</td></tr>

<tr><td style="background:${VIOLET_BRAND.heroBg};padding:48px 32px;text-align:center;font-family:${f};">
  <div style="display:inline-block;background:${VIOLET_BRAND.primary};color:#ffffff;font-size:10px;font-weight:700;padding:4px 14px;border-radius:99px;letter-spacing:2px;margin-bottom:16px;">${violetEsc(badge)}</div>
  <div style="font-size:28px;font-weight:800;color:${VIOLET_BRAND.dark};line-height:1.2;margin-bottom:10px;">${violetEsc(heroTitle)}</div>
  ${heroSubBlock}
</td></tr>

<tr><td style="background:#ffffff;padding:36px 32px;font-family:${f};">
  ${greetingBlock}
  ${bodyTextBlock}
  ${cardHtml}
  ${afterCardBlock}
  ${ctaBlock}
  ${extraBlock}
  ${helpBlock}
</td></tr>

<tr><td style="background:${VIOLET_BRAND.dark};padding:28px 32px;text-align:center;font-family:${f};">
  <div style="color:#ffffff;font-size:14px;font-weight:800;letter-spacing:2px;margin-bottom:14px;">NIVRA TELECOM</div>
  <div style="height:1px;background:${VIOLET_BRAND.divider};margin:12px 0;line-height:1px;font-size:0;">&nbsp;</div>
  <div style="margin-bottom:12px;">
    <a href="${PORTAL_URL}" style="color:${VIOLET_BRAND.footerAccent};font-size:11px;text-decoration:none;margin:0 8px;">Mon compte</a>
    <a href="mailto:${SUPPORT_EMAIL}" style="color:${VIOLET_BRAND.footerAccent};font-size:11px;text-decoration:none;margin:0 8px;">Support</a>
    <a href="${APP_URL}/legal/confidentialite" style="color:${VIOLET_BRAND.footerAccent};font-size:11px;text-decoration:none;margin:0 8px;">Confidentialité</a>
    <a href="${APP_URL}/desabonnement" style="color:${VIOLET_BRAND.footerAccent};font-size:11px;text-decoration:none;margin:0 8px;">Se désabonner</a>
  </div>
  <div style="font-size:11px;color:${VIOLET_BRAND.footerLow};line-height:1.6;">© 2026 Nivra Telecom. Tous droits réservés.<br>Ce message a été envoyé car vous êtes client Nivra Telecom.</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
