/**
 * FieldNotifications — Uses fetchNotifications + markNotificationsRead from service layer.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationsRead } from "@/field-app/lib/fieldServices";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, CheckCheck, DollarSign, FileText, Loader2, RefreshCw, ShoppingCart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FieldBadge, FieldEmptyState, FieldMetricCard, FieldPageHeader, FieldPanel } from "@/field-app/components/FieldUI";

const ICON_MAP: Record<string, typeof Bell> = { sale: ShoppingCart, commission: DollarSign, sync: RefreshCw, lead: UserPlus, system: Bell, payroll: FileText, document: FileText };

export default function FieldNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["field-notifications-list"],
    queryFn: fetchNotifications,
    staleTime: 1000 * 30,
  });

  const markAllRead = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["field-notifications-list"] }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;
  const urgentCount = notifications.filter((n: any) => n.status === "error").length;

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <FieldPageHeader eyebrow="Support terrain" title="Notifications & alertes" description="Alertes opérationnelles: sync, paiements, commissions."
        actions={unreadCount > 0 ? <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}><CheckCheck className="mr-2 h-4 w-4" />Tout marquer lu</Button> : undefined} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldMetricCard label="Non lues" value={unreadCount} hint="Demandent votre attention" icon={Bell} tone={unreadCount > 0 ? "warning" : "success"} />
        <FieldMetricCard label="Urgentes" value={urgentCount} hint="Sync bloquées ou alertes critiques" icon={RefreshCw} tone={urgentCount > 0 ? "danger" : "success"} />
        <FieldMetricCard label="Flux actif" value={notifications.length} hint="Historique visible" icon={FileText} tone="info" />
      </div>
      <FieldPanel title="Fil principal" description="Chaque élément aide l'agent à agir.">
        {notifications.length === 0 ? (
          <FieldEmptyState icon={Bell} title="Aucune notification" description="Les alertes apparaîtront ici." />
        ) : (
          <div className="space-y-3">
            {notifications.map((n: any) => {
              const Icon = ICON_MAP[n.type] || Bell;
              const tone = n.status === "error" ? "danger" : n.status === "warning" ? "warning" : n.status === "success" ? "success" : "info";
              return (
                <div key={n.id} className={cn("flex items-start gap-3 rounded-[1.25rem] border px-4 py-4 shadow-card transition-all", n.isRead ? "border-border bg-card" : "border-primary/15 bg-primary/5")}>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-secondary text-foreground"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <FieldBadge tone={tone as any}>{n.source === "db" ? "Interne" : "Système"}</FieldBadge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{n.description}</p>
                  </div>
                  <div className="shrink-0 text-right"><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.time), { addSuffix: true, locale: fr })}</p></div>
                </div>
              );
            })}
          </div>
        )}
      </FieldPanel>
    </div>
  );
}
