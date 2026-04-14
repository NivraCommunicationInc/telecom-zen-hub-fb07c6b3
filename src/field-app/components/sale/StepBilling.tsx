/**
 * Step 6 — Billing Setup (backend-driven pricing)
 * All pricing computed via field-pricing-quote edge function.
 */
import { useQuery } from "@tanstack/react-query";
import { CreditCard, RotateCcw, Check, Tag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSaleBilling, FieldSaleService, FieldSaleEquipment } from "@/field-app/lib/fieldSaleTypes";
import type { FieldSalePromo } from "@/field-app/components/sale/StepPromo";
import { computePricingQuote, type PricingQuoteResult } from "@/field-app/lib/fieldServices";

interface Props {
  services: FieldSaleService[];
  equipment: FieldSaleEquipment[];
  billing: FieldSaleBilling;
  promos?: FieldSalePromo[];
  installationType?: string;
  paymentMethod?: string;
  onChange: (b: FieldSaleBilling) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepBilling({ services, equipment, billing, promos = [], installationType, paymentMethod, onChange, onNext, onBack }: Props) {
  // Build items for pricing quote
  const items = [
    ...services.map((s) => ({ product_id: s.id, quantity: 1 })),
    ...equipment.filter((e) => e.quantity > 0).map((e) => ({ product_id: e.id, quantity: e.quantity })),
  ];

  const promoPayload = promos.map((p) => ({
    promo_code: p.id.startsWith("manual-") ? undefined : p.name,
    field_promo_id: p.id.startsWith("manual-") ? undefined : p.id,
  }));

  const { data: quote, isLoading } = useQuery({
    queryKey: ["field-pricing-quote", items, promoPayload, installationType, paymentMethod],
    queryFn: () => computePricingQuote(items, promoPayload, installationType, paymentMethod),
    enabled: items.length > 0,
    staleTime: 30_000,
  });

  // Fallback local display if quote not yet loaded
  const monthlySubtotal = quote?.recurring_monthly_estimate ?? services.reduce((s, sv) => s + sv.monthlyPrice, 0);
  const oneTimeSubtotal = quote?.one_time_subtotal ?? equipment.reduce((s, e) => s + e.price * e.quantity, 0);
  const activationFee = quote?.activation_fee ?? 0;
  const discountTotal = quote?.discount_total ?? 0;
  const tpsAmount = quote?.tps_amount ?? 0;
  const tvqAmount = quote?.tvq_amount ?? 0;
  const grandTotal = quote?.grand_total ?? (monthlySubtotal + oneTimeSubtotal + activationFee);
  const dueToday = quote?.due_today_estimate ?? grandTotal;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Facturation</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Résumé financier calculé par le moteur de prix.</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-sm text-[#1D4ED8]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calcul du devis en cours…
        </div>
      )}

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
        {discountTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[#DC2626] flex items-center gap-1"><Tag className="h-3 w-3" /> Promotions</span>
            <span className="text-[#DC2626] font-medium">-{discountTotal.toFixed(2)} $</span>
          </div>
        )}
        <div className="border-t border-[#E5E7EB] pt-2 space-y-1">
          <div className="flex justify-between text-xs text-[#6B7280]">
            <span>Sous-total mensuel</span><span>{monthlySubtotal.toFixed(2)} $/mois</span>
          </div>
          {quote && (
            <>
              <div className="flex justify-between text-xs text-[#6B7280]">
                <span>TPS (5%)</span><span>{tpsAmount.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between text-xs text-[#6B7280]">
                <span>TVQ (9.975%)</span><span>{tvqAmount.toFixed(2)} $</span>
              </div>
            </>
          )}
          {!quote && (
            <>
              <div className="flex justify-between text-xs text-[#6B7280]">
                <span>TPS (5%)</span><span>Calculé au traitement</span>
              </div>
              <div className="flex justify-between text-xs text-[#6B7280]">
                <span>TVQ (9.975%)</span><span>Calculé au traitement</span>
              </div>
            </>
          )}
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
        <div className="border-t border-[#E5E7EB] pt-2">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-[#374151]">Total frais uniques</span>
            <span className="text-[#000000]">{(oneTimeSubtotal + activationFee).toFixed(2)} $</span>
          </div>
        </div>
      </div>

      {/* Today's total */}
      <div className="bg-[#000000] text-white rounded-xl p-5">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Montant dû aujourd'hui</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[#D1D5DB]">Premier mois</span><span>{monthlySubtotal.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#D1D5DB]">Frais uniques</span><span>{(oneTimeSubtotal + activationFee).toFixed(2)} $</span>
          </div>
          {quote && (
            <>
              <div className="flex justify-between text-xs text-[#9CA3AF]">
                <span>TPS</span><span>{tpsAmount.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between text-xs text-[#9CA3AF]">
                <span>TVQ</span><span>{tvqAmount.toFixed(2)} $</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
            <span>Total</span><span className="text-[#22C55E]">{dueToday.toFixed(2)} $</span>
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
