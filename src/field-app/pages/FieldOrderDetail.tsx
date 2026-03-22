/**
 * FieldOrderDetail — Full operational view of a field sales order.
 * Shows canonical pipeline status, payment state, Core sync, customer context,
 * equipment, promos, installation, appointment, and real actions.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Phone, Mail, MapPin, Package,
  CheckCircle2, Clock, AlertCircle, XCircle, Wallet,
  Banknote, RefreshCw, Building2, Truck, Wrench, Calendar,
  Tag, Users, Receipt, CreditCard, Zap, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { toast } from "sonner";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { NextActionBanner } from "@/field-app/components/NextActionBanner";
import { OrderSummaryStrip } from "@/field-app/components/OrderSummaryStrip";

/* ─── Status configurations ─── */
const SYNC_CONFIG: Record<string, { label: string; desc: string; icon: typeof CheckCircle2; classes: string }> = {
  synced: { label: "Synchronisé", desc: "Commande visible dans Nivra Core", icon: CheckCircle2, classes: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  pending: { label: "En attente", desc: "Synchronisation vers Core en cours", icon: Clock, classes: "text-amber-600 bg-amber-50 border-amber-200" },
  error: { label: "Erreur", desc: "La synchronisation a échoué", icon: AlertCircle, classes: "text-red-600 bg-red-50 border-red-200" },
};

const PAYMENT_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  confirmed: { label: "Paiement reçu", icon: CheckCircle2, classes: "text-emerald-600" },
  pending: { label: "Paiement en attente", icon: Clock, classes: "text-amber-600" },
  failed: { label: "Paiement échoué", icon: XCircle, classes: "text-red-600" },
  cancelled: { label: "Annulé", icon: XCircle, classes: "text-gray-500" },
};

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: typeof Wallet }> = {
  paypal: { label: "PayPal", icon: Wallet },
  interac: { label: "Virement Interac", icon: Banknote },
  deferred: { label: "Différé", icon: Clock },
  card: { label: "Carte (via PayPal)", icon: Wallet },
  cash: { label: "Comptant", icon: Banknote },
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  submitted: "Soumise",
  received: "Reçue",
  processing: "En traitement",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  installed: "Installée",
  activated: "Activée",
  completed: "Complétée",
  cancelled: "Annulée",
  on_hold: "En attente",
};

export default function FieldOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const queryClient = useQueryClient();

  /* ─── Load field_sales_order ─── */
  const { data: order, isLoading } = useQuery({
    queryKey: ["field-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_sales_orders")
        .select("*")
        .eq("id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  /* ─── Load canonical order if converted ─── */
  const { data: canonicalOrder } = useQuery({
    queryKey: ["canonical-order-for-field", order?.converted_order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, payment_status, service_type, shipping_carrier, shipping_tracking_number, shipping_tracking_url, fulfillment_type")
        .eq("id", order!.converted_order_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.converted_order_id,
  });

  /* ─── Load canonical invoice if order exists ─── */
  const { data: canonicalInvoice } = useQuery({
    queryKey: ["canonical-invoice-for-field", order?.converted_order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, status, total, amount_paid, balance_due, due_date")
        .eq("order_id", order!.converted_order_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.converted_order_id,
  });

  /* ─── Load canonical payment ─── */
  const { data: canonicalPayment } = useQuery({
    queryKey: ["canonical-payment-for-field", canonicalInvoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_payments")
        .select("id, payment_number, status, amount, method, provider, received_at")
        .eq("invoice_id", canonicalInvoice!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!canonicalInvoice?.id,
  });

  /* ─── Load appointment if canonical order exists ─── */
  const { data: appointment } = useQuery({
    queryKey: ["field-appointment", order?.converted_order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_number, title, scheduled_at, status, service_address, service_city, technician_id")
        .eq("order_id", order!.converted_order_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.converted_order_id,
  });

  /* ─── Load subscription if canonical order exists ─── */
  const { data: subscription } = useQuery({
    queryKey: ["field-subscription", order?.converted_order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date")
        .eq("order_id", order!.converted_order_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!order?.converted_order_id,
  });

  /* ─── Load commission for this order ─── */
  const { data: commission } = useQuery({
    queryKey: ["field-commission", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_commissions")
        .select("id, amount, status, reason")
        .eq("sale_id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  /* ─── Retry sync ─── */
  const retrySyncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("field-sales-sync", {
        body: { action: "sync_single", sale_id: orderId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Sync failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-order", orderId] });
      toast.success("Synchronisation réussie");
    },
    onError: (err: any) => {
      toast.error(`Échec de synchronisation: ${err.message}`);
    },
  });

  /* ─── Cancel order ─── */
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (order?.payment_status === "confirmed" || order?.sync_status === "synced") {
        throw new Error("Impossible d'annuler une commande payée ou déjà synchronisée");
      }
      const { error } = await supabase
        .from("field_sales_orders")
        .update({ payment_status: "cancelled", sync_status: "error", sync_error: "Cancelled by agent", updated_at: new Date().toISOString() })
        .eq("id", orderId!);
      if (error) throw error;
      await logInternalAudit({ action: "field_order_cancelled", category: "operations", portal: "field", targetType: "field_sales_order", targetId: orderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-order", orderId] });
      toast.success("Commande annulée");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;
  if (!order) return (
    <div className="text-center py-16">
      <p className="text-sm text-[#6B7280]">Commande introuvable</p>
      <button onClick={() => navigate(fieldPath("/submissions"))} className="text-sm text-[#22C55E] hover:underline mt-2">Retour</button>
    </div>
  );

  const sync = SYNC_CONFIG[order.sync_status || "pending"] || SYNC_CONFIG.pending;
  const payment = PAYMENT_CONFIG[order.payment_status || "pending"] || PAYMENT_CONFIG.pending;
  const payMethod = PAYMENT_METHOD_LABELS[order.payment_method || "deferred"] || PAYMENT_METHOD_LABELS.deferred;
  const SyncIcon = sync.icon;
  const PaymentIcon = payment.icon;
  const MethodIcon = payMethod.icon;
  const services: any[] = Array.isArray(order.services) ? order.services : [];
  const equipment: any[] = Array.isArray((order as any).equipment) ? (order as any).equipment : [];
  const canCancel = order.payment_status !== "confirmed" && order.sync_status !== "synced" && order.payment_status !== "cancelled";
  const canRetrySync = order.sync_status === "error" || order.sync_status === "pending";

  // Compute totals from services
  const monthlyTotal = services.reduce((sum: number, s: any) => sum + (Number(s.price_monthly) || 0), 0);
  const oneTimeTotal = (Number((order as any).activation_fee) || 0) + (Number((order as any).delivery_fee) || 0) + (Number((order as any).installation_fee) || 0);

  // Determine operational phase
  const getPhaseLabel = () => {
    if (order.payment_status === "cancelled") return "Annulée";
    if (!order.converted_order_id) {
      if (order.sync_status === "error") return "Erreur synchronisation";
      if (order.payment_status === "pending") return "Attente paiement";
      return "Synchronisation en cours";
    }
    if (canonicalOrder) {
      return ORDER_STATUS_LABELS[canonicalOrder.status] || canonicalOrder.status;
    }
    return "En traitement Core";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fieldPath("/submissions"))} className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors">
          <ArrowLeft className="h-4 w-4 text-[#6B7280]" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#000000]">{order.customer_name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[#6B7280] font-mono">{order.id.slice(0, 8).toUpperCase()}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#374151] font-medium">{getPhaseLabel()}</span>
          </div>
        </div>
        <span className="text-lg font-bold text-[#000000]">{order.total_amount?.toFixed(2)} $</span>
      </div>

      {/* ═══ Pipeline Status ═══ */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn("rounded-xl border p-4", sync.classes.replace(/text-\S+/, ""))}>
          <div className="flex items-center gap-2">
            <SyncIcon className={cn("h-5 w-5", sync.classes.split(" ")[0])} />
            <div>
              <p className={cn("text-sm font-semibold", sync.classes.split(" ")[0])}>{sync.label}</p>
              <p className="text-[10px] text-[#6B7280] mt-0.5">{sync.desc}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex items-center gap-2">
            <PaymentIcon className={cn("h-5 w-5", payment.classes)} />
            <div>
              <p className={cn("text-sm font-semibold", payment.classes)}>{payment.label}</p>
              <p className="text-[10px] text-[#6B7280] mt-0.5 flex items-center gap-1">
                <MethodIcon className="h-3 w-3" /> {payMethod.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Canonical Order Chain ═══ */}
      {order.converted_order_id && canonicalOrder && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Pipeline canonique
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Commande Core" value={canonicalOrder.order_number || canonicalOrder.id.slice(0, 8)} mono />
            <InfoRow label="Statut commande" value={ORDER_STATUS_LABELS[canonicalOrder.status] || canonicalOrder.status} />
            <InfoRow label="Statut paiement" value={canonicalOrder.payment_status || "—"} />
            <InfoRow label="Type" value={canonicalOrder.service_type || "—"} />
          </div>
          {canonicalInvoice && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-[#F3F4F6] pt-3">
              <InfoRow label="Facture" value={canonicalInvoice.invoice_number} mono />
              <InfoRow label="Statut facture" value={canonicalInvoice.status || "—"} />
              <InfoRow label="Total facturé" value={`${canonicalInvoice.total?.toFixed(2)} $`} bold />
              <InfoRow label="Solde dû" value={`${(canonicalInvoice.balance_due ?? 0).toFixed(2)} $`} />
            </div>
          )}
          {canonicalPayment && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-[#F3F4F6] pt-3">
              <InfoRow label="Paiement" value={canonicalPayment.payment_number} mono />
              <InfoRow label="Montant" value={`${canonicalPayment.amount?.toFixed(2)} $`} bold />
              <InfoRow label="Fournisseur" value={canonicalPayment.provider || canonicalPayment.method} />
              <InfoRow label="Statut paiement" value={canonicalPayment.status || "—"} />
            </div>
          )}
          <div className="mt-2 p-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg">
            <p className="text-xs font-medium text-[#16A34A] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Visible dans Nivra Core — traitement en cours
            </p>
          </div>
        </div>
      )}

      {/* Sync error state */}
      {!order.converted_order_id && order.sync_status === "error" && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl">
          <p className="text-sm font-medium text-[#DC2626] flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> Synchronisation échouée
          </p>
          {order.sync_error && <p className="text-xs text-[#B91C1C] mt-1">{order.sync_error}</p>}
        </div>
      )}

      {/* Sync pending state */}
      {!order.converted_order_id && order.sync_status !== "error" && order.payment_status !== "cancelled" && (
        <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl">
          <p className="text-sm font-medium text-[#D97706] flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> En attente de synchronisation vers Core
          </p>
        </div>
      )}

      {/* ═══ Appointment ═══ */}
      {appointment && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Rendez-vous
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Numéro" value={appointment.appointment_number || "—"} mono />
            <InfoRow label="Statut" value={appointment.status || "—"} />
            <InfoRow label="Date" value={format(new Date(appointment.scheduled_at), "d MMM yyyy HH:mm", { locale: fr })} />
            <InfoRow label="Adresse" value={[appointment.service_address, appointment.service_city].filter(Boolean).join(", ") || "—"} />
          </div>
        </div>
      )}

      {/* ═══ Shipping (if applicable) ═══ */}
      {canonicalOrder?.shipping_carrier && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Expédition
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Transporteur" value={canonicalOrder.shipping_carrier} />
            <InfoRow label="Suivi" value={canonicalOrder.shipping_tracking_number || "—"} mono />
          </div>
          {canonicalOrder.shipping_tracking_url && (
            <a href={canonicalOrder.shipping_tracking_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#22C55E] hover:underline">
              Suivre le colis →
            </a>
          )}
        </div>
      )}

      {/* ═══ Subscription (if exists) ═══ */}
      {subscription && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Abonnement
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Plan" value={subscription.plan_name} />
            <InfoRow label="Prix" value={`${subscription.plan_price?.toFixed(2)} $/mois`} />
            <InfoRow label="Statut" value={subscription.status || "—"} />
            <InfoRow label="Cycle" value={subscription.cycle_start_date ? `${format(new Date(subscription.cycle_start_date), "d MMM", { locale: fr })} → ${format(new Date(subscription.cycle_end_date), "d MMM yyyy", { locale: fr })}` : "—"} />
          </div>
        </div>
      )}

      {/* ═══ Client ═══ */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Client</h3>
        <div className="space-y-2">
          {order.customer_phone && (
            <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-sm text-[#000000] hover:text-[#22C55E]">
              <Phone className="h-4 w-4 text-[#6B7280]" />{order.customer_phone}
            </a>
          )}
          {order.customer_email && (
            <a href={`mailto:${order.customer_email}`} className="flex items-center gap-2 text-sm text-[#000000] hover:text-[#22C55E]">
              <Mail className="h-4 w-4 text-[#6B7280]" />{order.customer_email}
            </a>
          )}
          {order.customer_address && (
            <div className="flex items-start gap-2 text-sm text-[#6B7280]">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{order.customer_address}{order.customer_city ? `, ${order.customer_city}` : ""}{order.customer_postal_code ? ` ${order.customer_postal_code}` : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Services + Pricing ═══ */}
      {services.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Services
          </h3>
          <div className="space-y-2">
            {services.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-[#F9FAFB]">
                <span className="flex items-center gap-1.5 text-[#000000] font-medium">
                  <Package className="h-3.5 w-3.5 text-[#22C55E]" />
                  {s.name}
                </span>
                <span className="font-semibold text-[#000000]">{s.price_monthly?.toFixed(2)} $/mois</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#F3F4F6] pt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="p-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
              <p className="text-[10px] text-[#6B7280] font-medium">Mensuel récurrent</p>
              <p className="text-sm font-bold text-[#16A34A] mt-0.5">{monthlyTotal.toFixed(2)} $/mois</p>
            </div>
            {oneTimeTotal > 0 && (
              <div className="p-2.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
                <p className="text-[10px] text-[#6B7280] font-medium">Frais uniques</p>
                <p className="text-sm font-bold text-[#2563EB] mt-0.5">{oneTimeTotal.toFixed(2)} $</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Equipment ═══ */}
      {equipment.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Équipement
          </h3>
          {equipment.map((eq: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-[#F9FAFB]">
              <span className="text-[#000000]">{eq.name || eq.model || `Équipement ${i + 1}`}</span>
              {eq.serial_number && <span className="font-mono text-xs text-[#6B7280]">{eq.serial_number}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ═══ Promo / Referral ═══ */}
      {((order as any).promo_code || (order as any).referral_code) && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Promotions & Référencement
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {(order as any).promo_code && <InfoRow label="Code promo" value={(order as any).promo_code} mono />}
            {(order as any).referral_code && <InfoRow label="Code référence" value={(order as any).referral_code} mono />}
            {(order as any).discount_amount && <InfoRow label="Rabais" value={`-${Number((order as any).discount_amount).toFixed(2)} $`} />}
          </div>
        </div>
      )}

      {/* ═══ Installation Type ═══ */}
      {((order as any).installation_type || canonicalOrder?.fulfillment_type) && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Installation
          </h3>
          <div className="text-sm">
            <InfoRow label="Type" value={(order as any).installation_type || canonicalOrder?.fulfillment_type || "—"} />
          </div>
        </div>
      )}

      {/* ═══ Notes ═══ */}
      {order.internal_notes && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Notes internes</h3>
          <p className="text-sm text-[#6B7280] whitespace-pre-line">{order.internal_notes}</p>
        </div>
      )}

      {/* ═══ Timestamps ═══ */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Historique</h3>
        <div className="text-xs text-[#6B7280] space-y-1">
          <p>Créée: {format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
          {order.updated_at && <p>Mise à jour: {formatDistanceToNow(new Date(order.updated_at), { addSuffix: true, locale: fr })}</p>}
        </div>
      </div>

      {/* ═══ Actions ═══ */}
      <div className="space-y-2 pb-4">
        {canRetrySync && (
          <button
            onClick={() => retrySyncMutation.mutate()}
            disabled={retrySyncMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] text-white font-semibold text-sm hover:bg-[#16A34A] disabled:opacity-50 transition-colors"
          >
            {retrySyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Relancer la synchronisation vers Core
          </button>
        )}

        {canCancel && (
          <button
            onClick={() => {
              if (confirm("Annuler cette commande ? Cette action est irréversible.")) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#FECACA] text-[#DC2626] text-sm font-medium hover:bg-[#FEF2F2] transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Annuler cette commande
          </button>
        )}

        {!canCancel && order.payment_status === "confirmed" && order.sync_status === "synced" && (
          <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-center">
            <p className="text-sm font-medium text-[#16A34A]">
              ✅ Commande payée et envoyée — en traitement dans Core
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#6B7280]">{label}</span>
      <span className={cn("text-[#000000]", mono && "font-mono text-xs", bold && "font-semibold")}>{value}</span>
    </div>
  );
}
