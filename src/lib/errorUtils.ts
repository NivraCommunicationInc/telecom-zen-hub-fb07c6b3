/**
 * Production-safe error handling utilities.
 * 
 * Security: In production, never expose detailed error messages to users.
 * This prevents information leakage about database structure, stack traces, etc.
 */

const IS_PROD = import.meta.env.PROD;

// Generic error messages for production
const GENERIC_ERRORS = {
  default: "Une erreur est survenue. Veuillez réessayer.",
  network: "Erreur de connexion. Vérifiez votre connexion internet.",
  auth: "Erreur d'authentification. Veuillez vous reconnecter.",
  permission: "Vous n'avez pas les permissions requises.",
  validation: "Données invalides. Veuillez vérifier vos informations.",
  notFound: "Ressource introuvable.",
  server: "Erreur serveur. Réessayez plus tard.",
} as const;

type ErrorCategory = keyof typeof GENERIC_ERRORS;

/**
 * Get a production-safe error message.
 * In development: returns the original error message for debugging.
 * In production: returns a generic message to prevent information leakage.
 * 
 * @param error - The original error object or message
 * @param category - Optional category for more specific generic messages
 * @returns A safe error message string
 */
export function getSafeErrorMessage(
  error: unknown,
  category: ErrorCategory = "default"
): string {
  // In development, show detailed errors for debugging
  if (!IS_PROD) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      return String((error as { message: unknown }).message);
    }
    return GENERIC_ERRORS[category];
  }

  // In production, always return generic messages
  return GENERIC_ERRORS[category];
}

/**
 * Categorize an error based on its content for appropriate generic messaging.
 * This analyzes the error to determine what type of generic message to show.
 */
export function categorizeError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("network") || message.includes("fetch") || message.includes("connection")) {
    return "network";
  }
  if (message.includes("auth") || message.includes("session") || message.includes("token") || message.includes("jwt")) {
    return "auth";
  }
  if (message.includes("permission") || message.includes("forbidden") || message.includes("denied") || message.includes("403")) {
    return "permission";
  }
  if (message.includes("validation") || message.includes("invalid") || message.includes("required")) {
    return "validation";
  }
  if (message.includes("not found") || message.includes("404")) {
    return "notFound";
  }
  if (message.includes("500") || message.includes("server")) {
    return "server";
  }
  
  return "default";
}

/**
 * Get a safe error message with automatic categorization.
 * Combines getSafeErrorMessage with automatic error categorization.
 */
export function getAutoSafeErrorMessage(error: unknown): string {
  const category = categorizeError(error);
  return getSafeErrorMessage(error, category);
}

/**
 * Generate a unique error ID for tracking.
 * In production, this ID can be shown to users so they can reference it in support requests,
 * while the full error details are logged server-side.
 */
export function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Log error with ID for production tracing.
 * Returns the error ID that can be shown to users.
 */
export function logErrorWithId(
  error: unknown,
  context?: string
): string {
  const errorId = generateErrorId();
  
  // Always log the full error details (for server logs / console in dev)
  console.error(`[${errorId}]${context ? ` [${context}]` : ""}`, error);
  
  return errorId;
}

/**
 * Production-safe error response helper.
 * Returns an object suitable for API responses or UI display.
 */
export function createSafeErrorResponse(
  error: unknown,
  context?: string
): { message: string; errorId: string } {
  const errorId = logErrorWithId(error, context);
  const message = getAutoSafeErrorMessage(error);
  
  return {
    message: IS_PROD ? `${message} (Réf: ${errorId})` : message,
    errorId,
  };
}
