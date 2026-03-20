/**
 * FieldOffers — Read-only approved catalog. Clean light UI.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Wifi, Smartphone, Tv, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<string, { icon: typeof Package; color: string; bg: string; label: string }> = {
  internet: { icon: Wifi, color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]", label: "Internet" },
  mobile: { icon: Smartphone, color: "text-[#22C55E]", bg: "bg-[#DCFCE7]", label: "Mobile" },
  tv: { icon: Tv, color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]", label: "Télévision" },
  combo: { icon: Package, color: "text-[#F59E0B]", bg: "bg-[#FEF3C7]", label: "Combos" },
};

export default function FieldOffers() {
  const { data: services, isLoading } = useQuery({
    queryKey: ["field-offers-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, monthly_price, category, speed_mbps, is_active")
        .eq("is_active", true)
        .order("category")
        .order("monthly_price", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const grouped = (services || []).reduce((acc: Record<string, any[]>, s: any) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#000000]">Offres approuvées</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Catalogue officiel — Tarification fixe, aucune modification permise.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-[#9CA3AF] text-center py-12">Aucune offre disponible.</p>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.combo;
          const Icon = config.icon;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", config.bg)}>
                  <Icon className={cn("h-3.5 w-3.5", config.color)} />
                </div>
                <h2 className="text-sm font-semibold text-[#000000]">{config.label}</h2>
              </div>
              <div className="space-y-2">
                {(items as any[]).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#000000]">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-[#6B7280] truncate mt-0.5">{s.description}</p>
                      )}
                      {s.speed_mbps && (
                        <span className="text-[10px] font-medium text-[#3B82F6] bg-[#DBEAFE] px-1.5 py-0.5 rounded mt-1 inline-block">
                          {s.speed_mbps} Mbps
                        </span>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-[#000000]">{Number(s.monthly_price).toFixed(2)} $</p>
                      <p className="text-[10px] text-[#6B7280]">/mois</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <div className="p-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
        ⚠️ Tarification officielle uniquement. Aucune remise personnalisée ni code promo n'est applicable sur le terrain.
      </div>
    </div>
  );
}
