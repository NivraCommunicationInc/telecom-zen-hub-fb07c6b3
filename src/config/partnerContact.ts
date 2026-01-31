/**
 * Partner Portal contact configuration
 * Single source of truth - ONLY ONE EMAIL for partner support
 */

export const PARTNER_SUPPORT_EMAIL = "Support@NivraTelecom.com";

// App URL for absolute links
export const PARTNER_APP_URL = import.meta.env.VITE_APP_URL || "https://nivratelecom.com";

// Helper to generate absolute onboarding URL
export const getPartnerOnboardingUrl = (token: string): string => {
  return `${PARTNER_APP_URL}/influencer/onboarding?token=${encodeURIComponent(token)}`;
};

// Helper to generate mailto link
export const getPartnerMailtoLink = (): string => {
  return `mailto:${PARTNER_SUPPORT_EMAIL}`;
};
