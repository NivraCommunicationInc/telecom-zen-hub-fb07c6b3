import { supabase } from "@/integrations/supabase/client";

export interface FlagClientParams {
  clientId: string;
  orderId: string;
  alertLevel: "risk" | "fraud";
  reason?: string;
}

export const flagClientForRisk = async ({
  clientId,
  orderId,
  alertLevel,
  reason = "Order flagged for risk/fraud review",
}: FlagClientParams) => {
  // Update client profile with security status
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      security_status: "suspended",
      security_alert_level: alertLevel,
      security_reason: reason,
      security_flagged_at: new Date().toISOString(),
      security_flagged_order_id: orderId,
      security_requires_pin_reset: true,
    })
    .eq("user_id", clientId);

  if (profileError) {
    console.error("Error flagging client:", profileError);
    throw profileError;
  }

  // Log the action
  await supabase.from("security_action_logs").insert({
    client_id: clientId,
    action: `order_flagged_${alertLevel}`,
    order_id: orderId,
    reason,
    action_by_role: "system",
    details: {
      trigger: "order_status_change",
      alert_level: alertLevel,
    },
  });

  return { success: true };
};

export const liftClientSuspension = async (
  clientId: string,
  actionById: string,
  actionByName: string,
  actionByRole: string,
  requirePinReset: boolean = true,
  reason?: string
) => {
  const { error } = await supabase
    .from("profiles")
    .update({
      security_status: "active",
      security_alert_level: "none",
      security_reason: null,
      security_flagged_at: null,
      security_flagged_order_id: null,
      security_requires_pin_reset: requirePinReset,
    })
    .eq("user_id", clientId);

  if (error) {
    console.error("Error lifting suspension:", error);
    throw error;
  }

  // Log the action
  await supabase.from("security_action_logs").insert({
    client_id: clientId,
    action: "suspension_lifted",
    action_by_id: actionById,
    action_by_name: actionByName,
    action_by_role: actionByRole,
    reason: reason || "Suspension lifted by staff",
    details: {
      require_pin_reset: requirePinReset,
    },
  });

  return { success: true };
};

export const checkClientSecurityStatus = async (userId: string): Promise<{
  status: string;
  alertLevel: string;
  isSuspended: boolean;
}> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("security_status, security_alert_level")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("Error checking security status:", error);
    return { status: "active", alertLevel: "none", isSuspended: false };
  }

  return {
    status: data?.security_status || "active",
    alertLevel: data?.security_alert_level || "none",
    isSuspended: data?.security_status === "suspended",
  };
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
