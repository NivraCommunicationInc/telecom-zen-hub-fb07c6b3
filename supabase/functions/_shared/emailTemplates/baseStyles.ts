// ============================================================
// NIVRA TELECOM - EMAIL BASE STYLES
// Professional ISP email design system
// ============================================================

export const colors = {
  // Brand colors
  primary: '#0ea5e9',      // Sky blue
  primaryDark: '#0284c7',
  accent: '#22d3ee',       // Cyan
  
  // Navy palette
  navy: '#0c1929',
  navyLight: '#1e3a5f',
  navyMid: '#0c4a6e',
  
  // Success / Green
  success: '#10b981',
  successDark: '#059669',
  successLight: '#ecfdf5',
  successBorder: '#a7f3d0',
  successText: '#065f46',
  successTextLight: '#047857',
  
  // Warning / Amber
  warning: '#f59e0b',
  warningDark: '#d97706',
  warningLight: '#fffbeb',
  warningBorder: '#fef3c7',
  warningText: '#92400e',
  
  // Error / Red
  error: '#ef4444',
  errorDark: '#dc2626',
  errorLight: '#fef2f2',
  errorBorder: '#fecaca',
  errorText: '#991b1b',
  
  // Info / Blue
  info: '#3b82f6',
  infoDark: '#2563eb',
  infoLight: '#eff6ff',
  infoBorder: '#bfdbfe',
  infoText: '#1e40af',
  
  // Purple
  purple: '#8b5cf6',
  purpleDark: '#7c3aed',
  purpleLight: '#f5f3ff',
  purpleBorder: '#ddd6fe',
  
  // Neutrals
  white: '#ffffff',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
};

export const fonts = {
  primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
  sm: '6px',
  md: '10px',
  lg: '12px',
  xl: '16px',
  full: '50%',
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
  return `${formatted}$`;
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

// Base CSS for all emails
export const baseCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  
  * { box-sizing: border-box; }
  
  body {
    margin: 0;
    padding: 0;
    width: 100% !important;
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
  }
  
  table { border-collapse: collapse !important; }
  
  img {
    border: 0;
    height: auto;
    line-height: 100%;
    outline: none;
    text-decoration: none;
    -ms-interpolation-mode: bicubic;
  }
  
  .button:hover {
    opacity: 0.9 !important;
    transform: translateY(-1px);
  }
  
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; padding: 0 16px !important; }
    .header-padding { padding: 24px 20px !important; }
    .content-padding { padding: 24px 20px !important; }
    .mobile-full { width: 100% !important; display: block !important; }
    .mobile-center { text-align: center !important; }
    .mobile-hide { display: none !important; }
  }
`;
