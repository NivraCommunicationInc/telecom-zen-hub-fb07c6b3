/**
 * FieldSubmissions — Uses fetchOrderList from service layer. No direct DB queries.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchOrderList } from "@/field-app/lib/fieldServices";
import { ShoppingCart, Loader2, ChevronRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const SYNC_STATUS: Record<string, { label: string; icon: typeof CheckCircle2; classes: string }> = {
  synced: { label: "Envoyé à Core", icon: CheckCircle2, classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "Sync en attente", icon: Clock, classes: "bg-amber-50 text-amber-700 border-amber-200" },
  error: { label: "Erreur sync", icon: AlertCircle, classes: "bg-red-50 text-red-700 border-red-200" },
};
const PAYMENT_STATUS: Record<string, { label: string; classes: string }> = {
  confirmed: { label: "Payé", classes: "text-emerald-700" },
  pending: { label: "Paiement en attente", classes: "text-amber-700" },
  failed: { label: "Paiement échoué", classes: "text-red-700" },
};

export default function FieldSubmissions() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["field-orders-list"],
    queryFn: () => fetchOrderList({ mine: true }),
  });

  const orders = data?.orders || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mes commandes</h1>
        <p className="text-sm text-muted-foreground">{orders.length} commande{orders.length !== 1 ? "s" : ""}</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12"><ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">Aucune commande soumise</p></div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => {
            const sync = SYNC_STATUS[order.sync_status] || SYNC_STATUS.pending;
            const payment = PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.pending;
            const SyncIcon = sync.icon;
            const services = Array.isArray(order.services) ? order.services : [];
            const serviceNames = services.map((s: any) => s.name).join(", ");
            return (
              <button key={order.id} onClick={() => navigate(fieldPath(`/orders/${order.id}`))} className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-muted-foreground/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{order.customer_name}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", sync.classes)}><SyncIcon className="h-3 w-3 inline mr-0.5 -mt-px" />{sync.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn("text-xs font-medium", payment.classes)}>{payment.label}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs font-semibold text-foreground">{order.total_amount?.toFixed(2)} $</span>
                    </div>
                    {serviceNames && <p className="text-[11px] text-muted-foreground mt-1 truncate">{serviceNames}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
                {order.converted_order_id && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Commande canonique créée</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
