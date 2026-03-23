/**
 * NextBestAction — Shows the most important thing the agent should do next.
 */
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, Zap, ShieldCheck, Truck, Calendar } from "lucide-react";
import { employeePath } from "@/employee-app/lib/employeePaths";

interface Props {
  invoices: any[];
  subscriptions: any[];
  orders: any[];
  appointments: any[];
  onRecordPayment: () => void;
}

export function NextBestAction({ invoices, subscriptions, orders, appointments, onRecordPayment }: Props) {
  // Priority 1: Unpaid invoice
  const unpaid = invoices.find((i: any) => (i.balance_due ?? 0) > 0 && i.status !== "paid" && i.status !== "void");
  if (unpaid) {
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Solde impayé: {(unpaid.balance_due ?? unpaid.total)?.toFixed(2)} $</p>
            <p className="text-[10px] text-amber-400/60">Facture {unpaid.invoice_number}</p>
          </div>
        </div>
        <button
          onClick={onRecordPayment}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-medium hover:bg-amber-500 transition-colors"
        >
          Enregistrer paiement <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Priority 2: Suspended service
  const suspended = subscriptions.find((s: any) => s.status === "suspended");
  if (suspended) {
    return (
      <Link
        to={employeePath(`/subscriptions/${suspended.id}`)}
        className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-red-400" />
          <div>
            <p className="text-xs font-semibold text-red-300">Service suspendu: {suspended.plan_name}</p>
            <p className="text-[10px] text-red-400/60">Paiement requis pour réactivation</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-red-400" />
      </Link>
    );
  }

  // Priority 3: Pending activation
  const pendingActivation = orders.find((o: any) => ["delivered", "installed"].includes(o.status));
  if (pendingActivation) {
    return (
      <Link
        to={employeePath(`/orders/${pendingActivation.order_number ?? pendingActivation.id}`)}
        className="flex items-center justify-between px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-blue-400" />
          <div>
            <p className="text-xs font-semibold text-blue-300">Activation en attente</p>
            <p className="text-[10px] text-blue-400/60">Commande {pendingActivation.order_number}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-blue-400" />
      </Link>
    );
  }

  // Priority 4: Upcoming appointment
  const now = new Date();
  const upcoming = appointments.find((a: any) => new Date(a.scheduled_at) > now && ["confirmed", "scheduled", "pending"].includes(a.status));
  if (upcoming) {
    return (
      <Link
        to={employeePath(`/appointments/${upcoming.id}`)}
        className="flex items-center justify-between px-4 py-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-indigo-400" />
          <div>
            <p className="text-xs font-semibold text-indigo-300">Prochain rendez-vous</p>
            <p className="text-[10px] text-indigo-400/60">
              {new Date(upcoming.scheduled_at).toLocaleDateString("fr-CA")} à{" "}
              {new Date(upcoming.scheduled_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-indigo-400" />
      </Link>
    );
  }

  // All good
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
      <ShieldCheck className="h-5 w-5 text-emerald-400" />
      <p className="text-xs font-medium text-emerald-300">Aucune action urgente requise</p>
    </div>
  );
}
