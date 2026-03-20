/**
 * Step 6 — Billing Setup (promo-aware)
 */
import { CreditCard, RotateCcw, Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSaleBilling, FieldSaleService, FieldSaleEquipment } from "@/field-app/lib/fieldSaleTypes";
import type { FieldSalePromo } from "@/field-app/components/sale/StepPromo";
// ⛔ LOCAL TAX MATH REMOVED — taxes computed server-side only
const TAX_DISPLAY = { TPS_LABEL: "TPS (5%)", TVQ_LABEL: "TVQ (9.975%)" };

interface Props {
  services: FieldSaleService[];
  equipment: FieldSaleEquipment[];
  billing: FieldSaleBilling;
  promos?: FieldSalePromo[];
  onChange: (b: FieldSaleBilling) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepBilling({ services, equipment, billing, promos = [], onChange, onNext, onBack }: Props) {
  const monthlySubtotal = services.reduce((s, sv) => s + sv.monthlyPrice, 0);
  const equipmentTotal = equipment.reduce((s, e) => s + e.price * e.quantity, 0);
  const activationFee = services.length === 0 ? 0 : services.length === 1 ? 25 : 45;

  const promoMonthlyDiscount = promos.reduce((sum, p) => {
    if (p.promo_type === "monthly_discount") return sum + p.discount_monthly;
    if (p.promo_type === "percentage_off") return sum + (monthlySubtotal * p.discount_percentage / 100);
    return sum;
  }, 0);
  const promoOnetimeDiscount = promos.reduce((sum, p) => {
    if (p.promo_type === "activation_credit") return sum + Math.min(p.discount_onetime, activationFee);
    if (p.promo_type === "free_installation") return sum + p.discount_onetime;
    return sum;
  }, 0);

  const effectiveMonthly = Math.max(0, monthlySubtotal - promoMonthlyDiscount);
  const effectiveActivation = Math.max(0, activationFee - promoOnetimeDiscount);
  const oneTimeSubtotal = equipmentTotal + effectiveActivation;
  const totalDueToday = effectiveMonthly + oneTimeSubtotal;
  const taxes = estimateTaxes(totalDueToday);
  const monthlyTaxes = estimateTaxes(effectiveMonthly);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Facturation</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Résumé financier et options de facturation.</p>
      </div>

      {/* Monthly recurring */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw className="h-4 w-4 text-[#3B82F6]" />
          <h3 className="text-sm font-semibold text-[#000000]">Récurrent mensuel</h3>
        </div>
        {services.map((s) => (
          <div key={s.id} className="flex justify-between text-sm">
            <span className="text-[#374151]">{s.name}</span>
            <span className="text-[#000000] font-medium">{s.monthlyPrice.toFixed(2)} $</span>
          </div>
        ))}
        {promoMonthlyDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[#DC2626] flex items-center gap-1"><Tag className="h-3 w-3" /> Promotion</span>
            <span className="text-[#DC2626] font-medium">-{promoMonthlyDiscount.toFixed(2)} $</span>
          </div>
        )}
        <div className="border-t border-[#E5E7EB] pt-2 space-y-1">
          <div className="flex justify-between text-xs text-[#6B7280]">
            <span>Sous-total</span><span>{effectiveMonthly.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-xs text-[#6B7280]">
            <span>{TAX_DISPLAY.TPS_LABEL}</span><span>{monthlyTaxes.tps.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-xs text-[#6B7280]">
            <span>{TAX_DISPLAY.TVQ_LABEL}</span><span>{monthlyTaxes.tvq.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-[#000000] pt-1">
            <span>Total mensuel</span><span>{monthlyTaxes.total.toFixed(2)} $/mois</span>
          </div>
        </div>
      </div>

      {/* One-time */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-4 w-4 text-[#22C55E]" />
          <h3 className="text-sm font-semibold text-[#000000]">Frais uniques</h3>
        </div>
        {equipment.map((e) => (
          <div key={e.id} className="flex justify-between text-sm">
            <span className="text-[#374151]">{e.name} x{e.quantity}</span>
            <span className="text-[#000000] font-medium">{(e.price * e.quantity).toFixed(2)} $</span>
          </div>
        ))}
        <div className="flex justify-between text-sm">
          <span className="text-[#374151]">Frais d'activation</span>
          <span className="text-[#000000] font-medium">{activationFee.toFixed(2)} $</span>
        </div>
        {promoOnetimeDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[#DC2626] flex items-center gap-1"><Tag className="h-3 w-3" /> Promotion</span>
            <span className="text-[#DC2626] font-medium">-{promoOnetimeDiscount.toFixed(2)} $</span>
          </div>
        )}
        <div className="border-t border-[#E5E7EB] pt-2">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-[#374151]">Total frais uniques</span>
            <span className="text-[#000000]">{oneTimeSubtotal.toFixed(2)} $</span>
          </div>
        </div>
      </div>

      {/* Today's total */}
      <div className="bg-[#000000] text-white rounded-xl p-5">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Montant dû aujourd'hui</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[#D1D5DB]">Premier mois</span><span>{effectiveMonthly.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#D1D5DB]">Frais uniques</span><span>{oneTimeSubtotal.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-xs text-[#9CA3AF]">
            <span>{TAX_DISPLAY.TPS_LABEL}</span><span>{taxes.tps.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-xs text-[#9CA3AF]">
            <span>{TAX_DISPLAY.TVQ_LABEL}</span><span>{taxes.tvq.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
            <span>Total</span><span className="text-[#22C55E]">{taxes.total.toFixed(2)} $</span>
          </div>
        </div>
      </div>

      {/* Pre-authorized payment */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#000000]">Paiement pré-autorisé</p>
            <p className="text-xs text-[#6B7280] mt-0.5">Renouvellement automatique mensuel</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...billing, preauthorizedPayment: !billing.preauthorizedPayment })}
            className={cn("h-6 w-11 rounded-full transition-colors relative", billing.preauthorizedPayment ? "bg-[#22C55E]" : "bg-[#D1D5DB]")}
          >
            <div className={cn("h-5 w-5 bg-white rounded-full shadow absolute top-0.5 transition-transform", billing.preauthorizedPayment ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </div>
        {billing.preauthorizedPayment && (
          <p className="text-xs text-[#16A34A] mt-2 flex items-center gap-1">
            <Check className="h-3 w-3" /> Le client sera facturé automatiquement chaque mois
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">← Retour</button>
        <button type="button" onClick={onNext} className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors">Continuer →</button>
      </div>
    </div>
  );
}
