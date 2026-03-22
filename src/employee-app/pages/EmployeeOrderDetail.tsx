/**
 * EmployeeOrderDetail — Full operational order console for employees.
 * Status visualization, operational actions, canonical financials (read-only),
 * equipment, appointment, shipping, subscription visibility.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Loader2, ShoppingCart, Clock, Shield, FileText,
  DollarSign, User, MapPin, Calendar, Package, Send, MessageSquare,
  CheckCircle, XCircle, AlertTriangle, ChevronRight, Wrench,
  Truck, Zap, CreditCard, Phone, Mail, Hash,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";
import { NextOperationalStep } from "@/employee-app/components/NextOperationalStep";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";

function useEmployeeOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ["employee-order-detail-v3", orderId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!order) throw new Error("Commande introuvable");

      const [profileRes, invoiceRes, consentRes, logsRes, appointmentRes, accountRes, subscriptionRes, equipmentRes] = await Promise.all([
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
        supabase.from("billing_subscriptions")
          .select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at")
          .eq("order_id", orderId).maybeSingle(),
        supabase.from("equipment_inventory")
          .select("id, catalog_name, serial_number, mac_address, status, category, sku, condition")
          .eq("order_id", orderId),
      ]);

      // Load payment if invoice exists
      let paymentData = null;
      if (invoiceRes.data?.id) {
        const { data: payment } = await supabase
          .from("billing_payments")
          .select("id, payment_number, status, amount, method, provider, received_at, reference")
          .eq("invoice_id", invoiceRes.data.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        paymentData = payment;
      }

      return {
        order,
        profile: profileRes.data,
        invoice: invoiceRes.data,
        payment: paymentData,
        consent: consentRes.data?.[0] ?? null,
        logs: logsRes.data ?? [],
        appointment: appointmentRes.data,
        account: accountRes.data,
        subscription: subscriptionRes.data,
        equipment: equipmentRes.data ?? [],
        pricingSnapshot: order.pricing_snapshot as Record<string, any> | null,
      };
    },
    staleTime: 1000 * 60 * 2,
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
      await logInternalAudit({ action: "add_note", category: "operations", portal: "employee", targetType: "order", targetId: orderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-order-detail-v3", orderId] });
      setNoteText("");
      setShowNoteInput(false);
      toast.success("Note ajoutée");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  /* ─── Operational status update ─── */
  const statusMutation = useMutation({
    mutationFn: async ({ newStatus, logAction }: { newStatus: string; logAction: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();
      await supabase.from("activity_logs").insert({
        user_id: session.user.id,
        entity_id: orderId,
        entity_type: "order",
        action: logAction,
        actor_name: profile?.full_name ?? session.user.email ?? "Employé",
        actor_role: "employee",
      });
      await logInternalAudit({ action: logAction.toLowerCase().replace(/\s/g, "_"), category: "operations", portal: "employee", targetType: "order", targetId: orderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-order-detail-v3", orderId] });
      toast.success("Statut mis à jour");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-red-400 text-sm font-medium">Erreur de chargement</p>
        <p className="text-xs text-[hsl(220,10%,40%)] mt-1">{error instanceof Error ? error.message : "Commande introuvable"}</p>
        <Link to={employeePath("/orders")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { order, profile, invoice, payment, consent, logs, pricingSnapshot, appointment, account, subscription, equipment } = data;

  const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
    pending: { color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock, label: "En attente" },
    submitted: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Send, label: "Soumise" },
    received: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Package, label: "Reçue" },
    processing: { color: "text-indigo-400", bg: "bg-indigo-500/10", icon: Package, label: "En traitement" },
    confirmed: { color: "text-blue-400", bg: "bg-blue-500/10", icon: CheckCircle, label: "Confirmée" },
    shipped: { color: "text-cyan-400", bg: "bg-cyan-500/10", icon: Truck, label: "Expédiée" },
    delivered: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Package, label: "Livrée" },
    installed: { color: "text-indigo-400", bg: "bg-indigo-500/10", icon: Wrench, label: "Installée" },
    activated: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Zap, label: "Activée" },
    completed: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle, label: "Complétée" },
    cancelled: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle, label: "Annulée" },
    on_hold: { color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle, label: "En pause" },
  };
  const sc = statusConfig[order.status] ?? statusConfig.pending;

  const fmtMoney = (v: number | null | undefined) => v != null ? `${v.toFixed(2)} $` : "—";

  const ACTION_CONSEQUENCES: Record<string, string> = {
    received: "La commande sera marquée comme reçue par les opérations",
    processing: "Le traitement sera lancé — la commande apparaîtra comme en cours",
    shipped: "Marquer expédiée → le client sera notifié de l'envoi",
    delivered: "Marquer livrée → permettra l'activation du service",
    installed: "Installation terminée → permettra l'activation du service",
    activated: "Activer le service → l'abonnement deviendra actif",
    completed: "Clôturer la commande → aucune autre action possible",
    on_hold: "Mettre en pause → bloque toutes les actions suivantes",
  };

  // Determine available operational actions based on current status
  const getAvailableActions = () => {
    const actions: { label: string; status: string; logAction: string; variant: "primary" | "default" | "warning" }[] = [];
    const s = order.status;

    if (s === "pending" || s === "submitted") {
      actions.push({ label: "Marquer reçue", status: "received", logAction: "Commande marquée reçue", variant: "default" });
    }
    if (s === "received" || s === "pending" || s === "submitted") {
      actions.push({ label: "Commencer traitement", status: "processing", logAction: "Traitement commencé", variant: "primary" });
    }
    if (s === "processing") {
      actions.push({ label: "Marquer expédiée", status: "shipped", logAction: "Commande expédiée", variant: "default" });
      actions.push({ label: "Marquer installée", status: "installed", logAction: "Installation terminée", variant: "default" });
    }
    if (s === "shipped") {
      actions.push({ label: "Marquer livrée", status: "delivered", logAction: "Commande livrée", variant: "primary" });
    }
    if (s === "delivered" || s === "installed") {
      actions.push({ label: "Activer le service", status: "activated", logAction: "Service activé", variant: "primary" });
    }
    if (s === "activated") {
      actions.push({ label: "Marquer complétée", status: "completed", logAction: "Commande complétée", variant: "primary" });
    }
    if (!["completed", "cancelled", "activated"].includes(s)) {
      actions.push({ label: "Mettre en pause", status: "on_hold", logAction: "Commande mise en pause", variant: "warning" });
    }
    if (s === "on_hold") {
      actions.push({ label: "Reprendre traitement", status: "processing", logAction: "Traitement repris", variant: "primary" });
    }
    return actions;
  };

  const availableActions = getAvailableActions();

  return (
    <div className="space-y-4">
      <Link to={employeePath("/orders")} className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      {/* Header */}
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
          <span className={cn("text-xs font-semibold uppercase tracking-wide", sc.color)}>{sc.label}</span>
        </div>
      </div>

      {/* ═══ Operational Status Summary ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <MiniCard label="Commande" value={sc.label} color={sc.color} />
        <MiniCard label="Paiement" value={order.payment_status ?? "—"}
          color={order.payment_status === "paid" ? "text-emerald-400" : order.payment_status === "failed" ? "text-red-400" : "text-amber-400"} />
        <MiniCard label="Facture" value={invoice?.status ?? "—"}
          color={invoice?.status === "paid" ? "text-emerald-400" : "text-amber-400"} />
        <MiniCard label="Abonnement" value={subscription?.status ?? "—"}
          color={subscription?.status === "active" ? "text-emerald-400" : "text-amber-400"} />
        <MiniCard label="Équipement" value={equipment.length > 0 ? `${equipment.length} assigné(s)` : "Aucun"}
          color={equipment.length > 0 ? "text-blue-400" : "text-[hsl(220,10%,40%)]"} />
      </div>

      {/* ═══ NEXT OPERATIONAL STEP ═══ */}
      <NextOperationalStep
        orderStatus={order.status}
        paymentStatus={order.payment_status}
        hasEquipment={equipment.length > 0}
        hasAppointment={!!appointment}
        subscriptionStatus={subscription?.status ?? null}
        invoiceStatus={invoice?.status ?? null}
      />

      {/* ═══ Latest Note / Last Action ═══ */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,7%)] px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare className="h-3 w-3 text-[hsl(220,10%,38%)]" />
            <span className="text-[10px] text-[hsl(220,10%,40%)] font-semibold uppercase tracking-wider">Dernière action</span>
          </div>
          <p className="text-xs text-white font-medium">{logs[0].action}</p>
          <p className="text-[10px] text-[hsl(220,10%,35%)] mt-0.5">
            {logs[0].actor_name ?? "Système"} · {logs[0].actor_role ?? ""} · {formatDistanceToNow(new Date(logs[0].created_at), { addSuffix: true, locale: fr })}
          </p>
        </div>
      )}

      {/* ═══ Canonical Traceability IDs ═══ */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[hsl(220,10%,35%)] font-mono">
        <span>order: {orderId.slice(0, 8)}</span>
        {invoice && <span>· inv: {invoice.invoice_number}</span>}
        {payment && <span>· pay: {payment.payment_number}</span>}
        {subscription && <span>· sub: {subscription.id.slice(0, 8)}</span>}
        {appointment && <span>· apt: {appointment.appointment_number || appointment.id.slice(0, 8)}</span>}
        <span>· màj: {format(new Date(order.updated_at || order.created_at), "d MMM HH:mm", { locale: fr })}</span>
      </div>

      {/* ═══ Operational Actions with consequences ═══ */}
      {availableActions.length > 0 && (
        <div className="rounded-xl border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] p-4">
          <h3 className="text-xs font-semibold text-[hsl(220,10%,50%)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Actions opérationnelles
          </h3>
          <div className="flex flex-wrap gap-2">
            {availableActions.map((action) => (
              <ActionConfirmButton
                key={action.status}
                label={action.label}
                consequence={ACTION_CONSEQUENCES[action.status] || `${action.label} — cette action sera enregistrée`}
                onConfirm={() => statusMutation.mutate({ newStatus: action.status, logAction: action.logAction })}
                isPending={statusMutation.isPending}
                variant={action.variant}
              />
            ))}
          </div>
        </div>
      )}

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
        <div className="lg:col-span-2 space-y-4">
          {/* Financial detail — READ ONLY */}
          <Section title="Détail financier" icon={<DollarSign className="h-4 w-4" />} locked>
            <div className="rounded-lg p-3 bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,11%)]">
              <div className="flex items-center gap-1.5 mb-3">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Canonique</span>
              </div>
              {pricingSnapshot ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <InfoRow label="Sous-total" value={fmtMoney(pricingSnapshot.subtotal)} />
                  <InfoRow label="TPS (5%)" value={fmtMoney(pricingSnapshot.tps_amount)} />
                  <InfoRow label="TVQ (9.975%)" value={fmtMoney(pricingSnapshot.tvq_amount)} />
                  {pricingSnapshot.discount_amount > 0 && <InfoRow label="Rabais" value={`-${fmtMoney(pricingSnapshot.discount_amount)}`} />}
                  <div className="col-span-2 border-t border-[hsl(220,15%,13%)] pt-1.5 mt-1.5">
                    <InfoRow label="TOTAL" value={fmtMoney(pricingSnapshot.grand_total)} bold />
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <InfoRow label="Total commande" value={fmtMoney(order.total_amount)} />
                </div>
              )}
              {invoice && (
                <div className="mt-3 pt-2 border-t border-[hsl(220,15%,11%)] grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <InfoRow label="Facture" value={invoice.invoice_number} />
                  <InfoRow label="Statut" value={invoice.status ?? "—"} />
                  <InfoRow label="Payé" value={fmtMoney(invoice.amount_paid)} />
                  <InfoRow label="Solde dû" value={fmtMoney(invoice.balance_due)} />
                  {invoice.due_date && <InfoRow label="Échéance" value={format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })} />}
                </div>
              )}
              {payment && (
                <div className="mt-3 pt-2 border-t border-[hsl(220,15%,11%)] grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <InfoRow label="Paiement" value={payment.payment_number} />
                  <InfoRow label="Statut" value={payment.status ?? "—"} />
                  <InfoRow label="Montant" value={fmtMoney(payment.amount)} />
                  <InfoRow label="Méthode" value={payment.method ?? "—"} />
                  {payment.reference && <InfoRow label="Référence" value={payment.reference} />}
                  {payment.received_at && <InfoRow label="Reçu" value={format(new Date(payment.received_at), "d MMM yyyy HH:mm", { locale: fr })} />}
                </div>
              )}
            </div>
          </Section>

          {/* Equipment */}
          {equipment.length > 0 && (
            <Section title={`Équipement (${equipment.length})`} icon={<Wrench className="h-4 w-4" />}>
              <div className="space-y-2">
                {equipment.map((eq: any) => (
                  <div key={eq.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(220,20%,7%)] border border-[hsl(220,15%,11%)]">
                    <div>
                      <p className="text-xs text-white font-medium">{eq.catalog_name || eq.category}</p>
                      <p className="text-[10px] text-[hsl(220,10%,40%)] font-mono mt-0.5">
                        {[eq.serial_number, eq.mac_address].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium",
                      eq.status === "assigned" ? "text-blue-400 bg-blue-500/10" :
                      eq.status === "deployed" ? "text-emerald-400 bg-emerald-500/10" :
                      "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,13%)]"
                    )}>
                      {eq.status}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Subscription */}
          {subscription && (
            <Section title="Abonnement" icon={<Zap className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <InfoRow label="Plan" value={subscription.plan_name} />
                <InfoRow label="Prix" value={fmtMoney(subscription.plan_price)} />
                <InfoRow label="Statut" value={subscription.status ?? "—"} />
                {subscription.cycle_start_date && <InfoRow label="Cycle" value={`${format(new Date(subscription.cycle_start_date), "d MMM", { locale: fr })} → ${format(new Date(subscription.cycle_end_date), "d MMM yyyy", { locale: fr })}`} />}
                {subscription.next_renewal_at && <InfoRow label="Prochain renouvellement" value={format(new Date(subscription.next_renewal_at), "d MMM yyyy", { locale: fr })} />}
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

          {/* Shipping info */}
          {((order as any).shipping_carrier || (order as any).shipping_tracking_number) && (
            <Section title="Expédition" icon={<Truck className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <InfoRow label="Transporteur" value={(order as any).shipping_carrier || "—"} />
                <InfoRow label="Suivi" value={(order as any).shipping_tracking_number || "—"} />
              </div>
              {(order as any).shipping_tracking_url && (
                <a href={(order as any).shipping_tracking_url} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:underline mt-1 inline-block">
                  Suivre le colis →
                </a>
              )}
            </Section>
          )}

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
        </div>

        {/* RIGHT */}
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
                      {i < logs.length - 1 && (
                        <div className="absolute left-[5px] top-[10px] bottom-0 w-px bg-[hsl(220,15%,13%)]" />
                      )}
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
    <div className="rounded-lg border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] px-3 py-2">
      <p className="text-[10px] text-[hsl(220,10%,40%)] font-medium">{label}</p>
      <p className={cn("text-xs font-semibold mt-0.5 capitalize", color)}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[hsl(220,10%,45%)]">{label}</span>
      <span className={cn("text-white text-right", bold && "font-semibold")}>{value}</span>
    </div>
  );
}

function Section({ title, icon, children, locked }: { title: string; icon: React.ReactNode; children: React.ReactNode; locked?: boolean }) {
  return (
    <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,8%)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[hsl(220,10%,38%)]">{icon}</span>
        <h3 className="text-xs font-semibold text-[hsl(220,10%,55%)] uppercase tracking-wider">{title}</h3>
        {locked && (
          <span className="ml-auto text-[9px] text-[hsl(220,10%,28%)] bg-[hsl(220,15%,11%)] px-1.5 py-0.5 rounded font-mono">
            LECTURE SEULE
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
