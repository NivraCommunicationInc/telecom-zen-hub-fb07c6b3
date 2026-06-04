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
  if (!raw || typeof raw !== "string") return null;
  try {
    // Cherche tous les blocs JSON dans la string (peut être imbriqué dans un message)
    let startIdx = 0;
    while (startIdx < raw.length) {
      const jsonStart = raw.indexOf("{", startIdx);
      if (jsonStart === -1) break;
      try {
        const json = JSON.parse(raw.slice(jsonStart));
        const issue = json?.details?.[0]?.issue as string | undefined;
        if (issue && PAYPAL_ERROR_MAP[issue]) return PAYPAL_ERROR_MAP[issue];
        if (issue) return "Transaction refusée par PayPal. Contactez le support Nivra.";
        const name = json?.name as string | undefined;
        if (name && PAYPAL_ERROR_MAP[name]) return PAYPAL_ERROR_MAP[name];
      } catch { /* pas un JSON valide à cet index */ }
      startIdx = jsonStart + 1;
    }
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

    // 1. Cherche PayPal error dans le body brut (JSON imbriqué dans le texte)
    const bodyPaypalMsg = parsePayPalIssue(text);
    if (bodyPaypalMsg) return bodyPaypalMsg;

    try {
      const json = JSON.parse(text);
      // Le message peut contenir le JSON PayPal en string (ex: "PayPal capture failed: {...}")
      const rawMsg = json?.error || json?.message || "";
      if (typeof rawMsg === "string" && rawMsg) {
        // 2. Cherche PayPal error dans le message extrait
        const nestedPaypalMsg = parsePayPalIssue(rawMsg);
        if (nestedPaypalMsg) return nestedPaypalMsg;
        // Si le message contient du JSON illisible, retourne générique
        if (rawMsg.includes('"name"') || rawMsg.startsWith("{")) {
          return `Erreur de paiement (${status}). Veuillez réessayer ou contacter le support.`;
        }
        return rawMsg;
      }
      return `Erreur de paiement (${status}). Veuillez réessayer.`;
    } catch {
      const cleaned = (text || baseMessage).trim();
      if (cleaned.startsWith("{") || cleaned.includes('"name"')) {
        return `Erreur de paiement (${status}). Veuillez réessayer.`;
      }
      return cleaned;
    }
  } catch {
    return baseMessage;
  }
}
