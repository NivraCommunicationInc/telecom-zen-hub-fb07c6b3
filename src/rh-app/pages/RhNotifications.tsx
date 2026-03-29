/**
 * RhNotifications — Employee RH notifications list.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RhNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["rh-notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("employee_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("employee_notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["rh-notification-count"] });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const unreadCount = notifications?.filter((n: any) => !n.read).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-amber-600" />
            Notifications RH
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour"}
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
          {notifications.map((n: any) => (
            <Card key={n.id} className={cn("transition-shadow", !n.read && "border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10")}>
              <CardContent className="py-3 px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className={cn("text-sm", !n.read ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {n.title || n.message}
                    </p>
                    {n.title && n.message && (
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(n.created_at).toLocaleDateString("fr-CA")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
