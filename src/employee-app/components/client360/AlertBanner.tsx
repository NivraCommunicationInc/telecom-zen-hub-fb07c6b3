/**
 * AlertBanner — Shows urgent client alerts for service agents.
 */
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, Calendar, ShieldAlert, CreditCard, Zap } from "lucide-react";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Alert {
  type: "overdue" | "suspended" | "appointment" | "blocked" | "ticket" | "nip_bypass";
  label: string;
  link?: string;
  severity: "critical" | "warning" | "info";
}

interface Props {
  invoices: any[];
  subscriptions: any[];
  appointments: any[];
  tickets: any[];
  orders: any[];
  recentAudit: any[];
}

const ICONS = {
  overdue: CreditCard,
  suspended: Zap,
  appointment: Calendar,
  blocked: AlertTriangle,
  ticket: ShieldAlert,
  nip_bypass: ShieldAlert,
};

const SEVERITY_COLORS = {
  critical: "border-red-500/30 bg-red-500/5 text-red-400",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  info: "border-blue-500/30 bg-blue-500/5 text-blue-400",
};

export function AlertBanner({ invoices, subscriptions, appointments, tickets, orders, recentAudit }: Props) {
  const alerts: Alert[] = [];

  // Overdue invoices
  const overdueInvoices = invoices.filter((i: any) => i.status === "overdue" || (i.balance_due > 0 && new Date(i.due_date) < new Date()));
  if (overdueInvoices.length > 0) {
    alerts.push({
      type: "overdue",
      label: `${overdueInvoices.length} facture${overdueInvoices.length > 1 ? "s" : ""} en retard`,
      link: overdueInvoices[0]?.id ? employeePath(`/invoices/${overdueInvoices[0].id}`) : undefined,
      severity: "critical",
    });
  }

  // Suspended services
  const suspended = subscriptions.filter((s: any) => s.status === "suspended");
  if (suspended.length > 0) {
    alerts.push({
      type: "suspended",
      label: `${suspended.length} service${suspended.length > 1 ? "s" : ""} suspendu${suspended.length > 1 ? "s" : ""}`,
      link: suspended[0]?.id ? employeePath(`/subscriptions/${suspended[0].id}`) : undefined,
      severity: "critical",
    });
  }

  // Upcoming appointment today
  const now = new Date();
  const todayAppts = appointments.filter((a: any) => {
    const d = new Date(a.scheduled_at);
    return d.toDateString() === now.toDateString() && ["confirmed", "scheduled", "pending"].includes(a.status);
  });
  if (todayAppts.length > 0) {
    alerts.push({
      type: "appointment",
      label: `Rendez-vous aujourd'hui à ${new Date(todayAppts[0].scheduled_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`,
      link: todayAppts[0]?.id ? employeePath(`/appointments/${todayAppts[0].id}`) : undefined,
      severity: "info",
    });
  }

  // Blocked activations
  const blocked = orders.filter((o: any) => ["on_hold", "invalid_payment", "provisioning_failed", "fraud"].includes(o.status));
  if (blocked.length > 0) {
    alerts.push({
      type: "blocked",
      label: `${blocked.length} commande${blocked.length > 1 ? "s" : ""} bloquée${blocked.length > 1 ? "s" : ""}`,
      link: blocked[0]?.order_number ? employeePath(`/orders/${blocked[0].order_number}`) : undefined,
      severity: "warning",
    });
  }

  // Urgent tickets
  const urgentTickets = tickets.filter((t: any) => t.priority === "urgent" && t.status !== "resolved" && t.status !== "closed");
  if (urgentTickets.length > 0) {
    alerts.push({
      type: "ticket",
      label: `${urgentTickets.length} ticket${urgentTickets.length > 1 ? "s" : ""} urgent${urgentTickets.length > 1 ? "s" : ""}`,
      link: urgentTickets[0]?.id ? employeePath(`/support/${urgentTickets[0].id}`) : undefined,
      severity: "warning",
    });
  }

  // Recent NIP bypass
  const nipBypass = recentAudit.filter((a: any) =>
    a.action?.includes("nip_bypass") || a.action?.includes("pin_reset")
  );
  if (nipBypass.length > 0) {
    alerts.push({
      type: "nip_bypass",
      label: `NIP contourné/réinitialisé récemment (${formatDistanceToNow(new Date(nipBypass[0].created_at), { addSuffix: true, locale: fr })})`,
      severity: "warning",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {alerts.map((alert, i) => {
        const Icon = ICONS[alert.type];
        const content = (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${SEVERITY_COLORS[alert.severity]}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{alert.label}</span>
          </div>
        );
        return alert.link ? (
          <Link key={i} to={alert.link} className="block hover:opacity-80 transition-opacity">
            {content}
          </Link>
        ) : (
          <div key={i}>{content}</div>
        );
      })}
    </div>
  );
}
