/**
 * Production-safe error handling utilities for Edge Functions.
 * 
 * Security: In production, never expose detailed error messages to clients.
 * This prevents information leakage about database structure, stack traces, etc.
 */

// Check if we're in production (Deno environment)
const IS_PROD = Deno.env.get("ENV") === "production" || 
                Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

// Generic error messages for production
const GENERIC_ERRORS: Record<string, string> = {
  default: "Une erreur est survenue. Veuillez réessayer.",
  auth: "Erreur d'authentification.",
  permission: "Accès non autorisé.",
  validation: "Données invalides.",
  notFound: "Ressource introuvable.",
  server: "Erreur serveur.",
};

/**
 * Generate a unique error ID for tracking.
 */
export function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().substring(0, 4).toUpperCase()}`;
}

/**
 * Log error with ID for production tracing.
 * Returns the error ID that can be shown to clients.
 */
export function logErrorWithId(
  error: unknown,
  context?: string
): string {
  const errorId = generateErrorId();
  
  // Always log the full error details server-side
  console.error(`[${errorId}]${context ? ` [${context}]` : ""}`, error);
  
  return errorId;
}

/**
 * Get a production-safe error message.
 * In production: returns a generic message with error ID.
 * In development: returns the original error for debugging.
 */
export function getSafeErrorMessage(
  error: unknown,
  category: keyof typeof GENERIC_ERRORS = "default"
): string {
  // In development, show detailed errors
  if (!IS_PROD) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return GENERIC_ERRORS[category];
  }

  // In production, always return generic messages
  return GENERIC_ERRORS[category];
}

/**
 * Create a production-safe JSON error response.
 * Logs the full error server-side and returns a safe response to the client.
 */
export function createSafeErrorResponse(
  error: unknown,
  context: string,
  headers: HeadersInit,
  status: number = 500
): Response {
  const errorId = logErrorWithId(error, context);
  
  // Determine error category based on status
  let category: keyof typeof GENERIC_ERRORS = "default";
  if (status === 401) category = "auth";
  else if (status === 403) category = "permission";
  else if (status === 400) category = "validation";
  else if (status === 404) category = "notFound";
  else if (status >= 500) category = "server";
  
  const safeMessage = getSafeErrorMessage(error, category);
  
  // In production, include error ID for support reference
  const responseMessage = IS_PROD 
    ? `${safeMessage} (Réf: ${errorId})`
    : (error instanceof Error ? error.message : safeMessage);
  
  return new Response(
    JSON.stringify({ 
      error: responseMessage,
      errorId: IS_PROD ? errorId : undefined 
    }),
    { 
      status, 
      headers: { 
        "Content-Type": "application/json",
        ...headers 
      } 
    }
  );
}

/**
 * Wrapper for edge function handlers that catches errors and returns safe responses.
 */
export function withSafeErrorHandling(
  functionName: string,
  headers: HeadersInit
) {
  return (error: unknown, status: number = 500): Response => {
    return createSafeErrorResponse(error, functionName, headers, status);
  };
}
