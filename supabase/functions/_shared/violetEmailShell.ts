/**
 * Shared Nivra email shell — single source of truth for all transactional
 * Nivra emails sent through the custom queue.
 *
 * IMPORTANT: This file used to render its own "Violet Bold" design.
 * Per the corporate email standard, ALL outbound emails (client, employee,
 * internal) MUST use the official corporate template defined in
 * `emailTemplates/components.ts` (blue #0066CC, professional ISP look).
 *
 * To migrate every existing caller in one shot WITHOUT touching the 50+
 * `shell({...})` call sites in `customQueueTemplates.ts` and the edge
 * functions that import `violetShell`, we keep the exported API surface
 * identical (VIOLET_BRAND, VIOLET_FONT_STACK, violetEsc, violetShell,
 * VioletShellOpts) but the rendered HTML is now produced via the corporate
 * `emailDocument` + `header` + `footer` primitives.
 *
 * DO NOT re-introduce custom <html> / inline templates here — every email
 * must visually match the corporate standard.
 */

import {
  emailDocument,
  header,
  footer,
  colors,
  fonts,
  escapeHtml,
} from "./emailTemplates/components.ts";

// ---------------------------------------------------------------------------
// Backward-compatible exports
// ---------------------------------------------------------------------------

/**
 * Legacy palette aliases — kept so older callers that reference
 * VIOLET_BRAND.* continue to compile. Values now point at the official
 * corporate palette so any leftover inline usage also follows the standard.
 */
export const VIOLET_BRAND = {
  primary: colors.primary,
  primaryHover: colors.primaryDark,
  primaryAccent: colors.primary,
  primarySoft: colors.primaryLight,
  primarySoftBorder: colors.borderLight,
  dark: colors.textPrimary,
  darkSoft: colors.textSecondary,
  textBody: colors.textSecondary,
  textMuted: colors.textMuted,
  textFaint: colors.textLight ?? "#9CA3AF",
  surface: colors.white,
  surfaceAlt: colors.bgLight,
  pageBg: colors.bgLight,
  divider: colors.borderLight,
  cardBorder: colors.borderLight,
  cardBorderSoft: colors.borderLight,
  successBg: colors.successBg,
  successBorder: colors.successBorder,
  successText: colors.successText ?? colors.success,
  successDot: colors.success,
  warning: colors.warning,
  pinkAccent: colors.primary,
  heroBg: colors.primaryLight,
  cardBgLast: colors.primaryLight,
  footerAccent: colors.primary,
  footerLow: colors.textMuted,
};

export const VIOLET_FONT_STACK = fonts.primary;

export function violetEsc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return escapeHtml(String(v));
}

const SUPPORT_EMAIL = "support@nivra-telecom.ca";

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

// ---------------------------------------------------------------------------
// Internal: render the body content using corporate colors / spacing.
// The outer <html>, header, and footer are produced by emailDocument.
// ---------------------------------------------------------------------------

const F = fonts.primary;

function renderBadge(badge: string): string {
  if (!badge) return "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px;">
      <tr><td style="background-color: ${colors.primaryLight}; border: 1px solid ${colors.primary}; border-radius: 99px; padding: 6px 14px;">
        <span style="color: ${colors.primaryDark}; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; font-family: ${F};">
          ${escapeHtml(badge)}
        </span>
      </td></tr>
    </table>`;
}

function renderHero(title: string, sub?: string): string {
  const subBlock = sub
    ? `<p style="margin: 8px 0 0; font-size: 15px; color: ${colors.textSecondary}; line-height: 1.55; font-family: ${F};">${escapeHtml(sub)}</p>`
    : "";
  return `
    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: ${colors.textPrimary}; line-height: 1.2; font-family: ${F};">
      ${escapeHtml(title)}
    </h1>
    ${subBlock}`;
}

function renderGreeting(greeting?: string): string {
  if (!greeting) return "";
  return `<p style="margin: 24px 0 12px; font-size: 15px; color: ${colors.textPrimary}; font-weight: 600; font-family: ${F};">${escapeHtml(greeting)}</p>`;
}

function renderBodyText(bodyHtml?: string): string {
  if (!bodyHtml) return "";
  return `<div style="font-size: 14px; color: ${colors.textSecondary}; line-height: 1.7; margin: 0 0 20px; font-family: ${F};">${bodyHtml}</div>`;
}

function renderCard(
  cardTitle?: string,
  rows?: Array<[string, string]>,
  emphasizeLast: boolean = true,
): string {
  if (!cardTitle || !rows || rows.length === 0) return "";

  const rowsHtml = rows
    .map(([label, value], i) => {
      const isLast = emphasizeLast && i === rows.length - 1;
      const isFirst = i === 0;
      const borderTop = isFirst ? "" : `border-top: 1px solid ${colors.borderLight};`;
      const bg = isLast ? colors.primaryLight : colors.white;
      const labelColor = isLast ? colors.primaryDark : colors.textMuted;
      const valueColor = isLast ? colors.primaryDark : colors.textPrimary;
      const valueWeight = isLast ? "700" : "600";
      const valueSize = isLast ? "16px" : "14px";
      return `
        <tr><td style="padding: 14px 18px; background-color: ${bg}; ${borderTop} font-family: ${F};">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td style="font-size: 13px; color: ${labelColor}; font-weight: 500;">${escapeHtml(label)}</td>
              <td align="right" style="font-size: ${valueSize}; color: ${valueColor}; font-weight: ${valueWeight};">${escapeHtml(value)}</td>
            </tr>
          </table>
        </td></tr>`;
    })
    .join("");

  return `
    <div style="font-size: 12px; color: ${colors.textMuted}; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin: 0 0 12px; font-family: ${F};">
      ${escapeHtml(cardTitle)}
    </div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${colors.white}; border: 1px solid ${colors.borderLight}; border-radius: 8px; border-collapse: separate; overflow: hidden; margin: 0 0 24px;">
      ${rowsHtml}
    </table>`;
}

function renderAfterCard(html?: string): string {
  if (!html) return "";
  return `<div style="font-size: 14px; color: ${colors.textSecondary}; line-height: 1.7; margin: 0 0 20px; font-family: ${F};">${html}</div>`;
}

function renderCtas(
  primaryUrl?: string,
  primaryLabel?: string,
  secondaryUrl?: string,
  secondaryLabel?: string,
): string {
  const primary =
    primaryUrl && primaryLabel
      ? `<a href="${escapeHtml(primaryUrl)}" style="display: inline-block; background-color: ${colors.primary}; color: ${colors.white}; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 15px; font-family: ${F};">${escapeHtml(primaryLabel)}</a>`
      : "";
  const secondary =
    secondaryUrl && secondaryLabel
      ? `<a href="${escapeHtml(secondaryUrl)}" style="display: inline-block; background-color: transparent; color: ${colors.primary}; text-decoration: none; padding: 12px 24px; border: 1.5px solid ${colors.primary}; border-radius: 6px; font-weight: 600; font-size: 14px; margin-left: 8px; font-family: ${F};">${escapeHtml(secondaryLabel)}</a>`
      : "";
  if (!primary && !secondary) return "";
  return `<div style="text-align: center; margin: 8px 0 28px;">${primary}${secondary}</div>`;
}

function renderHelp(html: string | undefined, variant: "info" | "warning"): string {
  if (html) {
    const borderColor = variant === "warning" ? colors.warning : colors.primary;
    const bgColor = variant === "warning" ? colors.warningBg : colors.infoBg;
    return `<div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 0 6px 6px 0; padding: 14px 18px; font-size: 13px; color: ${colors.textSecondary}; margin: 8px 0 0; line-height: 1.6; font-family: ${F};">${html}</div>`;
  }
  // Default support box (corporate colors)
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.primaryLight}; border: 1px solid ${colors.borderLight}; border-radius: 8px; margin-top: 8px;">
      <tr><td style="padding: 18px 20px; font-family: ${F};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: middle;">
              <div style="font-size: 11px; color: ${colors.primaryDark}; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px;">Support Nivra Telecom</div>
              <div style="font-size: 14px; color: ${colors.textPrimary}; font-weight: 600; line-height: 1.4;">Une question ? Notre équipe vous répond rapidement.</div>
            </td>
            <td align="right" style="vertical-align: middle;">
              <a href="mailto:${SUPPORT_EMAIL}" style="display: inline-block; background-color: ${colors.primary}; color: ${colors.white}; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 13px;">Nous écrire</a>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;
}

// ---------------------------------------------------------------------------
// Main exported renderer — produces a full corporate-template HTML email.
// ---------------------------------------------------------------------------

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

  // Inner content for the corporate emailDocument body slot.
  // The corporate header() and footer() are appended below via emailDocument.
  const innerContent = `
    ${header()}
    <tr>
      <td style="padding: 32px 40px; background-color: ${colors.white};" class="content-padding">
        ${renderBadge(badge)}
        ${renderHero(heroTitle, heroSub)}
        ${renderGreeting(greeting)}
        ${renderBodyText(bodyHtml)}
        ${renderCard(cardTitle, cardRows, cardEmphasizeLast)}
        ${renderAfterCard(afterCardHtml)}
        ${renderCtas(ctaPrimaryUrl, ctaPrimaryLabel, ctaSecondaryUrl, ctaSecondaryLabel)}
        ${extraBodyHtml ?? ""}
        ${renderHelp(helpHtml, helpVariant)}
      </td>
    </tr>
    ${footer(SUPPORT_EMAIL)}
  `;

  return emailDocument(heroTitle, preheader, innerContent);
}
