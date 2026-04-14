/**
 * FieldOrderDetail — Uses fetchOrderDetail, retrySyncOrder, addOrderNote from service layer. No direct DB queries.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOrderDetail, retrySyncOrder } from "@/field-app/lib/fieldServices";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Package, CheckCircle2, Clock, AlertCircle, XCircle, Wallet, Banknote, RefreshCw, Building2, CreditCard, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { NextActionBanner } from "@/field-app/components/NextActionBanner";
import { OrderSummaryStrip } from "@/field-app/components/OrderSummaryStrip";

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
  paypal: { label: "PayPal", icon: Wallet }, interac: { label: "Virement Interac", icon: Banknote }, deferred: { label: "Différé", icon: Clock }, card: { label: "Carte", icon: Wallet }, cash: { label: "Comptant", icon: Banknote },
};
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente", submitted: "Soumise", received: "Reçue", processing: "En traitement", confirmed: "Confirmée", shipped: "Expédiée", delivered: "Livrée", installed: "Installée", activated: "Activée", completed: "Complétée", cancelled: "Annulée",
};

function InfoRow({ label, value, mono, bold }: { label: string; value: string | undefined | null; mono?: boolean; bold?: boolean }) {
  return (
    <div><span className="text-[10px] text-[#9CA3AF] block">{label}</span><p className={cn("text-sm text-[#000000]", mono && "font-mono", bold && "font-bold")}>{value || "—"}</p></div>
  );
}

export default function FieldOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["field-order-detail", orderId],
    queryFn: () => fetchOrderDetail(orderId!),
    enabled: !!orderId,
  });

  const retrySyncMutation = useMutation({
    mutationFn: () => retrySyncOrder(orderId!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["field-order-detail", orderId] }); toast.success("Synchronisation relancée"); },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  const order = data?.order;
  if (!order) return <div className="text-center py-16"><p className="text-sm text-[#6B7280]">Commande introuvable</p><button onClick={() => navigate(fieldPath("/submissions"))} className="text-sm text-[#22C55E] hover:underline mt-2">Retour</button></div>;

  const canonicalOrder = data?.canonical;
  const commission = data?.commission;
  const subscription = data?.subscription;
  const appointment = data?.appointment;

  const sync = SYNC_CONFIG[order.sync_status || "pending"] || SYNC_CONFIG.pending;
  const payment = PAYMENT_CONFIG[order.payment_status || "pending"] || PAYMENT_CONFIG.pending;
  const payMethod = PAYMENT_METHOD_LABELS[order.payment_method || "deferred"] || PAYMENT_METHOD_LABELS.deferred;
  const SyncIcon = sync.icon;
  const PaymentIcon = payment.icon;
  const services: any[] = Array.isArray(order.services) ? order.services : [];
  const canRetrySync = order.sync_status === "error" || order.sync_status === "pending";

  const getPhaseLabel = () => {
    if (order.payment_status === "cancelled") return "Annulée";
    if (!order.converted_order_id) {
      if (order.sync_status === "error") return "Erreur synchronisation";
      if (order.payment_status === "pending") return "Attente paiement";
      return "Synchronisation en cours";
    }
    if (canonicalOrder) return ORDER_STATUS_LABELS[canonicalOrder.status] || canonicalOrder.status;
    return "En traitement Core";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fieldPath("/submissions"))} className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"><ArrowLeft className="h-4 w-4 text-[#6B7280]" /></button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#000000]">{order.customer_name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[#6B7280] font-mono">{order.id.slice(0, 8).toUpperCase()}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#374151] font-medium">{getPhaseLabel()}</span>
          </div>
        </div>
        <span className="text-lg font-bold text-[#000000]">{order.total_amount?.toFixed(2)} $</span>
      </div>

      <NextActionBanner paymentStatus={order.payment_status} syncStatus={order.sync_status} convertedOrderId={order.converted_order_id} canonicalOrderStatus={canonicalOrder?.status} hasAppointment={!!appointment} subscriptionStatus={subscription?.status} />
      <OrderSummaryStrip saleStatus={getPhaseLabel()} paymentStatus={order.payment_status || "pending"} syncStatus={order.sync_status || "pending"} installationStatus={canonicalOrder?.status || "—"} serviceStatus={subscription?.status || "—"} commissionStatus={commission?.status || "pending"} commissionAmount={commission?.amount} />

      {commission && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5 mb-2"><CreditCard className="h-3.5 w-3.5" /> Commission</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Montant" value={`${commission.amount?.toFixed(2)} $`} bold />
            <InfoRow label="Statut" value={commission.status === "approved" ? "Approuvée" : commission.status === "paid" ? "Payée" : "En attente"} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={cn("rounded-xl border p-4", sync.classes.replace(/text-\S+/, ""))}>
          <div className="flex items-center gap-2"><SyncIcon className={cn("h-5 w-5", sync.classes.split(" ")[0])} /><div><p className={cn("text-sm font-semibold", sync.classes.split(" ")[0])}>{sync.label}</p><p className="text-[10px] text-[#6B7280] mt-0.5">{sync.desc}</p></div></div>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
          <div className="flex items-center gap-2"><PaymentIcon className={cn("h-5 w-5", payment.classes)} /><div><p className={cn("text-sm font-semibold", payment.classes)}>{payment.label}</p><p className="text-[10px] text-[#6B7280] mt-0.5">{payMethod.label}</p></div></div>
        </div>
      </div>

      {canonicalOrder && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Pipeline canonique</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoRow label="Commande Core" value={canonicalOrder.order_number || canonicalOrder.id?.slice(0, 8)} mono />
            <InfoRow label="Statut" value={ORDER_STATUS_LABELS[canonicalOrder.status] || canonicalOrder.status} />
          </div>
          <div className="mt-2 p-2.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg"><p className="text-xs font-medium text-[#16A34A] flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Visible dans Nivra Core</p></div>
        </div>
      )}

      {!order.converted_order_id && order.sync_status === "error" && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl">
          <p className="text-sm font-medium text-[#DC2626] flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Synchronisation échouée</p>
          {order.sync_error && <p className="text-xs text-[#DC2626]/70 mt-1">{order.sync_error}</p>}
          <button onClick={() => retrySyncMutation.mutate()} disabled={retrySyncMutation.isPending} className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#DC2626] text-white text-sm font-medium hover:bg-[#B91C1C] disabled:opacity-50 transition-colors">
            {retrySyncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Relancer la synchronisation
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Client</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <InfoRow label="Nom" value={order.customer_name} bold />
          {order.customer_phone && <div><span className="text-[10px] text-[#9CA3AF]">Téléphone</span><a href={`tel:${order.customer_phone}`} className="text-sm text-[#000000] flex items-center gap-1"><Phone className="h-3 w-3" />{order.customer_phone}</a></div>}
          {order.customer_email && <div><span className="text-[10px] text-[#9CA3AF]">Courriel</span><a href={`mailto:${order.customer_email}`} className="text-sm text-[#000000] flex items-center gap-1"><Mail className="h-3 w-3" />{order.customer_email}</a></div>}
          {order.customer_address && <div className="col-span-2"><span className="text-[10px] text-[#9CA3AF]">Adresse</span><p className="text-sm text-[#000000] flex items-center gap-1"><MapPin className="h-3 w-3" />{order.customer_address}</p></div>}
        </div>
      </div>

      {services.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Services</h3>
          {services.map((s: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6] last:border-0">
              <span className="text-sm text-[#000000]">{s.name}</span>
              <span className="text-sm font-semibold text-[#000000]">{s.price_monthly ? `${Number(s.price_monthly).toFixed(2)} $/mo` : "—"}</span>
            </div>
          ))}
        </div>
      )}

      {(data?.status_history?.length ?? 0) > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3">Historique</h3>
          <div className="space-y-2">
            {data!.status_history.slice(0, 10).map((h: any) => (
              <div key={h.id} className="flex items-start gap-2 text-xs">
                <span className="text-[10px] text-[#9CA3AF] shrink-0 w-16">{format(new Date(h.created_at), "dd/MM HH:mm")}</span>
                <span className="text-[#000000]">{h.status_domain}: {h.old_status} → {h.new_status}</span>
                {h.change_reason && <span className="text-[#9CA3AF]">— {h.change_reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
