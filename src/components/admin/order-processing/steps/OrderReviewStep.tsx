/**
 * OrderReviewStep — Step 2: Review ordered services, items, promotions
 * CANONICAL: reads billing_invoice_lines (proc.invoiceLines) — same source as OrderSummaryPanel.
 * Never reconstruct from pricing_snapshot or order columns.
 */
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface Props { proc: any; }

/** Classify an invoice line (mirrors OrderSummaryPanel logic). */
function classifyLine(line: any): "recurring" | "equipment" | "fee" | "discount" {
  if (line.line_type === "discount" || line.line_type === "credit") return "discount";
  const desc = (line.description || "").toLowerCase();
  if (
    line.line_type === "equipment" ||
    desc.includes("routeur") || desc.includes("router") ||
    desc.includes("terminal") || desc.includes("modem") ||
    desc.includes("sim") || desc.includes("décodeur") ||
    desc.includes("borne")
  ) return "equipment";
  if (
    line.line_type === "fee" ||
    desc.includes("activation") || desc.includes("livraison") ||
    desc.includes("installation") || desc.includes("shipping") ||
    desc.includes("delivery")
  ) return "fee";
  return "recurring";
}

const fmt = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(2)} $`;

export function OrderReviewStep({ proc }: Props) {
  const { order, invoice, invoiceLines } = proc;
  const lines: any[] = Array.isArray(invoiceLines) ? invoiceLines : [];

  const recurring: any[] = [];
  const equipment: any[] = [];
  const fees: any[] = [];
  const discounts: any[] = [];
  for (const l of lines) {
    const c = classifyLine(l);
    if (c === "recurring") recurring.push(l);
    else if (c === "equipment") equipment.push(l);
    else if (c === "fee") fees.push(l);
    else discounts.push(l);
  }

  const recurringSubtotal = recurring.reduce((s, l) => s + Number(l.line_total || 0), 0);
  const discountTotal = discounts.reduce((s, l) => s + Math.abs(Number(l.line_total || 0)), 0);
  const recurringNet = Math.max(0, recurringSubtotal - discountTotal);
  const equipmentSubtotal = equipment.reduce((s, l) => s + Number(l.line_total || 0), 0);
  const feeSubtotal = fees.reduce((s, l) => s + Number(l.line_total || 0), 0);
  const oneTimeSubtotal = equipmentSubtotal + feeSubtotal;

  const tps = invoice?.tps_amount ?? order.tps_amount ?? 0;
  const tvq = invoice?.tvq_amount ?? order.tvq_amount ?? 0;
  const total = invoice?.total ?? order.total_amount ?? 0;
  const amountPaid = invoice?.amount_paid ?? 0;
  const balanceDue = invoice?.balance_due ?? (Number(total) - Number(amountPaid));

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Revue de commande</h3>

      {/* Service type header */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Type de service:</span> <span className="font-medium text-gray-900">{order.service_type}</span></div>
          <div><span className="text-gray-500">Type de commande:</span> <span className="font-medium text-gray-900">{order.order_type || "standard"}</span></div>
          <div><span className="text-gray-500">Promo:</span> <span className="font-medium text-gray-900">{order.promo_code || order.discount_code || "Aucune"}</span></div>
          <div><span className="text-gray-500">Catégorie:</span> <span className="font-medium text-gray-900">{order.category || "—"}</span></div>
        </div>
      </div>

      {lines.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
          ⚠ Lignes de facturation manquantes pour cette commande.
        </div>
      )}

      {/* ═══ Recurring ═══ */}
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Services mensuels (récurrent)</h4>
      {recurring.length > 0 ? (
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
            {recurring.map((l, i) => (
              <tr key={`r-${i}`}>
                <td className="py-2 text-gray-900">{l.description}</td>
                <td className="py-2 text-gray-700">{l.quantity || 1}</td>
                <td className="py-2 text-right text-gray-700 tabular-nums">{fmt(l.unit_price)}</td>
                <td className="py-2 text-right text-gray-900 font-medium tabular-nums">{fmt(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-400 mb-2">Aucun service récurrent.</p>
      )}

      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Sous-total mensuel</span><span className="text-gray-900 font-medium tabular-nums">{fmt(recurringSubtotal)}/mois</span></div>
          {discounts.map((d, i) => (
            <div key={`d-${i}`} className="flex justify-between">
              <span className="text-gray-500">{d.description}</span>
              <span className="text-emerald-600 tabular-nums">-{fmt(Math.abs(Number(d.line_total || 0)))}</span>
            </div>
          ))}
          {discountTotal > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Net mensuel après rabais</span><span className="text-gray-700 tabular-nums">{fmt(recurringNet)}/mois</span></div>
          )}
        </div>
      </div>

      {/* ═══ One-time & Equipment ═══ */}
      {(equipment.length > 0 || fees.length > 0) && (
        <>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Frais uniques & Équipement</h4>
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
            <div className="space-y-1 text-sm">
              {equipment.map((l, i) => (
                <div key={`eq-${i}`} className="flex justify-between">
                  <span className="text-gray-700">{l.description}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span>
                  <span className="text-gray-900 tabular-nums">{fmt(l.line_total)}</span>
                </div>
              ))}
              {fees.map((l, i) => (
                <div key={`fee-${i}`} className="flex justify-between">
                  <span className="text-gray-700">{l.description}</span>
                  <span className="text-gray-900 tabular-nums">{fmt(l.line_total)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-200 pt-1 font-medium">
                <span className="text-gray-900">Total frais uniques</span>
                <span className="text-gray-900 tabular-nums">{fmt(oneTimeSubtotal)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ Financial summary ═══ */}
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sommaire financier</h4>
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Services 1er mois</span><span className="text-gray-700 tabular-nums">{fmt(recurringSubtotal)}</span></div>
          {discountTotal > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Rabais</span><span className="text-emerald-600 tabular-nums">-{fmt(discountTotal)}</span></div>
          )}
          <div className="flex justify-between"><span className="text-gray-500">Frais uniques</span><span className="text-gray-700 tabular-nums">{fmt(oneTimeSubtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">TPS (5%)</span><span className="text-gray-700 tabular-nums">{fmt(tps)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">TVQ (9.975%)</span><span className="text-gray-700 tabular-nums">{fmt(tvq)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900 tabular-nums">{fmt(total)}</span>
          </div>
          <div className="flex justify-between"><span className="text-gray-500">Payé</span><span className="text-emerald-600 tabular-nums">{fmt(amountPaid)}</span></div>
          <div className="flex justify-between font-semibold">
            <span className="text-gray-900">Solde dû</span>
            <span className={Number(balanceDue) > 0 ? "text-red-600 tabular-nums" : "text-emerald-600 tabular-nums"}>{fmt(balanceDue)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
        <Button size="sm" onClick={() => proc.setActiveStep("payment")} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmer et continuer
        </Button>
      </div>
    </div>
  );
}
