/**
 * Nivra Core — Customer 360 Dossier (premium ops-grade)
 * Two-column telecom CRM layout with dense operational panels.
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
  ExternalLink, ChevronDown, ChevronRight, Activity, AlertTriangle,
  DollarSign, Hash, CircleDot, Wrench,
} from "lucide-react";
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
  pending_review: "En révision", submitted: "Soumis",
  paid: "Payé", overdue: "En souffrance", draft: "Brouillon", voided: "Annulée",
  installation_completed: "Installation terminée", activated: "Activé",
};
const label = (s: string | null | undefined) => STATUS_LABELS[s || ""] || s || "—";

/* ── Micro components ── */
const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-border/60 bg-card ${className}`}>{children}</div>
);

const PanelHeader = ({ icon: Icon, title, count, action }: {
  icon: any; title: string; count?: number; action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-[11px] font-semibold text-foreground">{title}</span>
      {count != null && (
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full tabular-nums font-medium ml-1">{count}</span>
      )}
    </div>
    {action}
  </div>
);

const CollapsibleSection = ({ icon: Icon, title, count, defaultOpen = true, children }: {
  icon: any; title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Panel>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-3 py-2 border-b border-border/40 group">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors">{title}</span>
          {count != null && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full tabular-nums font-medium ml-1">{count}</span>
          )}
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && children}
    </Panel>
  );
};

const InfoLine = ({ label: l, value, mono, accent }: { label: string; value: React.ReactNode; mono?: boolean; accent?: boolean }) => (
  <div className="flex items-center justify-between py-1 px-3">
    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</span>
    <span className={`text-[11px] text-right ${mono ? "font-mono" : ""} ${accent ? "text-primary font-medium" : "text-foreground"}`}>{value}</span>
  </div>
);

const MiniTable = ({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/30">
          {headers.map(h => (
            <th key={h} className="text-left px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {empty ? (
          <tr><td colSpan={headers.length} className="text-center py-4 text-muted-foreground/40 text-[11px]">Aucune donnée</td></tr>
        ) : children}
      </tbody>
    </table>
  </div>
);

const trClass = "border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors";

const KpiChip = ({ label: l, value, accent, alert }: { label: string; value: string | number; accent?: boolean; alert?: boolean }) => (
  <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-md bg-muted/30 border border-border/30 min-w-[72px]">
    <span className={`text-sm font-bold tabular-nums leading-tight ${alert ? "text-destructive" : accent ? "text-primary" : "text-foreground"}`}>{value}</span>
    <span className="text-[8px] uppercase tracking-widest text-muted-foreground/60 font-medium mt-0.5">{l}</span>
  </div>
);

const QuickAction = ({ icon: Icon, label: l, onClick, variant = "default", loading }: {
  icon: any; label: string; onClick: () => void; variant?: "default" | "warning" | "success"; loading?: boolean;
}) => {
  const cls = {
    default: "text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5",
    warning: "text-amber-400 hover:text-amber-300 hover:border-amber-500/40 hover:bg-amber-500/5",
    success: "text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/5",
  };
  return (
    <button onClick={onClick} disabled={loading} className={`flex items-center gap-1.5 w-full rounded-md border border-border/40 bg-card px-2.5 py-1.5 text-[10px] font-medium transition-all disabled:opacity-40 ${cls[variant]}`}>
      <Icon className="h-3 w-3 shrink-0" /> {l}
    </button>
  );
};

/* ── Main ── */
const CoreAccountDetail = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const data = useAccountProfile(accountId);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.accountError) {
    return (
      <div className="py-16 text-center space-y-2">
        <AlertTriangle className="h-6 w-6 mx-auto text-destructive/60" />
        <p className="text-destructive text-xs font-medium">Erreur de chargement</p>
        <p className="text-muted-foreground text-[11px] max-w-sm mx-auto">{(data.accountError as any)?.message || "Vérifiez votre session."}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-md bg-primary px-4 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Réessayer</button>
          <Link to={corePath("/accounts")} className="text-primary text-[11px] hover:underline">← Comptes</Link>
        </div>
      </div>
    );
  }

  if (!data.account) {
    return (
      <div className="py-16 text-center space-y-2">
        <User className="h-6 w-6 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground text-xs">Compte introuvable</p>
        <p className="text-muted-foreground/40 text-[10px] font-mono">{accountId}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-md border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">Réessayer</button>
          <Link to={corePath("/accounts")} className="text-primary text-[11px] hover:underline">← Comptes</Link>
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

  const totalPaid = data.payments.reduce((s, p: any) => s + (p.amount ?? 0), 0);
  const monthlyRevenue = activeSubs.reduce((s, sub: any) => s + (sub.plan_price ?? 0), 0);

  return (
    <div className="space-y-3">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <Link to={corePath("/accounts")} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Comptes
        </Link>
        <button onClick={() => data.refetch()} className="flex items-center gap-1 rounded-md border border-border/50 bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          <RefreshCw className="h-3 w-3" /> Actualiser
        </button>
      </div>

      {/* ── Header strip ── */}
      <Panel className="p-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground tracking-tight truncate">{clientName}</h1>
              <StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{acct.account_number}</span>
              {prof?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prof.email}</span>}
              {prof?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prof.phone}</span>}
              {acct.primary_service_city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{acct.primary_service_city}</span>}
            </div>
          </div>
        </div>
        {/* KPI strip */}
        <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto">
          <KpiChip label="Abonnements" value={activeSubs.length} accent />
          <KpiChip label="Commandes" value={data.orders.length} />
          <KpiChip label="Factures" value={data.invoices.length} />
          <KpiChip label="Impayées" value={unpaidInvoices.length} alert={unpaidInvoices.length > 0} />
          <KpiChip label="Paiements" value={data.payments.length} />
          <KpiChip label="Solde dû" value={fmtCAD(totalDue)} alert={totalDue > 0} />
          <KpiChip label="Rev. mensuel" value={fmtCAD(monthlyRevenue)} accent />
        </div>
      </Panel>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
        {/* LEFT — operational data */}
        <div className="space-y-3 min-w-0">
          {/* Unpaid alert */}
          {unpaidInvoices.length > 0 && (
            <Panel className="border-destructive/30 bg-destructive/5">
              <PanelHeader icon={AlertTriangle} title="Factures impayées" count={unpaidInvoices.length} />
              <MiniTable headers={["Facture", "Total", "Solde", "Échéance"]} >
                {unpaidInvoices.map((inv: any) => (
                  <tr key={inv.id} className={trClass}>
                    <td className="px-3 py-1.5"><Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-foreground hover:text-primary text-[11px]">{inv.invoice_number}</Link></td>
                    <td className="px-3 py-1.5 tabular-nums text-foreground text-[11px]">{fmtCAD(inv.total)}</td>
                    <td className="px-3 py-1.5 tabular-nums text-destructive font-medium text-[11px]">{fmtCAD(inv.balance_due)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-[11px]">{fmtDate(inv.due_date)}</td>
                  </tr>
                ))}
              </MiniTable>
            </Panel>
          )}

          {/* Subscriptions */}
          <CollapsibleSection icon={Repeat} title="Abonnements" count={data.subscriptions.length}>
            <MiniTable headers={["Plan", "Cat.", "Prix/mois", "Statut", "Cycle", "Auto", ""]} empty={data.subscriptions.length === 0}>
              {data.subscriptions.map((s: any) => (
                <tr key={s.id} className={trClass}>
                  <td className="px-3 py-1.5">
                    <p className="text-foreground font-medium text-[11px]">{s.plan_name}</p>
                    <p className="text-muted-foreground text-[10px] font-mono">{s.plan_code}</p>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px]">{s.service_category || "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums text-primary font-medium text-[11px]">{fmtCAD(s.plan_price)}</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(s.status)} variant={statusToVariant(s.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-[10px]">{fmtDate(s.cycle_start_date)} → {fmtDate(s.cycle_end_date)}</td>
                  <td className="px-3 py-1.5">
                    {s.auto_billing_enabled ? <Zap className="h-3 w-3 text-primary" /> : <span className="text-muted-foreground/30 text-[10px]">—</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    <Link to={corePath(`/subscriptions/${s.id}`)} className="text-primary/70 hover:text-primary"><ExternalLink className="h-3 w-3" /></Link>
                  </td>
                </tr>
              ))}
            </MiniTable>
          </CollapsibleSection>

          {/* Orders */}
          <CollapsibleSection icon={ShoppingCart} title="Commandes" count={data.orders.length}>
            <MiniTable headers={["#", "Service", "Statut", "Total", "Paiement", "Date", ""]} empty={data.orders.length === 0}>
              {data.orders.slice(0, 25).map((o: any) => (
                <tr key={o.id} className={trClass}>
                  <td className="px-3 py-1.5 font-mono text-foreground text-[11px]">{o.order_number || "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px]">{o.service_category || o.service_type || "—"}</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(o.status)} variant={statusToVariant(o.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 tabular-nums text-foreground text-[11px]">{fmtCAD(o.total_today ?? o.order_total)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px]">{label(o.payment_status)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-[11px]">{fmtDate(o.created_at)}</td>
                  <td className="px-3 py-1.5"><Link to={corePath(`/orders/${o.id}`)} className="text-primary/70 hover:text-primary"><ExternalLink className="h-3 w-3" /></Link></td>
                </tr>
              ))}
            </MiniTable>
          </CollapsibleSection>

          {/* Invoice History */}
          <CollapsibleSection icon={FileText} title="Historique des factures" count={data.invoices.length} defaultOpen={false}>
            <MiniTable headers={["Facture", "Type", "Total", "Payé", "Solde", "Statut", "Échéance"]} empty={data.invoices.length === 0}>
              {data.invoices.slice(0, 30).map((inv: any) => (
                <tr key={inv.id} className={trClass}>
                  <td className="px-3 py-1.5"><Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-foreground hover:text-primary text-[11px]">{inv.invoice_number}</Link></td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px] capitalize">{inv.type}</td>
                  <td className="px-3 py-1.5 tabular-nums text-foreground text-[11px]">{fmtCAD(inv.total)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-primary text-[11px]">{fmtCAD(inv.amount_paid)}</td>
                  <td className="px-3 py-1.5"><span className={`tabular-nums text-[11px] font-medium ${(inv.balance_due ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`}>{fmtCAD(inv.balance_due)}</span></td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(inv.status)} variant={statusToVariant(inv.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-[11px]">{fmtDate(inv.due_date)}</td>
                </tr>
              ))}
            </MiniTable>
          </CollapsibleSection>

          {/* Payments */}
          <CollapsibleSection icon={CreditCard} title="Paiements" count={data.payments.length} defaultOpen={false}>
            <MiniTable headers={["#", "Montant", "Méthode", "Statut", "Réf.", "Reçu le"]} empty={data.payments.length === 0}>
              {data.payments.slice(0, 30).map((p: any) => (
                <tr key={p.id} className={trClass}>
                  <td className="px-3 py-1.5 font-mono text-foreground text-[11px]">{p.payment_number || "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums text-primary font-medium text-[11px]">{fmtCAD(p.amount)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px] capitalize">{p.method}</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(p.status)} variant={statusToVariant(p.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px]">{p.reference || "—"}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-[11px]">{fmtDate(p.received_at)}</td>
                </tr>
              ))}
            </MiniTable>
          </CollapsibleSection>

          {/* Equipment */}
          <CollapsibleSection icon={Package} title="Équipements" count={data.equipment.length} defaultOpen={false}>
            <MiniTable headers={["Article", "SKU", "Qté", "Prix", "Total", "S/N"]} empty={data.equipment.length === 0}>
              {data.equipment.map((eq: any) => (
                <tr key={eq.id} className={trClass}>
                  <td className="px-3 py-1.5 text-foreground text-[11px]">{eq.item_name}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px]">{eq.item_sku || "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums text-foreground text-[11px]">{eq.quantity}</td>
                  <td className="px-3 py-1.5 tabular-nums text-muted-foreground text-[11px]">{fmtCAD(eq.unit_price)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-foreground text-[11px]">{fmtCAD(eq.line_total)}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground text-[10px] max-w-[120px] truncate">
                    {eq.serial_numbers ? (Array.isArray(eq.serial_numbers) ? (eq.serial_numbers as string[]).join(", ") : JSON.stringify(eq.serial_numbers)) : "—"}
                  </td>
                </tr>
              ))}
            </MiniTable>
          </CollapsibleSection>

          {/* Tickets */}
          <CollapsibleSection icon={MessageSquare} title="Tickets de support" count={data.tickets.length} defaultOpen={false}>
            <MiniTable headers={["#", "Sujet", "Cat.", "Statut", "Créé le"]} empty={data.tickets.length === 0}>
              {data.tickets.slice(0, 20).map((t: any) => (
                <tr key={t.id} className={trClass}>
                  <td className="px-3 py-1.5 font-mono text-foreground text-[11px]">{t.ticket_number || "—"}</td>
                  <td className="px-3 py-1.5 text-foreground max-w-[180px] truncate text-[11px]">{t.subject || t.title || "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px]">{t.category || "—"}</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(t.status)} variant={statusToVariant(t.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-[11px]">{fmtDate(t.created_at)}</td>
                </tr>
              ))}
            </MiniTable>
          </CollapsibleSection>

          {/* Appointments */}
          <CollapsibleSection icon={Calendar} title="Rendez-vous" count={data.appointments.length} defaultOpen={false}>
            <MiniTable headers={["#", "Titre", "Type", "Statut", "Date", "Adresse"]} empty={data.appointments.length === 0}>
              {data.appointments.map((a: any) => (
                <tr key={a.id} className={trClass}>
                  <td className="px-3 py-1.5 font-mono text-foreground text-[10px]">{a.appointment_number || "—"}</td>
                  <td className="px-3 py-1.5 text-foreground text-[11px]">{a.title}</td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px]">{a.service_type || a.installation_method || "—"}</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(a.status)} variant={statusToVariant(a.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-[11px]">{fmtDateTime(a.scheduled_at)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground text-[11px] max-w-[140px] truncate">{a.service_address || "—"}</td>
                </tr>
              ))}
            </MiniTable>
          </CollapsibleSection>

          {/* Activity */}
          <CollapsibleSection icon={Activity} title="Chronologie" count={data.activityLogs.length} defaultOpen={false}>
            {data.activityLogs.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted-foreground/40 text-[11px]">Aucune activité</div>
            ) : (
              <div className="divide-y divide-border/20 max-h-[320px] overflow-y-auto">
                {data.activityLogs.slice(0, 40).map((log: any) => (
                  <div key={log.id} className="px-3 py-2 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-foreground leading-snug">{log.summary}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground/60">
                          <span className="capitalize">{log.action_type?.replace(/_/g, " ")}</span>
                          {log.actor_name && <span>· {log.actor_name}</span>}
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground/40 whitespace-nowrap shrink-0">{fmtDateTime(log.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>

        {/* RIGHT — summary & actions sidebar */}
        <div className="space-y-3">
          {/* Account info */}
          <Panel>
            <PanelHeader icon={CircleDot} title="Compte" />
            <div className="py-1 divide-y divide-border/20">
              <InfoLine label="Numéro" value={acct.account_number} mono accent />
              <InfoLine label="Statut" value={<StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />} />
              <InfoLine label="Classe crédit" value={acct.credit_class || "Standard"} />
              <InfoLine label="Créé le" value={fmtDate(acct.created_at)} />
            </div>
          </Panel>

          {/* Billing cycle */}
          <Panel>
            <PanelHeader icon={Clock} title="Facturation" />
            <div className="py-1 divide-y divide-border/20">
              <InfoLine label="Jour de cycle" value={acct.billing_cycle_day ?? "—"} accent />
              <InfoLine label="Prochaine facture" value={fmtDate(acct.next_invoice_date)} accent />
              <InfoLine label="Date d'ancrage" value={fmtDate(acct.billing_anchor_date)} />
            </div>
          </Panel>

          {/* Financial summary */}
          <Panel>
            <PanelHeader icon={DollarSign} title="Résumé financier" />
            <div className="py-1 divide-y divide-border/20">
              <InfoLine label="Solde impayé" value={fmtCAD(totalDue)} accent={totalDue <= 0} />
              <InfoLine label="Total payé" value={fmtCAD(totalPaid)} />
              <InfoLine label="Rev. mensuel" value={fmtCAD(monthlyRevenue)} accent />
              <InfoLine label="Factures" value={data.invoices.length} />
            </div>
          </Panel>

          {/* Identity */}
          <Panel>
            <PanelHeader icon={User} title="Identité" />
            <div className="py-1 divide-y divide-border/20">
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
            <div className="py-1 divide-y divide-border/20">
              <InfoLine label="Statut" value={
                latestKyc
                  ? <StatusBadge label={label(latestKyc.status)} variant={statusToVariant(latestKyc.status)} size="sm" />
                  : <span className="text-muted-foreground/40 text-[10px]">Non vérifié</span>
              } />
              {latestKyc && (
                <>
                  <InfoLine label="Document" value={latestKyc.document_type || "—"} />
                  <InfoLine label="Soumis" value={fmtDate(latestKyc.submitted_at)} />
                  <InfoLine label="Révisé" value={fmtDate(latestKyc.reviewed_at)} />
                </>
              )}
            </div>
            {data.kycSessions.length > 1 && (
              <div className="px-3 pb-2">
                <span className="text-[9px] text-muted-foreground/50">{data.kycSessions.length} session(s) au total</span>
              </div>
            )}
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
              {data.orders[0] && (
                <QuickAction icon={ShoppingCart} label="Dernière commande" onClick={() => navigate(corePath(`/orders/${data.orders[0].id}`))} />
              )}
              {data.subscriptions[0] && (
                <QuickAction icon={Repeat} label="Ouvrir abonnement" onClick={() => navigate(corePath(`/subscriptions/${(data.subscriptions[0] as any).id}`))} />
              )}
            </div>
            {showNoteInput && (
              <div className="px-2 pb-2 space-y-1.5">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Note interne…"
                  rows={2}
                  className="w-full rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 resize-none"
                />
                <button onClick={addNote} disabled={actionLoading || !noteText.trim()} className="w-full rounded-md bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors">
                  Enregistrer la note
                </button>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default CoreAccountDetail;
