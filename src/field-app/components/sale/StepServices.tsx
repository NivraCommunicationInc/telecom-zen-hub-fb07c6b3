/**
 * Step 2 — Service / Plan Selection
 * Read-only pricing from approved catalog.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, Smartphone, Tv, Package, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSaleService } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  selected: FieldSaleService[];
  onChange: (services: FieldSaleService[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Wifi> = {
  internet: Wifi,
  mobile: Smartphone,
  tv: Tv,
};

const CATEGORY_LABELS: Record<string, string> = {
  internet: "Internet",
  mobile: "Mobile",
  tv: "Télévision",
};

export default function StepServices({ selected, onChange, onNext, onBack }: Props) {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["field-catalog-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, monthly_price, category, speed_mbps, is_active")
        .eq("is_active", true)
        .order("category")
        .order("monthly_price", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const grouped = services.reduce((acc: Record<string, any[]>, s) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const isSelected = (id: string) => selected.some((s) => s.id === id);

  const toggleService = (service: any) => {
    if (isSelected(service.id)) {
      onChange(selected.filter((s) => s.id !== service.id));
    } else {
      onChange([
        ...selected,
        {
          id: service.id,
          name: service.name,
          category: service.category,
          monthlyPrice: Number(service.monthly_price),
          description: service.description,
          speed: service.speed_mbps ? `${service.speed_mbps} Mbps` : undefined,
        },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Sélection des services</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Sélectionnez les forfaits approuvés. Tarification fixe — aucune modification permise.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const Icon = CATEGORY_ICONS[category] || Package;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#22C55E]" />
                <h3 className="text-sm font-semibold text-[#000000]">
                  {CATEGORY_LABELS[category] || category}
                </h3>
              </div>
              <div className="space-y-2">
                {(items as any[]).map((s) => {
                  const active = isSelected(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                        active
                          ? "border-[#22C55E] bg-[#F0FDF4]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#000000]">{s.name}</span>
                            {s.speed_mbps && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#3B82F6]">
                                {s.speed_mbps} Mbps
                              </span>
                            )}
                          </div>
                          {s.description && (
                            <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{s.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-3">
                          <div className="text-right">
                            <p className="text-lg font-bold text-[#000000]">
                              {Number(s.monthly_price).toFixed(2)} $
                            </p>
                            <p className="text-[10px] text-[#6B7280]">/mois</p>
                          </div>
                          <div className={cn(
                            "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors",
                            active ? "bg-[#22C55E] border-[#22C55E]" : "border-[#D1D5DB]"
                          )}>
                            {active && <Check className="h-3.5 w-3.5 text-white" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Selected summary */}
      {selected.length > 0 && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#16A34A] uppercase tracking-wider mb-2">
            {selected.length} service{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {selected.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-[#000000]">{s.name}</span>
                <span className="font-semibold text-[#000000]">{s.monthlyPrice.toFixed(2)} $/mois</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t border-[#BBF7D0] pt-2 mt-2">
              <span className="text-[#000000]">Total mensuel</span>
              <span className="text-[#16A34A]">
                {selected.reduce((s, sv) => s + sv.monthlyPrice, 0).toFixed(2)} $/mois
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Pricing notice */}
      <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
        ⚠️ Tarification officielle uniquement. Aucune remise ni code promo n'est applicable sur le terrain.
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
          ← Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={selected.length === 0}
          className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
