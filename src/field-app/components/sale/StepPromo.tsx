/**
 * Step 2.5 — Promotion / Discount selection (between Services and Equipment)
 * Controlled by approved promo catalog. No freeform pricing edits.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tag, Loader2, Check, X, Gift, DollarSign, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldSalePromo {
  id: string;
  name: string;
  description: string | null;
  promo_type: string;
  discount_monthly: number;
  discount_onetime: number;
  discount_percentage: number;
  duration_months: number;
  requires_approval: boolean;
}

interface Props {
  selectedPromos: FieldSalePromo[];
  monthlySubtotal: number;
  activationFee: number;
  onChange: (promos: FieldSalePromo[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const PROMO_ICONS: Record<string, typeof Tag> = {
  monthly_discount: DollarSign,
  free_installation: Gift,
  activation_credit: Gift,
  percentage_off: Percent,
  custom: Tag,
};

function promoImpactLabel(promo: FieldSalePromo, monthlySubtotal: number): string {
  if (promo.promo_type === "monthly_discount") {
    return `-${promo.discount_monthly.toFixed(2)} $/mois × ${promo.duration_months} mois`;
  }
  if (promo.promo_type === "free_installation") {
    return `-${promo.discount_onetime.toFixed(2)} $ (frais uniques)`;
  }
  if (promo.promo_type === "activation_credit") {
    return `-${promo.discount_onetime.toFixed(2)} $ (activation)`;
  }
  if (promo.promo_type === "percentage_off") {
    const amount = (monthlySubtotal * promo.discount_percentage / 100);
    return `-${amount.toFixed(2)} $/mois (${promo.discount_percentage}%)`;
  }
  return "Promotion";
}

export default function StepPromo({ selectedPromos, monthlySubtotal, activationFee, onChange, onNext, onBack }: Props) {
  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["field-sales-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_sales_promotions")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as FieldSalePromo[];
    },
    staleTime: 60_000,
  });

  const isSelected = (id: string) => selectedPromos.some((p) => p.id === id);

  const togglePromo = (promo: FieldSalePromo) => {
    if (isSelected(promo.id)) {
      onChange(selectedPromos.filter((p) => p.id !== promo.id));
    } else {
      onChange([...selectedPromos, promo]);
    }
  };

  // Calculate total discount impact
  const totalMonthlyDiscount = selectedPromos.reduce((sum, p) => {
    if (p.promo_type === "monthly_discount") return sum + p.discount_monthly;
    if (p.promo_type === "percentage_off") return sum + (monthlySubtotal * p.discount_percentage / 100);
    return sum;
  }, 0);

  const totalOnetimeDiscount = selectedPromos.reduce((sum, p) => {
    if (p.promo_type === "free_installation" || p.promo_type === "activation_credit") return sum + p.discount_onetime;
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Promotions</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Appliquez les promotions approuvées. Aucune modification manuelle permise.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
        </div>
      ) : promos.length === 0 ? (
        <div className="bg-[#F3F4F6] rounded-xl p-6 text-center">
          <Tag className="h-8 w-8 mx-auto mb-2 text-[#9CA3AF]" />
          <p className="text-sm text-[#6B7280]">Aucune promotion disponible actuellement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {promos.map((promo) => {
            const active = isSelected(promo.id);
            const Icon = PROMO_ICONS[promo.promo_type] || Tag;
            return (
              <button
                key={promo.id}
                type="button"
                onClick={() => togglePromo(promo)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
                  active
                    ? "border-[#22C55E] bg-[#F0FDF4]"
                    : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      active ? "bg-[#DCFCE7]" : "bg-[#FEF3C7]"
                    )}>
                      <Icon className={cn("h-5 w-5", active ? "text-[#16A34A]" : "text-[#D97706]")} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#000000]">{promo.name}</span>
                        {promo.requires_approval && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706]">
                            Approbation requise
                          </span>
                        )}
                      </div>
                      {promo.description && (
                        <p className="text-xs text-[#6B7280] mt-0.5">{promo.description}</p>
                      )}
                      <p className="text-xs font-medium text-[#DC2626] mt-1">
                        {promoImpactLabel(promo, monthlySubtotal)}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ml-3",
                    active ? "bg-[#22C55E] border-[#22C55E]" : "border-[#D1D5DB]"
                  )}>
                    {active && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Impact summary */}
      {selectedPromos.length > 0 && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-[#DC2626] uppercase tracking-wider">
            Impact des promotions
          </p>
          {totalMonthlyDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#374151]">Réduction mensuelle</span>
              <span className="font-semibold text-[#DC2626]">-{totalMonthlyDiscount.toFixed(2)} $/mois</span>
            </div>
          )}
          {totalOnetimeDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#374151]">Réduction frais uniques</span>
              <span className="font-semibold text-[#DC2626]">-{totalOnetimeDiscount.toFixed(2)} $</span>
            </div>
          )}
        </div>
      )}

      {/* Skip notice */}
      <div className="p-3 rounded-lg bg-[#F3F4F6] text-xs text-[#6B7280]">
        💡 Vous pouvez continuer sans appliquer de promotion.
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
          ← Retour
        </button>
        <button type="button" onClick={onNext} className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors">
          Continuer →
        </button>
      </div>
    </div>
  );
}
