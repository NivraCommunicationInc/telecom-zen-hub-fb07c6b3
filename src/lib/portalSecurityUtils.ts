import { portalSupabase } from "@/integrations/supabase/portalClient";

/**
 * Portal-only security utilities.
 * Uses portalSupabase client to avoid session conflicts with admin.
 */

/**
 * Check client security status (portal version)
 */
export const checkPortalSecurityStatus = async (userId: string): Promise<{
  status: string;
  alertLevel: string;
  accountStatus: string;
  isSuspended: boolean;
  isOnHold: boolean;
}> => {
  const { data, error } = await portalSupabase
    .from("profiles")
    .select("security_status, security_alert_level, account_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    console.error("Error checking portal security status:", error);
    return { status: "active", alertLevel: "none", accountStatus: "active", isSuspended: false, isOnHold: false };
  }

  const securityStatus = data.security_status || "active";
  const alertLevel = data.security_alert_level || "none";
  const accountStatus = data.account_status || "active";

  return {
    status: securityStatus,
    alertLevel,
    accountStatus,
    isSuspended: securityStatus === "suspended",
    isOnHold: accountStatus === "hold",
  };
};

/**
 * Verify security before sensitive action (portal version)
 * Returns true if action is allowed, false if blocked
 */
export const verifyPortalSensitiveActionAllowed = async (userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> => {
  const { isSuspended, isOnHold, alertLevel } = await checkPortalSecurityStatus(userId);
  
  if (isSuspended || isOnHold) {
    return {
      allowed: false,
      reason: alertLevel === "fraud" 
        ? "Votre compte est suspendu pour vérification de fraude. Veuillez nous contacter."
        : alertLevel === "risk"
        ? "Votre compte est suspendu pour vérification de sécurité. Veuillez nous contacter."
        : "Votre compte est en attente. Veuillez nous contacter.",
    };
  }

  return { allowed: true };
};
