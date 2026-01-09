import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";

interface ActivityLogOptions {
  changedField?: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
}

export const usePortalActivityLog = () => {
  const { user } = useClientAuth();

  const logActivity = async (
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, any>,
    options?: ActivityLogOptions
  ) => {
    if (!user) return;

    try {
      // Get user profile for name/email
      const { data: profile } = await portalSupabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      await portalSupabase.from("activity_logs").insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        actor_role: "Client",
        actor_name: profile?.full_name || user.email?.split("@")[0] || "Client",
        actor_email: profile?.email || user.email,
        changed_field: options?.changedField,
        reason: options?.reason,
        old_value: options?.oldValue,
        new_value: options?.newValue,
      });
    } catch (error) {
      console.error("Failed to log portal activity:", error);
    }
  };

  return { logActivity };
};
