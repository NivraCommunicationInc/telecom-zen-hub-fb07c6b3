/**
 * OrderReviewStep — Step 2: Full itemized review from canonical billing_invoice_lines
 */
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { toNonNegativeMoney } from "@/lib/pricing/money";

interface Props { proc: any; }

function classifyLine(line: any): "recurring" | "equipment" | "fee" | "discount_recurring" | "discount_onetime" {
  const desc = (line.description || "").toLowerCase();
  const lineType = (line.line_type || "").toLowerCase();
  if (lineType === "discount" || lineType === "credit") {
    if (desc.includes("equip") || desc.includes("équip") || desc.includes("installation") ||
        desc.includes("activation") || desc.includes("livraison") || desc.includes("router") ||
        desc.includes("routeur") || desc.includes("terminal") || desc.includes("sim") ||
        desc.includes("modem") || desc.includes("décodeur") || desc.includes("frais")) {
      return "discount_onetime";
    }
    return "discount_recurring";
  }
  if (lineType === "equipment" || desc.includes("routeur") || desc.includes("router") || desc.includes("terminal") || desc.includes("modem") || desc.includes("sim") || desc.includes("décodeur")) return "equipment";
  if (lineType === "fee" || desc.includes("activation") || desc.includes("livraison") || desc.includes("installation") || desc.includes("shipping") || desc.includes("delivery")) return "fee";
  return "recurring";
}

export function OrderReviewStep({ proc }: Props) {
  const { order, invoice, invoiceLines } = proc;
  const hasInvoiceLines = invoiceLines && invoiceLines.length > 0;

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

  const recurringSubtotal = toNonNegativeMoney(hasInvoiceLines ? recurringLines.reduce((s, l) => s + Number(l.line_total || 0), 0) : 0);
  const recurringDiscountTotal = toNonNegativeMoney(hasInvoiceLines ? discountRecurringLines.reduce((s, l) => s + Math.abs(Number(l.line_total || 0)), 0) : 0);
  const recurringNet = Math.max(0, recurringSubtotal - recurringDiscountTotal);
  const onetimeGross = toNonNegativeMoney(hasInvoiceLines ? [...equipmentLines, ...feeLines].reduce((s, l) => s + Number(l.line_total || 0), 0) : 0);
  const onetimeDiscountTotal = toNonNegativeMoney(hasInvoiceLines ? discountOnetimeLines.reduce((s, l) => s + Math.abs(Number(l.line_total || 0)), 0) : 0);
  const onetimeNet = Math.max(0, onetimeGross - onetimeDiscountTotal);

  const tpsAmount = toNonNegativeMoney(invoice?.tps_amount ?? 0);
  const tvqAmount = toNonNegativeMoney(invoice?.tvq_amount ?? 0);
  const totalAmount = toNonNegativeMoney(invoice?.total ?? (order.pricing_snapshot as any)?.grand_total ?? order.total_amount ?? 0);
  const amountPaid = toNonNegativeMoney(invoice?.amount_paid ?? 0);
  const balanceDue = toNonNegativeMoney(invoice?.balance_due ?? (totalAmount - amountPaid));

  if (!hasInvoiceLines) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Étape 2 — Revue de commande</div>
        <div className="bg-amber-950/50 border border-amber-700/50 text-amber-300 rounded-lg px-3 py-2 text-sm mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Lignes de facturation manquantes</p>
              <p className="text-xs mt-1 opacity-80">Aucune ligne canonique n'existe — erreur système, à créer au checkout.</p>
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[#0d1421] rounded-lg p-3 text-center">
            <div className="text-lg font-medium text-slate-100 tabular-nums">{totalAmount.toFixed(2)} $</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Total</div>
          </div>
          <div className="bg-[#0d1421] rounded-lg p-3 text-center">
            <div className="text-lg font-medium text-green-300 tabular-nums">{amountPaid.toFixed(2)} $</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Payé</div>
          </div>
          <div className="bg-[#0d1421] rounded-lg p-3 text-center">
            <div className={`text-lg font-medium tabular-nums ${balanceDue > 0 ? "text-red-300" : "text-green-300"}`}>{balanceDue.toFixed(2)} $</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Solde dû</div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-700/50">
          <Button size="sm" onClick={() => proc.setActiveStep("payment")} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Continuer malgré tout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Étape 2 — Revue de commande</div>

      {/* Service type card */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Service</h4>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-500">Type de service:</span> <span className="font-medium text-slate-100 ml-1">{order.service_type}</span></div>
          <div><span className="text-slate-500">Type de commande:</span> <span className="font-medium text-slate-100 ml-1">{order.order_type || "standard"}</span></div>
          <div><span className="text-slate-500">Promo:</span> <span className="font-medium text-slate-100 ml-1">{order.promo_code || order.discount_code || "Aucune"}</span></div>
          <div><span className="text-slate-500">Catégorie:</span> <span className="font-medium text-slate-100 ml-1">{order.category || "—"}</span></div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#0d1421] rounded-lg p-3 text-center">
          <div className="text-lg font-medium text-slate-100 tabular-nums">{totalAmount.toFixed(2)} $</div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Total</div>
        </div>
        <div className="bg-[#0d1421] rounded-lg p-3 text-center">
          <div className="text-lg font-medium text-green-300 tabular-nums">{amountPaid.toFixed(2)} $</div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Payé</div>
        </div>
        <div className="bg-[#0d1421] rounded-lg p-3 text-center">
          <div className={`text-lg font-medium tabular-nums ${balanceDue > 0 ? "text-red-300" : "text-green-300"}`}>{balanceDue.toFixed(2)} $</div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Solde dû</div>
        </div>
      </div>

      {/* Recurring section */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Services mensuels (récurrent)</h4>
        </div>
        <div className="p-4">
          {recurringLines.length > 0 ? (
            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="border-b border-slate-700/50 text-left text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="pb-2 font-medium">Service</th>
                  <th className="pb-2 font-medium">Qté</th>
                  <th className="pb-2 font-medium text-right">Prix</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recurringLines.map((line: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 text-slate-100">{line.description}</td>
                    <td className="py-2 text-slate-300">{line.quantity || 1}</td>
                    <td className="py-2 text-right text-slate-300 tabular-nums">{Number(line.unit_price || 0).toFixed(2)} $</td>
                    <td className="py-2 text-right text-slate-100 font-medium tabular-nums">{Number(line.line_total || 0).toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500 mb-2">Aucun service récurrent.</p>
          )}

          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Sous-total mensuel</span><span className="text-slate-100 font-medium tabular-nums">{recurringSubtotal.toFixed(2)} $/mois</span></div>
            {recurringDiscountTotal > 0 && (
              <>
                {discountRecurringLines.map((dl: any, i: number) => (
                  <div key={`d-${i}`} className="flex justify-between">
                    <span className="text-slate-500">{dl.description}</span>
                    <span className="text-green-300 tabular-nums">-{Math.abs(Number(dl.line_total || 0)).toFixed(2)} $</span>
                  </div>
                ))}
                <div className="flex justify-between"><span className="text-slate-500">Net mensuel après rabais</span><span className="text-slate-300 tabular-nums">{recurringNet.toFixed(2)} $/mois</span></div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* One-time section */}
      {(equipmentLines.length > 0 || feeLines.length > 0 || discountOnetimeLines.length > 0) && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Frais uniques & Équipement</h4>
          </div>
          <div className="p-4 space-y-1 text-sm">
            {equipmentLines.map((line: any, i: number) => (
              <div key={`eq-${i}`} className="flex justify-between">
                <span className="text-slate-500">{line.description}</span>
                <span className="text-slate-300 tabular-nums">{Number(line.line_total || 0).toFixed(2)} $</span>
              </div>
            ))}
            {feeLines.map((line: any, i: number) => (
              <div key={`fee-${i}`} className="flex justify-between">
                <span className="text-slate-500">{line.description}</span>
                <span className="text-slate-300 tabular-nums">{Number(line.line_total || 0).toFixed(2)} $</span>
              </div>
            ))}
            {discountOnetimeLines.map((dl: any, i: number) => (
              <div key={`dot-${i}`} className="flex justify-between">
                <span className="text-slate-500">{dl.description}</span>
                <span className="text-green-300 tabular-nums">-{Math.abs(Number(dl.line_total || 0)).toFixed(2)} $</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-700/50 pt-1 font-medium">
              <span className="text-slate-100">Total frais uniques</span>
              <span className="text-slate-100 tabular-nums">{onetimeNet.toFixed(2)} $</span>
            </div>
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Sommaire financier</h4>
        </div>
        <div className="p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Services 1er mois</span><span className="text-slate-300 tabular-nums">{recurringSubtotal.toFixed(2)} $</span></div>
          {onetimeGross > 0 && <div className="flex justify-between"><span className="text-slate-500">Frais uniques</span><span className="text-slate-300 tabular-nums">{onetimeGross.toFixed(2)} $</span></div>}
          {recurringDiscountTotal > 0 && <div className="flex justify-between"><span className="text-slate-500">Rabais récurrents</span><span className="text-green-300 tabular-nums">-{recurringDiscountTotal.toFixed(2)} $</span></div>}
          {onetimeDiscountTotal > 0 && <div className="flex justify-between"><span className="text-slate-500">Rabais uniques</span><span className="text-green-300 tabular-nums">-{onetimeDiscountTotal.toFixed(2)} $</span></div>}
          <div className="flex justify-between"><span className="text-slate-500">TPS (5%)</span><span className="text-slate-300 tabular-nums">{tpsAmount.toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-slate-500">TVQ (9.975%)</span><span className="text-slate-300 tabular-nums">{tvqAmount.toFixed(2)} $</span></div>
          <div className="flex justify-between border-t border-slate-700/50 pt-1 font-semibold">
            <span className="text-slate-100">Total</span>
            <span className="text-slate-100 tabular-nums">{totalAmount.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Payé</span><span className="text-green-300 tabular-nums">{amountPaid.toFixed(2)} $</span></div>
          <div className="flex justify-between font-semibold">
            <span className="text-slate-100">Solde dû</span>
            <span className={`tabular-nums ${balanceDue > 0 ? "text-red-300" : "text-green-300"}`}>{balanceDue.toFixed(2)} $</span>
          </div>
        </div>
      </div>

      {order.appointment_date && (
        <div className="bg-blue-950/50 border border-blue-700/50 text-blue-300 rounded-lg px-3 py-2 text-sm mb-4">
          <h4 className="text-[10px] uppercase tracking-wider mb-1">Rendez-vous</h4>
          <p>{order.appointment_date}</p>
          {order.appointment_notes && <p className="text-xs mt-1 opacity-80">{order.appointment_notes}</p>}
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-slate-700/50">
        <Button size="sm" onClick={() => proc.setActiveStep("payment")} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmer et continuer
        </Button>
      </div>
    </div>
  );
}
