/**
 * Step 2 — Service / Plan Selection
 * Uses the backend catalog engine via fieldServices.
 */
import { useQuery } from "@tanstack/react-query";
import { Wifi, Smartphone, Tv, Package, Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCatalog } from "@/field-app/lib/fieldServices";
import type { FieldSaleService } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  selected: FieldSaleService[];
  onChange: (services: FieldSaleService[]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface CatalogProduct {
  id: string;
  product_code: string;
  name: string;
  category_code: string;
  customer_description: string | null;
  is_sellable: boolean;
  prices: Array<{ price_type: string; amount: number }>;
  attributes: Array<{ attribute_key: string; attribute_value_jsonb: any }>;
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

const CATEGORY_ORDER = ["internet", "mobile", "tv"];

export default function StepServices({ selected, onChange, onNext, onBack }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["field-catalog-full"],
    queryFn: () => fetchCatalog(),
    staleTime: 5 * 60 * 1000,
  });

  // Build product list with prices merged
  const products: CatalogProduct[] = (data?.products || [])
    .filter((p: any) => p.is_sellable && p.product_type !== "equipment" && p.product_type !== "fee")
    .map((p: any) => ({
      ...p,
      prices: (data?.prices || []).filter((pr: any) => pr.product_id === p.id),
      attributes: (data?.attributes || []).filter((a: any) => a.product_id === p.id),
    }));

  // Group by category
  const grouped: Record<string, CatalogProduct[]> = {};
  for (const p of products) {
    const cat = p.category_code || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const getMonthlyPrice = (p: CatalogProduct) => {
    const rec = p.prices.find((pr) => pr.price_type === "recurring_monthly");
    return rec ? Number(rec.amount) : 0;
  };

  const getAttr = (p: CatalogProduct, key: string) => {
    const attr = p.attributes.find((a) => a.attribute_key === key);
    return attr?.attribute_value_jsonb;
  };

  const isSelected = (id: string) => selected.some((s) => s.id === id);

  const toggleService = (p: CatalogProduct) => {
    if (isSelected(p.id)) {
      onChange(selected.filter((s) => s.id !== p.id));
    } else {
      const speed = getAttr(p, "download_speed_mbps");
      onChange([
        ...selected,
        {
          id: p.id,
          name: p.name,
          category: p.category_code,
          monthlyPrice: getMonthlyPrice(p),
          description: p.customer_description,
          speed: speed ? `${speed} Mbps` : undefined,
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
      ) : error ? (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626]">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Erreur de chargement du catalogue. Veuillez réessayer.
        </div>
      ) : products.length === 0 ? (
        <div className="p-6 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-[#D97706]" />
          <p className="text-sm font-medium text-[#92400E]">Aucun forfait approuvé disponible</p>
          <p className="text-xs text-[#A16207] mt-1">
            Contactez un administrateur pour activer des forfaits dans le catalogue.
          </p>
        </div>
      ) : (
        sortedCategories.map((category) => {
          const items = grouped[category];
          const Icon = CATEGORY_ICONS[category] || Package;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#22C55E]" />
                <h3 className="text-sm font-semibold text-[#000000]">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <span className="text-[10px] text-[#9CA3AF] font-medium">
                  {items.length} forfait{items.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((product) => {
                  const active = isSelected(product.id);
                  const price = getMonthlyPrice(product);
                  const speed = getAttr(product, "download_speed_mbps");

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleService(product)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                        active
                          ? "border-[#22C55E] bg-[#F0FDF4]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#000000]">{product.name}</span>
                            {speed && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#3B82F6]">
                                {speed} Mbps
                              </span>
                            )}
                          </div>
                          {product.customer_description && (
                            <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{product.customer_description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-3">
                          <div className="text-right">
                            <p className="text-lg font-bold text-[#000000]">
                              {price.toFixed(2)} $
                            </p>
                            <p className="text-[10px] text-[#6B7280]">/mois</p>
                          </div>
                          <div className={cn(
                            "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
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
