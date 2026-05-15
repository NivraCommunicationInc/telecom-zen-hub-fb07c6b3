/**
 * HrNotifications — Clickable notifications with deep-link routing.
 * Fixed: uses is_read (not read), supports link_url for deep links.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCheck, Loader2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TYPE_ROUTES: Record<string, string> = {
  payroll: "/hr/paie",
  commission: "/hr/commissions",
  schedule: "/hr/horaires",
  letter: "/hr/lettres-emploi",
  tax_document: "/hr/documents-fiscaux",
  general: "/hr/dashboard",
};

export default function HrNotifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["rh-notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("employee_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await supabase
        .from("employee_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("is_read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["rh-unread-notifs"] });
    },
  });

  const markOneRead = useMutation({
    mutationFn: async (notifId: string) => {
      await supabase
        .from("employee_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notifId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["rh-unread-notifs"] });
    },
  });

  const handleClick = (notif: any) => {
    // Mark as read
    if (!notif.is_read) {
      markOneRead.mutate(notif.id);
    }
    // Navigate to deep link
    const route = notif.link_url || TYPE_ROUTES[notif.notification_type] || "/hr/dashboard";
    navigate(route);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications RH
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour ✓"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Tout marquer lu
          </Button>
        )}
      </div>

      {!notifications?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune notification.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => {
            const isUnread = !n.is_read;
            return (
              <Card
                key={n.id}
                className={cn(
                  "transition-all cursor-pointer hover:shadow-sm",
                  isUnread && "border-primary/40 bg-primary/5"
                )}
                onClick={() => handleClick(n)}
              >
                <CardContent className="py-3 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {isUnread && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        <p className={cn("text-sm", isUnread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                          {n.title || n.message}
                        </p>
                      </div>
                      {n.title && n.message && (
                        <p className="text-xs text-muted-foreground pl-4">{n.message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(n.created_at), "d MMM HH:mm", { locale: fr })}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
