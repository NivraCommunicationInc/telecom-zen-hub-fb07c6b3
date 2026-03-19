/**
 * EmployeeOrderDetail — Phase 2: Enhanced order console.
 * Better status visualization, operational action bar, richer timeline,
 * appointment/equipment info. READ-ONLY canonical financials.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Loader2, ShoppingCart, Clock, Shield, FileText,
  DollarSign, User, MapPin, Calendar, Package, Send, MessageSquare,
  CheckCircle, XCircle, AlertTriangle, ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

function useEmployeeOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ["employee-order-detail-v2", orderId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!order) throw new Error("Commande introuvable");

      const [profileRes, invoiceRes, consentRes, logsRes, appointmentRes, accountRes] = await Promise.all([
        order.user_id
          ? supabase.from("profiles").select("full_name, email, phone").eq("user_id", order.user_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("billing_invoices")
          .select("id, invoice_number, total, subtotal, tps_amount, tvq_amount, status, due_date, paid_at, balance_due, amount_paid")
          .eq("order_id", orderId).maybeSingle(),
        supabase.from("consent_records").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1),
        supabase.from("activity_logs").select("action, created_at, actor_name, details, actor_role")
          .eq("entity_id", orderId).eq("entity_type", "order").order("created_at", { ascending: false }).limit(30),
        supabase.from("appointments").select("id, appointment_number, title, scheduled_at, status, service_address, service_city, technician_id")
          .eq("order_id", orderId).maybeSingle(),
        order.account_id
          ? supabase.from("accounts").select("account_number, status, billing_address, billing_city").eq("id", order.account_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        order,
        profile: profileRes.data,
        invoice: invoiceRes.data,
        consent: consentRes.data?.[0] ?? null,
        logs: logsRes.data ?? [],
        appointment: appointmentRes.data,
        account: accountRes.data,
        pricingSnapshot: order.pricing_snapshot as Record<string, any> | null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function EmployeeOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-sm text-[hsl(220,10%,40%)]">Commande introuvable</p>
        <Link to={employeePath("/orders")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  return <OrderDetailContent orderId={orderId} />;
}

function OrderDetailContent({ orderId }: { orderId: string }) {
  const { data, isLoading, error } = useEmployeeOrderDetail(orderId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();
      await supabase.from("activity_logs").insert({
        user_id: session.user.id,
        entity_id: orderId,
        entity_type: "order",
        action: `Note: ${note}`,
        actor_name: profile?.full_name ?? session.user.email ?? "Employé",
        actor_role: "employee",
      });
      await logInternalAudit({ action: "add_note", category: "operations", portal: "employee", entityType: "order", entityId: orderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-order-detail-v2", orderId] });
      setNoteText("");
      setShowNoteInput(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-red-400 text-sm font-medium">Erreur de chargement</p>
        <Link to={employeePath("/orders")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { order, profile, invoice, consent, logs, pricingSnapshot, appointment, account } = data;

  const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
    pending: { color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock },
    submitted: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Send },
    processing: { color: "text-indigo-400", bg: "bg-indigo-500/10", icon: Package },
    completed: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle },
    cancelled: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
    on_hold: { color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle },
  };
  const sc = statusConfig[order.status] ?? statusConfig.pending;

  const fmtMoney = (v: number | null | undefined) =>
    v != null ? `${v.toFixed(2)} $` : "—";

  const snap = pricingSnapshot;

  return (
    <div className="space-y-4">
      {/* Back */}
      <Link to={employeePath("/orders")} className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      {/* Header with status badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-400" />
            {order.order_number ?? `#${orderId.slice(0, 8)}`}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(220,10%,45%)]">
            <span>{format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
            <span className="text-[hsl(220,10%,20%)]">·</span>
            <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}</span>
            {order.service_type && (
              <>
                <span className="text-[hsl(220,10%,20%)]">·</span>
                <span className="text-[hsl(220,10%,55%)]">{order.service_type}</span>
              </>
            )}
          </div>
        </div>
        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", sc.bg)}>
          <sc.icon className={cn("h-4 w-4", sc.color)} />
          <span className={cn("text-xs font-semibold uppercase tracking-wide", sc.color)}>{order.status}</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
        >
          <MessageSquare className="h-3 w-3" /> Ajouter note
        </button>
        {profile?.email && (
          <button
            onClick={() => navigate(employeePath(`/clients/${order.user_id}`))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
          >
            <User className="h-3 w-3" /> Voir client
          </button>
        )}
        {invoice && (
          <button
            onClick={() => navigate(employeePath(`/payments`))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-xs text-[hsl(220,10%,55%)] hover:text-white hover:border-blue-500/30 transition-colors"
          >
            <DollarSign className="h-3 w-3" /> Facture {invoice.invoice_number}
          </button>
        )}
      </div>

      {/* Note input */}
      {showNoteInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Écrire une note interne…"
            className="flex-1 px-3 py-2 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,30%)] focus:outline-none focus:border-blue-500/50"
            onKeyDown={(e) => e.key === "Enter" && noteText.trim() && addNoteMutation.mutate(noteText.trim())}
          />
          <button
            onClick={() => noteText.trim() && addNoteMutation.mutate(noteText.trim())}
            disabled={addNoteMutation.isPending || !noteText.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {addNoteMutation.isPending ? "…" : "Envoyer"}
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MiniCard label="Commande" value={order.status} color={sc.color} />
            <MiniCard label="Paiement" value={order.payment_status ?? "—"}
              color={order.payment_status === "paid" ? "text-emerald-400" : "text-amber-400"} />
            <MiniCard label="Service" value={order.service_type ?? "—"} color="text-blue-400" />
            <MiniCard label="Source" value={(order as any).source ?? "web"} color="text-[hsl(220,10%,55%)]" />
          </div>

          {/* Pricing Snapshot — READ ONLY */}
          <Section title="Détail financier" icon={<DollarSign className="h-4 w-4" />} locked>
            <div className="rounded-lg p-3 bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,11%)]">
              <div className="flex items-center gap-1.5 mb-3">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                  Canonique · pricing_snapshot
                </span>
              </div>
              {snap ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <InfoRow label="Sous-total" value={fmtMoney(snap.subtotal)} />
                  <InfoRow label="TPS (5%)" value={fmtMoney(snap.tps_amount)} />
                  <InfoRow label="TVQ (9.975%)" value={fmtMoney(snap.tvq_amount)} />
                  {snap.discount_amount > 0 && <InfoRow label="Rabais" value={`-${fmtMoney(snap.discount_amount)}`} />}
                  {snap.activation_fee > 0 && <InfoRow label="Frais activation" value={fmtMoney(snap.activation_fee)} />}
                  {snap.delivery_fee > 0 && <InfoRow label="Livraison" value={fmtMoney(snap.delivery_fee)} />}
                  <div className="col-span-2 border-t border-[hsl(220,15%,13%)] pt-1.5 mt-1.5">
                    <InfoRow label="TOTAL" value={fmtMoney(snap.grand_total)} bold />
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <InfoRow label="Total facturé" value={fmtMoney(invoice?.total)} />
                  <InfoRow label="Total commande" value={fmtMoney(order.total_amount)} />
                  <p className="text-[10px] text-amber-400/80 mt-2">⚠ Aucun pricing_snapshot disponible</p>
                </div>
              )}
              {invoice && (
                <div className="mt-3 pt-2 border-t border-[hsl(220,15%,11%)] grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <InfoRow label="Facture" value={invoice.invoice_number} />
                  <InfoRow label="Statut facture" value={invoice.status ?? "—"} />
                  <InfoRow label="Montant payé" value={fmtMoney(invoice.amount_paid)} />
                  <InfoRow label="Solde dû" value={fmtMoney(invoice.balance_due)} />
                </div>
              )}
            </div>
          </Section>

          {/* Consent */}
          {consent && (
            <Section title="Consentement" icon={<Shield className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <InfoRow label="Horodatage" value={format(new Date(consent.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })} />
                <InfoRow label="IP" value={(consent as any).ip_address ?? "—"} />
                <InfoRow label="Conditions" value={(consent as any).terms_accepted ? "✓ Acceptées" : "✗ Non"} />
              </div>
            </Section>
          )}

          {/* Appointment */}
          {appointment && (
            <Section title="Rendez-vous" icon={<Calendar className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <InfoRow label="Numéro" value={appointment.appointment_number ?? "—"} />
                <InfoRow label="Statut" value={appointment.status ?? "—"} />
                <InfoRow label="Date" value={format(new Date(appointment.scheduled_at), "d MMM yyyy HH:mm", { locale: fr })} />
                <InfoRow label="Adresse" value={[appointment.service_address, appointment.service_city].filter(Boolean).join(", ") || "—"} />
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT: Client + Account + Timeline */}
        <div className="space-y-4">
          {/* Client card */}
          <Section title="Client" icon={<User className="h-4 w-4" />}>
            <div className="space-y-1 text-xs">
              <InfoRow label="Nom" value={profile?.full_name ?? "—"} />
              <InfoRow label="Email" value={profile?.email ?? "—"} />
              <InfoRow label="Téléphone" value={profile?.phone ?? "—"} />
            </div>
            {account && (
              <div className="mt-3 pt-2 border-t border-[hsl(220,15%,11%)] space-y-1 text-xs">
                <InfoRow label="Compte" value={account.account_number} />
                <InfoRow label="Statut" value={account.status ?? "—"} />
                {account.billing_city && <InfoRow label="Ville" value={account.billing_city} />}
              </div>
            )}
            {order.user_id && (
              <button
                onClick={() => navigate(employeePath(`/clients/${order.user_id}`))}
                className="mt-3 flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
              >
                Voir profil complet <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </Section>

          {/* Timeline */}
          <Section title="Historique" icon={<Clock className="h-4 w-4" />}>
            {logs.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,30%)]">Aucune entrée.</p>
            ) : (
              <div className="space-y-0 max-h-[500px] overflow-y-auto pr-1">
                {logs.map((log, i) => {
                  const isNote = log.action?.startsWith("Note:");
                  return (
                    <div key={i} className="relative pl-4 pb-3 last:pb-0">
                      {/* Vertical line */}
                      {i < logs.length - 1 && (
                        <div className="absolute left-[5px] top-[10px] bottom-0 w-px bg-[hsl(220,15%,13%)]" />
                      )}
                      {/* Dot */}
                      <div className={cn(
                        "absolute left-0 top-[5px] h-[10px] w-[10px] rounded-full border-2",
                        isNote
                          ? "bg-blue-500/20 border-blue-500/50"
                          : "bg-[hsl(220,15%,13%)] border-[hsl(220,15%,18%)]"
                      )} />
                      <div>
                        <p className={cn("text-xs font-medium", isNote ? "text-blue-300" : "text-white")}>
                          {isNote ? log.action.replace("Note: ", "") : log.action}
                        </p>
                        <p className="text-[10px] text-[hsl(220,10%,35%)] mt-0.5">
                          {log.actor_name ?? "Système"}
                          {log.actor_role && ` · ${log.actor_role}`}
                          {" · "}
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7.5%)] p-3">
      <p className="text-[10px] text-[hsl(220,10%,38%)] font-medium mb-1">{label}</p>
      <p className={cn("text-xs font-semibold uppercase", color)}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children, locked }: { title: string; icon: React.ReactNode; children: React.ReactNode; locked?: boolean }) {
  return (
    <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,8%)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[hsl(220,10%,38%)]">{icon}</span>
        <h3 className="text-xs font-semibold text-[hsl(220,10%,58%)] uppercase tracking-wider">{title}</h3>
        {locked && (
          <span className="ml-auto text-[9px] text-[hsl(220,10%,30%)] bg-[hsl(220,15%,11%)] px-1.5 py-0.5 rounded font-mono">
            LECTURE SEULE
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-[hsl(220,10%,42%)]">{label}</span>
      <span className={cn("text-white text-right max-w-[60%] truncate", bold && "font-bold")}>{value}</span>
    </div>
  );
}
