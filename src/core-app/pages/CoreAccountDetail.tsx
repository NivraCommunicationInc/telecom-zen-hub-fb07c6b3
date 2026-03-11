/**
 * Nivra Core — Customer 360 Detail (ops-grade)
 * Central customer file with all linked sections and quick actions.
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
  ExternalLink, ChevronDown, ChevronRight, Activity,
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

/* ── reusable components ── */
const SectionHeader = ({ icon: Icon, title, count, defaultOpen = true, children }: {
  icon: any; title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left group">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />}
        <Icon className="h-4 w-4 text-emerald-400" />
        <h2 className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">{title}</h2>
        {count != null && <span className="text-[11px] text-[hsl(220,10%,45%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums font-medium">{count}</span>}
      </button>
      {open && children}
    </div>
  );
};

const MiniTable = ({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) => (
  <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[hsl(220,15%,16%)]">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr><td colSpan={headers.length} className="text-center py-6 text-[hsl(220,10%,30%)] text-xs">Aucune donnée</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  </div>
);

const InfoRow = ({ label: l, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-start justify-between py-1.5 border-b border-[hsl(220,15%,13%)] last:border-0">
    <span className="text-[11px] text-[hsl(220,10%,40%)] shrink-0">{l}</span>
    <span className={`text-[11px] text-white text-right ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

const ActionBtn = ({ icon: Icon, label: l, onClick, variant = "default", loading }: {
  icon: any; label: string; onClick: () => void; variant?: "default" | "warning" | "success"; loading?: boolean;
}) => {
  const colors = {
    default: "border-[hsl(220,15%,18%)] text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30",
    warning: "border-[hsl(220,15%,18%)] text-amber-400 hover:text-amber-300 hover:border-amber-500/30",
    success: "border-[hsl(220,15%,18%)] text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/30",
  };
  return (
    <button onClick={onClick} disabled={loading} className={`flex items-center gap-1.5 rounded-lg border bg-[hsl(220,20%,13%)] px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${colors[variant]}`}>
      <Icon className="h-3.5 w-3.5" /> {l}
    </button>
  );
};

const trClass = "border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)] transition-colors";

/* ── Main Component ── */
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
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(220,10%,40%)]" />
      </div>
    );
  }

  if (data.accountError) {
    return (
      <div className="py-20 text-center space-y-2">
        <User className="h-8 w-8 mx-auto mb-2 text-red-400/50" />
        <p className="text-red-400 text-xs font-medium">Erreur de chargement du compte</p>
        <p className="text-[hsl(220,10%,35%)] text-[11px] max-w-md mx-auto">{(data.accountError as any)?.message || "Vérifiez votre session et réessayez."}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 transition-colors">
            <RefreshCw className="h-3 w-3 inline mr-1.5" />Réessayer
          </button>
          <Link to={corePath("/accounts")} className="text-blue-400 text-xs hover:underline">← Retour aux comptes</Link>
        </div>
      </div>
    );
  }

  if (!data.account) {
    return (
      <div className="py-20 text-center space-y-2">
        <User className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-[hsl(220,10%,40%)] text-xs">Compte introuvable</p>
        <p className="text-[hsl(220,10%,28%)] text-[10px]">ID: {accountId}</p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => data.refetch()} className="rounded-lg border border-[hsl(220,15%,20%)] px-3 py-1.5 text-[11px] text-[hsl(220,10%,50%)] hover:text-white transition-colors">
            <RefreshCw className="h-3 w-3 inline mr-1.5" />Réessayer
          </button>
          <Link to={corePath("/accounts")} className="text-blue-400 text-xs hover:underline">← Retour aux comptes</Link>
        </div>
      </div>
    );
  }

  const acct = data.account;
  const prof = data.profile;
  const totalDue = data.invoices.reduce((sum, inv: any) => sum + (inv.balance_due ?? 0), 0);
  const unpaidInvoices = data.invoices.filter((inv: any) => (inv.balance_due ?? 0) > 0);
  const latestKyc = data.kycSessions[0];

  /* ── Quick actions ── */
  const updateAccountStatus = async (newStatus: string) => {
    if (!accountId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", accountId);
      if (error) throw error;
      toast.success(`Compte ${newStatus === "suspended" ? "suspendu" : "réactivé"}`);
      data.refetch();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim() || !data.clientId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("client_activity_logs")
        .insert({
          client_id: data.clientId,
          actor_user_id: (await supabase.auth.getUser()).data.user?.id || "unknown",
          action_type: "internal_note",
          summary: noteText.trim(),
          entity_type: "account",
          entity_id: accountId,
        });
      if (error) throw error;
      toast.success("Note ajoutée");
      setNoteText("");
      setShowNoteInput(false);
      data.refetch();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Back + Refresh ── */}
      <div className="flex items-center justify-between">
        <Link to={corePath("/accounts")} className="flex items-center gap-1.5 text-[12px] text-[hsl(220,10%,50%)] hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Comptes
        </Link>
        <button onClick={() => data.refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* ── Header Card ── */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-[hsl(220,15%,16%)] flex items-center justify-center">
              <User className="h-5 w-5 text-[hsl(220,10%,45%)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                {prof ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || "Client" : "Client"}
              </h1>
              <p className="font-mono text-[hsl(220,10%,50%)] text-xs mt-0.5">Compte {acct.account_number}</p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-[hsl(220,10%,45%)]">
                {prof?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prof.email}</span>}
                {prof?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prof.phone}</span>}
                {(acct.primary_service_address || acct.primary_service_city) && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[acct.primary_service_address, acct.primary_service_city].filter(Boolean).join(", ")}</span>
                )}
              </div>
            </div>
          </div>
          <StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
          {[
            { label: "Commandes", value: data.orders.length, color: "text-white" },
            { label: "Abonnements", value: data.subscriptions.length, color: "text-white" },
            { label: "Factures", value: data.invoices.length, color: "text-white" },
            { label: "Impayées", value: unpaidInvoices.length, color: unpaidInvoices.length > 0 ? "text-red-400" : "text-emerald-400" },
            { label: "Paiements", value: data.payments.length, color: "text-white" },
            { label: "Solde dû", value: fmtCAD(totalDue), color: totalDue > 0 ? "text-red-400" : "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)] p-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium">{s.label}</p>
              <p className={`text-sm font-bold mt-0.5 tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[hsl(220,15%,14%)]">
          {acct.status !== "suspended" ? (
            <ActionBtn icon={PauseCircle} label="Suspendre" onClick={() => updateAccountStatus("suspended")} variant="warning" loading={actionLoading} />
          ) : (
            <ActionBtn icon={PlayCircle} label="Réactiver" onClick={() => updateAccountStatus("active")} variant="success" loading={actionLoading} />
          )}
          <ActionBtn icon={StickyNote} label="Ajouter note" onClick={() => setShowNoteInput(!showNoteInput)} />
          {data.orders[0] && (
            <ActionBtn icon={ShoppingCart} label="Dernière commande" onClick={() => navigate(corePath(`/orders/${data.orders[0].id}`))} />
          )}
          {data.subscriptions[0] && (
            <ActionBtn icon={Repeat} label="Abonnement" onClick={() => navigate(corePath(`/subscriptions/${(data.subscriptions[0] as any).id}`))} />
          )}
        </div>

        {/* Inline note input */}
        {showNoteInput && (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Note interne…"
              className="flex-1 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-3 py-1.5 text-xs text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/40"
              onKeyDown={e => e.key === "Enter" && addNote()}
            />
            <button onClick={addNote} disabled={actionLoading || !noteText.trim()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors">
              Enregistrer
            </button>
          </div>
        )}
      </div>

      {/* ── Account Info ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
          <h3 className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-semibold mb-2">Compte</h3>
          <InfoRow label="Numéro de compte" value={acct.account_number} mono />
          <InfoRow label="Statut" value={<StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />} />
          <InfoRow label="Jour de facturation" value={acct.billing_cycle_day ?? "—"} />
          <InfoRow label="Prochaine facture" value={fmtDate(acct.next_invoice_date)} />
          <InfoRow label="Date d'ancrage" value={fmtDate(acct.billing_anchor_date)} />
          <InfoRow label="Classe de crédit" value={acct.credit_class || "Standard"} />
          <InfoRow label="Créé le" value={fmtDate(acct.created_at)} />
        </div>

        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
          <h3 className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-semibold mb-2">Identité client</h3>
          <InfoRow label="Nom" value={prof ? `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || "—" : "—"} />
          <InfoRow label="Courriel" value={prof?.email || "—"} />
          <InfoRow label="Téléphone" value={prof?.phone || "—"} />
          <InfoRow label="Adresse de service" value={[acct.primary_service_address, acct.primary_service_city, acct.primary_service_postal_code].filter(Boolean).join(", ") || "—"} />
          <InfoRow label="Adresse de facturation" value={[acct.billing_address, acct.billing_city, acct.billing_postal_code].filter(Boolean).join(", ") || "—"} />
          <InfoRow label="KYC" value={
            latestKyc
              ? <StatusBadge label={label(latestKyc.status)} variant={statusToVariant(latestKyc.status)} size="sm" />
              : <span className="text-[hsl(220,10%,30%)]">Non vérifié</span>
          } />
        </div>
      </div>

      {/* ── Active Subscriptions ── */}
      <SectionHeader icon={Repeat} title="Abonnements" count={data.subscriptions.length}>
        <MiniTable headers={["Plan", "Catégorie", "Prix/mois", "Statut", "Cycle début", "Cycle fin", "Auto-billing", ""]} empty={data.subscriptions.length === 0}>
          {data.subscriptions.map((s: any) => (
            <tr key={s.id} className={trClass}>
              <td className="px-3 py-2">
                <p className="text-white font-medium">{s.plan_name}</p>
                <p className="text-[hsl(220,10%,38%)] text-[11px] font-mono">{s.plan_code}</p>
              </td>
              <td className="px-3 py-2"><span className="text-[hsl(220,10%,55%)]">{s.service_category || "—"}</span></td>
              <td className="px-3 py-2"><span className="tabular-nums text-emerald-400 font-medium">{fmtCAD(s.plan_price)}</span></td>
              <td className="px-3 py-2"><StatusBadge label={label(s.status)} variant={statusToVariant(s.status || "")} size="sm" /></td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(s.cycle_start_date)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(s.cycle_end_date)}</td>
              <td className="px-3 py-2">
                {s.auto_billing_enabled
                  ? <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]"><Zap className="h-3 w-3" /> Oui</span>
                  : <span className="text-[hsl(220,10%,35%)] text-[11px]">Non</span>}
              </td>
              <td className="px-3 py-2">
                <Link to={corePath(`/subscriptions/${s.id}`)} className="text-blue-400 hover:text-blue-300 text-[11px]">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── Unpaid Invoices ── */}
      {unpaidInvoices.length > 0 && (
        <SectionHeader icon={FileText} title="Factures impayées" count={unpaidInvoices.length}>
          <MiniTable headers={["Facture", "Total", "Payé", "Solde", "Statut", "Échéance"]}>
            {unpaidInvoices.map((inv: any) => (
              <tr key={inv.id} className={trClass}>
                <td className="px-3 py-2">
                  <Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-white hover:text-blue-400">{inv.invoice_number}</Link>
                </td>
                <td className="px-3 py-2 tabular-nums text-white">{fmtCAD(inv.total)}</td>
                <td className="px-3 py-2 tabular-nums text-emerald-400">{fmtCAD(inv.amount_paid)}</td>
                <td className="px-3 py-2 tabular-nums text-red-400 font-medium">{fmtCAD(inv.balance_due)}</td>
                <td className="px-3 py-2"><StatusBadge label={label(inv.status)} variant={statusToVariant(inv.status || "")} size="sm" /></td>
                <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(inv.due_date)}</td>
              </tr>
            ))}
          </MiniTable>
        </SectionHeader>
      )}

      {/* ── Orders ── */}
      <SectionHeader icon={ShoppingCart} title="Commandes" count={data.orders.length}>
        <MiniTable headers={["#", "Service", "Statut", "Total", "Paiement", "Date", ""]} empty={data.orders.length === 0}>
          {data.orders.slice(0, 25).map((o: any) => (
            <tr key={o.id} className={trClass}>
              <td className="px-3 py-2 font-mono text-white">{o.order_number || "—"}</td>
              <td className="px-3 py-2 text-[hsl(220,10%,55%)]">{o.service_category || o.service_type || "—"}</td>
              <td className="px-3 py-2"><StatusBadge label={label(o.status)} variant={statusToVariant(o.status || "")} size="sm" /></td>
              <td className="px-3 py-2 tabular-nums text-white">{fmtCAD(o.total_today ?? o.order_total)}</td>
              <td className="px-3 py-2 text-[hsl(220,10%,45%)]">{label(o.payment_status)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(o.created_at)}</td>
              <td className="px-3 py-2">
                <Link to={corePath(`/orders/${o.id}`)} className="text-blue-400 hover:text-blue-300">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── All Invoices ── */}
      <SectionHeader icon={FileText} title="Historique des factures" count={data.invoices.length} defaultOpen={false}>
        <MiniTable headers={["Facture", "Type", "Total", "Payé", "Solde", "Statut", "Échéance"]} empty={data.invoices.length === 0}>
          {data.invoices.slice(0, 30).map((inv: any) => (
            <tr key={inv.id} className={trClass}>
              <td className="px-3 py-2">
                <Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-white hover:text-blue-400">{inv.invoice_number}</Link>
              </td>
              <td className="px-3 py-2 text-[hsl(220,10%,50%)] capitalize">{inv.type}</td>
              <td className="px-3 py-2 tabular-nums text-white">{fmtCAD(inv.total)}</td>
              <td className="px-3 py-2 tabular-nums text-emerald-400">{fmtCAD(inv.amount_paid)}</td>
              <td className="px-3 py-2">
                <span className={`tabular-nums font-medium ${(inv.balance_due ?? 0) > 0 ? "text-red-400" : "text-[hsl(220,10%,40%)]"}`}>{fmtCAD(inv.balance_due)}</span>
              </td>
              <td className="px-3 py-2"><StatusBadge label={label(inv.status)} variant={statusToVariant(inv.status || "")} size="sm" /></td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(inv.due_date)}</td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── Payment History ── */}
      <SectionHeader icon={CreditCard} title="Historique des paiements" count={data.payments.length} defaultOpen={false}>
        <MiniTable headers={["#", "Montant", "Méthode", "Statut", "Référence", "Reçu le"]} empty={data.payments.length === 0}>
          {data.payments.slice(0, 30).map((p: any) => (
            <tr key={p.id} className={trClass}>
              <td className="px-3 py-2 font-mono text-white">{p.payment_number || "—"}</td>
              <td className="px-3 py-2 tabular-nums text-emerald-400 font-medium">{fmtCAD(p.amount)}</td>
              <td className="px-3 py-2 text-[hsl(220,10%,55%)] capitalize">{p.method}</td>
              <td className="px-3 py-2"><StatusBadge label={label(p.status)} variant={statusToVariant(p.status || "")} size="sm" /></td>
              <td className="px-3 py-2 font-mono text-[hsl(220,10%,40%)] text-[11px]">{p.reference || "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(p.received_at)}</td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── KYC Sessions ── */}
      <SectionHeader icon={Shield} title="Vérification d'identité (KYC)" count={data.kycSessions.length} defaultOpen={false}>
        <MiniTable headers={["Dossier", "Type", "Statut", "Soumis le", "Révisé le", "Commande"]} empty={data.kycSessions.length === 0}>
          {data.kycSessions.map((k: any) => (
            <tr key={k.id} className={trClass}>
              <td className="px-3 py-2 font-mono text-white text-[11px]">{k.case_number || k.id.slice(0, 8)}</td>
              <td className="px-3 py-2 text-[hsl(220,10%,55%)]">{k.document_type || "—"}</td>
              <td className="px-3 py-2"><StatusBadge label={label(k.status)} variant={statusToVariant(k.status)} size="sm" /></td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(k.submitted_at)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(k.reviewed_at)}</td>
              <td className="px-3 py-2">
                {k.order_id
                  ? <Link to={corePath(`/orders/${k.order_id}`)} className="text-blue-400 hover:text-blue-300"><ExternalLink className="h-3.5 w-3.5" /></Link>
                  : <span className="text-[hsl(220,10%,30%)]">—</span>}
              </td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── Equipment ── */}
      <SectionHeader icon={Package} title="Équipements" count={data.equipment.length} defaultOpen={false}>
        <MiniTable headers={["Article", "SKU", "Qté", "Prix unitaire", "Total", "S/N"]} empty={data.equipment.length === 0}>
          {data.equipment.map((eq: any) => (
            <tr key={eq.id} className={trClass}>
              <td className="px-3 py-2 text-white">{eq.item_name}</td>
              <td className="px-3 py-2 font-mono text-[hsl(220,10%,45%)] text-[11px]">{eq.item_sku || "—"}</td>
              <td className="px-3 py-2 tabular-nums text-white">{eq.quantity}</td>
              <td className="px-3 py-2 tabular-nums text-[hsl(220,10%,55%)]">{fmtCAD(eq.unit_price)}</td>
              <td className="px-3 py-2 tabular-nums text-white">{fmtCAD(eq.line_total)}</td>
              <td className="px-3 py-2 font-mono text-[hsl(220,10%,40%)] text-[11px]">
                {eq.serial_numbers ? (Array.isArray(eq.serial_numbers) ? (eq.serial_numbers as string[]).join(", ") : JSON.stringify(eq.serial_numbers)) : "—"}
              </td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── Appointments ── */}
      <SectionHeader icon={Calendar} title="Rendez-vous / Visites" count={data.appointments.length} defaultOpen={false}>
        <MiniTable headers={["#", "Titre", "Type", "Statut", "Planifié le", "Adresse"]} empty={data.appointments.length === 0}>
          {data.appointments.map((a: any) => (
            <tr key={a.id} className={trClass}>
              <td className="px-3 py-2 font-mono text-white text-[11px]">{a.appointment_number || "—"}</td>
              <td className="px-3 py-2 text-white">{a.title}</td>
              <td className="px-3 py-2 text-[hsl(220,10%,55%)]">{a.service_type || a.installation_method || "—"}</td>
              <td className="px-3 py-2"><StatusBadge label={label(a.status)} variant={statusToVariant(a.status || "")} size="sm" /></td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDateTime(a.scheduled_at)}</td>
              <td className="px-3 py-2 text-[hsl(220,10%,40%)] max-w-[180px] truncate">{a.service_address || "—"}</td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── Support Tickets ── */}
      <SectionHeader icon={MessageSquare} title="Tickets de support" count={data.tickets.length} defaultOpen={false}>
        <MiniTable headers={["#", "Sujet", "Catégorie", "Statut", "Créé le"]} empty={data.tickets.length === 0}>
          {data.tickets.slice(0, 20).map((t: any) => (
            <tr key={t.id} className={trClass}>
              <td className="px-3 py-2 font-mono text-white">{t.ticket_number || "—"}</td>
              <td className="px-3 py-2 text-white max-w-[200px] truncate">{t.subject || t.title || "—"}</td>
              <td className="px-3 py-2 text-[hsl(220,10%,55%)]">{t.category || "—"}</td>
              <td className="px-3 py-2"><StatusBadge label={label(t.status)} variant={statusToVariant(t.status || "")} size="sm" /></td>
              <td className="px-3 py-2 whitespace-nowrap text-[hsl(220,10%,40%)]">{fmtDate(t.created_at)}</td>
            </tr>
          ))}
        </MiniTable>
      </SectionHeader>

      {/* ── Activity Timeline ── */}
      <SectionHeader icon={Activity} title="Chronologie d'activité" count={data.activityLogs.length} defaultOpen={false}>
        {data.activityLogs.length === 0 ? (
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-6 text-center text-[hsl(220,10%,30%)] text-xs">
            Aucune activité enregistrée
          </div>
        ) : (
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] divide-y divide-[hsl(220,15%,14%)] max-h-[400px] overflow-y-auto">
            {data.activityLogs.slice(0, 40).map((log: any) => (
              <div key={log.id} className="px-3 py-2.5 hover:bg-[hsl(220,20%,12%)] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white">{log.summary}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[hsl(220,10%,38%)]">
                      <span className="capitalize">{log.action_type?.replace(/_/g, " ")}</span>
                      {log.actor_name && <span>· {log.actor_name}</span>}
                      {log.actor_role && <span className="text-[hsl(220,10%,30%)]">({log.actor_role})</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-[hsl(220,10%,35%)] whitespace-nowrap shrink-0">{fmtDateTime(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionHeader>
    </div>
  );
};

export default CoreAccountDetail;
