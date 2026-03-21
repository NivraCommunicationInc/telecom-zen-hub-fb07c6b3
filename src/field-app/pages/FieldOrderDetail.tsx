/**
 * FieldOrderDetail — Full operational view of a field sales order.
 * Shows canonical pipeline status, payment state, Core sync, and real actions.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Phone, Mail, MapPin, Package,
  CheckCircle2, Clock, AlertCircle, XCircle, Wallet,
  Banknote, RefreshCw, ExternalLink, Copy, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { toast } from "sonner";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

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
};

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: typeof Wallet }> = {
  paypal: { label: "PayPal", icon: Wallet },
  interac: { label: "Virement Interac", icon: Banknote },
  deferred: { label: "Différé", icon: Clock },
  card: { label: "Carte (via PayPal)", icon: Wallet },
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
        .select("id, order_number, status, total_amount, payment_status")
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
        .select("id, invoice_number, status, total, amount_paid, balance_due")
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
      toast.error(`Échec: ${err.message}`);
    },
  });

  /* ─── Cancel order (only if not yet synced/paid) ─── */
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

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!order) return (
    <div className="text-center py-16">
      <p className="text-sm text-muted-foreground">Commande introuvable</p>
      <button onClick={() => navigate(fieldPath("/submissions"))} className="text-sm text-primary hover:underline mt-2">Retour</button>
    </div>
  );

  const sync = SYNC_CONFIG[order.sync_status || "pending"] || SYNC_CONFIG.pending;
  const payment = PAYMENT_CONFIG[order.payment_status || "pending"] || PAYMENT_CONFIG.pending;
  const payMethod = PAYMENT_METHOD_LABELS[order.payment_method || "deferred"] || PAYMENT_METHOD_LABELS.deferred;
  const SyncIcon = sync.icon;
  const PaymentIcon = payment.icon;
  const MethodIcon = payMethod.icon;
  const services: any[] = Array.isArray(order.services) ? order.services : [];
  const canCancel = order.payment_status !== "confirmed" && order.sync_status !== "synced";
  const canRetrySync = order.sync_status === "error" || order.sync_status === "pending";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fieldPath("/submissions"))} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{order.customer_name}</h1>
          <p className="text-xs text-muted-foreground font-mono">{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <span className="text-lg font-bold text-foreground">{order.total_amount?.toFixed(2)} $</span>
      </div>

      {/* ═══ Pipeline Status ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sync status */}
        <div className={cn("rounded-xl border p-4", sync.classes.replace(/text-\S+/, ""))}>
          <div className="flex items-center gap-2">
            <SyncIcon className={cn("h-5 w-5", sync.classes.split(" ")[0])} />
            <div>
              <p className={cn("text-sm font-semibold", sync.classes.split(" ")[0])}>{sync.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sync.desc}</p>
            </div>
          </div>
        </div>
        {/* Payment status */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <PaymentIcon className={cn("h-5 w-5", payment.classes)} />
            <div>
              <p className={cn("text-sm font-semibold", payment.classes)}>{payment.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <MethodIcon className="h-3 w-3" /> {payMethod.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Canonical Order Chain ═══ */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          Pipeline canonique
        </h3>

        {order.converted_order_id && canonicalOrder ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Commande Core</span>
              <span className="font-mono text-xs font-semibold text-foreground">{canonicalOrder.order_number || canonicalOrder.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Statut commande</span>
              <span className="font-medium text-foreground capitalize">{canonicalOrder.status}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Statut paiement</span>
              <span className="font-medium text-foreground capitalize">{canonicalOrder.payment_status}</span>
            </div>
            {canonicalInvoice && (
              <>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Facture</span>
                  <span className="font-mono text-xs font-semibold text-foreground">{canonicalInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut facture</span>
                  <span className="font-medium text-foreground capitalize">{canonicalInvoice.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total facturé</span>
                  <span className="font-semibold text-foreground">{canonicalInvoice.total?.toFixed(2)} $</span>
                </div>
              </>
            )}
            {canonicalPayment && (
              <>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Paiement</span>
                  <span className="font-mono text-xs font-semibold text-foreground">{canonicalPayment.payment_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-semibold text-foreground">{canonicalPayment.amount?.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fournisseur</span>
                  <span className="text-foreground capitalize">{canonicalPayment.provider || canonicalPayment.method}</span>
                </div>
              </>
            )}
            <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Visible dans Nivra Core — traitement staff en cours
              </p>
            </div>
          </div>
        ) : order.sync_status === "error" ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-medium text-red-700 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Synchronisation échouée
            </p>
            {order.sync_error && <p className="text-[10px] text-red-600 mt-1">{order.sync_error}</p>}
          </div>
        ) : (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              En attente de synchronisation vers Core
            </p>
          </div>
        )}
      </div>

      {/* ═══ Contact info ═══ */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</h3>
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary">
            <Phone className="h-4 w-4 text-muted-foreground" />{order.customer_phone}
          </a>
        )}
        {order.customer_email && (
          <a href={`mailto:${order.customer_email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary">
            <Mail className="h-4 w-4 text-muted-foreground" />{order.customer_email}
          </a>
        )}
        {order.customer_address && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{order.customer_address}{order.customer_city ? `, ${order.customer_city}` : ""}{order.customer_postal_code ? ` ${order.customer_postal_code}` : ""}</span>
          </div>
        )}
      </div>

      {/* ═══ Services ═══ */}
      {services.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</h3>
          {services.map((s: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-foreground">
                <Package className="h-3.5 w-3.5 text-primary" />
                {s.name}
              </span>
              <span className="font-semibold text-foreground">{s.price_monthly?.toFixed(2)} $/mois</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Notes ═══ */}
      {order.internal_notes && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes internes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{order.internal_notes}</p>
        </div>
      )}

      {/* ═══ Actions ═══ */}
      <div className="space-y-2">
        {canRetrySync && (
          <button
            onClick={() => retrySyncMutation.mutate()}
            disabled={retrySyncMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Annuler cette commande
          </button>
        )}

        {!canCancel && order.payment_status === "confirmed" && order.sync_status === "synced" && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
            <p className="text-sm font-medium text-emerald-700">
              ✅ Commande payée et envoyée — en traitement dans Core
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
