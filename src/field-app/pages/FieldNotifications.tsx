/**
 * FieldNotifications — Actionable field alerts with real notifications and sync signals.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCheck, DollarSign, FileText, Loader2, RefreshCw, ShoppingCart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { cn } from "@/lib/utils";
import { FieldBadge, FieldEmptyState, FieldMetricCard, FieldPageHeader, FieldPanel } from "@/field-app/components/FieldUI";

type NotifItem = {
  id: string;
  type: "sale" | "commission" | "sync" | "lead" | "system" | "payroll" | "document";
  title: string;
  description: string;
  time: string;
  status?: "success" | "warning" | "error" | "info";
  isRead?: boolean;
  source: "db" | "derived";
};

const ICON_MAP = {
  sale: ShoppingCart,
  commission: DollarSign,
  sync: RefreshCw,
  lead: UserPlus,
  system: Bell,
  payroll: FileText,
  document: FileText,
} as const;

function mapNotifType(value: string): NotifItem["type"] {
  if (value.includes("commission") || value.includes("withdrawal")) return "commission";
  if (value.includes("payroll") || value.includes("pay")) return "payroll";
  if (value.includes("tax") || value.includes("document") || value.includes("letter")) return "document";
  return "system";
}

export default function FieldNotifications() {
  const { user } = useStaffUser();
  const queryClient = useQueryClient();

  const { data: dbNotifications = [], isLoading: loadingDb } = useQuery({
    queryKey: ["field-employee-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((notification: any) => ({
        id: notification.id,
        type: mapNotifType(notification.notification_type || "system"),
        title: notification.title || "Notification",
        description: notification.message || "",
        time: notification.created_at,
        status: "info" as const,
        isRead: notification.is_read,
        source: "db" as const,
      }));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });

  const { data: derivedNotifications = [], isLoading: loadingDerived } = useQuery({
    queryKey: ["field-notifications-derived", user?.id],
    queryFn: async () => {
      const items: NotifItem[] = [];
      const { data: orders } = await supabase
        .from("field_sales_orders")
        .select("id, customer_name, sync_status, payment_status, created_at, updated_at")
        .eq("salesperson_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(10);

      for (const order of orders || []) {
        if (order.sync_status === "synced") {
          items.push({
            id: `sync-${order.id}`,
            type: "sync",
            title: "Commande synchronisée",
            description: `${order.customer_name} — le dossier est bien propagé aux opérations.`,
            time: order.updated_at || order.created_at,
            status: "success",
            isRead: true,
            source: "derived",
          });
        } else if (order.sync_status === "error") {
          items.push({
            id: `sync-error-${order.id}`,
            type: "sync",
            title: "Synchronisation à relancer",
            description: `${order.customer_name} — le détail de commande doit être revu.`,
            time: order.updated_at || order.created_at,
            status: "error",
            isRead: false,
            source: "derived",
          });
        } else if (order.payment_status === "pending") {
          items.push({
            id: `payment-${order.id}`,
            type: "sale",
            title: "Paiement client à confirmer",
            description: `${order.customer_name} — la commande existe, mais le paiement reste en attente.`,
            time: order.updated_at || order.created_at,
            status: "warning",
            isRead: false,
            source: "derived",
          });
        }
      }

      return items;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`field-notif-rt-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "employee_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-employee-notifications", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employee_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["field-employee-notifications", user?.id] }),
  });

  const notifications = [...dbNotifications, ...derivedNotifications]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 30);

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const urgentCount = notifications.filter((notification) => notification.status === "error").length;
  const isLoading = loadingDb || loadingDerived;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FieldPageHeader
        eyebrow="Support terrain"
        title="Notifications & alertes"
        description="Ici, l'agent voit ce qui nécessite une relance concrète: sync, paiements, commissions et signaux internes."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Tout marquer lu
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <FieldMetricCard label="Non lues" value={unreadCount} hint="Notifications qui demandent votre attention" icon={Bell} tone={unreadCount > 0 ? "warning" : "success"} />
        <FieldMetricCard label="Urgentes" value={urgentCount} hint="Sync bloquées ou alertes critiques" icon={RefreshCw} tone={urgentCount > 0 ? "danger" : "success"} />
        <FieldMetricCard label="Flux actif" value={notifications.length} hint="Historique visible sur cette page" icon={FileText} tone="info" />
      </div>

      <FieldPanel title="Fil principal" description="Chaque élément doit aider l'agent à agir, pas juste l'informer.">
        {notifications.length === 0 ? (
          <FieldEmptyState
            icon={Bell}
            title="Aucune notification"
            description="Les synchronisations, paiements et alertes internes apparaîtront ici dès qu'une action demandera votre attention."
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const Icon = ICON_MAP[notification.type] || Bell;
              const tone = notification.status === "error" ? "danger" : notification.status === "warning" ? "warning" : notification.status === "success" ? "success" : "info";
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 rounded-[1.25rem] border px-4 py-4 shadow-card transition-all",
                    notification.isRead ? "border-border bg-card" : "border-primary/15 bg-primary/5",
                  )}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-secondary text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                      <FieldBadge tone={tone as any}>{notification.source === "db" ? "Interne" : "Système"}</FieldBadge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{notification.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(notification.time), { addSuffix: true, locale: fr })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FieldPanel>
    </div>
  );
}
