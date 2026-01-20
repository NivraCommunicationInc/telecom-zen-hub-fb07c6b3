// ============================================================
// NIVRA TELECOM - EMAIL BASE STYLES V2
// Professional ISP email design - Clean, Readable, Corporate
// Inspired by Bell, Vidéotron, Rogers corporate emails
// ============================================================

export const colors = {
  // Primary brand - Professional Blue
  primary: '#0066CC',        // Corporate blue
  primaryDark: '#004C99',
  primaryLight: '#E6F0FA',
  
  // Accent - Teal for highlights
  accent: '#00A3A3',
  accentDark: '#007A7A',
  accentLight: '#E6F7F7',
  
  // Text colors - High contrast for readability
  textPrimary: '#1A1A1A',    // Almost black for main text
  textSecondary: '#4A4A4A',  // Dark gray for secondary
  textMuted: '#6B7280',      // Medium gray for labels
  textLight: '#9CA3AF',      // Light gray for captions
  
  // Backgrounds
  white: '#FFFFFF',
  bgLight: '#F8FAFB',        // Very light gray-blue
  bgCard: '#FFFFFF',
  bgSection: '#F3F4F6',
  
  // Borders
  borderLight: '#E5E7EB',
  borderMedium: '#D1D5DB',
  
  // Status colors with good contrast
  success: '#059669',        // Dark green for text
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  successLight: '#ECFDF5',
  successDark: '#047857',
  successText: '#065F46',
  successTextLight: '#047857',
  
  warning: '#D97706',        // Dark amber for text
  warningBg: '#FFFBEB',
  warningBorder: '#FCD34D',
  warningLight: '#FFFBEB',
  warningDark: '#B45309',
  warningText: '#92400E',
  
  error: '#DC2626',          // Dark red for text
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  errorLight: '#FEF2F2',
  errorDark: '#B91C1C',
  errorText: '#991B1B',
  
  info: '#2563EB',           // Dark blue for text
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  infoLight: '#EFF6FF',
  infoDark: '#1D4ED8',
  infoText: '#1E40AF',
  
  // Purple
  purple: '#7C3AED',
  purpleDark: '#6D28D9',
  purpleLight: '#F5F3FF',
  purpleBorder: '#DDD6FE',
  
  // Navy (legacy)
  navy: '#1F2937',
  navyLight: '#374151',
  navyMid: '#4B5563',
  
  // Gray scale (legacy compatibility)
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Footer
  footerBg: '#1F2937',
  footerText: '#D1D5DB',
  footerLink: '#9CA3AF',
};

export const fonts = {
  primary: "Arial, Helvetica, 'Segoe UI', sans-serif",  // More reliable email fonts
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
};

// Utility functions
export const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount || 0);
};

export const formatCurrencySimple = (amount: number): string => {
  const formatted = (amount || 0).toFixed(2);
  return `${formatted} $`;
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Base CSS for all emails - Minimal, reliable
export const baseCSS = `
  * { box-sizing: border-box; }
  
  body {
    margin: 0;
    padding: 0;
    width: 100% !important;
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
    background-color: ${colors.bgLight};
  }
  
  table { 
    border-collapse: collapse !important; 
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
  }
  
  img {
    border: 0;
    height: auto;
    line-height: 100%;
    outline: none;
    text-decoration: none;
    -ms-interpolation-mode: bicubic;
  }
  
  a {
    color: ${colors.primary};
    text-decoration: underline;
  }
  
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .content-padding { padding: 24px 16px !important; }
    .header-padding { padding: 20px 16px !important; }
  }
`;
