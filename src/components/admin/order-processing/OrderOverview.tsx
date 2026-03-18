/**
 * OrderOverview — Read-only summary of the order
 * Shows all key information without editing capabilities
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  orderId: string;
  onSwitchToProcess: () => void;
}

export function OrderOverview({ orderId, onSwitchToProcess }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-order-overview", orderId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", order.user_id)
        .maybeSingle();

      const { data: invoice } = await supabase
        .from("billing_invoices")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      return { order, profile, invoice, items: items || [] };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data?.order) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
        <p className="text-red-600 font-medium">Erreur de chargement</p>
      </div>
    );
  }

  const { order, profile, invoice, items } = data;
  const clientName = profile?.full_name
    || [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
    || "—";

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Order info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Commande</h3>
          <div className="space-y-2 text-sm">
            <Row label="Numéro" value={order.order_number || `#${order.id.slice(0, 8)}`} />
            <Row label="Type" value={order.service_type} />
            <Row label="Statut" value={order.status} />
            <Row label="Créée" value={format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })} />
            <Row label="Fulfillment" value={order.fulfillment_type || "Non assigné"} />
          </div>
        </div>

        {/* Client info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Client</h3>
          <div className="space-y-2 text-sm">
            <Row label="Nom" value={clientName} />
            <Row label="Courriel" value={order.client_email || profile?.email} />
            <Row label="Téléphone" value={order.client_phone || profile?.phone} />
            <Row label="Adresse" value={order.client_full_address || "—"} />
            <Row label="Compte" value={order.account_id ? "—" : "—"} />
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Financier</h3>
          <div className="space-y-2 text-sm">
            <Row label="Sous-total" value={`${Number(invoice?.subtotal ?? order.subtotal ?? 0).toFixed(2)} $`} />
            <Row label="TPS" value={`${Number(invoice?.tps_amount ?? order.tps_amount ?? 0).toFixed(2)} $`} />
            <Row label="TVQ" value={`${Number(invoice?.tvq_amount ?? order.tvq_amount ?? 0).toFixed(2)} $`} />
            <Row label="Total" value={`${Number(invoice?.total ?? order.total_amount ?? 0).toFixed(2)} $`} bold />
            <Row label="Paiement" value={order.payment_status || "pending"} />
            <Row label="Méthode" value={order.payment_method || "—"} />
          </div>
        </div>
      </div>

      {/* Order items */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Articles</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 font-medium">Article</th>
                <th className="pb-2 font-medium">Qté</th>
                <th className="pb-2 font-medium text-right">Prix</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-2 text-gray-900">{item.product_name || item.plan_name || `Item ${i + 1}`}</td>
                  <td className="py-2 text-gray-700">{item.quantity || 1}</td>
                  <td className="py-2 text-right text-gray-700 tabular-nums">{Number(item.unit_price || 0).toFixed(2)} $</td>
                  <td className="py-2 text-right text-gray-900 font-medium tabular-nums">{Number(item.line_total || item.unit_price || 0).toFixed(2)} $</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {order.internal_notes && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes internes</h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{order.internal_notes}</pre>
        </div>
      )}

      {/* CTA to process */}
      <div className="flex justify-center pt-4">
        <Button onClick={onSwitchToProcess} className="gap-2 bg-gray-900 text-white hover:bg-gray-800">
          <Wrench className="w-4 h-4" /> Traiter cette commande
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string | null | undefined; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-right text-xs ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>
        {value || "—"}
      </span>
    </div>
  );
}
