/**
 * OrderReviewStep — Step 2: Full itemized review from canonical billing_invoice_lines
 * 3-section structure: Recurring / One-time / Today's Total
 * Source of truth: billing_invoice_lines ONLY. No reconstruction from pricing_snapshot.
 */
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { toNonNegativeMoney } from "@/lib/pricing/money";

interface Props { proc: any; }

/**
 * LOCKED PRICING DOMAIN RULE:
 * - Recurring monthly block = recurring items + recurring-only discounts
 * - One-time block = equipment + fees + one-time discounts
 * - One-time/equipment promos must NOT reduce the recurring monthly total
 * - One-time discounts must remain visible as negative line items in one-time block
 */

/** Classify an invoice line by its type/description */
function classifyLine(line: any): "recurring" | "equipment" | "fee" | "discount_recurring" | "discount_onetime" {
  const desc = (line.description || "").toLowerCase();
  const lineType = (line.line_type || "").toLowerCase();

  // Discounts need sub-classification: one-time vs recurring
  if (lineType === "discount" || lineType === "credit") {
    // One-time/equipment discounts: equipment promos, EQUIP codes, installation discounts
    if (desc.includes("equip") || desc.includes("équip") || desc.includes("installation") ||
        desc.includes("activation") || desc.includes("livraison") || desc.includes("router") ||
        desc.includes("routeur") || desc.includes("terminal") || desc.includes("sim") ||
        desc.includes("modem") || desc.includes("décodeur") || desc.includes("frais")) {
      return "discount_onetime";
    }
    // Recurring discounts: monthly promos, new client discounts, welcome discounts
    return "discount_recurring";
  }

  if (lineType === "equipment" || desc.includes("routeur") || desc.includes("router") || desc.includes("terminal") || desc.includes("modem") || desc.includes("sim") || desc.includes("décodeur")) return "equipment";
  if (lineType === "fee" || desc.includes("activation") || desc.includes("livraison") || desc.includes("installation") || desc.includes("shipping") || desc.includes("delivery")) return "fee";
  return "recurring";
}

export function OrderReviewStep({ proc }: Props) {
  const { order, invoice, invoiceLines } = proc;
  const hasInvoiceLines = invoiceLines && invoiceLines.length > 0;

  // Categorize invoice lines with domain-separated discounts
  const recurringLines: any[] = [];
  const equipmentLines: any[] = [];
  const feeLines: any[] = [];
  const discountRecurringLines: any[] = [];
  const discountOnetimeLines: any[] = [];

  if (hasInvoiceLines) {
    for (const line of invoiceLines) {
      const cat = classifyLine(line);
      if (cat === "recurring") recurringLines.push(line);
      else if (cat === "equipment") equipmentLines.push(line);
      else if (cat === "fee") feeLines.push(line);
      else if (cat === "discount_recurring") discountRecurringLines.push(line);
      else if (cat === "discount_onetime") discountOnetimeLines.push(line);
    }
  }

  // DOMAIN-SEPARATED TOTALS
  // Recurring: recurring items - recurring-only discounts
  const recurringSubtotal = toNonNegativeMoney(
    hasInvoiceLines ? recurringLines.reduce((s, l) => s + Number(l.line_total || 0), 0) : 0
  );
  const recurringDiscountTotal = toNonNegativeMoney(
    hasInvoiceLines ? discountRecurringLines.reduce((s, l) => s + Math.abs(Number(l.line_total || 0)), 0) : 0
  );
  const recurringNet = Math.max(0, recurringSubtotal - recurringDiscountTotal);

  // One-time: equipment + fees - one-time discounts
  const onetimeGross = toNonNegativeMoney(
    hasInvoiceLines ? [...equipmentLines, ...feeLines].reduce((s, l) => s + Number(l.line_total || 0), 0) : 0
  );
  const onetimeDiscountTotal = toNonNegativeMoney(
    hasInvoiceLines ? discountOnetimeLines.reduce((s, l) => s + Math.abs(Number(l.line_total || 0)), 0) : 0
  );
  const onetimeNet = Math.max(0, onetimeGross - onetimeDiscountTotal);

  // Taxes and total from invoice (canonical source of truth)
  const tpsAmount = toNonNegativeMoney(invoice?.tps_amount ?? 0);
  const tvqAmount = toNonNegativeMoney(invoice?.tvq_amount ?? 0);
  const totalAmount = toNonNegativeMoney(invoice?.total ?? (order.pricing_snapshot as any)?.grand_total ?? order.total_amount ?? 0);
  const amountPaid = toNonNegativeMoney(invoice?.amount_paid ?? 0);
  const balanceDue = toNonNegativeMoney(invoice?.balance_due ?? (totalAmount - amountPaid));

  // SYSTEM ERROR: Missing invoice lines
  if (!hasInvoiceLines) {
    return (
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-4">Revue de commande</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Lignes de facturation manquantes</p>
              <p className="text-xs text-amber-600 mt-1">
                Aucune ligne canonique (billing_invoice_lines) n'existe pour cette commande. 
                Ceci est une erreur système — les lignes doivent être créées au moment du checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Still show canonical totals from invoice */}
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sommaire financier (facture)</h4>
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="text-gray-900 font-semibold tabular-nums">{totalAmount.toFixed(2)} $</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payé</span><span className="text-emerald-600 tabular-nums">{amountPaid.toFixed(2)} $</span></div>
            <div className="flex justify-between font-semibold">
              <span className="text-gray-900">Solde dû</span>
              <span className={`tabular-nums ${balanceDue > 0 ? "text-red-600" : "text-emerald-600"}`}>{balanceDue.toFixed(2)} $</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <Button size="sm" onClick={() => proc.setActiveStep("payment")} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Continuer malgré tout
          </Button>
        </div>
      </div>
    );
  }

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
      {recurringLines.length > 0 ? (
        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">Service</th>
              <th className="pb-2 font-medium">Qté</th>
              <th className="pb-2 font-medium text-right">Prix unitaire</th>
              <th className="pb-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recurringLines.map((line: any, i: number) => (
              <tr key={i}>
                <td className="py-2 text-gray-900">{line.description}</td>
                <td className="py-2 text-gray-700">{line.quantity || 1}</td>
                <td className="py-2 text-right text-gray-700 tabular-nums">{Number(line.unit_price || 0).toFixed(2)} $</td>
                <td className="py-2 text-right text-gray-900 font-medium tabular-nums">{Number(line.line_total || 0).toFixed(2)} $</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-400 mb-2">Aucun service récurrent.</p>
      )}

      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Sous-total mensuel</span><span className="text-gray-900 font-medium tabular-nums">{recurringSubtotal.toFixed(2)} $/mois</span></div>
          {recurringDiscountTotal > 0 && (
            <>
              {discountRecurringLines.map((dl: any, i: number) => (
                <div key={`d-${i}`} className="flex justify-between">
                  <span className="text-gray-500">{dl.description}</span>
                  <span className="text-emerald-600 tabular-nums">-{Math.abs(Number(dl.line_total || 0)).toFixed(2)} $</span>
                </div>
              ))}
              <div className="flex justify-between"><span className="text-gray-500">Net mensuel après rabais</span><span className="text-gray-700 tabular-nums">{recurringNet.toFixed(2)} $/mois</span></div>
            </>
          )}
        </div>
      </div>

      {/* ═══ SECTION B: One-time Fees & Equipment ═══ */}
      {(equipmentLines.length > 0 || feeLines.length > 0 || discountOnetimeLines.length > 0) && (
        <>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Frais uniques & Équipement</h4>
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
            <div className="space-y-1 text-sm">
              {equipmentLines.map((line: any, i: number) => (
                <div key={`eq-${i}`} className="flex justify-between">
                  <span className="text-gray-500">{line.description}</span>
                  <span className="text-gray-700 tabular-nums">{Number(line.line_total || 0).toFixed(2)} $</span>
                </div>
              ))}
              {feeLines.map((line: any, i: number) => (
                <div key={`fee-${i}`} className="flex justify-between">
                  <span className="text-gray-500">{line.description}</span>
                  <span className="text-gray-700 tabular-nums">{Number(line.line_total || 0).toFixed(2)} $</span>
                </div>
              ))}
              {discountOnetimeLines.map((dl: any, i: number) => (
                <div key={`dot-${i}`} className="flex justify-between">
                  <span className="text-gray-500">{dl.description}</span>
                  <span className="text-emerald-600 tabular-nums">-{Math.abs(Number(dl.line_total || 0)).toFixed(2)} $</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-200 pt-1 font-medium">
                <span className="text-gray-900">Total frais uniques</span>
                <span className="text-gray-900 tabular-nums">{onetimeNet.toFixed(2)} $</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ SECTION C: Sommaire financier (canonical from invoice) ═══ */}
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sommaire financier</h4>
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Services 1er mois</span><span className="text-gray-700 tabular-nums">{recurringSubtotal.toFixed(2)} $</span></div>
          {onetimeGross > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Frais uniques</span><span className="text-gray-700 tabular-nums">{onetimeGross.toFixed(2)} $</span></div>
          )}
          {recurringDiscountTotal > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Rabais récurrents</span><span className="text-emerald-600 tabular-nums">-{recurringDiscountTotal.toFixed(2)} $</span></div>
          )}
          {onetimeDiscountTotal > 0 && (
            <div className="flex justify-between"><span className="text-gray-500">Rabais uniques</span><span className="text-emerald-600 tabular-nums">-{onetimeDiscountTotal.toFixed(2)} $</span></div>
          )}
          <div className="flex justify-between"><span className="text-gray-500">TPS (5%)</span><span className="text-gray-700 tabular-nums">{tpsAmount.toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-gray-500">TVQ (9.975%)</span><span className="text-gray-700 tabular-nums">{tvqAmount.toFixed(2)} $</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900 tabular-nums">{totalAmount.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payé</span>
            <span className="text-emerald-600 tabular-nums">{amountPaid.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-gray-900">Solde dû</span>
            <span className={`tabular-nums ${balanceDue > 0 ? "text-red-600" : "text-emerald-600"}`}>{balanceDue.toFixed(2)} $</span>
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