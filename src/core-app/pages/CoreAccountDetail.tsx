/**
 * Nivra Core — Customer 360 Dossier
 * 3-column ops console: Left Nav | Center Content | Right Summary
 * Mirrors OrderProcessingWorkspace layout.
 */
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAccountProfile } from "@/core-app/hooks/useAccountProfile";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { corePath } from "@/core-app/lib/corePaths";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, RefreshCw, User, FileText, CreditCard, Repeat,
  ShoppingCart, Mail, Phone, MapPin, Calendar, Shield, Package,
  MessageSquare, Clock, Zap, PauseCircle, PlayCircle, StickyNote,
  ExternalLink, Activity, AlertTriangle, DollarSign, Hash, CircleDot,
  LayoutGrid,
} from "lucide-react";
import { InvoiceActionMenu } from "@/core-app/components/account-actions/InvoiceActions";
import { SubscriptionActionMenu } from "@/core-app/components/account-actions/SubscriptionActions";
import { EquipmentActionMenu } from "@/core-app/components/account-actions/EquipmentActions";
import { AccountActionMenu } from "@/core-app/components/account-actions/AccountQuickActions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* ── helpers ── */
const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actif", pending: "En attente", suspended: "Suspendu", cancelled: "Annulé",
  closed: "Fermé", open: "Ouvert", in_progress: "En cours", resolved: "Résolu",
  waiting_client: "Attente client", completed: "Terminé", confirmed: "Confirmé",
  scheduled: "Planifié", approved: "Approuvé", rejected: "Rejeté",
  pending_review: "En révision", submitted: "Soumis", manual_review: "Révision manuelle",
  paid: "Payé", overdue: "En souffrance", draft: "Brouillon", voided: "Annulée",
  installation_completed: "Installation terminée", activated: "Activé",
};
const label = (s: string | null | undefined) => STATUS_LABELS[s || ""] || s || "—";

/* ── Section definitions ── */
type SectionId = "overview" | "subscriptions" | "orders" | "invoices" | "payments" | "equipment" | "tickets" | "appointments" | "kyc" | "timeline";

const SECTIONS: { id: SectionId; label: string; icon: any }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutGrid },
  { id: "subscriptions", label: "Abonnements", icon: Repeat },
  { id: "orders", label: "Commandes", icon: ShoppingCart },
  { id: "invoices", label: "Factures", icon: FileText },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "equipment", label: "Équipements", icon: Package },
  { id: "tickets", label: "Tickets", icon: MessageSquare },
  { id: "appointments", label: "Rendez-vous", icon: Calendar },
  { id: "kyc", label: "KYC", icon: Shield },
  { id: "timeline", label: "Chronologie", icon: Activity },
];

/* ── Micro components ── */
const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] ${className}`}>{children}</div>
);

const PanelHeader = ({ icon: Icon, title, count, actions }: { icon: any; title: string; count?: number; actions?: React.ReactNode }) => (
  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-[11px] font-semibold text-white">{title}</span>
      {count != null && (
        <span className="text-[10px] text-[hsl(220,10%,50%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums font-medium ml-1">{count}</span>
      )}
    </div>
    {actions && <div className="flex items-center gap-1.5">{actions}</div>}
  </div>
);

const InfoLine = ({ label: l, value, mono, accent }: { label: string; value: React.ReactNode; mono?: boolean; accent?: boolean }) => (
  <div className="flex items-center justify-between py-1.5 px-3">
    <span className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wide">{l}</span>
    <span className={`text-[11px] text-right ${mono ? "font-mono" : ""} ${accent ? "text-emerald-400 font-medium" : "text-white"}`}>{value}</span>
  </div>
);

const MiniTable = ({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[hsl(220,15%,14%)]">
          {headers.map(h => (
            <th key={h} className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {empty ? (
          <tr><td colSpan={headers.length} className="text-center py-6 text-[hsl(220,10%,30%)] text-[11px]">Aucune donnée</td></tr>
        ) : children}
      </tbody>
    </table>
  </div>
);

const trClass = "border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors";

const QuickAction = ({ icon: Icon, label: l, onClick, variant = "default", loading }: {
  icon: any; label: string; onClick: () => void; variant?: "default" | "warning" | "success"; loading?: boolean;
}) => {
  const cls = {
    default: "text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/30",
    warning: "text-amber-400 hover:text-amber-300 hover:border-amber-500/40",
    success: "text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40",
  };
  return (
    <button onClick={onClick} disabled={loading} className={`flex items-center gap-1.5 w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2.5 py-1.5 text-[10px] font-medium transition-all disabled:opacity-40 ${cls[variant]}`}>
      <Icon className="h-3 w-3 shrink-0" /> {l}
    </button>
  );
};

/* ── Section Content Components ── */
const OverviewSection = ({ data, acct, prof, clientName, totalDue, unpaidInvoices, activeSubs, latestKyc, monthlyRevenue, totalPaid }: any) => (
  <div className="space-y-3">
    {/* Unpaid alert */}
    {unpaidInvoices.length > 0 && (
      <Panel className="border-red-500/30">
        <PanelHeader icon={AlertTriangle} title="Factures impayées" count={unpaidInvoices.length} />
        <MiniTable headers={["Facture", "Total", "Solde", "Échéance"]}>
          {unpaidInvoices.map((inv: any) => (
            <tr key={inv.id} className={trClass}>
              <td className="px-3 py-1.5"><Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-white hover:text-emerald-400 text-[11px]">{inv.invoice_number}</Link></td>
              <td className="px-3 py-1.5 tabular-nums text-white text-[11px]">{fmtCAD(inv.total)}</td>
              <td className="px-3 py-1.5 tabular-nums text-red-400 font-medium text-[11px]">{fmtCAD(inv.balance_due)}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(inv.due_date)}</td>
            </tr>
          ))}
        </MiniTable>
      </Panel>
    )}

    {/* Quick KPIs */}
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: "Abonnements actifs", value: activeSubs.length, accent: true },
        { label: "Commandes", value: data.orders.length },
        { label: "Solde impayé", value: fmtCAD(totalDue), alert: totalDue > 0 },
        { label: "Rev. mensuel", value: fmtCAD(monthlyRevenue), accent: true },
      ].map(k => (
        <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2.5">
          <p className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{k.label}</p>
          <p className={`text-base font-bold tabular-nums mt-0.5 ${k.alert ? "text-red-400" : k.accent ? "text-emerald-400" : "text-white"}`}>{k.value}</p>
        </div>
      ))}
    </div>

    {/* Recent subscriptions */}
    {activeSubs.length > 0 && (
      <Panel>
        <PanelHeader icon={Repeat} title="Abonnements actifs" count={activeSubs.length} />
        <MiniTable headers={["Plan", "Prix/mois", "Cycle", ""]}>
          {activeSubs.slice(0, 5).map((s: any) => (
            <tr key={s.id} className={trClass}>
              <td className="px-3 py-1.5">
                <p className="text-white font-medium text-[11px]">{s.plan_name}</p>
                <p className="text-[hsl(220,10%,40%)] text-[10px] font-mono">{s.plan_code}</p>
              </td>
              <td className="px-3 py-1.5 tabular-nums text-emerald-400 font-medium text-[11px]">{fmtCAD(s.plan_price)}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[10px]">{fmtDate(s.cycle_start_date)} → {fmtDate(s.cycle_end_date)}</td>
              <td className="px-3 py-1.5"><Link to={corePath(`/subscriptions/${s.id}`)} className="text-[hsl(220,10%,50%)] hover:text-emerald-400"><ExternalLink className="h-3 w-3" /></Link></td>
            </tr>
          ))}
        </MiniTable>
      </Panel>
    )}

    {/* Recent orders */}
    {data.orders.length > 0 && (
      <Panel>
        <PanelHeader icon={ShoppingCart} title="Dernières commandes" count={data.orders.length} />
        <MiniTable headers={["#", "Service", "Statut", "Total", "Date", ""]}>
          {data.orders.slice(0, 5).map((o: any) => (
            <tr key={o.id} className={trClass}>
              <td className="px-3 py-1.5 font-mono text-white text-[11px]">{o.order_number || "—"}</td>
              <td className="px-3 py-1.5 text-[hsl(220,10%,55%)] text-[11px]">{o.service_category || o.service_type || "—"}</td>
              <td className="px-3 py-1.5"><StatusBadge label={label(o.status)} variant={statusToVariant(o.status || "")} size="sm" /></td>
              <td className="px-3 py-1.5 tabular-nums text-[hsl(220,10%,70%)] text-[11px]">{fmtCAD(o.total_today ?? o.order_total)}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(o.created_at)}</td>
              <td className="px-3 py-1.5"><Link to={corePath(`/orders/${o.id}`)} className="text-[hsl(220,10%,50%)] hover:text-emerald-400"><ExternalLink className="h-3 w-3" /></Link></td>
            </tr>
          ))}
        </MiniTable>
      </Panel>
    )}
  </div>
);

const SubscriptionsSection = ({ data, customerId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={Repeat} title="Abonnements" count={data.subscriptions.length}
      actions={<SubscriptionActionMenu subscriptions={data.subscriptions} customerId={customerId} onRefresh={onRefresh} />} />
    <MiniTable headers={["Plan", "Cat.", "Prix/mois", "Statut", "Cycle", "Auto", ""]} empty={data.subscriptions.length === 0}>
      {data.subscriptions.map((s: any) => (
        <tr key={s.id} className={trClass}>
          <td className="px-3 py-1.5">
            <p className="text-white font-medium text-[11px]">{s.plan_name}</p>
            <p className="text-[hsl(220,10%,40%)] text-[10px] font-mono">{s.plan_code}</p>
          </td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,55%)] text-[11px]">{s.service_category || "—"}</td>
          <td className="px-3 py-1.5 tabular-nums text-emerald-400 font-medium text-[11px]">{fmtCAD(s.plan_price)}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(s.status)} variant={statusToVariant(s.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[10px]">{fmtDate(s.cycle_start_date)} → {fmtDate(s.cycle_end_date)}</td>
          <td className="px-3 py-1.5">{s.auto_billing_enabled ? <Zap className="h-3 w-3 text-emerald-400" /> : <span className="text-[hsl(220,10%,25%)] text-[10px]">—</span>}</td>
          <td className="px-3 py-1.5"><Link to={corePath(`/subscriptions/${s.id}`)} className="text-[hsl(220,10%,50%)] hover:text-emerald-400"><ExternalLink className="h-3 w-3" /></Link></td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

const OrdersSection = ({ data }: any) => (
  <Panel>
    <PanelHeader icon={ShoppingCart} title="Commandes" count={data.orders.length} />
    <MiniTable headers={["#", "Service", "Statut", "Total", "Paiement", "Date", ""]} empty={data.orders.length === 0}>
      {data.orders.slice(0, 50).map((o: any) => (
        <tr key={o.id} className={trClass}>
          <td className="px-3 py-1.5 font-mono text-white text-[11px]">{o.order_number || "—"}</td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,55%)] text-[11px]">{o.service_category || o.service_type || "—"}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(o.status)} variant={statusToVariant(o.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 tabular-nums text-[hsl(220,10%,70%)] text-[11px]">{fmtCAD(o.total_today ?? o.order_total)}</td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,45%)] text-[11px]">{label(o.payment_status)}</td>
          <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(o.created_at)}</td>
          <td className="px-3 py-1.5"><Link to={corePath(`/orders/${o.id}`)} className="text-[hsl(220,10%,50%)] hover:text-emerald-400"><ExternalLink className="h-3 w-3" /></Link></td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

const InvoicesSection = ({ data, customerId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={FileText} title="Historique des factures" count={data.invoices.length}
      actions={<InvoiceActionMenu invoices={data.invoices} customerId={customerId} clientId={data.clientId} accountId={undefined} onRefresh={onRefresh} />} />
    <MiniTable headers={["Facture", "Type", "Total", "Payé", "Solde", "Statut", "Échéance"]} empty={data.invoices.length === 0}>
      {data.invoices.slice(0, 50).map((inv: any) => (
        <tr key={inv.id} className={trClass}>
          <td className="px-3 py-1.5"><Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-white hover:text-emerald-400 text-[11px]">{inv.invoice_number}</Link></td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,45%)] text-[11px] capitalize">{inv.type}</td>
          <td className="px-3 py-1.5 tabular-nums text-white text-[11px]">{fmtCAD(inv.total)}</td>
          <td className="px-3 py-1.5 tabular-nums text-emerald-400 text-[11px]">{fmtCAD(inv.amount_paid)}</td>
          <td className="px-3 py-1.5"><span className={`tabular-nums text-[11px] font-medium ${(inv.balance_due ?? 0) > 0 ? "text-red-400" : "text-[hsl(220,10%,35%)]"}`}>{fmtCAD(inv.balance_due)}</span></td>
          <td className="px-3 py-1.5"><StatusBadge label={label(inv.status)} variant={statusToVariant(inv.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(inv.due_date)}</td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

const PaymentsSection = ({ data, customerId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={CreditCard} title="Paiements" count={data.payments.length}
      actions={<InvoiceActionMenu invoices={data.invoices} customerId={customerId} clientId={data.clientId} accountId={undefined} onRefresh={onRefresh} />} />
    <MiniTable headers={["#", "Montant", "Méthode", "Statut", "Réf.", "Reçu le"]} empty={data.payments.length === 0}>
      {data.payments.slice(0, 50).map((p: any) => (
        <tr key={p.id} className={trClass}>
          <td className="px-3 py-1.5 font-mono text-white text-[11px]">{p.payment_number || "—"}</td>
          <td className="px-3 py-1.5 tabular-nums text-emerald-400 font-medium text-[11px]">{fmtCAD(p.amount)}</td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,55%)] text-[11px] capitalize">{p.method}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(p.status)} variant={statusToVariant(p.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 font-mono text-[hsl(220,10%,40%)] text-[10px]">{p.reference || "—"}</td>
          <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(p.received_at)}</td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

const EquipmentSection = ({ data, accountId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={Package} title="Équipements" count={data.equipment.length}
      actions={<EquipmentActionMenu equipment={data.equipment} accountId={accountId} clientId={data.clientId} orders={data.orders} onRefresh={onRefresh} />} />
    <MiniTable headers={["Article", "SKU", "Qté", "Prix", "Total", "S/N"]} empty={data.equipment.length === 0}>
      {data.equipment.map((eq: any) => (
        <tr key={eq.id} className={trClass}>
          <td className="px-3 py-1.5 text-white text-[11px]">{eq.item_name}</td>
          <td className="px-3 py-1.5 font-mono text-[hsl(220,10%,40%)] text-[10px]">{eq.item_sku || "—"}</td>
          <td className="px-3 py-1.5 tabular-nums text-white text-[11px]">{eq.quantity}</td>
          <td className="px-3 py-1.5 tabular-nums text-[hsl(220,10%,55%)] text-[11px]">{fmtCAD(eq.unit_price)}</td>
          <td className="px-3 py-1.5 tabular-nums text-white text-[11px]">{fmtCAD(eq.line_total)}</td>
          <td className="px-3 py-1.5 font-mono text-[hsl(220,10%,40%)] text-[10px] max-w-[120px] truncate">
            {eq.serial_numbers ? (Array.isArray(eq.serial_numbers) ? (eq.serial_numbers as string[]).join(", ") : JSON.stringify(eq.serial_numbers)) : "—"}
          </td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

const TicketsSection = ({ data, clientId, clientEmail, clientName, accountId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={MessageSquare} title="Tickets de support" count={data.tickets.length}
      actions={<AccountActionMenu clientId={clientId} clientEmail={clientEmail} clientName={clientName} accountId={accountId} onRefresh={onRefresh} />} />
    <MiniTable headers={["#", "Sujet", "Cat.", "Statut", "Créé le"]} empty={data.tickets.length === 0}>
      {data.tickets.slice(0, 30).map((t: any) => (
        <tr key={t.id} className={trClass}>
          <td className="px-3 py-1.5 font-mono text-white text-[11px]">{t.ticket_number || "—"}</td>
          <td className="px-3 py-1.5 text-white max-w-[180px] truncate text-[11px]">{t.subject || t.title || "—"}</td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,55%)] text-[11px]">{t.category || "—"}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(t.status)} variant={statusToVariant(t.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(t.created_at)}</td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

const AppointmentsSection = ({ data, clientId, clientEmail, clientName, accountId, onRefresh }: any) => (
  <Panel>
    <PanelHeader icon={Calendar} title="Rendez-vous" count={data.appointments.length}
      actions={<AccountActionMenu clientId={clientId} clientEmail={clientEmail} clientName={clientName} accountId={accountId} onRefresh={onRefresh} />} />
    <MiniTable headers={["#", "Titre", "Type", "Statut", "Date", "Adresse"]} empty={data.appointments.length === 0}>
      {data.appointments.map((a: any) => (
        <tr key={a.id} className={trClass}>
          <td className="px-3 py-1.5 font-mono text-[hsl(220,10%,55%)] text-[10px]">{a.appointment_number || "—"}</td>
          <td className="px-3 py-1.5 text-white text-[11px]">{a.title}</td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,55%)] text-[11px]">{a.service_type || a.installation_method || "—"}</td>
          <td className="px-3 py-1.5"><StatusBadge label={label(a.status)} variant={statusToVariant(a.status || "")} size="sm" /></td>
          <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDateTime(a.scheduled_at)}</td>
          <td className="px-3 py-1.5 text-[hsl(220,10%,45%)] text-[11px] max-w-[140px] truncate">{a.service_address || "—"}</td>
        </tr>
      ))}
    </MiniTable>
  </Panel>
);

const KycSection = ({ data }: any) => (
  <Panel>
    <PanelHeader icon={Shield} title="Vérification KYC" count={data.kycSessions.length} />
    {data.kycSessions.length === 0 ? (
      <div className="px-3 py-6 text-center text-[hsl(220,10%,30%)] text-[11px]">Aucune session KYC</div>
    ) : (
      <MiniTable headers={["#", "Statut", "Document", "Soumis", "Révisé"]}>
        {data.kycSessions.map((k: any) => (
          <tr key={k.id} className={trClass}>
            <td className="px-3 py-1.5 font-mono text-[hsl(220,10%,55%)] text-[10px]">{k.case_number || k.id.slice(0, 8)}</td>
            <td className="px-3 py-1.5"><StatusBadge label={label(k.status)} variant={statusToVariant(k.status || "")} size="sm" /></td>
            <td className="px-3 py-1.5 text-[hsl(220,10%,55%)] text-[11px]">{k.document_type || "—"}</td>
            <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(k.submitted_at)}</td>
            <td className="px-3 py-1.5 whitespace-nowrap text-[hsl(220,10%,45%)] text-[11px]">{fmtDate(k.reviewed_at)}</td>
          </tr>
        ))}
      </MiniTable>
    )}
  </Panel>
);

const TimelineSection = ({ data }: any) => (
  <Panel>
    <PanelHeader icon={Activity} title="Chronologie" count={data.activityLogs.length} />
    {data.activityLogs.length === 0 ? (
      <div className="px-3 py-6 text-center text-[hsl(220,10%,30%)] text-[11px]">Aucune activité</div>
    ) : (
      <div className="divide-y divide-[hsl(220,15%,14%)] max-h-[600px] overflow-y-auto">
        {data.activityLogs.slice(0, 50).map((log: any) => (
          <div key={log.id} className="px-3 py-2 hover:bg-[hsl(220,20%,13%)] transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white leading-snug">{log.summary}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-[hsl(220,10%,35%)]">
                  <span className="capitalize">{log.action_type?.replace(/_/g, " ")}</span>
                  {log.actor_name && <span>· {log.actor_name}</span>}
                </div>
              </div>
              <span className="text-[9px] text-[hsl(220,10%,30%)] whitespace-nowrap shrink-0">{fmtDateTime(log.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </Panel>
);

/* ── Main ── */
const CoreAccountDetail = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const data = useAccountProfile(accountId);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[hsl(220,10%,40%)]" />
      </div>
    );
  }

  if (data.accountError) {
    return (
      <div className="py-16 text-center space-y-2">
        <AlertTriangle className="h-6 w-6 mx-auto text-red-400/60" />
        <p className="text-red-400 text-xs font-medium">Erreur de chargement</p>
        <p className="text-[hsl(220,10%,40%)] text-[11px] max-w-sm mx-auto">{(data.accountError as any)?.message || "Vérifiez votre session."}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 transition-colors">Réessayer</button>
          <Link to={corePath("/accounts")} className="text-emerald-400 text-[11px] hover:underline">← Comptes</Link>
        </div>
      </div>
    );
  }

  if (!data.account) {
    return (
      <div className="py-16 text-center space-y-2">
        <User className="h-6 w-6 mx-auto text-[hsl(220,10%,30%)]" />
        <p className="text-[hsl(220,10%,45%)] text-xs">Compte introuvable</p>
        <p className="text-[hsl(220,10%,30%)] text-[10px] font-mono">{accountId}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-md border border-[hsl(220,15%,16%)] px-3 py-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">Réessayer</button>
          <Link to={corePath("/accounts")} className="text-emerald-400 text-[11px] hover:underline">← Comptes</Link>
        </div>
      </div>
    );
  }

  const acct = data.account;
  const prof = data.profile;
  const totalDue = data.invoices.reduce((sum, inv: any) => sum + (inv.balance_due ?? 0), 0);
  const unpaidInvoices = data.invoices.filter((inv: any) => (inv.balance_due ?? 0) > 0);
  const activeSubs = data.subscriptions.filter((s: any) => s.status === "active");
  const latestKyc = data.kycSessions[0];
  const clientName = prof ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || "Client" : "Client";
  const totalPaid = data.payments.reduce((s, p: any) => s + (p.amount ?? 0), 0);
  const monthlyRevenue = activeSubs.reduce((s, sub: any) => s + (sub.plan_price ?? 0), 0);

  const updateAccountStatus = async (newStatus: string) => {
    if (!accountId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("accounts").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", accountId);
      if (error) throw error;
      toast.success(`Compte ${newStatus === "suspended" ? "suspendu" : "réactivé"}`);
      data.refetch();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setActionLoading(false); }
  };

  const addNote = async () => {
    if (!noteText.trim() || !data.clientId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from("client_activity_logs").insert({
        client_id: data.clientId,
        actor_user_id: (await supabase.auth.getUser()).data.user?.id || "unknown",
        action_type: "internal_note", summary: noteText.trim(),
        entity_type: "account", entity_id: accountId,
      });
      if (error) throw error;
      toast.success("Note ajoutée");
      setNoteText(""); setShowNoteInput(false); data.refetch();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setActionLoading(false); }
  };

  /* Section badge counts */
  const sectionCounts: Partial<Record<SectionId, number>> = {
    subscriptions: data.subscriptions.length,
    orders: data.orders.length,
    invoices: data.invoices.length,
    payments: data.payments.length,
    equipment: data.equipment.length,
    tickets: data.tickets.length,
    appointments: data.appointments.length,
    kyc: data.kycSessions.length,
    timeline: data.activityLogs.length,
  };

  const renderSection = () => {
    const baseProps = { data, acct, prof, clientName, totalDue, unpaidInvoices, activeSubs, latestKyc, monthlyRevenue, totalPaid };
    const actionProps = { customerId: data.customerId, clientId: data.clientId, clientEmail: prof?.email, clientName, accountId, onRefresh: data.refetch };
    switch (activeSection) {
      case "overview": return <OverviewSection {...baseProps} />;
      case "subscriptions": return <SubscriptionsSection data={data} customerId={data.customerId} onRefresh={data.refetch} />;
      case "orders": return <OrdersSection data={data} />;
      case "invoices": return <InvoicesSection data={data} customerId={data.customerId} onRefresh={data.refetch} />;
      case "payments": return <PaymentsSection data={data} customerId={data.customerId} onRefresh={data.refetch} />;
      case "equipment": return <EquipmentSection data={data} accountId={accountId} onRefresh={data.refetch} />;
      case "tickets": return <TicketsSection data={data} {...actionProps} />;
      case "appointments": return <AppointmentsSection data={data} {...actionProps} />;
      case "kyc": return <KycSection data={data} />;
      case "timeline": return <TimelineSection data={data} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <Link to={corePath("/accounts")} className="flex items-center gap-1 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
          <ArrowLeft className="h-3 w-3" /> Comptes
        </Link>
        <button onClick={() => data.refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* ── Header strip ── */}
      <Panel className="p-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight truncate">{clientName}</h1>
              <StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[10px] text-[hsl(220,10%,45%)]">
              <span className="flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{acct.account_number}</span>
              {prof?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prof.email}</span>}
              {prof?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prof.phone}</span>}
              {acct.primary_service_city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{acct.primary_service_city}</span>}
            </div>
          </div>
        </div>
      </Panel>

      {/* ── 3-column layout: Nav | Content | Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-3">

        {/* LEFT: Section Navigation */}
        <Panel className="p-0 self-start lg:sticky lg:top-4">
          <div className="px-3 py-2.5 border-b border-[hsl(220,15%,14%)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">Navigation</span>
          </div>
          <nav className="py-1">
            {SECTIONS.map(s => {
              const isActive = activeSection === s.id;
              const count = sectionCounts[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] font-medium transition-colors ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400"
                      : "text-[hsl(220,10%,50%)] hover:text-white hover:bg-[hsl(220,20%,13%)] border-l-2 border-transparent"
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left truncate">{s.label}</span>
                  {count != null && count > 0 && (
                    <span className={`text-[9px] tabular-nums px-1.5 py-0.5 rounded-full font-medium ${
                      isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-[hsl(220,15%,14%)] text-[hsl(220,10%,45%)]"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </Panel>

        {/* CENTER: Active Section Content */}
        <div className="min-h-[500px] min-w-0">
          {renderSection()}
        </div>

        {/* RIGHT: Summary & Actions */}
        <div className="space-y-3 self-start lg:sticky lg:top-4">
          {/* Account info */}
          <Panel>
            <PanelHeader icon={CircleDot} title="Compte" />
            <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
              <InfoLine label="Numéro" value={acct.account_number} mono accent />
              <InfoLine label="Statut" value={<StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />} />
              <InfoLine label="Classe crédit" value={acct.credit_class || "C"} />
              <InfoLine label="Créé le" value={fmtDate(acct.created_at)} />
            </div>
          </Panel>

          {/* Billing cycle */}
          <Panel>
            <PanelHeader icon={Clock} title="Facturation" />
            <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
              <InfoLine label="Jour de cycle" value={acct.billing_cycle_day ?? "—"} accent />
              <InfoLine label="Prochaine facture" value={fmtDate(acct.next_invoice_date)} accent />
              <InfoLine label="Date d'ancrage" value={fmtDate(acct.billing_anchor_date)} />
            </div>
          </Panel>

          {/* Financial summary */}
          <Panel>
            <PanelHeader icon={DollarSign} title="Résumé financier" />
            <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
              <InfoLine label="Solde impayé" value={fmtCAD(totalDue)} accent={totalDue <= 0} />
              <InfoLine label="Total payé" value={fmtCAD(totalPaid)} />
              <InfoLine label="Rev. mensuel" value={fmtCAD(monthlyRevenue)} accent />
              <InfoLine label="Factures" value={data.invoices.length} />
            </div>
          </Panel>

          {/* Identity */}
          <Panel>
            <PanelHeader icon={User} title="Identité" />
            <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
              <InfoLine label="Nom" value={clientName} />
              <InfoLine label="Courriel" value={prof?.email || "—"} />
              <InfoLine label="Téléphone" value={prof?.phone || "—"} />
              <InfoLine label="Adresse service" value={[acct.primary_service_address, acct.primary_service_city].filter(Boolean).join(", ") || "—"} />
              <InfoLine label="Adresse facturation" value={[acct.billing_address, acct.billing_city].filter(Boolean).join(", ") || "—"} />
            </div>
          </Panel>

          {/* KYC */}
          <Panel>
            <PanelHeader icon={Shield} title="KYC" />
            <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
              <InfoLine label="Statut" value={
                latestKyc
                  ? <StatusBadge label={label(latestKyc.status)} variant={statusToVariant(latestKyc.status)} size="sm" />
                  : <span className="text-[hsl(220,10%,30%)] text-[10px]">Non vérifié</span>
              } />
              {latestKyc && (
                <>
                  <InfoLine label="Document" value={latestKyc.document_type || "—"} />
                  <InfoLine label="Soumis" value={fmtDate(latestKyc.submitted_at)} />
                  <InfoLine label="Révisé" value={fmtDate(latestKyc.reviewed_at)} />
                </>
              )}
            </div>
          </Panel>

          {/* Quick actions */}
          <Panel>
            <PanelHeader icon={Zap} title="Actions rapides" />
            <div className="p-2 space-y-1.5">
              {acct.status !== "suspended" ? (
                <QuickAction icon={PauseCircle} label="Suspendre le compte" onClick={() => updateAccountStatus("suspended")} variant="warning" loading={actionLoading} />
              ) : (
                <QuickAction icon={PlayCircle} label="Réactiver le compte" onClick={() => updateAccountStatus("active")} variant="success" loading={actionLoading} />
              )}
              <QuickAction icon={StickyNote} label="Ajouter une note interne" onClick={() => setShowNoteInput(!showNoteInput)} />
              <QuickAction icon={CreditCard} label="Gérer facturation" onClick={() => setActiveSection("invoices")} />
              <QuickAction icon={Repeat} label="Gérer abonnements" onClick={() => setActiveSection("subscriptions")} />
              <QuickAction icon={Package} label="Équipements" onClick={() => setActiveSection("equipment")} />
              <QuickAction icon={MessageSquare} label="Tickets" onClick={() => setActiveSection("tickets")} />
              {data.orders[0] && (
                <QuickAction icon={ShoppingCart} label="Dernière commande" onClick={() => navigate(corePath(`/orders/${data.orders[0].id}`))} />
              )}
            </div>
            {showNoteInput && (
              <div className="px-2 pb-2 space-y-1.5">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Note interne…"
                  rows={2}
                  className="w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50 resize-none"
                />
                <button onClick={addNote} disabled={actionLoading || !noteText.trim()} className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                  Enregistrer la note
                </button>
              </div>
            )}
          </Panel>

          {/* Operational shortcuts */}
          <Panel>
            <PanelHeader icon={Mail} title="Communication" />
            <div className="p-2">
              <AccountActionMenu
                clientId={data.clientId}
                clientEmail={prof?.email}
                clientName={clientName}
                accountId={accountId}
                onRefresh={data.refetch}
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default CoreAccountDetail;
