// ============================================================
// NIVRA TELECOM - EMAIL COMPONENTS V2
// Professional, Clean, High-Contrast Design
// ============================================================

import { colors, fonts, escapeHtml, baseCSS, formatCurrency, formatCurrencySimple, formatDate, formatDateTime } from './baseStyles.ts';

// Re-export utilities
export { colors, fonts, escapeHtml, baseCSS, formatCurrency, formatCurrencySimple, formatDate, formatDateTime };

// Logo URL - Hosted externally for email compatibility
const LOGO_URL = 'https://telecom-zen-hub.lovable.app/lovable-uploads/c4eafae0-55ef-4f55-9858-2e3660474598.png';

// Email document wrapper - Clean white design
export const emailDocument = (title: string, preheader: string, content: string): string => `
<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table { border-collapse: collapse; }
    td { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>${baseCSS}</style>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bgLight}; font-family: ${fonts.primary}; color: ${colors.textPrimary};">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(preheader)} &#847; &#847; &#847; &#847; &#847;
  </div>
  
  <!-- Wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: ${colors.bgLight};">
    <tr>
      <td style="padding: 32px 16px;">
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" class="container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: ${colors.white}; border: 1px solid ${colors.borderLight}; border-radius: ${borderRadius.md};">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

const borderRadius = { sm: '4px', md: '8px', lg: '12px' };

// Professional Header - Text-based for maximum email client compatibility
export const header = (): string => `
  <tr>
    <td class="header-padding" style="padding: 28px 40px; border-bottom: 3px solid ${colors.primary}; background-color: ${colors.white};">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: left;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: ${colors.primary}; font-family: ${fonts.primary};">Nivra Telecom</h1>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Télécommunications</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

// Simple header alternative (text-based for email clients that block images)
export const headerSimple = (): string => `
  <tr>
    <td class="header-padding" style="padding: 24px 40px; border-bottom: 3px solid ${colors.primary}; background-color: ${colors.white};">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: left;">
            <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: ${colors.primary};">Nivra</h1>
            <span style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Télécommunications</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

// Status banner types
export type BannerType = 'success' | 'warning' | 'error' | 'info' | 'purple';

interface BannerConfig {
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
  textColor: string;
}

const bannerConfigs: Record<BannerType, BannerConfig> = {
  success: {
    bg: colors.successBg,
    border: colors.successBorder,
    iconColor: colors.success,
    titleColor: colors.success,
    textColor: colors.textSecondary,
  },
  warning: {
    bg: colors.warningBg,
    border: colors.warningBorder,
    iconColor: colors.warning,
    titleColor: colors.warning,
    textColor: colors.textSecondary,
  },
  error: {
    bg: colors.errorBg,
    border: colors.errorBorder,
    iconColor: colors.error,
    titleColor: colors.error,
    textColor: colors.textSecondary,
  },
  info: {
    bg: colors.infoBg,
    border: colors.infoBorder,
    iconColor: colors.info,
    titleColor: colors.info,
    textColor: colors.textSecondary,
  },
  purple: {
    bg: '#F5F3FF',
    border: '#DDD6FE',
    iconColor: '#7C3AED',
    titleColor: '#7C3AED',
    textColor: colors.textSecondary,
  },
};

// Clean status banner
export const statusBanner = (
  type: BannerType,
  icon: string,
  title: string,
  subtitle?: string
): string => {
  const config = bannerConfigs[type];
  return `
  <tr>
    <td style="padding: 24px 40px; background-color: ${config.bg}; border-bottom: 1px solid ${config.border};">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="width: 48px; vertical-align: top;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background-color: ${colors.white}; text-align: center; line-height: 40px; border: 2px solid ${config.border};">
              <span style="font-size: 20px;">${icon}</span>
            </div>
          </td>
          <td style="vertical-align: middle; padding-left: 16px;">
            <h2 style="color: ${config.titleColor}; font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">${escapeHtml(title)}</h2>
            ${subtitle ? `<p style="color: ${config.textColor}; font-size: 14px; margin: 0;">${escapeHtml(subtitle)}</p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;
};

// Section header with clean line
export const sectionHeader = (
  title: string,
  color: 'primary' | 'success' | 'warning' | 'error' | 'purple' = 'primary'
): string => {
  const colorMap = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    purple: '#7C3AED',
  };
  
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 16px;">
    <tr>
      <td style="padding-bottom: 8px; border-bottom: 2px solid ${colorMap[color]};">
        <h3 style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(title)}</h3>
      </td>
    </tr>
  </table>
`;
};

// Info card with white background
export const infoCard = (
  bgColor: string,
  borderColor: string,
  content: string
): string => `
  <div style="background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
    ${content}
  </div>
`;

// Professional button - High contrast
export const button = (
  text: string,
  href: string,
  variant: 'primary' | 'success' | 'warning' | 'secondary' = 'primary'
): string => {
  const styles = {
    primary: { bg: colors.primary, text: colors.white },
    success: { bg: colors.success, text: colors.white },
    warning: { bg: colors.warning, text: colors.white },
    secondary: { bg: colors.bgSection, text: colors.textPrimary },
  };
  const style = styles[variant];
  
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
    <tr>
      <td style="background-color: ${style.bg}; border-radius: 6px; text-align: center;">
        <a href="${href}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: ${style.text}; text-decoration: none; font-family: ${fonts.primary};">
          ${escapeHtml(text)}
        </a>
      </td>
    </tr>
  </table>
`;
};

// Professional Footer - Email only support, no phone, no NEQ
export const footer = (_supportEmail: string): string => `
  <tr>
    <td style="background-color: ${colors.footerBg}; padding: 32px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: center; padding-bottom: 20px;">
            <h4 style="color: ${colors.white}; font-size: 18px; font-weight: 700; margin: 0;">Nivra Telecom</h4>
            <p style="color: ${colors.footerText}; font-size: 13px; margin: 8px 0 0 0;">
              Fournisseur de services Internet et TV sans contrat au Québec
            </p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-bottom: 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">Site web</a></td>
                <td style="color: ${colors.footerText};">|</td>
                <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca/forfaits" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">Forfaits</a></td>
                <td style="color: ${colors.footerText};">|</td>
                <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca/faq" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">FAQ</a></td>
                <td style="color: ${colors.footerText};">|</td>
                <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca/privacy" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">Confidentialité</a></td>
                <td style="color: ${colors.footerText};">|</td>
                <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca/terms" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">Conditions</a></td>
                <td style="color: ${colors.footerText};">|</td>
                <td style="padding: 0 8px;"><a href="https://crtc.gc.ca/fra/accueil-home.htm" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">CRTC</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top: 1px solid #374151; padding-top: 16px; text-align: center;">
            <p style="color: ${colors.textLight}; font-size: 11px; margin: 0;">
              © 2026 Nivra Communications Inc. Tous droits réservés.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

// Help section - Email only support, no phone
export const helpSection = (supportEmail: string): string => `
  <div style="margin-top: 32px; padding: 24px; background-color: ${colors.bgSection}; border-radius: 8px; text-align: center;">
    <p style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">Besoin d'aide?</p>
    <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0 0 16px 0;">Notre équipe répond par courriel 7 jours sur 7, de 8h à 20h.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td>
          <a href="mailto:${supportEmail}" style="display: inline-block; padding: 10px 24px; background-color: ${colors.primary}; color: ${colors.white}; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px;">
            ✉️&nbsp;${supportEmail}
          </a>
        </td>
      </tr>
    </table>
  </div>
`;

// Simple info row - Clean table row
export const infoRow = (label: string, value: string): string => `
  <tr>
    <td style="color: ${colors.textMuted}; font-size: 14px; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">${escapeHtml(label)}</td>
    <td style="color: ${colors.textPrimary}; font-size: 14px; font-weight: 600; text-align: right; padding: 10px 0; border-bottom: 1px solid ${colors.borderLight};">${escapeHtml(value)}</td>
  </tr>
`;

// Alert box - High contrast
export const alertBox = (
  type: 'warning' | 'error' | 'info' | 'success',
  icon: string,
  title: string,
  message: string
): string => {
  const configs = {
    warning: { bg: colors.warningBg, border: colors.warningBorder, title: colors.warning, text: colors.textSecondary },
    error: { bg: colors.errorBg, border: colors.errorBorder, title: colors.error, text: colors.textSecondary },
    info: { bg: colors.infoBg, border: colors.infoBorder, title: colors.info, text: colors.textSecondary },
    success: { bg: colors.successBg, border: colors.successBorder, title: colors.success, text: colors.textSecondary },
  };
  const config = configs[type];
  
  return `
  <div style="background-color: ${config.bg}; border: 1px solid ${config.border}; border-left: 4px solid ${config.title}; border-radius: 4px; padding: 16px; margin: 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
      <tr>
        <td style="width: 32px; vertical-align: top; padding-right: 12px;">
          <span style="font-size: 20px;">${icon}</span>
        </td>
        <td>
          <p style="color: ${config.title}; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">${escapeHtml(title)}</p>
          <p style="color: ${config.text}; font-size: 13px; margin: 0; line-height: 1.5;">${escapeHtml(message)}</p>
        </td>
      </tr>
    </table>
  </div>
`;
};

// Content wrapper
export const contentWrapper = (content: string): string => `
  <tr>
    <td class="content-padding" style="padding: 32px 40px;">
      ${content}
    </td>
  </tr>
`;

// Divider
export const divider = (): string => `
  <hr style="border: none; border-top: 1px solid ${colors.borderLight}; margin: 24px 0;">
`;

// Amount box - Clean and readable
export const amountBox = (
  label: string,
  amount: string,
  sublabel?: string,
  variant: 'primary' | 'success' | 'error' = 'primary'
): string => {
  const configs = {
    primary: { bg: colors.primaryLight, border: colors.primary, labelColor: colors.textMuted, amountColor: colors.primary },
    success: { bg: colors.successBg, border: colors.success, labelColor: colors.textMuted, amountColor: colors.success },
    error: { bg: colors.errorBg, border: colors.error, labelColor: colors.textMuted, amountColor: colors.error },
  };
  const config = configs[variant];
  
  return `
  <div style="background-color: ${config.bg}; border: 2px solid ${config.border}; padding: 20px 24px; border-radius: 8px; margin-top: 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
      <tr>
        <td>
          <p style="color: ${config.labelColor}; font-size: 13px; font-weight: 500; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(label)}</p>
          ${sublabel ? `<p style="color: ${colors.textSecondary}; font-size: 12px; margin: 0;">${escapeHtml(sublabel)}</p>` : ''}
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <span style="color: ${config.amountColor}; font-size: 28px; font-weight: 700;">${escapeHtml(amount)}</span>
        </td>
      </tr>
    </table>
  </div>
`;
};

// Greeting paragraph - Standard readable text
export const greeting = (name: string): string => `
  <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
    Bonjour ${escapeHtml(name)},
  </p>
`;

// Body text
export const bodyText = (text: string): string => `
  <p style="color: ${colors.textSecondary}; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
    ${text}
  </p>
`;
