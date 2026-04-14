/**
 * FieldOffers — Read-only approved catalog via backend catalog engine.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchCatalog } from "@/field-app/lib/fieldServices";
import { Package, Wifi, Smartphone, Tv, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG: Record<string, { icon: typeof Package; color: string; bg: string; label: string }> = {
  internet: { icon: Wifi, color: "text-blue-600", bg: "bg-blue-50", label: "Internet" },
  mobile: { icon: Smartphone, color: "text-emerald-600", bg: "bg-emerald-50", label: "Mobile" },
  tv: { icon: Tv, color: "text-violet-600", bg: "bg-violet-50", label: "Télévision" },
  combo: { icon: Package, color: "text-amber-600", bg: "bg-amber-50", label: "Combos" },
};

export default function FieldOffers() {
  const { data: catalog, isLoading } = useQuery({
    queryKey: ["field-offers-catalog"],
    queryFn: () => fetchCatalog(),
    staleTime: 1000 * 60 * 10,
  });

  const products = catalog?.products || [];
  const prices = catalog?.prices || [];

  const enriched = products.map((p: any) => {
    const price = prices.find((pr: any) => pr.product_id === p.id && pr.price_type === "monthly");
    return { ...p, monthly_price: price?.amount ?? p.monthly_price ?? 0 };
  });

  const grouped = enriched.reduce((acc: Record<string, any[]>, s: any) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Offres approuvées</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Catalogue officiel — Tarification fixe, aucune modification permise.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Aucune offre disponible.</p>
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
                <h2 className="text-sm font-semibold text-foreground">{config.label}</h2>
              </div>
              <div className="space-y-2">
                {(items as any[]).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-muted-foreground/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      {s.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>}
                      {s.speed_mbps && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                          {s.speed_mbps} Mbps
                        </span>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-foreground">{Number(s.monthly_price).toFixed(2)} $</p>
                      <p className="text-[10px] text-muted-foreground">/mois</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
        ⚠️ Tarification officielle uniquement. Aucune remise personnalisée ni code promo n'est applicable sur le terrain.
      </div>
    </div>
  );
}
