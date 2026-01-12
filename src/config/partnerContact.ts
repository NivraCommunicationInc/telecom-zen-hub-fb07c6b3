/**
 * Partner Portal contact configuration
 * Single source of truth for all partner-related emails
 */

export const PARTNER_CONTACT = {
  // Support email for partners
  supportEmail: "support@nivratelecom.ca",
  supportEmailDisplay: "Support@NivraTelecom.ca",
  
  // Dedicated partners email
  partnersEmail: "partenaires@nivratelecom.ca",
  partnersEmailDisplay: "partenaires@nivratelecom.ca",
  
  // App URL for absolute links
  appUrl: import.meta.env.VITE_APP_URL || "https://nivratelecom.ca",
} as const;

// Helper to generate absolute onboarding URL
export const getPartnerOnboardingUrl = (token: string): string => {
  return `${PARTNER_CONTACT.appUrl}/influencer/onboarding?token=${encodeURIComponent(token)}`;
};

// Helper to generate mailto links
export const getPartnerMailtoLink = (type: "support" | "partners" = "support"): string => {
  const email = type === "partners" ? PARTNER_CONTACT.partnersEmail : PARTNER_CONTACT.supportEmail;
  return `mailto:${email}`;
};
