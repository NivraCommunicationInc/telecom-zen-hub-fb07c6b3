import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";

export interface AccountBlockCheckResult {
  allowed: boolean;
  accountBlocked: boolean;
  onlineBlocked: boolean;
  blockedReason: string | null;
  errorMessage: string;
}

/**
 * Server-side check for account block status before performing actions.
 * Call this before any order creation, service change, or similar mutations.
 * 
 * @param userId - The user ID to check
 * @returns Promise with the check result
 */
export async function checkAccountBlockedForAction(
  userId: string
): Promise<AccountBlockCheckResult> {
  try {
    const { data, error } = await portalSupabase
      .from("profiles")
      .select("account_status, online_access_status, blocked_reason")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[checkAccountBlockedForAction] Error:", error);
      return {
        allowed: false,
        accountBlocked: false,
        onlineBlocked: false,
        blockedReason: null,
        errorMessage: "Impossible de vérifier le statut du compte. Veuillez réessayer.",
      };
    }

    const accountBlocked = data?.account_status === "blocked";
    const onlineBlocked = data?.online_access_status === "blocked";

    if (accountBlocked) {
      return {
        allowed: false,
        accountBlocked: true,
        onlineBlocked,
        blockedReason: data?.blocked_reason || null,
        errorMessage: data?.blocked_reason 
          ? `Compte bloqué: ${data.blocked_reason}. Contactez le support.`
          : "Votre compte est bloqué. Veuillez contacter le support pour plus d'informations.",
      };
    }

    return {
      allowed: true,
      accountBlocked: false,
      onlineBlocked,
      blockedReason: null,
      errorMessage: "",
    };
  } catch (err) {
    console.error("[checkAccountBlockedForAction] Unexpected error:", err);
    return {
      allowed: false,
      accountBlocked: false,
      onlineBlocked: false,
      blockedReason: null,
      errorMessage: "Erreur inattendue. Veuillez réessayer.",
    };
  }
}

/**
 * Wraps a mutation function with account block check.
 * If account is blocked, rejects with appropriate error message.
 * 
 * @param userId - The user ID to check
 * @param mutationFn - The original mutation function to wrap
 * @returns A wrapped function that checks account status first
 */
export function withAccountBlockCheck<T, R>(
  userId: string,
  mutationFn: (data: T) => Promise<R>
): (data: T) => Promise<R> {
  return async (data: T) => {
    const blockCheck = await checkAccountBlockedForAction(userId);
    
    if (!blockCheck.allowed) {
      throw new Error(blockCheck.errorMessage);
    }
    
    return mutationFn(data);
  };
}