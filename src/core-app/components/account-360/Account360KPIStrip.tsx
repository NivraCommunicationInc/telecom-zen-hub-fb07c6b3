/**
 * Account360KPIStrip — 8 KPI cards for the Customer 360 dashboard.
 */
import {
  Repeat, FileText, CreditCard, MessageSquare, Calendar, Package, Shield, ShoppingCart,
} from "lucide-react";

const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");

interface Props {
  activeSubs: number;
  suspendedSubs: number;
  unpaidInvoices: number;
  recentPayments: number;
  openTickets: number;
  upcomingAppointments: number;
  equipmentCount: number;
  ordersCount: number;
}

export function Account360KPIStrip({
  activeSubs, suspendedSubs, unpaidInvoices, recentPayments,
  openTickets, upcomingAppointments, equipmentCount, ordersCount,
}: Props) {
  const kpis = [
    { label: "Services actifs", value: activeSubs, icon: Repeat, color: "text-emerald-400", alert: false },
    { label: "Suspendus", value: suspendedSubs, icon: Repeat, color: suspendedSubs > 0 ? "text-red-400" : "text-core-text-disabled", alert: suspendedSubs > 0 },
    { label: "Fact. impayées", value: unpaidInvoices, icon: FileText, color: unpaidInvoices > 0 ? "text-red-400" : "text-emerald-400", alert: unpaidInvoices > 0 },
    { label: "Paiements récents", value: recentPayments, icon: CreditCard, color: "text-core-text-primary", alert: false },
    { label: "Tickets ouverts", value: openTickets, icon: MessageSquare, color: openTickets > 0 ? "text-amber-400" : "text-core-text-disabled", alert: openTickets > 0 },
    { label: "RDV à venir", value: upcomingAppointments, icon: Calendar, color: upcomingAppointments > 0 ? "text-sky-400" : "text-core-text-disabled", alert: false },
    { label: "Équipements", value: equipmentCount, icon: Package, color: "text-core-text-primary", alert: false },
    { label: "Commandes", value: ordersCount, icon: ShoppingCart, color: "text-core-text-primary", alert: false },
  ];

  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
      {kpis.map(k => (
        <div
          key={k.label}
          className={`rounded-lg border bg-[hsl(220,20%,11%)] p-2.5 ${
            k.alert ? "border-red-500/20" : "border-[hsl(220,15%,16%)]"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <k.icon className={`h-3 w-3 ${k.color}`} />
            <span className="text-[9px] uppercase tracking-wider text-core-text-label font-medium truncate">{k.label}</span>
          </div>
          <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}
