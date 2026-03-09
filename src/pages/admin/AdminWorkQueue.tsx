/**
 * AdminWorkQueue — Central operational work queue page
 * Desktop-first, all sections visible immediately, zero mock data.
 */
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { StatCard } from "@/components/admin/ui/StatCard";
import { SectionCard } from "@/components/admin/ui/SectionCard";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { useWorkQueue, type WorkQueueItem, type AppointmentQueueItem } from "@/hooks/admin/useWorkQueue";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, CreditCard, Calendar, Zap, AlertTriangle, ArrowRight,
  Clock, ExternalLink,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";

function OrderRow({ item }: { item: WorkQueueItem }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-primary/5 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold text-foreground">
            {item.order_number || item.id.slice(0, 8)}
          </span>
          {item.invoice_number && (
            <Link to={`/admin/invoices/${item.invoice_id}`} className="text-xs text-primary hover:underline font-mono">
              #{item.invoice_number}
            </Link>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {item.client_name || item.client_email || "—"}
          {item.account_number && <span className="ml-2 font-mono opacity-70">#{item.account_number}</span>}
          {item.service_type && <span className="ml-2">• {item.service_type}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.total_amount != null && (
          <span className="text-sm font-medium tabular-nums">
            {item.total_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </span>
        )}
        <StatusBadge label={item.status} variant={statusToVariant(item.status)} size="sm" />
        <Link to={`/admin/orders/${item.id}`}>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0">
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function AppointmentRow({ item }: { item: AppointmentQueueItem }) {
  const date = new Date(item.scheduled_at);
  const dateLabel = isToday(date) ? "Aujourd'hui" : isTomorrow(date) ? "Demain" : format(date, "d MMM", { locale: fr });
  const timeLabel = format(date, "HH:mm");

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-primary/5 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {item.appointment_number || item.title}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            {dateLabel} {timeLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {item.client_email || "—"}
          {item.service_address && <span className="ml-2">• {item.service_address}</span>}
          {item.service_city && <span>, {item.service_city}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge label={item.status || "pending"} variant={statusToVariant(item.status || "pending")} size="sm" />
        {item.order_id && (
          <Link to={`/admin/orders/${item.order_id}`}>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Voir commande">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

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
    <SectionCard
      title={title}
      icon={Icon}
      actions={
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
      }
      noPadding
    >
      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : count === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage}</p>
      ) : (
        children
      )}
    </SectionCard>
  );
}

export default function AdminWorkQueue() {
  const { newOrders, paidOrders, appointments, activations, onHold, isLoading } = useWorkQueue();

  const totalItems = newOrders.length + paidOrders.length + appointments.length + activations.length + onHold.length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="File de travail"
          subtitle="Actions opérationnelles à traiter — données en temps réel"
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "File de travail" },
          ]}
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard icon={Package} label="Nouvelles commandes" value={newOrders.length} />
          <StatCard icon={CreditCard} label="Payées à traiter" value={paidOrders.length} />
          <StatCard icon={Calendar} label="Rendez-vous à venir" value={appointments.length} />
          <StatCard icon={Zap} label="Activations en attente" value={activations.length} />
          <StatCard icon={AlertTriangle} label="En hold / bloquées" value={onHold.length} />
        </div>

        {/* All sections visible — desktop-first */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Nouvelles commandes */}
          <QueueSection
            title="Nouvelles commandes"
            icon={Package}
            count={newOrders.length}
            isLoading={isLoading}
            emptyMessage="Aucune nouvelle commande"
          >
            {newOrders.map(item => <OrderRow key={item.id} item={item} />)}
          </QueueSection>

          {/* Payées à traiter */}
          <QueueSection
            title="Commandes payées à traiter"
            icon={CreditCard}
            count={paidOrders.length}
            isLoading={isLoading}
            emptyMessage="Aucune commande payée en attente"
          >
            {paidOrders.map(item => <OrderRow key={item.id} item={item} />)}
          </QueueSection>

          {/* Rendez-vous */}
          <QueueSection
            title="Rendez-vous aujourd'hui & à venir"
            icon={Calendar}
            count={appointments.length}
            isLoading={isLoading}
            emptyMessage="Aucun rendez-vous à venir"
          >
            {appointments.map(item => <AppointmentRow key={item.id} item={item} />)}
          </QueueSection>

          {/* Activations en attente */}
          <QueueSection
            title="Activations en attente"
            icon={Zap}
            count={activations.length}
            isLoading={isLoading}
            emptyMessage="Aucune activation en attente"
          >
            {activations.map(item => <OrderRow key={item.id} item={item} />)}
          </QueueSection>
        </div>

        {/* En hold — full width at bottom */}
        <QueueSection
          title="En hold / Bloquées"
          icon={AlertTriangle}
          count={onHold.length}
          isLoading={isLoading}
          emptyMessage="Aucune commande bloquée"
        >
          {onHold.map(item => <OrderRow key={item.id} item={item} />)}
        </QueueSection>
      </div>
    </AdminLayout>
  );
}
