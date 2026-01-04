import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useEffect } from "react";

export interface Notification {
  id: string;
  user_id: string;
  user_role: string;
  type: string;
  title: string;
  message: string | null;
  link_target: string | null;
  link_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function usePortalNotifications() {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["portal-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("notifications")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Unread count
  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await portalSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-notifications"] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await portalSupabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user?.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-notifications"] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = portalSupabase
      .channel("portal-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["portal-notifications"] });
        }
      )
      .subscribe();

    return () => {
      portalSupabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    notifications: notifications || [],
    unreadCount,
    isLoading,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    isMarkingRead: markAsReadMutation.isPending,
  };
}
