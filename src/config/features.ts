/**
 * Feature flags for the application.
 * KYC_ENABLED: Controls whether QR identity verification is required during checkout.
 * Set to false to bypass KYC/QR verification step entirely.
 */
export const FEATURES = {
  KYC_ENABLED: true,
} as const;
