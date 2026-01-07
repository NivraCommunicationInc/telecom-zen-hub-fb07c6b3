import { backendClient } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";

interface ActivityLogOptions {
  changedField?: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
}

export const useActivityLog = () => {
  const { user, role } = useAuth();

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
      const { data: profile } = await backendClient
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      // Map role to display name
      const roleDisplayMap: Record<string, string> = {
        admin: "Admin",
        employee: "Employé",
        technician: "Technicien",
        client: "Client",
      };

      await backendClient.from("activity_logs").insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        actor_role: roleDisplayMap[role || "client"] || role || "Client",
        actor_name: profile?.full_name || user.email?.split("@")[0] || "Utilisateur",
        actor_email: profile?.email || user.email,
        changed_field: options?.changedField,
        reason: options?.reason,
        old_value: options?.oldValue,
        new_value: options?.newValue,
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  return { logActivity };
};
