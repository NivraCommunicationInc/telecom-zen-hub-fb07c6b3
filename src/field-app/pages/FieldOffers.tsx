/**
 * FieldOffers — Read-only approved catalog.
 * No custom pricing, no promo overrides.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Wifi, Smartphone, Tv, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<string, { icon: typeof Package; color: string; bg: string }> = {
  internet: { icon: Wifi, color: "text-blue-400", bg: "bg-blue-500/10" },
  mobile: { icon: Smartphone, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  tv: { icon: Tv, color: "text-purple-400", bg: "bg-purple-500/10" },
  combo: { icon: Package, color: "text-amber-400", bg: "bg-amber-500/10" },
};

export default function FieldOffers() {
  const { data: services, isLoading } = useQuery({
    queryKey: ["field-offers-catalog"],
    queryFn: async () => {
      // Try services_public view first, fallback to services table
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

  // Group by category
  const grouped = (services || []).reduce((acc: Record<string, any[]>, s: any) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Offres approuvées</h1>
        <p className="text-sm text-[hsl(220,10%,45%)] mt-0.5">Catalogue officiel — Tarification fixe, aucune modification permise.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-[hsl(220,10%,35%)] text-center py-12">Aucune offre disponible.</p>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.combo;
          const Icon = config.icon;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn("h-6 w-6 rounded flex items-center justify-center", config.bg)}>
                  <Icon className={cn("h-3.5 w-3.5", config.color)} />
                </div>
                <h2 className="text-sm font-semibold text-white capitalize">{category}</h2>
              </div>
              <div className="space-y-1.5">
                {(items as any[]).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      {s.description && (
                        <p className="text-[11px] text-[hsl(220,10%,40%)] truncate mt-0.5">{s.description}</p>
                      )}
                      {s.speed_mbps && (
                        <span className="text-[10px] text-blue-400 font-medium">{s.speed_mbps} Mbps</span>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-white">{Number(s.monthly_price).toFixed(2)} $</p>
                      <p className="text-[10px] text-[hsl(220,10%,40%)]">/mois</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Fixed pricing notice */}
      <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400/80">
        ⚠️ Tarification officielle uniquement. Aucune remise personnalisée ni code promo n'est applicable sur le terrain.
      </div>
    </div>
  );
}
