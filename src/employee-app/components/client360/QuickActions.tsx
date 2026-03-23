/**
 * QuickActions — Service agent action toolbar.
 */
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import {
  MessageSquare, Plus, DollarSign, FileText, ShoppingCart, Zap,
  AlertTriangle, Key, Building2, Calendar, Send, Receipt, BookOpen, Briefcase,
  Tv,
} from "lucide-react";

interface Props {
  clientId: string;
  account: any | null;
  orders: any[];
  invoices: any[];
  subscriptions: any[];
  appointments: any[];
  tickets: any[];
  unpaidCount: number;
  onAddNote: () => void;
  onCreateTicket: () => void;
  onEscalation: () => void;
  onRecordPayment: () => void;
  onPinReset: () => void;
  onEscalationPreset: (category: string, subject: string, desc: string) => void;
}

export function QuickActions({
  clientId, account, orders, invoices, subscriptions, appointments, tickets,
  unpaidCount, onAddNote, onCreateTicket, onEscalation, onRecordPayment, onPinReset,
  onEscalationPreset,
}: Props) {
  const navigate = useNavigate();

  const ActionBtn = ({ icon: Icon, label, onClick, variant = "default" }: {
    icon: any; label: string; onClick: () => void; variant?: "default" | "primary" | "warning" | "success";
  }) => {
    const colors = {
      default: "border-[hsl(220,15%,15%)] text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30",
      primary: "border-blue-500/20 text-blue-300 hover:text-white hover:border-blue-500/40 bg-blue-500/5",
      warning: "border-amber-500/20 text-amber-400/70 hover:text-amber-400 hover:border-amber-500/30",
      success: "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 bg-emerald-500/5",
    };
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-[hsl(220,20%,8%)] text-[11px] font-medium transition-colors whitespace-nowrap ${colors[variant]}`}
      >
        <Icon className="h-3 w-3 shrink-0" /> {label}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,8%)] p-3">
      <p className="text-[10px] text-[hsl(220,10%,30%)] uppercase tracking-wider font-semibold mb-2">Actions rapides</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {unpaidCount > 0 && (
          <ActionBtn icon={DollarSign} label={`Paiement (${unpaidCount})`} onClick={onRecordPayment} variant="success" />
        )}
        {invoices.length > 0 && (
          <ActionBtn icon={FileText} label="Facture" onClick={() => navigate(employeePath(`/invoices/${invoices[0].id}`))} />
        )}
        {orders.length > 0 && (
          <ActionBtn icon={ShoppingCart} label="Commande" onClick={() => navigate(employeePath(`/orders/${orders[0].order_number ?? orders[0].id}`))} />
        )}
        {subscriptions.length > 0 && (
          <ActionBtn icon={Zap} label="Abonnement" onClick={() => navigate(employeePath(`/subscriptions/${subscriptions[0].id}`))} />
        )}
        {account?.id && (
          <ActionBtn icon={Building2} label="Compte" onClick={() => navigate(employeePath(`/accounts/${account.id}`))} variant="primary" />
        )}
        <ActionBtn icon={MessageSquare} label="Note" onClick={onAddNote} />
        <ActionBtn icon={Plus} label="Ticket" onClick={onCreateTicket} />
        {tickets.length > 0 && (
          <ActionBtn icon={Send} label="Répondre ticket" onClick={() => navigate(employeePath(`/support/${tickets[0].id}`))} />
        )}
        <ActionBtn icon={Calendar} label="Rendez-vous" onClick={() => {
          if (appointments.length > 0) navigate(employeePath(`/appointments/${appointments[0].id}`));
          else navigate(employeePath("/appointments"));
        }} />
        <ActionBtn icon={Key} label="NIP" onClick={onPinReset} variant="warning" />
        <ActionBtn icon={Briefcase} label="Ajout service" onClick={() => onEscalationPreset("add_service", "Ajout de service", "")} variant="warning" />
        <ActionBtn icon={Tv} label="Chaînes TV" onClick={() => onEscalationPreset("tv_channel_change", "Changement de chaînes TV", "")} variant="warning" />
        <ActionBtn icon={AlertTriangle} label="Escalation" onClick={onEscalation} variant="warning" />
      </div>
    </div>
  );
}
