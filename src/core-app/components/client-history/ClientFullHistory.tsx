/**
 * ClientFullHistory — Tab content showing complete cross-time history
 * for a client: orders, payments, KYC sessions, emails, and activity logs.
 * All sections are collapsible with a count badge in the header.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ShoppingCart, CreditCard, Shield, Mail, Clock,
  ChevronDown, ChevronRight, Loader2,
} from "lucide-react";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { PAYMENT_SOURCES } from "@/core-app/components/payments/PaymentConstants";
import { cn } from "@/lib/utils";


// ── Action label translations (mirrors DashboardPage activity feed) ──
const ACTION_LABELS: Record<string, string> = {
  kyc_requested: "Vérification KYC demandée",
  kyc_approved: "KYC approuvé",
  kyc_rejected: "KYC rejeté",
  order_created: "Nouvelle commande créée",
  order_completed: "Commande complétée",
  order_cancelled: "Commande annulée",
  order_status_change: "Changement de statut commande",
  payment_confirmed: "Paiement confirmé",
  payment_received: "Paiement reçu",
  payment_failed: "Paiement échoué",
  invoice_created: "Facture créée",
  invoice_sent: "Facture envoyée",
  invoice_paid: "Facture payée",
  subscription_created: "Abonnement créé",
  subscription_cancelled: "Abonnement annulé",
  equipment_assigned: "Équipement attribué",
  equipment_replaced: "Équipement remplacé",
  equipment_returned: "Équipement retourné",
  account_created: "Compte créé",
  profile_update: "Profil mis à jour",
  note_added: "Note ajoutée",
  ticket_created: "Ticket créé",
  ticket_closed: "Ticket fermé",
  appointment_scheduled: "Rendez-vous planifié",
  appointment_completed: "Rendez-vous complété",
  completed: "Complété",
  created: "Créé",
};

const TEMPLATE_LABELS: Record<string, string> = {
  order_confirmation: "Confirmation de commande",
  order_shipped: "Commande expédiée",
  order_delivered: "Commande livrée",
  payment_receipt: "Reçu de paiement",
  payment_confirmed: "Paiement confirmé",
  payment_failed: "Paiement échoué",
  invoice_issued: "Facture émise",
  invoice_reminder: "Rappel de facture",
  kyc_requested: "Vérification KYC requise",
  kyc_approved: "KYC approuvé",
  kyc_rejected: "KYC refusé",
  appointment_reminder: "Rappel de rendez-vous",
  appointment_technician_en_route: "Technicien en route",
  installation_completed: "Installation complétée",
  contract_signed: "Contrat signé",
  welcome: "Bienvenue",
  password_reset: "Réinitialisation mot de passe",
  account_created: "Compte créé",
};

const formatAction = (action: string | null | undefined): string => {
  if (!action) return "—";
  const key = action.toLowerCase().trim();
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatTemplate = (key: string | null | undefined): string => {
  if (!key) return "—";
  const k = key.toLowerCase().trim();
  if (TEMPLATE_LABELS[k]) return TEMPLATE_LABELS[k];
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const fmtDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }) : "—";

// ── Collapsible section wrapper ──
interface SectionProps {
  title: string;
  icon: any;
  count: number;
  loading?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
const HistorySection = ({ title, icon: Icon, count, loading, defaultOpen = true, children }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[hsl(220,20%,13%)] transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-[hsl(220,10%,45%)]" /> : <ChevronRight className="h-4 w-4 text-[hsl(220,10%,45%)]" />}
        <Icon className="h-4 w-4 text-emerald-400" />
        <h3 className="text-[13px] font-semibold text-white flex-1 text-left">{title}</h3>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-[hsl(220,10%,45%)]" />
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
            {count}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-[hsl(220,15%,14%)]">{children}</div>}
    </div>
  );
};

const EmptyRow = ({ label }: { label: string }) => (
  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">{label}</p>
);

interface Props {
  clientId: string;
  email?: string | null;
  billingCustomerId?: string | null;
}

export const ClientFullHistory = ({ clientId, email, billingCustomerId }: Props) => {
  // ── All orders (all time) ──
  const ordersQ = useQuery({
    queryKey: ["client-history-orders", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, service_type, status, payment_status, total_amount")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── All payments (with processor + source + invoice link) ──
  const paymentsQ = useQuery({
    queryKey: ["client-history-payments", billingCustomerId],
    queryFn: async () => {
      if (!billingCustomerId) return [];
      const { data, error } = await supabase
        .from("billing_payments")
        .select(`
          id, payment_number, amount, method, reference, status, created_at, received_at,
          provider, provider_payment_id, source, nivra_reference, square_payment_id,
          square_receipt_url, invoice_id,
          invoice:billing_invoices(invoice_number)
        `)
        .eq("customer_id", billingCustomerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!billingCustomerId,
  });


  // ── All KYC sessions ──
  const kycQ = useQuery({
    queryKey: ["client-history-kyc", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("id, case_number, status, document_type, id_type, created_at, submitted_at, reviewed_at, reviewed_by")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── All communications (email + SMS + notifications + calls) — Module 46 (D46-E) ──
  // Uses the canonical `v_customer_communications` unified view.
  const emailsQ = useQuery({
    queryKey: ["client-history-communications", clientId, email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_customer_communications" as any)
        .select("row_id, channel, direction, recipient, phone, subject, template_key, status, sent_at, created_at, error_message")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!clientId,
  });

  // ── Reviewer names for KYC sessions ──
  const reviewerIds = useMemo(
    () => Array.from(new Set((kycQ.data || []).map((k: any) => k.reviewed_by).filter(Boolean))),
    [kycQ.data],
  );
  const reviewersQ = useQuery({
    queryKey: ["client-history-kyc-reviewers", reviewerIds.sort().join(",")],
    queryFn: async () => {
      if (reviewerIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", reviewerIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = p.full_name || p.email || "—";
      });
      return map;
    },
    enabled: reviewerIds.length > 0,
  });

  // ── Unified timeline (Module 51 B2.3 canonical) ──
  // The activity timeline UI is delegated to <CustomerTimelineTable>, which
  // reads exclusively from v_customer_timeline. This section keeps only the
  // event count for the collapsible header.
  const activityQ = useQuery({
    queryKey: ["client-history-timeline-count", clientId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("v_customer_timeline" as any)
        .select("event_id", { count: "exact", head: true })
        .eq("client_id", clientId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!clientId,
  });

  return (
    <div className="space-y-4">
      {/* ═══ ORDERS ═══ */}
      <HistorySection title="Toutes les commandes" icon={ShoppingCart} count={ordersQ.data?.length || 0} loading={ordersQ.isLoading}>
        {ordersQ.data && ordersQ.data.length > 0 ? (
          <div className="space-y-2 mt-2">
            {ordersQ.data.map((o: any) => (
              <Link
                key={o.id}
                to={corePath(`/orders/${o.id}`)}
                className="flex items-center gap-3 p-3 rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] hover:border-emerald-500/30 hover:bg-[hsl(220,20%,12%)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-white">#{o.order_number}</span>
                    <span className="text-[10px] text-[hsl(220,10%,45%)]">{fmtDate(o.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-[#A1A1AA] mt-0.5">{o.service_type || "—"}</p>
                </div>
                <span className="text-[12px] text-emerald-400 font-medium tabular-nums">
                  {o.total_amount ? `${Number(o.total_amount).toFixed(2)} $` : "—"}
                </span>
                <StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyRow label="Aucune commande" />
        )}
      </HistorySection>

      {/* ═══ PAYMENTS ═══ */}
      <HistorySection title="Historique des paiements" icon={CreditCard} count={paymentsQ.data?.length || 0} loading={paymentsQ.isLoading}>
        {paymentsQ.data && paymentsQ.data.length > 0 ? (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,14%)]">
                  {["Date", "Montant", "Méthode", "Facture", "Réf NVR", "Réf processeur", "Source", "Statut", ""].map((h) => (
                    <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paymentsQ.data.map((p: any) => {
                  const methodBase = p.method === "card" ? "Carte" : p.method === "paypal" ? "Carte" : p.method === "interac" ? "Interac" : p.method === "manual" ? "Manuel" : p.method === "internal" ? "Crédit promo" : (p.method || "—");
                  const providerTag = p.provider === "square" ? " (Square)" : p.provider === "paypal" ? " (PayPal)" : p.method === "paypal" ? " (PayPal)" : "";
                  const methodLabel = `${methodBase}${providerTag}`;
                  const procRef = p.square_payment_id || p.provider_payment_id || p.reference || "—";
                  const nvrRef = p.nivra_reference || p.payment_number;
                  const sourceLabel = p.source ? (PAYMENT_SOURCES[p.source] || p.source) : "—";
                  return (
                    <tr key={p.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                      <td className="px-2 py-2 text-[#A1A1AA] whitespace-nowrap">{fmtDate(p.received_at || p.created_at)}</td>
                      <td className="px-2 py-2 text-emerald-400 font-medium tabular-nums whitespace-nowrap">{Number(p.amount).toFixed(2)} $</td>
                      <td className="px-2 py-2 text-[#CBD5E1] whitespace-nowrap">{methodLabel}</td>
                      <td className="px-2 py-2 font-mono text-[10px]">
                        {p.invoice?.invoice_number ? (
                          <Link to={corePath(`/invoices/${p.invoice_id}`)} className="text-[#38BDF8] hover:underline">{p.invoice.invoice_number}</Link>
                        ) : <span className="text-[hsl(220,10%,38%)]">—</span>}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] text-white">{nvrRef}</td>
                      <td className="px-2 py-2 font-mono text-[10px] text-[#94A3B8] truncate max-w-[140px]">{procRef}</td>
                      <td className="px-2 py-2 text-[#94A3B8] text-[10px]">{sourceLabel}</td>
                      <td className="px-2 py-2"><StatusBadge label={p.status || "confirmed"} variant={statusToVariant(p.status || "confirmed")} size="sm" /></td>
                      <td className="px-2 py-2">
                        {p.square_receipt_url && (
                          <a href={p.square_receipt_url} target="_blank" rel="noreferrer" className="text-[#38BDF8] hover:underline text-[10px]">Reçu</a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyRow label={billingCustomerId ? "Aucun paiement" : "Aucun compte de facturation lié"} />
        )}
      </HistorySection>



      {/* ═══ KYC SESSIONS ═══ */}
      <HistorySection title="Sessions de vérification KYC" icon={Shield} count={kycQ.data?.length || 0} loading={kycQ.isLoading}>
        {kycQ.data && kycQ.data.length > 0 ? (
          <div className="space-y-2 mt-2">
            {kycQ.data.map((k: any) => (
              <div key={k.id} className="flex items-center gap-3 p-3 rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-white">{k.case_number || k.id.slice(0, 8)}</span>
                    <span className="text-[10px] text-[hsl(220,10%,45%)]">{fmtDate(k.submitted_at || k.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-[#A1A1AA] mt-0.5">
                    {k.document_type || k.id_type || "Document"}
                    {k.reviewed_by && reviewersQ.data?.[k.reviewed_by] && (
                      <> · Vérifié par <span className="text-[hsl(220,10%,60%)]">{reviewersQ.data[k.reviewed_by]}</span></>
                    )}
                  </p>
                </div>
                <StatusBadge label={k.status || "pending"} variant={statusToVariant(k.status || "pending")} size="sm" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyRow label="Aucune session KYC" />
        )}
      </HistorySection>

      {/* ═══ COMMUNICATIONS (email + SMS + notifications + calls) — Module 46 ═══ */}
      <HistorySection title="Toutes les communications" icon={Mail} count={emailsQ.data?.length || 0} loading={emailsQ.isLoading} defaultOpen={false}>
        {emailsQ.data && emailsQ.data.length > 0 ? (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,14%)]">
                  {["Date", "Canal", "Destinataire", "Type / Sujet", "Statut"].map((h) => (
                    <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emailsQ.data.map((e: any) => (
                  <tr key={e.row_id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                    <td className="px-2 py-2 text-[#A1A1AA] whitespace-nowrap">{fmtDate(e.sent_at || e.created_at)}</td>
                    <td className="px-2 py-2 text-white uppercase text-[10px]">{e.channel}</td>
                    <td className="px-2 py-2 text-[#CBD5E1] truncate max-w-[180px]">{e.recipient || e.phone || "—"}</td>
                    <td className="px-2 py-2 text-[#A1A1AA] truncate max-w-[280px]">
                      {e.subject || formatTemplate(e.template_key) || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge
                        label={e.status === "sent" || e.status === "delivered" ? "envoyé" : e.status === "failed" ? "échoué" : e.status === "queued" || e.status === "pending" ? "en file" : e.status}
                        variant={statusToVariant(e.status === "sent" || e.status === "delivered" ? "active" : e.status)}
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyRow label="Aucune communication" />
        )}
      </HistorySection>

      {/* ═══ ACTIVITY TIMELINE ═══ */}
      <HistorySection title="Journal d'activité" icon={Clock} count={activityQ.data?.length || 0} loading={activityQ.isLoading} defaultOpen={false}>
        {activityQ.data && activityQ.data.length > 0 ? (
          <div className="space-y-1 mt-2 max-h-[500px] overflow-y-auto">
            {activityQ.data.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-[hsl(220,15%,14%)] last:border-0">
                <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", "bg-emerald-400/60")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white">
                    <span className="text-emerald-400 font-medium">{formatAction(log.action)}</span>
                    {log.entity_type && <span className="text-[hsl(220,10%,45%)]"> · {log.entity_type}</span>}
                  </p>
                  {log.changed_field && (
                    <p className="text-[10px] text-[hsl(220,10%,45%)] mt-0.5">
                      {log.changed_field}: <span className="text-[hsl(220,10%,55%)]">{log.old_value || "∅"}</span> → <span className="text-[hsl(220,10%,70%)]">{log.new_value || "∅"}</span>
                    </p>
                  )}
                  {log.actor_name && (
                    <p className="text-[10px] text-[hsl(220,10%,40%)] mt-0.5">
                      par {log.actor_name}{log.actor_role ? ` (${log.actor_role})` : ""}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-[hsl(220,10%,35%)] shrink-0 whitespace-nowrap">
                  {fmtDate(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyRow label="Aucune activité enregistrée" />
        )}
      </HistorySection>
    </div>
  );
};

export default ClientFullHistory;
