import { useClientAuth } from "@/hooks/useClientAuth";
import { writeAccountJournal } from "@/lib/writeAccountJournal";

interface ActivityLogOptions {
  changedField?: string;
  reason?: string;
  oldValue?: string;
  newValue?: string;
}

function minuteBucket(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
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
      const eventKey = `portalact:${user.id}:${entityType}:${entityId || "none"}:${action}:${minuteBucket()}`;
      await writeAccountJournal({
        targetTable: "activity_logs",
        eventKey,
        payload: {
          action,
          entity_type: entityType,
          entity_id: entityId,
          details,
          changed_field: options?.changedField,
          reason: options?.reason,
          old_value: options?.oldValue,
          new_value: options?.newValue,
        },
      });
    } catch (error) {
      console.error("Failed to log portal activity:", error);
    }
  };

  return { logActivity };
};
