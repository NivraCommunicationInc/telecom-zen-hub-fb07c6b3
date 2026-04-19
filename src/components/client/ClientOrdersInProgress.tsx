/**
 * ClientOrdersInProgress
 * Shows the client's active in-flight orders (paid but not yet activated)
 * with a visual lifecycle timeline so they can track service delivery.
 *
 * Lifecycle (canonical, see installation-lifecycle-states memory):
 *   confirmed → processing → shipped → installation → activated
 */
import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package, CheckCircle2, Clock, Truck, Wrench, Zap, FileText,
  ChevronRight, AlertCircle, CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

type OrderRow = {
  id: string;
  order_number: string | null;
  status: string;
  service_type: string | null;
  total_amount: number | null;
  payment_status: string | null;
  created_at: string;
};

type AppointmentRow = {
  id: string;
  order_id: string | null;
  scheduled_at: string;
  status: string | null;
  installation_method: string | null;
};

const STEPS = [
  { key: "confirmed",    label: "Confirmée",    icon: CheckCircle2 },
  { key: "processing",   label: "Préparation",  icon: Package },
  { key: "shipped",      label: "Expédiée",     icon: Truck },
  { key: "installation", label: "Installation", icon: Wrench },
  { key: "activated",    label: "Activée",      icon: Zap },
] as const;

const STATUS_TO_STEP_INDEX: Record<string, number> = {
  pending: 0,
  confirmed: 0,
  paid: 0,
  processing: 1,
  preparing: 1,
  shipped: 2,
  in_transit: 2,
  delivered: 2,
  installation: 3,
  installation_scheduled: 3,
  installing: 3,
  activated: 4,
  active: 4,
  completed: 4,
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "activated" || s === "active") {
    return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Activée</Badge>;
  }
  if (s === "shipped" || s === "in_transit") {
    return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">En transit</Badge>;
  }
  if (s === "installation" || s === "installation_scheduled") {
    return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Installation prévue</Badge>;
  }
  if (s === "processing" || s === "preparing") {
    return <Badge className="bg-indigo-500/20 text-indigo-600 border-indigo-500/30">En préparation</Badge>;
  }
  return <Badge variant="outline">En cours</Badge>;
}

function OrderTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_TO_STEP_INDEX[status.toLowerCase()] ?? 0;

  return (
    <div className="flex items-center gap-1 sm:gap-2 mt-3">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <div
                className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                  done && "bg-emerald-500 border-emerald-500 text-white",
                  active && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/15",
                  !done && !active && "bg-muted border-border text-muted-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-xs text-center leading-tight truncate w-full",
                  active && "text-foreground font-medium",
                  !active && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-0.5 sm:mx-1 mt-[-18px]",
                  done ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ClientOrdersInProgress() {
  const { user } = useClientAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["client-orders-in-progress", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000, // live tracking
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("orders")
        .select("id, order_number, status, service_type, total_amount, payment_status, created_at")
        .eq("user_id", user!.id)
        .not("status", "in", '("cancelled","refunded","completed")')
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as OrderRow[];
    },
  });

  const orderIds = orders.map((o) => o.id);

  const { data: appointments = [] } = useQuery({
    queryKey: ["client-orders-in-progress-appointments", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("appointments")
        .select("id, order_id, scheduled_at, status, installation_method")
        .in("order_id", orderIds)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data || []) as AppointmentRow[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 animate-pulse" /> Chargement de vos commandes…
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) return null;

  const apptByOrder = new Map<string, AppointmentRow>();
  for (const a of appointments) {
    if (a.order_id && !apptByOrder.has(a.order_id)) apptByOrder.set(a.order_id, a);
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          Services en cours de livraison
          <Badge variant="secondary" className="ml-auto text-xs">
            {orders.length} commande{orders.length > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {orders.map((order) => {
          const appt = apptByOrder.get(order.id);
          return (
            <div key={order.id} className="rounded-lg border border-border bg-card/60 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {order.order_number || `#${order.id.slice(0, 8)}`}
                    </span>
                    {statusBadge(order.status)}
                    {order.service_type && (
                      <Badge variant="outline" className="text-xs">{order.service_type}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      Commandée le {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                    {order.total_amount != null && (
                      <span className="font-medium text-foreground">
                        {Number(order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    )}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to={`/portal/orders/${order.id}`}>
                    Détails <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </Button>
              </div>

              <OrderTimeline status={order.status} />

              {appt && (
                <div className="mt-3 flex items-center gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md px-3 py-2 border border-amber-500/20">
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Installation prévue le{" "}
                    <strong>{format(new Date(appt.scheduled_at), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}</strong>
                    {appt.installation_method && ` (${appt.installation_method})`}
                  </span>
                </div>
              )}

              {order.payment_status === "pending" && (
                <div className="mt-3 flex items-center gap-2 text-xs bg-red-500/10 text-red-600 rounded-md px-3 py-2 border border-red-500/20">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Paiement en attente — votre commande sera traitée dès réception.</span>
                </div>
              )}
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
          <FileText className="w-3 h-3" />
          Le suivi est mis à jour automatiquement toutes les 30 secondes.
        </p>
      </CardContent>
    </Card>
  );
}
