/**
 * OrderReviewStep — Step 2: Review ordered services, items, promotions
 * 3-section structure: Recurring / One-time / Today's Total
 */
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface Props { proc: any; }

export function OrderReviewStep({ proc }: Props) {
  const { order, items } = proc;
  const ps = order.pricing_snapshot as any;

  // Derive amounts from pricing snapshot (canonical) or fallback to order columns
  const recurringSubtotal = ps?.recurring_subtotal ?? order.subtotal ?? 0;
  const discountTotal = ps?.discount_total ?? order.discount_amount ?? 0;
  const recurringNet = Math.max(0, Number(recurringSubtotal) - Number(discountTotal));
  const oneTimeSubtotal = ps?.one_time_subtotal ?? 0;

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Revue de commande</h3>

      {/* Service type */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Type de service:</span> <span className="font-medium text-gray-900">{order.service_type}</span></div>
          <div><span className="text-gray-500">Type de commande:</span> <span className="font-medium text-gray-900">{order.order_type || "standard"}</span></div>
          <div><span className="text-gray-500">Promo:</span> <span className="font-medium text-gray-900">{order.promo_code || order.discount_code || "Aucune"}</span></div>
          <div><span className="text-gray-500">Catégorie:</span> <span className="font-medium text-gray-900">{order.category || "—"}</span></div>
        </div>
      </div>

      {/* ═══ SECTION A: Recurring Services ═══ */}
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Services mensuels (récurrent)</h4>
      {items.length > 0 ? (
        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">Service</th>
              <th className="pb-2 font-medium">Qté</th>
              <th className="pb-2 font-medium text-right">Prix</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
      ) : (
        <p className="text-sm text-gray-400 mb-2">Aucun article détaillé.</p>
      )}

      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Sous-total mensuel</span><span className="text-gray-900 font-medium tabular-nums">{Number(recurringSubtotal).toFixed(2)} $/mois</span></div>
          {Number(discountTotal) > 0 && (
            <>
              <div className="flex justify-between"><span className="text-gray-500">Rabais {order.promo_code ? `(${order.promo_code})` : ""}</span><span className="text-emerald-600 tabular-nums">-{Number(discountTotal).toFixed(2)} $</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Net mensuel après rabais</span><span className="text-gray-700 tabular-nums">{recurringNet.toFixed(2)} $/mois</span></div>
            </>
          )}
        </div>
      </div>

      {/* ═══ SECTION B: One-time Fees ═══ */}
      {Number(oneTimeSubtotal) > 0 && (
        <>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Frais uniques</h4>
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
            <div className="space-y-1 text-sm">
              {order.activation_fee > 0 && <div className="flex justify-between"><span className="text-gray-500">Activation</span><span className="text-gray-700 tabular-nums">{Number(order.activation_fee).toFixed(2)} $</span></div>}
              {order.delivery_fee > 0 && <div className="flex justify-between"><span className="text-gray-500">Livraison</span><span className="text-gray-700 tabular-nums">{Number(order.delivery_fee).toFixed(2)} $</span></div>}
              {order.installation_fee > 0 && <div className="flex justify-between"><span className="text-gray-500">Installation</span><span className="text-gray-700 tabular-nums">{Number(order.installation_fee).toFixed(2)} $</span></div>}
              {order.router_fee > 0 && <div className="flex justify-between"><span className="text-gray-500">Routeur</span><span className="text-gray-700 tabular-nums">{Number(order.router_fee).toFixed(2)} $</span></div>}
              {order.terminal_fee > 0 && <div className="flex justify-between"><span className="text-gray-500">Terminal(s)</span><span className="text-gray-700 tabular-nums">{Number(order.terminal_fee).toFixed(2)} $</span></div>}
              <div className="flex justify-between border-t border-gray-200 pt-1 font-medium"><span className="text-gray-900">Total frais uniques</span><span className="text-gray-900 tabular-nums">{Number(oneTimeSubtotal).toFixed(2)} $</span></div>
            </div>
          </div>
        </>
      )}

      {/* ═══ SECTION C: Total de la commande ═══ */}
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sommaire financier</h4>
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Frais uniques</span><span className="text-gray-700 tabular-nums">{Number(oneTimeSubtotal).toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Services 1er mois</span><span className="text-gray-700 tabular-nums">{Number(recurringSubtotal).toFixed(2)} $</span></div>
          {Number(discountTotal) > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Rabais</span><span className="text-emerald-600 tabular-nums">-{Number(discountTotal).toFixed(2)} $</span></div>
          )}
          <div className="flex justify-between"><span className="text-gray-500">TPS</span><span className="text-gray-700 tabular-nums">{Number(order.tps_amount || 0).toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-gray-500">TVQ</span><span className="text-gray-700 tabular-nums">{Number(order.tvq_amount || 0).toFixed(2)} $</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900 tabular-nums">{Number(order.total_amount || 0).toFixed(2)} $</span>
          </div>
        </div>
      </div>

      {/* Appointment if applicable */}
      {order.appointment_date && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          <h4 className="text-xs font-semibold text-blue-700 uppercase mb-1">Rendez-vous</h4>
          <p className="text-sm text-blue-900">{order.appointment_date}</p>
          {order.appointment_notes && <p className="text-xs text-blue-600 mt-1">{order.appointment_notes}</p>}
        </div>
      )}

      {/* Equipment */}
      {order.equipment_details && (
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Équipement demandé</h4>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(order.equipment_details, null, 2)}</pre>
        </div>
      )}

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <Button size="sm" onClick={() => proc.setActiveStep("payment")} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmer et continuer
        </Button>
      </div>
    </div>
  );
}
