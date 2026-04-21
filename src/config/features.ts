/**
 * Feature flags for the application.
 * KYC_ENABLED: Controls whether QR identity verification is required during checkout.
 * Set to false to bypass KYC/QR verification step entirely.
 */
export const FEATURES = {
  // KYC désactivé dans le checkout : la vérification d'identité est envoyée
  // automatiquement par courriel lors du traitement de la commande.
  KYC_ENABLED: false,
} as const;
