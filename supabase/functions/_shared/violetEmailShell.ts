/**
 * Shared "Nivra Service" email shell — single source of truth for all
 * transactional Nivra emails. Design based on the approved "Service Activé"
 * template (violet #7c3aed + white + dark navy #0a0a23).
 *
 * The exported API (violetShell, violetEsc, VIOLET_BRAND, VIOLET_FONT_STACK,
 * VioletShellOpts) is preserved so every existing edge function keeps working
 * — only the rendered HTML changes.
 */

export const VIOLET_BRAND = {
  primary: "#7c3aed",
  primaryHover: "#6d28d9",
  primaryAccent: "#a78bfa",
  primarySoft: "#f5f3ff",
  primarySoftBorder: "#ede9fe",
  dark: "#0a0a23",
  darkSoft: "#52525b",
  textBody: "#52525b",
  textMuted: "#71717a",
  textFaint: "#a1a1aa",
  surface: "#ffffff",
  surfaceAlt: "#fafafe",
  pageBg: "#eef0f4",
  divider: "#f1f1f5",
  cardBorder: "#ececf3",
  cardBorderSoft: "#f4f4f8",
  successBg: "#ecfdf5",
  successBorder: "#a7f3d0",
  successText: "#065f46",
  successDot: "#10b981",
  warning: "#f59e0b",
  pinkAccent: "#ec4899",
  // Legacy aliases kept for backwards compatibility with older callers
  heroBg: "#f5f3ff",
  cardBgLast: "#f5f3ff",
  footerAccent: "#a78bfa",
  footerLow: "#71717a",
};

export const VIOLET_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const APP_URL = "https://nivra-telecom.ca";
const PORTAL_URL = `${APP_URL}/mon-compte`;
const SUPPORT_EMAIL = "support@nivra-telecom.ca";

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

function rowsBlock(
  rows: Array<[string, string]>,
  emphasizeLast: boolean,
): string {
  const f = VIOLET_FONT_STACK;
  return rows
    .map(([label, value], i) => {
      const isLast = emphasizeLast && i === rows.length - 1;
      if (isLast) {
        // Highlighted final row (e.g. "Total", "Prochaine facture")
        return `<tr><td style="padding:18px 20px;background:linear-gradient(135deg,#faf9ff 0%,${VIOLET_BRAND.primarySoft} 100%);font-family:${f};">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
            <td style="vertical-align:middle;">
              <div style="font-size:11px;color:${VIOLET_BRAND.primary};font-weight:700;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:3px;">${violetEsc(label)}</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="font-size:18px;color:${VIOLET_BRAND.dark};font-weight:800;letter-spacing:-0.4px;line-height:1.2;">${violetEsc(value)}</div>
            </td>
          </tr></table>
        </td></tr>`;
      }
      const border =
        i < rows.length - 1
          ? `border-bottom:1px solid ${VIOLET_BRAND.cardBorderSoft};`
          : "";
      return `<tr><td style="padding:16px 20px;${border}font-family:${f};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
          <td style="font-size:13px;color:${VIOLET_BRAND.textMuted};font-weight:500;">${violetEsc(label)}</td>
          <td align="right" style="font-size:14px;color:${VIOLET_BRAND.dark};font-weight:600;">${violetEsc(value)}</td>
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

  const f = VIOLET_FONT_STACK;
  const C = VIOLET_BRAND;

  // ---------- HERO badge ("SERVICE ACTIVÉ" style pill) ----------
  const badgeBlock = badge
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:${C.successBg};border:1px solid ${C.successBorder};border-radius:99px;"><tr>
          <td style="padding:6px 14px 6px 12px;vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;padding-right:8px;line-height:1;">
                <div style="width:7px;height:7px;background:${C.successDot};border-radius:50%;"></div>
              </td>
              <td style="vertical-align:middle;color:${C.successText};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;line-height:1;">
                ${violetEsc(badge)}
              </td>
            </tr></table>
          </td>
        </tr></table>
      </td></tr></table>`
    : "";

  // ---------- HERO title (first part black, color the rest) ----------
  // Keep heroTitle as one styled block to stay safe with arbitrary input.
  const heroTitleBlock = `<h1 style="margin:0 0 14px;font-size:36px;font-weight:800;color:${C.dark};line-height:1.1;letter-spacing:-1.2px;font-family:${f};">${violetEsc(heroTitle)}</h1>`;

  const heroSubBlock = heroSub
    ? `<p style="margin:0;font-size:16px;color:${C.textBody};line-height:1.55;font-weight:400;font-family:${f};">${violetEsc(heroSub)}</p>`
    : "";

  // ---------- Body / greeting ----------
  const greetingBlock = greeting
    ? `<div style="font-size:16px;color:${C.dark};margin-bottom:14px;font-weight:600;font-family:${f};letter-spacing:-0.2px;">${violetEsc(greeting)}</div>`
    : "";

  const bodyTextBlock = bodyHtml
    ? `<div style="font-size:14px;color:${C.textBody};line-height:1.7;margin-bottom:20px;font-family:${f};">${bodyHtml}</div>`
    : "";

  // ---------- Recap card (label/value rows) ----------
  const cardHtml =
    cardTitle && cardRows && cardRows.length > 0
      ? `<div style="font-size:12px;color:${C.textMuted};font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 14px;font-family:${f};">${violetEsc(cardTitle)}</div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${C.surface};border:1px solid ${C.cardBorder};border-radius:14px;border-collapse:separate;overflow:hidden;margin:0 0 24px;">
          ${rowsBlock(cardRows, cardEmphasizeLast)}
        </table>`
      : "";

  // ---------- CTAs (pill primary + ghost secondary) ----------
  const ctaPrimary =
    ctaPrimaryUrl && ctaPrimaryLabel
      ? `<a href="${violetEsc(ctaPrimaryUrl)}" style="display:inline-block;background:${C.primary};color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:99px;font-weight:700;font-size:15px;letter-spacing:-0.2px;font-family:${f};box-shadow:0 4px 14px rgba(124,58,237,0.32);">${violetEsc(ctaPrimaryLabel)} →</a>`
      : "";

  const ctaSecondary =
    ctaSecondaryUrl && ctaSecondaryLabel
      ? `<a href="${violetEsc(ctaSecondaryUrl)}" style="display:inline-block;background:transparent;color:${C.primary};text-decoration:none;padding:14px 28px;border-radius:99px;font-weight:600;font-size:14px;border:1.5px solid ${C.primarySoftBorder};margin-left:8px;font-family:${f};">${violetEsc(ctaSecondaryLabel)}</a>`
      : "";

  const ctaBlock =
    ctaPrimary || ctaSecondary
      ? `<div style="text-align:center;margin:8px 0 28px;">${ctaPrimary}${ctaSecondary}</div>`
      : "";

  // ---------- After card slot ----------
  const afterCardBlock = afterCardHtml
    ? `<div style="font-size:14px;color:${C.textBody};line-height:1.7;margin-bottom:20px;font-family:${f};">${afterCardHtml}</div>`
    : "";

  // ---------- Help / info banner (dark support style) ----------
  const helpBorder = helpVariant === "warning" ? C.warning : C.primary;
  const helpBlock = helpHtml
    ? `<div style="background:${C.surfaceAlt};border-left:4px solid ${helpBorder};border-radius:0 10px 10px 0;padding:16px 20px;font-size:13px;color:${C.textBody};margin-top:8px;line-height:1.6;font-family:${f};">${helpHtml}</div>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.dark};border-radius:14px;margin-top:8px;">
        <tr><td style="padding:22px 24px;font-family:${f};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;">
              <div style="font-size:11px;color:${C.pinkAccent};font-weight:700;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:4px;">Support québécois</div>
              <div style="font-size:15px;color:#ffffff;font-weight:600;letter-spacing:-0.2px;line-height:1.4;">Une question ? On répond en moins de 2h.</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <a href="mailto:${SUPPORT_EMAIL}" style="display:inline-block;background:#ffffff;color:${C.dark};text-decoration:none;padding:10px 20px;border-radius:99px;font-weight:700;font-size:13px;letter-spacing:-0.1px;">Nous écrire</a>
            </td>
          </tr></table>
        </td></tr>
      </table>`;

  const extraBlock = extraBodyHtml ? extraBodyHtml : "";

  // ---------- Final HTML ----------
  return `<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${violetEsc(heroTitle)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  @media only screen and (max-width:620px){
    .container{width:100%!important;border-radius:0!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .hero-title h1{font-size:28px!important;line-height:1.15!important;}
    .hide-mobile{display:none!important;}
  }
  a{color:${C.primary};text-decoration:none;}
</style>
</head>
<body style="margin:0;padding:0;background:${C.pageBg};font-family:${f};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:${C.dark};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.pageBg};">${violetEsc(preheader)}</span>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pageBg};">
<tr><td align="center" style="padding:24px 12px 40px;">

<!-- MAIN CONTAINER -->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${C.surface};border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 12px 40px rgba(30,27,75,0.10);">

<!-- TOP ACCENT GRADIENT -->
<tr><td style="height:4px;background:${C.primary};background:linear-gradient(90deg,${C.primary} 0%,${C.primaryAccent} 50%,${C.primary} 100%);line-height:4px;font-size:0;">&nbsp;</td></tr>

<!-- HEADER : violet logo block + Nivra wordmark -->
<tr><td class="px" style="background:${C.surface};padding:22px 36px;border-bottom:1px solid ${C.divider};font-family:${f};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left" style="vertical-align:middle;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:10px;">
          <div style="width:32px;height:32px;background:${C.primary};border-radius:8px;text-align:center;line-height:32px;color:#ffffff;font-size:14px;font-weight:800;font-family:${f};">N</div>
        </td>
        <td style="vertical-align:middle;">
          <div style="color:${C.dark};font-size:17px;font-weight:700;letter-spacing:-0.3px;line-height:1;">Nivra</div>
          <div style="color:${C.textMuted};font-size:11px;font-weight:500;line-height:1.4;margin-top:2px;">Telecom · Québec</div>
        </td>
      </tr></table>
    </td>
    <td align="right" class="hide-mobile" style="vertical-align:middle;color:${C.textMuted};font-size:12px;font-weight:500;">
      Sans contrat · Support québécois
    </td>
  </tr></table>
</td></tr>

<!-- HERO : badge + title + sub -->
<tr><td class="px hero-title" style="padding:48px 36px 36px;background:${C.surface};font-family:${f};">
  ${badgeBlock}
  ${heroTitleBlock}
  ${heroSubBlock}
</td></tr>

<!-- BODY : greeting + body text + recap card + after-card + CTA + extra + help -->
<tr><td class="px" style="padding:0 36px 36px;background:${C.surface};font-family:${f};">
  ${greetingBlock}
  ${bodyTextBlock}
  ${cardHtml}
  ${afterCardBlock}
  ${ctaBlock}
  ${extraBlock}
  ${helpBlock}
</td></tr>

<!-- FOOTER -->
<tr><td style="background:${C.surfaceAlt};padding:32px 36px;border-top:1px solid ${C.divider};font-family:${f};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;"><tr>
    <td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:8px;">
          <div style="width:24px;height:24px;background:${C.primary};border-radius:6px;text-align:center;line-height:24px;color:#ffffff;font-size:11px;font-weight:800;">N</div>
        </td>
        <td style="vertical-align:middle;color:${C.dark};font-size:14px;font-weight:700;letter-spacing:-0.2px;">
          Nivra Telecom
        </td>
      </tr></table>
    </td>
  </tr></table>

  <div style="font-size:12px;color:${C.textMuted};line-height:2;margin-bottom:14px;">
    <a href="${PORTAL_URL}" style="color:${C.darkSoft};text-decoration:none;font-weight:500;">Mon compte</a>
    <span style="color:#d4d4d8;margin:0 10px;">·</span>
    <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.darkSoft};text-decoration:none;font-weight:500;">Support</a>
    <span style="color:#d4d4d8;margin:0 10px;">·</span>
    <a href="${APP_URL}/legal/confidentialite" style="color:${C.darkSoft};text-decoration:none;font-weight:500;">Confidentialité</a>
    <span style="color:#d4d4d8;margin:0 10px;">·</span>
    <a href="${APP_URL}/desabonnement" style="color:${C.darkSoft};text-decoration:none;font-weight:500;">Désabonnement</a>
  </div>

  <div style="font-size:11px;color:${C.textFaint};line-height:1.6;font-weight:400;">
    © 2026 Nivra Telecom inc. Tous droits réservés.<br>
    Vous recevez ce message car vous êtes client Nivra Telecom.<br>
    Montréal, Québec · Canada
  </div>
</td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}
