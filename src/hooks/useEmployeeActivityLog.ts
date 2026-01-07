import { employeeClient as employeeSupabase } from "@/integrations/backend/employeeClient";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";

interface ActivityLogOptions {
  changedField?: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
}

export const useEmployeeActivityLog = () => {
  const { user, role } = useEmployeeAuth();

  const logActivity = async (
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, any>,
    options?: ActivityLogOptions
  ) => {
    if (!user) return;

    try {
      // Prefer employee directory for names; fallback to auth email.
      const { data: employee } = await employeeSupabase
        .from("employees")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      const roleDisplayMap: Record<string, string> = {
        employee: "Employé",
        admin: "Admin",
        technician: "Technicien",
        client: "Client",
      };

      await employeeSupabase.from("activity_logs").insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        actor_role: roleDisplayMap[role || "employee"] || role || "Employé",
        actor_name:
          employee?.full_name || user.email?.split("@")[0] || "Employé",
        actor_email: employee?.email || user.email,
        changed_field: options?.changedField,
        reason: options?.reason,
        old_value: options?.oldValue,
        new_value: options?.newValue,
      });
    } catch (error) {
      console.error("[useEmployeeActivityLog] Failed to log activity:", error);
    }
  };

  return { logActivity };
};
