// ============================================================
// NIVRA TELECOM - EMAIL COMPONENTS
// Reusable email components for all templates
// ============================================================

import { colors, fonts, escapeHtml, baseCSS, formatCurrency, formatCurrencySimple, formatDate, formatDateTime } from './baseStyles.ts';

// Re-export utilities from baseStyles for convenience
export { colors, fonts, escapeHtml, baseCSS, formatCurrency, formatCurrencySimple, formatDate, formatDateTime };

// Email document wrapper
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
<body style="margin: 0; padding: 0; background-color: ${colors.gray100}; font-family: ${fonts.primary};">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(preheader)} &#847; &#847; &#847; &#847; &#847;
  </div>
  
  <!-- Wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: ${colors.gray100};">
    <tr>
      <td style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" class="container" style="max-width: 640px; width: 100%; margin: 0 auto; background-color: ${colors.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

// Header with gradient
export const header = (): string => `
  <tr>
    <td class="header-padding" style="background: linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyLight} 50%, ${colors.navyMid} 100%); padding: 40px 48px; text-align: center; position: relative;">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, ${colors.primary} 0%, ${colors.accent} 50%, #14b8a6 100%);"></div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: center;">
            <h1 style="margin: 0; font-size: 36px; font-weight: 800; letter-spacing: -0.03em;">
              <span style="color: ${colors.white};">Nivra</span>
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${colors.accent};">Télécommunications</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

// Status banner types
export type BannerType = 'success' | 'warning' | 'error' | 'info' | 'purple';

interface BannerConfig {
  bgGradient: string;
  border: string;
  iconBg: string;
  iconShadow: string;
  titleColor: string;
  textColor: string;
}

const bannerConfigs: Record<BannerType, BannerConfig> = {
  success: {
    bgGradient: `linear-gradient(135deg, ${colors.successLight} 0%, #d1fae5 100%)`,
    border: colors.successBorder,
    iconBg: colors.white,
    iconShadow: 'rgba(16, 185, 129, 0.25)',
    titleColor: colors.successText,
    textColor: colors.successTextLight,
  },
  warning: {
    bgGradient: `linear-gradient(135deg, ${colors.warningLight} 0%, #fef3c7 100%)`,
    border: colors.warningBorder,
    iconBg: colors.white,
    iconShadow: 'rgba(245, 158, 11, 0.25)',
    titleColor: colors.warningText,
    textColor: '#b45309',
  },
  error: {
    bgGradient: `linear-gradient(135deg, ${colors.errorLight} 0%, #fee2e2 100%)`,
    border: colors.errorBorder,
    iconBg: colors.white,
    iconShadow: 'rgba(239, 68, 68, 0.25)',
    titleColor: colors.errorText,
    textColor: '#b91c1c',
  },
  info: {
    bgGradient: `linear-gradient(135deg, ${colors.infoLight} 0%, #dbeafe 100%)`,
    border: colors.infoBorder,
    iconBg: colors.white,
    iconShadow: 'rgba(59, 130, 246, 0.25)',
    titleColor: colors.infoText,
    textColor: '#1d4ed8',
  },
  purple: {
    bgGradient: `linear-gradient(135deg, ${colors.purpleLight} 0%, #ede9fe 100%)`,
    border: colors.purpleBorder,
    iconBg: colors.white,
    iconShadow: 'rgba(139, 92, 246, 0.25)',
    titleColor: '#5b21b6',
    textColor: '#6d28d9',
  },
};

export const statusBanner = (
  type: BannerType,
  icon: string,
  title: string,
  subtitle?: string
): string => {
  const config = bannerConfigs[type];
  return `
  <tr>
    <td style="background: ${config.bgGradient}; padding: 24px 48px; border-bottom: 1px solid ${config.border};">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: center;">
            <div style="display: inline-block; background-color: ${config.iconBg}; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; box-shadow: 0 4px 14px ${config.iconShadow}; margin-bottom: 16px;">
              <span style="font-size: 28px;">${icon}</span>
            </div>
            <h2 style="color: ${config.titleColor}; font-size: 22px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.02em;">${escapeHtml(title)}</h2>
            ${subtitle ? `<p style="color: ${config.textColor}; font-size: 15px; margin: 0; font-weight: 500;">${escapeHtml(subtitle)}</p>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;
};

// Section header with colored bar
export const sectionHeader = (
  title: string,
  color: 'primary' | 'success' | 'warning' | 'error' | 'purple' = 'primary'
): string => {
  const colorMap = {
    primary: `linear-gradient(180deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
    success: `linear-gradient(180deg, ${colors.success} 0%, ${colors.successDark} 100%)`,
    warning: `linear-gradient(180deg, ${colors.warning} 0%, ${colors.warningDark} 100%)`,
    error: `linear-gradient(180deg, ${colors.error} 0%, ${colors.errorDark} 100%)`,
    purple: `linear-gradient(180deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
  };
  
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
    <tr>
      <td style="padding-bottom: 16px;">
        <div style="display: flex; align-items: center;">
          <div style="width: 4px; height: 24px; background: ${colorMap[color]}; border-radius: 2px; margin-right: 12px;"></div>
          <h3 style="color: ${colors.gray900}; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">${escapeHtml(title)}</h3>
        </div>
      </td>
    </tr>
  </table>
`;
};

// Info card
export const infoCard = (
  bgColor: string,
  borderColor: string,
  content: string
): string => `
  <div style="background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 20px;">
    ${content}
  </div>
`;

// Primary button
export const button = (
  text: string,
  href: string,
  variant: 'primary' | 'success' | 'warning' | 'secondary' = 'primary'
): string => {
  const styles = {
    primary: `background: linear-gradient(135deg, ${colors.primary} 0%, #06b6d4 100%); box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35);`,
    success: `background: linear-gradient(135deg, ${colors.success} 0%, ${colors.successDark} 100%); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);`,
    warning: `background: linear-gradient(135deg, ${colors.warning} 0%, ${colors.warningDark} 100%); box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);`,
    secondary: `background: ${colors.gray100}; color: ${colors.gray900}; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);`,
  };
  
  const textColor = variant === 'secondary' ? colors.gray900 : colors.white;
  
  return `
  <a href="${href}" class="button" style="display: inline-block; ${styles[variant]} color: ${textColor}; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 10px; transition: all 0.2s ease;">
    ${escapeHtml(text)}
  </a>
`;
};

// Footer
export const footer = (supportPhone: string, supportEmail: string): string => `
  <tr>
    <td style="background-color: ${colors.gray900}; padding: 32px 48px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
        <tr>
          <td style="text-align: center; padding-bottom: 24px;">
            <h4 style="color: ${colors.white}; font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.02em;">Nivra</h4>
            <p style="color: ${colors.accent}; font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0 0;">Télécommunications</p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-bottom: 20px;">
            <p style="color: ${colors.gray400}; font-size: 13px; line-height: 1.6; margin: 0;">
              Fournisseur de services de télécommunications prépayés au Québec.<br>
              Simple, rapide, sans engagement.
            </p>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-bottom: 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td style="padding: 0 8px;">
                  <a href="tel:+1${supportPhone.replace(/[^0-9]/g, "")}" style="color: ${colors.gray500}; font-size: 13px; text-decoration: none;">📞 ${supportPhone}</a>
                </td>
                <td style="color: ${colors.gray600}; padding: 0 8px;">|</td>
                <td style="padding: 0 8px;">
                  <a href="mailto:${supportEmail}" style="color: ${colors.gray500}; font-size: 13px; text-decoration: none;">✉️ ${supportEmail}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="text-align: center; padding-bottom: 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
              <tr>
                <td style="padding: 0 8px;">
                  <a href="https://nivratelecom.ca" style="color: ${colors.gray500}; font-size: 12px; text-decoration: none;">Site web</a>
                </td>
                <td style="color: ${colors.gray600}; padding: 0 8px;">|</td>
                <td style="padding: 0 8px;">
                  <a href="https://nivratelecom.ca/privacy" style="color: ${colors.gray500}; font-size: 12px; text-decoration: none;">Confidentialité</a>
                </td>
                <td style="color: ${colors.gray600}; padding: 0 8px;">|</td>
                <td style="padding: 0 8px;">
                  <a href="https://nivratelecom.ca/terms" style="color: ${colors.gray500}; font-size: 12px; text-decoration: none;">Conditions</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top: 1px solid ${colors.gray800}; padding-top: 20px; text-align: center;">
            <p style="color: ${colors.gray500}; font-size: 11px; line-height: 1.6; margin: 0;">
              © ${new Date().getFullYear()} Nivra Télécom Inc. Tous droits réservés.<br>
              Cet email a été envoyé suite à une action sur nivratelecom.ca
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

// Help section
export const helpSection = (supportPhone: string, supportEmail: string): string => `
  <div style="margin-top: 40px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 12px; padding: 24px; text-align: center;">
    <p style="color: #0369a1; font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">Besoin d'aide?</p>
    <p style="color: #0284c7; font-size: 14px; margin: 0 0 16px 0;">Notre équipe est disponible pour vous assister</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
      <tr>
        <td style="text-align: center; padding: 8px;">
          <a href="tel:+1${supportPhone.replace(/[^0-9]/g, "")}" style="display: inline-block; background-color: ${colors.white}; color: #0284c7; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 8px; border: 1px solid #7dd3fc;">
            📞 ${supportPhone}
          </a>
        </td>
        <td style="text-align: center; padding: 8px;">
          <a href="mailto:${supportEmail}" style="display: inline-block; background-color: ${colors.white}; color: #0284c7; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 20px; border-radius: 8px; border: 1px solid #7dd3fc;">
            ✉️ ${supportEmail}
          </a>
        </td>
      </tr>
    </table>
  </div>
`;

// Simple info row
export const infoRow = (label: string, value: string): string => `
  <tr>
    <td style="color: ${colors.gray500}; font-size: 14px; padding: 12px 0; border-bottom: 1px solid ${colors.gray200};">${escapeHtml(label)}</td>
    <td style="color: ${colors.gray900}; font-size: 14px; font-weight: 600; text-align: right; padding: 12px 0; border-bottom: 1px solid ${colors.gray200};">${escapeHtml(value)}</td>
  </tr>
`;

// Alert box
export const alertBox = (
  type: 'warning' | 'error' | 'info' | 'success',
  icon: string,
  title: string,
  message: string
): string => {
  const configs = {
    warning: { bg: colors.warningLight, border: colors.warningBorder, title: colors.warningText, text: '#b45309' },
    error: { bg: colors.errorLight, border: colors.errorBorder, title: colors.errorText, text: '#b91c1c' },
    info: { bg: colors.infoLight, border: colors.infoBorder, title: colors.infoText, text: '#1d4ed8' },
    success: { bg: colors.successLight, border: colors.successBorder, title: colors.successText, text: colors.successTextLight },
  };
  const config = configs[type];
  
  return `
  <div style="background-color: ${config.bg}; border: 1px solid ${config.border}; border-radius: 12px; padding: 20px; margin: 24px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
      <tr>
        <td style="width: 40px; vertical-align: top;">
          <span style="font-size: 24px;">${icon}</span>
        </td>
        <td>
          <p style="color: ${config.title}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">${escapeHtml(title)}</p>
          <p style="color: ${config.text}; font-size: 14px; margin: 0; line-height: 1.5;">${escapeHtml(message)}</p>
        </td>
      </tr>
    </table>
  </div>
`;
};

// Content wrapper
export const contentWrapper = (content: string): string => `
  <tr>
    <td class="content-padding" style="padding: 40px 48px;">
      ${content}
    </td>
  </tr>
`;

// Divider
export const divider = (): string => `
  <hr style="border: none; border-top: 1px solid ${colors.gray200}; margin: 32px 0;">
`;

// Amount highlight box (for billing)
export const amountBox = (
  label: string,
  amount: string,
  sublabel?: string,
  variant: 'primary' | 'success' | 'error' = 'primary'
): string => {
  const configs = {
    primary: { bg: `linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyLight} 100%)`, labelColor: colors.gray400, amountColor: colors.accent },
    success: { bg: `linear-gradient(135deg, ${colors.successDark} 0%, ${colors.success} 100%)`, labelColor: '#d1fae5', amountColor: colors.white },
    error: { bg: `linear-gradient(135deg, ${colors.errorDark} 0%, ${colors.error} 100%)`, labelColor: '#fecaca', amountColor: colors.white },
  };
  const config = configs[variant];
  
  return `
  <div style="background: ${config.bg}; padding: 20px 24px; border-radius: 12px; margin-top: 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
      <tr>
        <td>
          <p style="color: ${config.labelColor}; font-size: 13px; font-weight: 500; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(label)}</p>
          ${sublabel ? `<p style="color: ${colors.white}; font-size: 11px; margin: 0; opacity: 0.8;">${escapeHtml(sublabel)}</p>` : ''}
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <span style="color: ${config.amountColor}; font-size: 28px; font-weight: 800; letter-spacing: -0.02em;">${escapeHtml(amount)}</span>
        </td>
      </tr>
    </table>
  </div>
`;
};
