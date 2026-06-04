// Codes d'erreur PayPal → messages français clairs
const PAYPAL_ERROR_MAP: Record<string, string> = {
  PAYEE_BLOCKED_TRANSACTION:    "Transaction refusée par les paramètres de sécurité du marchand. Contactez le support Nivra.",
  INSTRUMENT_DECLINED:          "Carte refusée par votre banque. Vérifiez vos informations ou essayez une autre carte.",
  CARD_EXPIRED:                 "Carte expirée. Utilisez une carte valide.",
  INVALID_CVV:                  "Code CVV invalide.",
  INSUFFICIENT_FUNDS:           "Fonds insuffisants sur cette carte.",
  PAYER_ACTION_REQUIRED:        "Authentification 3D Secure requise. Veuillez suivre les instructions de votre banque.",
  COMPLIANCE_VIOLATION:         "Transaction non autorisée dans cette région.",
  TRANSACTION_REFUSED:          "Transaction refusée. Essayez une autre carte ou contactez votre banque.",
  CARD_CLOSED:                  "Cette carte est fermée. Utilisez une autre carte.",
  DUPLICATE_TRANSACTION:        "Transaction en double détectée. Attendez quelques minutes avant de réessayer.",
};

function parsePayPalIssue(raw: string): string | null {
  // Cherche le premier "issue" dans le JSON PayPal
  try {
    // Le raw peut être "PayPal capture failed: {json}" ou directement le json
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) return null;
    const json = JSON.parse(raw.slice(jsonStart));
    const issue = json?.details?.[0]?.issue as string | undefined;
    if (issue && PAYPAL_ERROR_MAP[issue]) return PAYPAL_ERROR_MAP[issue];
    if (issue) return `Erreur de paiement: ${issue}`;
    const name = json?.name as string | undefined;
    if (name && PAYPAL_ERROR_MAP[name]) return PAYPAL_ERROR_MAP[name];
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract a useful error message from a Supabase Functions invoke() error.
 * Handles PayPal-specific error codes and returns user-friendly French messages.
 */
export async function getInvokeErrorMessage(error: any): Promise<string> {
  if (!error) return "Erreur inconnue";

  const baseMessage = typeof error?.message === "string" ? error.message : String(error);

  // Check for PayPal error in the base message itself (thrown as Error by edge function)
  const paypalMsg = parsePayPalIssue(baseMessage);
  if (paypalMsg) return paypalMsg;

  // FunctionsHttpError stores the Response object in `context`
  const ctx = error?.context;
  const looksLikeResponse = ctx && typeof ctx === "object" && typeof ctx.status === "number" && typeof ctx.headers?.get === "function";

  if (!looksLikeResponse) return baseMessage;

  const res = ctx as Response;

  try {
    const status = res.status;
    const text = await res.clone().text();

    // Check for PayPal error in response body
    const bodyPaypalMsg = parsePayPalIssue(text);
    if (bodyPaypalMsg) return bodyPaypalMsg;

    try {
      const json = JSON.parse(text);
      const msg = json?.error || json?.message || text;
      // If msg looks like raw JSON, return a generic message
      if (typeof msg === "string" && msg.trim().startsWith("{")) {
        return `Erreur de paiement (${status}). Veuillez réessayer.`;
      }
      return typeof msg === "string" ? msg : `Erreur de paiement (${status}). Veuillez réessayer.`;
    } catch {
      const cleaned = (text || baseMessage).trim();
      if (cleaned.startsWith("{")) return `Erreur de paiement (${status}). Veuillez réessayer.`;
      return `${cleaned} (HTTP ${status})`;
    }
  } catch {
    return baseMessage;
  }
}
