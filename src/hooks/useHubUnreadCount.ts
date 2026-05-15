/**
 * useHubUnreadCount — fetches unread Nivra Source notifications + open
 * tickets count for the current user. Used by sidebar "Nivra Source" badge.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useHubUnreadCount() {
  return useQuery({
    queryKey: ["hub-unread-total"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const [notif, tickets] = await Promise.all([
        supabase.from("hub_notifications").select("id", { count: "exact", head: true })
          .not("is_read_by", "cs", `{${user.id}}`),
        supabase.from("hub_tickets").select("id", { count: "exact", head: true })
          .eq("submitted_by", user.id).in("status", ["open", "in_progress", "waiting"]),
      ]);
      return (notif.count ?? 0) + (tickets.count ?? 0);
    },
  });
}
