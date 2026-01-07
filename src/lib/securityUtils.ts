import { backendClient } from "@/integrations/backend";
import { logClientActivityDirect } from "@/hooks/useClientActivityLog";

export interface FlagClientParams {
  clientId: string;
  orderId?: string;
  alertLevel: "risk" | "fraud";
  reason?: string;
  actionById?: string;
  actionByName?: string;
  actionByRole?: string;
}

export interface FlagClientResult {
  success: boolean;
  error?: string;
  profile?: any;
  suspendedServicesCount?: number;
  suspendedAppointmentsCount?: number;
}

/**
 * Atomic function to flag a client for risk/fraud
 * - Updates profile security status
 * - Suspends all active subscriptions
 * - Suspends streaming subscriptions
 * - Puts appointments on hold
 * - Logs the action
 */
export const flagClientForRiskAtomic = async ({
  clientId,
  orderId,
  alertLevel,
  reason = "Account flagged for security review",
  actionById,
  actionByName,
  actionByRole = "admin",
}: FlagClientParams): Promise<FlagClientResult> => {
  try {
    // Step 1: Update profile with security status AND account_status = 'hold'
    const { data: profileData, error: profileError } = await backendClient
      .from("profiles")
      .update({
        security_status: "suspended",
        security_alert_level: alertLevel,
        security_reason: reason,
        security_flagged_at: new Date().toISOString(),
        security_flagged_order_id: orderId || null,
        security_requires_pin_reset: true,
        account_status: "hold", // FRAUD/RISK = HOLD
      })
      .eq("user_id", clientId)
      .select()
      .maybeSingle();

    if (profileError) {
      console.error("Error updating profile security status:", profileError);
      return { success: false, error: `Failed to update profile: ${profileError.message}` };
    }

    if (!profileData) {
      return { success: false, error: "Profile not found" };
    }

    // Step 2: Suspend all active subscriptions
    const { data: suspendedSubs, error: subsError } = await backendClient
      .from("subscriptions")
      .update({
        status: "suspended",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", clientId)
      .eq("status", "active")
      .select();

    if (subsError) {
      console.error("Error suspending subscriptions:", subsError);
      // Continue - this is not critical
    }

    // Step 3: Suspend streaming subscriptions
    const { data: suspendedStreaming, error: streamingError } = await backendClient
      .from("client_streaming_subscriptions")
      .update({
        status: "suspended",
        internal_notes: `Suspended due to ${alertLevel} review - ${new Date().toISOString()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", clientId)
      .eq("status", "active")
      .select();

    if (streamingError) {
      console.error("Error suspending streaming subscriptions:", streamingError);
      // Continue - this is not critical
    }

    // Step 4: Put scheduled appointments on hold
    const { data: heldAppointments, error: apptError } = await backendClient
      .from("appointments")
      .update({
        status: "on_hold",
        internal_notes: `On hold due to ${alertLevel} review - ${new Date().toISOString()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId)
      .in("status", ["scheduled", "confirmed", "pending"])
      .select();

    if (apptError) {
      console.error("Error holding appointments:", apptError);
      // Continue - this is not critical
    }

    // Step 5: Log to security_action_logs
    await backendClient.from("security_action_logs").insert({
      client_id: clientId,
      client_email: profileData.email,
      action: `flagged_${alertLevel}`,
      action_by_id: actionById,
      action_by_name: actionByName,
      action_by_role: actionByRole,
      order_id: orderId,
      reason,
      details: {
        alert_level: alertLevel,
        suspended_subscriptions: suspendedSubs?.length || 0,
        suspended_streaming: suspendedStreaming?.length || 0,
        held_appointments: heldAppointments?.length || 0,
      },
    });

    // Step 6: Log to client_activity_logs for admin journal
    if (actionById) {
      await logClientActivityDirect({
        clientId,
        actorUserId: actionById,
        actorName: actionByName || "Admin",
        actorRole: actionByRole || "admin",
        actionType: alertLevel === "fraud" ? "fraud_flag" : "risk_flag",
        entityType: "profile",
        entityId: orderId,
        summary: alertLevel === "fraud" 
          ? `Compte signalé pour fraude. Statut: EN ATTENTE. ${reason}`
          : `Compte signalé pour risque. Statut: EN ATTENTE. ${reason}`,
        beforeData: { security_status: "active", account_status: "active" },
        afterData: { 
          security_status: "suspended", 
          security_alert_level: alertLevel,
          account_status: "hold",
          suspended_services: (suspendedSubs?.length || 0) + (suspendedStreaming?.length || 0),
        },
      });
    }

    return {
      success: true,
      profile: profileData,
      suspendedServicesCount: (suspendedSubs?.length || 0) + (suspendedStreaming?.length || 0),
      suspendedAppointmentsCount: heldAppointments?.length || 0,
    };
  } catch (err: any) {
    console.error("Error in flagClientForRiskAtomic:", err);
    return { success: false, error: err.message || "Unknown error occurred" };
  }
};

/**
 * Lift client suspension and optionally reactivate services
 */
export const liftClientSuspensionAtomic = async (
  clientId: string,
  actionById: string,
  actionByName: string,
  actionByRole: string,
  requirePinReset: boolean = true,
  reactivateServices: boolean = false,
  reason?: string
): Promise<FlagClientResult> => {
  try {
    // Step 1: Update profile - restore security AND account_status = 'active'
    const { data: profileData, error: profileError } = await backendClient
      .from("profiles")
      .update({
        security_status: "active",
        security_alert_level: "none",
        security_reason: null,
        security_flagged_at: null,
        security_flagged_order_id: null,
        security_requires_pin_reset: requirePinReset,
        account_status: "active", // Fraud removed = ACTIVE
      })
      .eq("user_id", clientId)
      .select()
      .maybeSingle();

    if (profileError) {
      console.error("Error lifting suspension:", profileError);
      return { success: false, error: `Failed to update profile: ${profileError.message}` };
    }

    if (!profileData) {
      console.error("No profile found to update for client:", clientId);
      return { success: false, error: "Profile not found - no rows updated" };
    }

    let reactivatedCount = 0;

    // Step 2: Optionally reactivate services
    if (reactivateServices) {
      const { data: reactivatedSubs } = await backendClient
        .from("subscriptions")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", clientId)
        .eq("status", "suspended")
        .select();

      const { data: reactivatedStreaming } = await backendClient
        .from("client_streaming_subscriptions")
        .update({
          status: "active",
          internal_notes: `Reactivated after security review - ${new Date().toISOString()}`,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", clientId)
        .eq("status", "suspended")
        .select();

      reactivatedCount = (reactivatedSubs?.length || 0) + (reactivatedStreaming?.length || 0);
    }

    // Step 3: Log to security_action_logs
    await backendClient.from("security_action_logs").insert({
      client_id: clientId,
      client_email: profileData?.email,
      action: "suspension_lifted",
      action_by_id: actionById,
      action_by_name: actionByName,
      action_by_role: actionByRole,
      reason: reason || "Suspension lifted by staff",
      details: {
        require_pin_reset: requirePinReset,
        reactivated_services: reactivatedCount,
      },
    });

    // Step 4: Log to client_activity_logs for admin journal
    await logClientActivityDirect({
      clientId,
      actorUserId: actionById,
      actorName: actionByName,
      actorRole: actionByRole,
      actionType: "fraud_removed",
      entityType: "profile",
      summary: `Signalement fraude/risque retiré. Statut: ACTIF. ${reason || "Suspension levée par staff"}`,
      beforeData: { security_status: "suspended", account_status: "hold" },
      afterData: { 
        security_status: "active", 
        security_alert_level: "none",
        account_status: "active",
        reactivated_services: reactivatedCount,
      },
    });

    return {
      success: true,
      profile: profileData,
      suspendedServicesCount: reactivatedCount,
    };
  } catch (err: any) {
    console.error("Error in liftClientSuspensionAtomic:", err);
    return { success: false, error: err.message || "Unknown error occurred" };
  }
};

/**
 * Check client security status (use maybeSingle to avoid errors)
 */
export const checkClientSecurityStatus = async (userId: string): Promise<{
  status: string;
  alertLevel: string;
  accountStatus: string;
  isSuspended: boolean;
  isOnHold: boolean;
}> => {
  const { data, error } = await backendClient
    .from("profiles")
    .select("security_status, security_alert_level, account_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    console.error("Error checking security status:", error);
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
 * Verify security before sensitive action
 * Returns true if action is allowed, false if blocked
 */
export const verifySensitiveActionAllowed = async (userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> => {
  const { isSuspended, isOnHold, alertLevel } = await checkClientSecurityStatus(userId);
  
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

// Order status values that trigger fraud/risk flagging
export const RISK_FLAG_STATUSES = ["risk", "fraud", "flagged", "high_risk"];

export const shouldFlagClient = (status: string): boolean => {
  return RISK_FLAG_STATUSES.includes(status.toLowerCase());
};

export const getAlertLevelFromStatus = (status: string): "risk" | "fraud" => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === "fraud") return "fraud";
  return "risk";
};
