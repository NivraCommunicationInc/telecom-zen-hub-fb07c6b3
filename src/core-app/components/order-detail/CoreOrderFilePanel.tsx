/**
 * CoreOrderFilePanel — Right sidebar: comprehensive order file
 * Collapsible sections for all linked data: financials, KYC, equipment,
 * contract, appointment, payment details, subscriptions, risk flags, etc.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { corePath } from "@/core-app/lib/corePaths";
import {
  ChevronDown, ChevronRight, DollarSign, FileText, CreditCard,
  Shield, Package, Calendar, ScrollText, Wifi, ExternalLink,
  Hash, AlertTriangle, MessageSquare, Loader2, Users, Radio
} from "lucide-react";

interface Props {
  proc: any;
}

const fmtCAD = (n: number | null | undefined) => (n != null ? `${Number(n).toFixed(2)} $` : "—");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

/* ─── Collapsible Section ─── */
function FileSection({ 
  icon: Icon, title, count, defaultOpen = false, variant, children 
}: { 
  icon: any; title: string; count?: number; defaultOpen?: boolean; 
  variant?: "success" | "warning" | "danger" | "info"; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const variantColors = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-sky-400",
  };
  const iconColor = variant ? variantColors[variant] : "text-[hsl(220,10%,45%)]";

  return (
    <div className="border-b border-[hsl(220,15%,14%)] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-[hsl(220,15%,13%)] transition-colors"
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-[11px] font-semibold text-[hsl(220,10%,70%)] flex-1">{title}</span>
        {count != null && count > 0 && (
          <span className="text-[9px] font-mono text-[hsl(220,10%,40%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums">
            {count}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-3 w-3 text-[hsl(220,10%,35%)]" />
        ) : (
          <ChevronRight className="h-3 w-3 text-[hsl(220,10%,35%)]" />
        )}
      </button>
      {open && (
        <div className="px-3.5 pb-3 pt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Detail row ─── */
function Row({ label, value, mono, accent }: { label: string; value?: string | null; mono?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between items-start py-1 gap-2">
      <span className="text-[10px] text-[hsl(220,10%,38%)] uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-[11px] text-right ${accent || "text-[hsl(220,10%,65%)]"} ${mono ? "font-mono" : ""} break-all`}>
        {value || "—"}
      </span>
    </div>
  );
}

export function CoreOrderFilePanel({ proc }: Props) {
  const { order, invoice, appointment, items, profile, account, contracts, kycSession } = proc;
  const contract = contracts?.[0] || null;

  // Financial calculations from invoice (CANONICAL source of truth)
  const total = invoice?.total ?? order.total_amount;
  const subtotal = invoice?.subtotal ?? order.subtotal;
  const amountPaid = invoice?.amount_paid ?? 0;
  const balanceDue = invoice?.balance_due ?? (total ? Number(total) - Number(amountPaid) : 0);
  const isPaid = balanceDue <= 0 && Number(amountPaid) > 0;
  const tpsAmount = invoice?.tps_amount ?? order.tps_amount;
  const tvqAmount = invoice?.tvq_amount ?? order.tvq_amount;

  // Fetch linked subscriptions
  const { data: subscriptions } = useQuery({
    queryKey: ["order-subscriptions", order.id],
    enabled: !!order.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_code, plan_price, status, cycle_start_date, cycle_end_date")
        .eq("order_id", order.id);
      return data || [];
    },
  });

  // Fetch internal notes from order_internal_notes table
  const { data: internalNotes, isLoading: notesLoading } = useQuery({
    queryKey: ["order-internal-notes-panel", order.id],
    enabled: !!order.id,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_internal_notes")
        .select("id, body, created_by_name, created_by_role, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      {/* Panel title */}
      <div className="px-3.5 py-2.5 border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)]">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,40%)]">
          Dossier de commande
        </h3>
      </div>

      {/* ═══ Risk Flags ═══ */}
      {order.risk_flags && order.risk_flags.length > 0 && (
        <div className="px-3.5 py-2 border-b border-[hsl(220,15%,14%)] bg-red-500/5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Alertes</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {order.risk_flags.map((flag: string, i: number) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Financial Summary ═══ */}
      <FileSection icon={DollarSign} title="Sommaire financier" defaultOpen variant={isPaid ? "success" : balanceDue > 0 ? "danger" : "info"}>
        <div className="space-y-0.5">
          <Row label="Sous-total" value={fmtCAD(subtotal)} mono />
          {(order.activation_fee ?? 0) > 0 && <Row label="Activation" value={fmtCAD(order.activation_fee)} mono />}
          {(order.delivery_fee ?? 0) > 0 && <Row label="Livraison" value={fmtCAD(order.delivery_fee)} mono />}
          {(order.installation_fee ?? 0) > 0 && <Row label="Installation" value={fmtCAD(order.installation_fee)} mono />}
          <Row label="TPS (5%)" value={fmtCAD(tpsAmount)} mono />
          <Row label="TVQ (9.975%)" value={fmtCAD(tvqAmount)} mono />
          <div className="border-t border-[hsl(220,15%,16%)] mt-1.5 pt-1.5">
            <Row label="Total" value={fmtCAD(total)} mono accent="text-white font-semibold" />
            <Row label="Payé" value={fmtCAD(amountPaid)} mono accent="text-emerald-400" />
            <Row
              label="Solde dû"
              value={fmtCAD(balanceDue)}
              mono
              accent={balanceDue > 0 ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}
            />
          </div>
        </div>
      </FileSection>

      {/* ═══ Invoice ═══ */}
      <FileSection icon={FileText} title="Facture" defaultOpen variant={invoice ? (invoice.status === "paid" ? "success" : "warning") : undefined}>
        {invoice ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <Link to={corePath(`/invoices/${invoice.id}`)} className="text-[11px] text-blue-400 hover:text-blue-300 font-mono font-medium flex items-center gap-1">
                {invoice.invoice_number} <ExternalLink className="h-2.5 w-2.5" />
              </Link>
              <StatusBadge label={invoice.status || "—"} variant={statusToVariant(invoice.status || "")} size="sm" />
            </div>
            <Row label="Type" value={invoice.type} />
            <Row label="Échéance" value={fmtDate(invoice.due_date)} />
            <Row label="Payé le" value={fmtDate(invoice.paid_at)} />
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(220,10%,30%)] flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Aucune facture liée
          </p>
        )}
      </FileSection>

      {/* ═══ Payment ═══ */}
      <FileSection icon={CreditCard} title="Paiement" variant={order.payment_status === "paid" || order.payment_status === "confirmed" ? "success" : "warning"}>
        <div className="space-y-0.5">
          <Row label="Statut" value={order.payment_status} />
          <Row label="Méthode" value={order.payment_method} />
          <Row label="Référence" value={order.payment_reference} mono />
          {order.promo_code && <Row label="Code promo" value={order.promo_code} accent="text-emerald-400" />}
        </div>
      </FileSection>

      {/* ═══ Subscriptions ═══ */}
      <FileSection icon={Radio} title="Abonnements" count={subscriptions?.length} variant={subscriptions && subscriptions.length > 0 ? "success" : undefined}>
        {subscriptions && subscriptions.length > 0 ? (
          <div className="space-y-2">
            {subscriptions.map((sub: any) => (
              <div key={sub.id} className="rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-2">
                <div className="flex items-center justify-between mb-1">
                  <Link to={corePath(`/subscriptions/${sub.id}`)} className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                    {sub.plan_name} <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                  <StatusBadge label={sub.status || "—"} variant={statusToVariant(sub.status || "")} size="sm" />
                </div>
                <Row label="Code" value={sub.plan_code} mono />
                <Row label="Prix" value={fmtCAD(sub.plan_price)} mono />
                <Row label="Cycle" value={`${fmtDate(sub.cycle_start_date)} → ${fmtDate(sub.cycle_end_date)}`} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(220,10%,30%)]">Aucun abonnement lié</p>
        )}
      </FileSection>

      {/* ═══ KYC ═══ */}
      <FileSection icon={Shield} title="Vérification KYC" variant={
        kycSession?.status === "approved" ? "success" :
        kycSession?.status === "rejected" ? "danger" :
        kycSession ? "warning" : undefined
      }>
        {kycSession ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[hsl(220,10%,38%)] uppercase">Statut</span>
              <StatusBadge label={kycSession.status || "—"} variant={statusToVariant(kycSession.status || "")} size="sm" />
            </div>
            <Row label="Case" value={kycSession.case_number} mono />
            <Row label="Méthode" value={kycSession.verification_method} />
            <Row label="Soumis le" value={fmtDate(kycSession.created_at)} />
            {kycSession.ocr_confidence_score != null && (
              <Row label="Score OCR" value={`${(kycSession.ocr_confidence_score * 100).toFixed(0)}%`} accent={
                kycSession.ocr_confidence_score >= 0.8 ? "text-emerald-400" : 
                kycSession.ocr_confidence_score >= 0.5 ? "text-amber-400" : "text-red-400"
              } />
            )}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(220,10%,30%)]">Non requis ou non soumis</p>
        )}
      </FileSection>

      {/* ═══ Equipment ═══ */}
      <FileSection icon={Package} title="Équipement">
        <div className="space-y-0.5">
          <Row label="SIM" value={order.sim_number || order.sim_type} mono />
          <Row label="IMEI" value={order.imei_number} mono />
          <Row label="MAC" value={order.mac_address} mono />
          <Row label="N° série" value={order.serial_number} mono />
          {order.router_model && <Row label="Routeur" value={order.router_model} />}
          {order.equipment_id && <Row label="ID Inventaire" value={order.equipment_id} mono accent="text-sky-400" />}
        </div>
      </FileSection>

      {/* ═══ Appointment ═══ */}
      <FileSection icon={Calendar} title="Rendez-vous" variant={appointment ? (appointment.status === "completed" ? "success" : "info") : undefined}>
        {appointment ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[hsl(220,10%,38%)] uppercase">Statut</span>
              <StatusBadge label={appointment.status || "planifié"} variant={statusToVariant(appointment.status || "pending")} size="sm" />
            </div>
            <Row label="N°" value={appointment.appointment_number} mono />
            <Row label="Date" value={fmtDateTime(appointment.scheduled_at)} />
            <Row label="Méthode" value={appointment.installation_method} />
            <Row label="Adresse" value={appointment.service_address} />
            {appointment.technician_id && <Row label="Technicien" value="Assigné" accent="text-emerald-400" />}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(220,10%,30%)]">Aucun rendez-vous planifié</p>
        )}
      </FileSection>

      {/* ═══ Contract / Documents ═══ */}
      <FileSection icon={ScrollText} title="Contrat & Documents" count={contracts?.length} variant={
        contract?.status === "fully_signed" ? "success" :
        contract ? "warning" : undefined
      }>
        {contract ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono text-[hsl(220,10%,55%)]">{contract.contract_number || "—"}</span>
              <StatusBadge
                label={contract.is_signed || contract.status === "fully_signed" ? "Signé" : contract.status || "En attente"}
                variant={contract.is_signed || contract.status === "fully_signed" ? "success" : "warning"}
                size="sm"
              />
            </div>
            <Row label="Version" value={contract.version ? `v${contract.version}` : "v1"} />
            <Row label="Créé le" value={fmtDate(contract.created_at)} />
            {contract.client_signed_at && <Row label="Client signé" value={fmtDateTime(contract.client_signed_at)} accent="text-emerald-400" />}
            {contract.admin_signed_at && <Row label="Admin signé" value={fmtDateTime(contract.admin_signed_at)} accent="text-emerald-400" />}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(220,10%,30%)]">Aucun contrat généré</p>
        )}
      </FileSection>

      {/* ═══ Service Activation ═══ */}
      <FileSection icon={Wifi} title="Activation service" variant={
        order.status === "completed" || order.status === "activated" || order.status === "installation_completed" ? "success" :
        order.status === "in_progress" || order.status === "provisioning" ? "info" : undefined
      }>
        <div className="space-y-0.5">
          <Row label="Statut commande" value={order.status} />
          <Row label="Type service" value={order.service_type} />
          {order.fulfillment_type && <Row label="Fulfillment" value={order.fulfillment_type} />}
          <Row label="Transporteur" value={order.carrier} />
          <Row label="Suivi" value={order.tracking_number} mono />
          {order.activated_at && <Row label="Activé le" value={fmtDateTime(order.activated_at)} accent="text-emerald-400" />}
          {order.processed_at && <Row label="Traité le" value={fmtDateTime(order.processed_at)} accent="text-sky-400" />}
        </div>
      </FileSection>

      {/* ═══ Client Identity ═══ */}
      <FileSection icon={Users} title="Identité client">
        <div className="space-y-0.5">
          <Row label="Prénom" value={order.client_first_name} />
          <Row label="Nom" value={order.client_last_name} />
          <Row label="Courriel" value={order.client_email} />
          <Row label="Téléphone" value={order.client_phone} />
          {order.client_dob && <Row label="Date naissance" value={fmtDate(order.client_dob)} />}
          <Row label="Adresse" value={order.client_full_address} />
          <Row label="Langue" value={order.language || order.preferred_language} />
        </div>
      </FileSection>

      {/* ═══ Order Items ═══ */}
      {items && items.length > 0 && (
        <FileSection icon={Hash} title="Articles" count={items.length}>
          <div className="space-y-1.5">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-[hsl(220,15%,13%)] last:border-0">
                <span className="text-[11px] text-[hsl(220,10%,60%)] truncate max-w-[140px]">
                  {item.product_name || item.plan_name || `Item ${i + 1}`}
                </span>
                <span className="text-[11px] font-mono text-[hsl(220,10%,55%)]">
                  {fmtCAD(item.unit_price)}
                </span>
              </div>
            ))}
          </div>
        </FileSection>
      )}

      {/* ═══ Internal Notes ═══ */}
      <FileSection icon={MessageSquare} title="Notes internes" count={internalNotes?.length} variant={internalNotes && internalNotes.length > 0 ? "info" : undefined}>
        {notesLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-3 w-3 animate-spin text-[hsl(220,10%,35%)]" />
          </div>
        ) : internalNotes && internalNotes.length > 0 ? (
          <div className="space-y-2">
            {internalNotes.map((note: any) => (
              <div key={note.id} className="rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-[hsl(220,10%,55%)]">
                    {note.created_by_name || "Système"}
                  </span>
                  <span className="text-[9px] font-mono text-[hsl(220,10%,30%)]">
                    {fmtDateTime(note.created_at)}
                  </span>
                </div>
                <p className="text-[11px] text-[hsl(220,10%,60%)] leading-relaxed whitespace-pre-wrap">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        ) : order.internal_notes ? (
          <pre className="text-[11px] text-[hsl(220,10%,50%)] whitespace-pre-wrap font-sans leading-relaxed">
            {order.internal_notes}
          </pre>
        ) : (
          <p className="text-[10px] text-[hsl(220,10%,30%)]">Aucune note</p>
        )}
      </FileSection>
    </div>
  );
}
