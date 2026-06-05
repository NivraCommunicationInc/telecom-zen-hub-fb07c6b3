import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type StaffNotificationType =
  | 'new_order'
  | 'invoice_created'
  | 'payment_received'
  | 'service_suspended'
  | 'service_cancelled'
  | 'order_failed'
  | 'order_on_hold'
  | 'order_stalled'
  | 'cancellation_requested';

export interface StaffNotification {
  id: string;
  notification_type: StaffNotificationType;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_number: string | null;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  amount: number | null;
  is_read: boolean;
  read_by: string | null;
  read_at: string | null;
  created_at: string;
}

export function useStaffNotifications() {
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch notifications
  const fetchNotifications = useCallback(async (limit = 50) => {
    try {
      const { data, error } = await supabase
        .from("staff_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const typedData = (data || []) as StaffNotification[];
      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.is_read).length);
    } catch (err) {
      console.error("[useStaffNotifications] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("staff_notifications")
        .update({
          is_read: true,
          read_by: user?.id,
          read_at: new Date().toISOString()
        })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[useStaffNotifications] Mark read error:", err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("staff_notifications")
        .update({
          is_read: true,
          read_by: user?.id,
          read_at: new Date().toISOString()
        })
        .in("id", unreadIds);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[useStaffNotifications] Mark all read error:", err);
    }
  }, [notifications]);

  // Setup realtime subscription
  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("staff-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "staff_notifications"
        },
        (payload) => {
          const newNotification = payload.new as StaffNotification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show toast for new notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, toast]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
}
