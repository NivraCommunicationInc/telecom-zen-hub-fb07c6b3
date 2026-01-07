import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeClient } from "@/integrations/backend";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
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

export function useEmployeeNotifications() {
  const { user } = useEmployeeAuth();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["employee-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await employeeClient
        .from("notifications")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Unread count
  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await employeeClient
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-notifications"] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await employeeClient
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user?.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-notifications"] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = employeeClient
      .channel("employee-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["employee-notifications"] });
        }
      )
      .subscribe();

    return () => {
      employeeClient.removeChannel(channel);
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
