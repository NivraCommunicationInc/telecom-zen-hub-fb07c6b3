/**
 * FieldNotifications — Activity feed & notifications for field agents.
 * Shows real employee_notifications (from Core actions) + recent system events.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { Bell, Loader2, CheckCircle2, AlertCircle, DollarSign, RefreshCw, UserPlus, ShoppingCart, FileText, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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

const ICON_MAP: Record<string, typeof Bell> = {
  sale: ShoppingCart,
  commission: DollarSign,
  sync: RefreshCw,
  lead: UserPlus,
  system: Bell,
  payroll: FileText,
  document: FileText,
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  success: { bg: "bg-[#DCFCE7]", color: "text-[#16A34A]" },
  warning: { bg: "bg-[#FEF3C7]", color: "text-[#D97706]" },
  error: { bg: "bg-[#FEE2E2]", color: "text-[#DC2626]" },
  info: { bg: "bg-[#DBEAFE]", color: "text-[#3B82F6]" },
};

function mapNotifType(t: string): NotifItem["type"] {
  if (t.includes("commission") || t.includes("withdrawal")) return "commission";
  if (t.includes("payroll") || t.includes("pay")) return "payroll";
  if (t.includes("tax") || t.includes("document") || t.includes("letter")) return "document";
  return "system";
}

export default function FieldNotifications() {
  const { user } = useStaffUser();
  const qc = useQueryClient();

  // ── Real notifications from employee_notifications table ──
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
      return (data || []).map((n: any) => ({
        id: n.id,
        type: mapNotifType(n.notification_type || "system"),
        title: n.title || "Notification",
        description: n.message || "",
        time: n.created_at,
        status: "info" as const,
        isRead: n.is_read,
        source: "db" as const,
      }));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });

  // ── Derived notifications from field activity ──
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

      for (const o of orders || []) {
        if (o.sync_status === "synced") {
          items.push({
            id: `sync-${o.id}`, type: "sync",
            title: "Commande synchronisée",
            description: `${o.customer_name} — visible dans Core`,
            time: o.updated_at || o.created_at, status: "success", isRead: true, source: "derived",
          });
        } else if (o.sync_status === "error") {
          items.push({
            id: `sync-err-${o.id}`, type: "sync",
            title: "Erreur synchronisation",
            description: `${o.customer_name} — action requise`,
            time: o.updated_at || o.created_at, status: "error", isRead: false, source: "derived",
          });
        }
      }

      return items;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3,
  });

  // ── Realtime subscription ──
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`field-notif-rt-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "employee_notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ["field-employee-notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  // ── Mark as read ──
  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employee_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field-employee-notifications"] }),
  });

  // ── Merge and sort ──
  const allNotifications = [...dbNotifications, ...derivedNotifications]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 30);

  const unreadCount = allNotifications.filter(n => !n.isRead).length;
  const isLoading = loadingDb || loadingDerived;

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Activité récente et mises à jour
            {unreadCount > 0 && <span className="ml-2 text-xs font-semibold text-[#22C55E]">({unreadCount} non lues)</span>}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck className="h-4 w-4 mr-1" /> Tout marquer lu
          </Button>
        )}
      </div>

      {allNotifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allNotifications.map((n) => {
            const Icon = ICON_MAP[n.type] || Bell;
            const style = STATUS_STYLE[n.status || "info"];
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4 border rounded-xl transition-colors",
                  n.isRead
                    ? "bg-card border-border"
                    : "bg-accent/30 border-primary/20"
                )}
              >
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", style.bg)}>
                  <Icon className={cn("h-4 w-4", style.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold text-foreground", !n.isRead && "font-bold")}>{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(n.time), { addSuffix: true, locale: fr })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
