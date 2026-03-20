/**
 * Step 2.5 — Promotion / Discount selection (between Services and Equipment)
 * Supports approved promo catalog + manual discount entry for field reps.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tag, Loader2, Check, Gift, DollarSign, Percent, PlusCircle, Trash2 } from "lucide-react";
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
    return `-${amount.toFixed(2)} $/mois (${promo.discount_percentage}%) × ${promo.duration_months} mois`;
  }
  if (promo.promo_type === "custom") {
    const parts: string[] = [];
    if (promo.discount_monthly > 0) parts.push(`-${promo.discount_monthly.toFixed(2)} $/mois`);
    if (promo.discount_onetime > 0) parts.push(`-${promo.discount_onetime.toFixed(2)} $ (unique)`);
    return parts.join(" + ") || "Rabais manuel";
  }
  return "Promotion";
}

export default function StepPromo({ selectedPromos, monthlySubtotal, activationFee, onChange, onNext, onBack }: Props) {
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualType, setManualType] = useState<"monthly" | "onetime">("monthly");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDuration, setManualDuration] = useState("1");
  const [manualReason, setManualReason] = useState("");

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

  const addManualDiscount = () => {
    const amt = parseFloat(manualAmount);
    if (!manualName.trim() || isNaN(amt) || amt <= 0) return;

    const custom: FieldSalePromo = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      description: manualReason.trim() || null,
      promo_type: "custom",
      discount_monthly: manualType === "monthly" ? amt : 0,
      discount_onetime: manualType === "onetime" ? amt : 0,
      discount_percentage: 0,
      duration_months: manualType === "monthly" ? parseInt(manualDuration) || 1 : 0,
      requires_approval: true,
    };

    onChange([...selectedPromos, custom]);
    setManualName("");
    setManualAmount("");
    setManualDuration("1");
    setManualReason("");
    setShowManual(false);
  };

  const removePromo = (id: string) => {
    onChange(selectedPromos.filter((p) => p.id !== id));
  };

  // Calculate total discount impact
  const totalMonthlyDiscount = selectedPromos.reduce((sum, p) => {
    if (p.promo_type === "monthly_discount" || (p.promo_type === "custom" && p.discount_monthly > 0)) return sum + p.discount_monthly;
    if (p.promo_type === "percentage_off") return sum + (monthlySubtotal * p.discount_percentage / 100);
    return sum;
  }, 0);

  const totalOnetimeDiscount = selectedPromos.reduce((sum, p) => {
    if (p.promo_type === "free_installation" || p.promo_type === "activation_credit") return sum + p.discount_onetime;
    if (p.promo_type === "custom" && p.discount_onetime > 0) return sum + p.discount_onetime;
    return sum;
  }, 0);

  // Separate catalog promos from manual ones in the selected list
  const catalogSelected = selectedPromos.filter(p => !p.id.startsWith("manual-"));
  const manualSelected = selectedPromos.filter(p => p.id.startsWith("manual-"));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Promotions & Rabais</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Sélectionnez les promotions approuvées ou ajoutez un rabais manuel.
        </p>
      </div>

      {/* ── Approved Promos Catalog ── */}
      <div>
        <p className="text-xs font-semibold text-[#374151] uppercase tracking-wider mb-2">
          Promotions approuvées
        </p>
        {isLoading ? (
          <div className="flex justify-center py-8">
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
      </div>

      {/* ── Manual Discount Section ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#374151] uppercase tracking-wider">
            Rabais manuel
          </p>
          {!showManual && (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#22C55E] hover:text-[#16A34A] transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Ajouter un rabais
            </button>
          )}
        </div>

        {/* Manual discount form */}
        {showManual && (
          <div className="border-2 border-[#E5E7EB] rounded-xl p-4 space-y-3 bg-[#FAFAFA]">
            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1">Nom du rabais *</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ex: Rabais fidélité client"
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#374151] block mb-1">Type</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as "monthly" | "onetime")}
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#22C55E] bg-white"
                >
                  <option value="monthly">Mensuel ($/mois)</option>
                  <option value="onetime">Unique ($)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#374151] block mb-1">Montant ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="10.00"
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                />
              </div>
            </div>

            {manualType === "monthly" && (
              <div>
                <label className="text-xs font-medium text-[#374151] block mb-1">Durée (mois)</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#000000] focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-[#374151] block mb-1">Raison / justification</label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Ex: Client référé par un partenaire"
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#22C55E]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="flex-1 py-2 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={addManualDiscount}
                disabled={!manualName.trim() || !manualAmount || parseFloat(manualAmount) <= 0}
                className="flex-1 py-2 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ajouter le rabais
              </button>
            </div>

            <p className="text-[10px] text-[#D97706] bg-[#FEF3C7] rounded-lg px-3 py-1.5">
              ⚠️ Les rabais manuels nécessitent une approbation du gestionnaire.
            </p>
          </div>
        )}

        {/* Show added manual discounts */}
        {manualSelected.length > 0 && (
          <div className="space-y-2 mt-2">
            {manualSelected.map((promo) => (
              <div
                key={promo.id}
                className="flex items-center justify-between p-3 rounded-xl border-2 border-[#22C55E] bg-[#F0FDF4]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-[#DCFCE7]">
                    <Tag className="h-5 w-5 text-[#16A34A]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#000000]">{promo.name}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#D97706]">
                        Approbation requise
                      </span>
                    </div>
                    {promo.description && (
                      <p className="text-xs text-[#6B7280] mt-0.5">{promo.description}</p>
                    )}
                    <p className="text-xs font-medium text-[#DC2626] mt-1">
                      {promoImpactLabel(promo, monthlySubtotal)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePromo(promo.id)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#DC2626] hover:bg-[#FEF2F2] transition-colors shrink-0 ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Impact summary ── */}
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
          {manualSelected.length > 0 && (
            <div className="flex justify-between text-xs pt-1 border-t border-[#FECACA]">
              <span className="text-[#D97706]">Rabais manuels inclus</span>
              <span className="font-medium text-[#D97706]">{manualSelected.length} rabais (approbation requise)</span>
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
