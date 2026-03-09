/**
 * WorkQueuePage — Nivra Core operational work queue.
 * Reuses useWorkQueue hook (same data source as /admin/work-queue).
 * Dark ops-grade visual style, routed at /core/work-queue.
 */
import { useWorkQueue, type WorkQueueItem, type AppointmentQueueItem } from "@/hooks/admin/useWorkQueue";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Link } from "react-router-dom";
import {
  Package, CreditCard, Calendar, Zap, AlertTriangle, ArrowRight, ExternalLink, RefreshCw,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";

/* ── Skeleton row ── */
function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-[hsl(220,15%,14%)] last:border-0">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-[hsl(220,15%,14%)] animate-pulse" />
            <div className="h-3 w-48 rounded bg-[hsl(220,15%,12%)] animate-pulse" />
          </div>
          <div className="h-5 w-16 rounded-full bg-[hsl(220,15%,14%)] animate-pulse" />
        </div>
      ))}
    </>
  );
}

/* ── Order row ── */
function OrderRow({ item }: { item: WorkQueueItem }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,15%,13%)] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-white">
            {item.order_number || item.id.slice(0, 8)}
          </span>
          {item.invoice_number && (
            <Link to={`/core/invoices/${item.invoice_id}`} className="text-[11px] text-emerald-400 hover:underline font-mono">
              #{item.invoice_number}
            </Link>
          )}
        </div>
        <p className="text-[11px] text-[hsl(220,10%,45%)] mt-0.5 truncate">
          {item.client_name || item.client_email || "—"}
          {item.account_number && <span className="ml-2 font-mono opacity-70">#{item.account_number}</span>}
          {item.service_type && <span className="ml-2">• {item.service_type}</span>}
          {item.failure_reason && (
            <span className="ml-2 text-red-400 font-medium">⚠ {item.failure_reason}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.total_amount != null && (
          <span className="text-xs font-medium tabular-nums text-[hsl(220,10%,70%)]">
            {item.total_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </span>
        )}
        <StatusBadge label={item.status} variant={statusToVariant(item.status)} size="sm" />
        <Link to={`/admin/orders/${item.id}`}>
          <button className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/40 transition-colors">
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ── Appointment row ── */
function AppointmentRow({ item }: { item: AppointmentQueueItem }) {
  const date = new Date(item.scheduled_at);
  const dateLabel = isToday(date) ? "Aujourd'hui" : isTomorrow(date) ? "Demain" : format(date, "d MMM", { locale: fr });
  const timeLabel = format(date, "HH:mm");

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,15%,13%)] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">
            {item.appointment_number || item.title}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-400 font-medium">
            {dateLabel} {timeLabel}
          </span>
        </div>
        <p className="text-[11px] text-[hsl(220,10%,45%)] mt-0.5 truncate">
          {item.client_email || "—"}
          {item.service_address && <span className="ml-2">• {item.service_address}</span>}
          {item.service_city && <span>, {item.service_city}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge label={item.status || "pending"} variant={statusToVariant(item.status || "pending")} size="sm" />
        {item.order_id && (
          <Link to={`/admin/orders/${item.order_id}`}>
            <button className="h-7 w-7 flex items-center justify-center rounded-md text-[hsl(220,10%,50%)] hover:text-white transition-colors" title="Voir commande">
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Section wrapper ── */
function QueueSection({
  title,
  icon: Icon,
  count,
  children,
  emptyMessage,
  isLoading,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
  emptyMessage: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,16%)]">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-white">{title}</h3>
        </div>
        <span className="text-[11px] font-semibold text-[hsl(220,10%,45%)] bg-[hsl(220,15%,14%)] px-2 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
      </div>
      {isLoading ? (
        <SkeletonRows />
      ) : count === 0 ? (
        <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-8">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  );
}

/* ── Main page ── */
const WorkQueuePage = () => {
  const { newOrders, paidOrders, appointments, activations, onHold, isLoading } = useWorkQueue();

  const totalItems = newOrders.length + paidOrders.length + appointments.length + activations.length + onHold.length;

  const kpis = [
    { icon: Package, label: "Nouvelles", value: newOrders.length },
    { icon: CreditCard, label: "Payées", value: paidOrders.length },
    { icon: Calendar, label: "RDV", value: appointments.length },
    { icon: Zap, label: "Activations", value: activations.length },
    { icon: AlertTriangle, label: "Hold", value: onHold.length, warn: onHold.length > 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">File de travail</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">
            Actions opérationnelles à traiter · {totalItems} élément{totalItems !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <k.icon className={`h-3.5 w-3.5 ${k.warn ? "text-amber-400" : "text-[hsl(220,10%,40%)]"}`} />
              <span className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{k.label}</span>
            </div>
            <p className={`text-lg font-bold tabular-nums ${k.warn ? "text-amber-400" : "text-white"}`}>
              {isLoading ? "—" : k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Queue sections — 2-col grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <QueueSection title="Nouvelles commandes" icon={Package} count={newOrders.length} isLoading={isLoading} emptyMessage="Aucune nouvelle commande">
          {newOrders.map(item => <OrderRow key={item.id} item={item} />)}
        </QueueSection>

        <QueueSection title="Commandes payées à traiter" icon={CreditCard} count={paidOrders.length} isLoading={isLoading} emptyMessage="Aucune commande payée en attente">
          {paidOrders.map(item => <OrderRow key={item.id} item={item} />)}
        </QueueSection>

        <QueueSection title="Rendez-vous aujourd'hui & à venir" icon={Calendar} count={appointments.length} isLoading={isLoading} emptyMessage="Aucun rendez-vous à venir">
          {appointments.map(item => <AppointmentRow key={item.id} item={item} />)}
        </QueueSection>

        <QueueSection title="Activations en attente" icon={Zap} count={activations.length} isLoading={isLoading} emptyMessage="Aucune activation en attente">
          {activations.map(item => <OrderRow key={item.id} item={item} />)}
        </QueueSection>
      </div>

      {/* On hold — full width */}
      <QueueSection title="En hold / Bloquées" icon={AlertTriangle} count={onHold.length} isLoading={isLoading} emptyMessage="Aucune commande bloquée">
        {onHold.map(item => <OrderRow key={item.id} item={item} />)}
      </QueueSection>
    </div>
  );
};

export default WorkQueuePage;
