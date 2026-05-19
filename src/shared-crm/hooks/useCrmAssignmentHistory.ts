/**
 * useCrmAssignmentHistory — Returns the assignment audit trail for a contact.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignmentHistoryRow {
  id: string;
  contact_id: string;
  from_agent_id: string | null;
  to_agent_id: string | null;
  changed_by_name: string | null;
  reason: string | null;
  kind: string;
  created_at: string;
}

export function useCrmAssignmentHistory(contactId: string | null) {
  return useQuery({
    queryKey: ["crm-assignment-history", contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<AssignmentHistoryRow[]> => {
      const { data, error } = await supabase
        .from("crm_assignment_history")
        .select("id, contact_id, from_agent_id, to_agent_id, changed_by_name, reason, kind, created_at")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssignmentHistoryRow[];
    },
  });
}
