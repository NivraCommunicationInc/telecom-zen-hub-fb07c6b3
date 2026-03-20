/**
 * useEmployeeNotifications — Real-time employee notification system.
 * Subscribes to employee_notifications table for the current user.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useEffect } from "react";
import { toast } from "sonner";

export interface EmployeeNotification {
  id: string;
  user_id: string;
  notification_type: "assignment" | "urgent" | "sla_breach" | "escalation" | "system";
  title: string;
  message: string | null;
  work_item_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export function useEmployeeNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["employee-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as EmployeeNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("employee_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-notifications"] }),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employee_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-notifications"] }),
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("employee-notifs-rt")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "employee_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["employee-notifications"] });
          const n = payload.new as EmployeeNotification;
          // Toast for urgent/breach notifications
          if (n.notification_type === "sla_breach" || n.notification_type === "urgent") {
            toast.error(n.title, { description: n.message || undefined, duration: 8000 });
          } else {
            toast(n.title, { description: n.message || undefined, duration: 5000 });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  return {
    notifications: notifications || [],
    unreadCount,
    isLoading,
    markAsRead: (id: string) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
  };
}
