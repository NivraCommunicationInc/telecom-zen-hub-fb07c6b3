/**
 * Step 3 — Equipment selection (backend-driven catalog).
 * Uses the field-catalog edge function for equipment data.
 */
import { useQuery } from "@tanstack/react-query";
import { Plus, Minus, Loader2, AlertTriangle, Router, Tv, Smartphone, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSaleEquipment, FieldSaleService } from "@/field-app/lib/fieldSaleTypes";
import { fetchCatalog } from "@/field-app/lib/fieldServices";

interface Props {
  services: FieldSaleService[];
  equipment: FieldSaleEquipment[];
  onChange: (eq: FieldSaleEquipment[]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface EquipmentItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string | null;
  requiredServiceCategory: string;
  maxQty: number;
  icon: typeof Router;
}

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  internet: "Internet",
  tv: "Télévision",
  mobile: "Mobile",
  security: "Sécurité",
  other: "Autre",
};

function resolveEquipmentMeta(name: string, rules: any[]): { category: string; icon: typeof Router; maxQty: number } {
  const n = name.toLowerCase();
  // Check rules for max qty
  const rule = rules.find((r: any) => r.equipment_product_id && r.max_quantity);
  const maxFromRule = rule?.max_quantity;

  if (n.includes("router") || n.includes("routeur") || n.includes("borne") || n.includes("mesh")) {
    return { category: "internet", icon: Router, maxQty: maxFromRule ?? (n.includes("router") || n.includes("routeur") ? 1 : 3) };
  }
  if (n.includes("terminal") || n.includes("iptv") || n.includes("4k")) {
    return { category: "tv", icon: Tv, maxQty: maxFromRule ?? 5 };
  }
  if (n.includes("sim") || n.includes("esim")) {
    return { category: "mobile", icon: Smartphone, maxQty: maxFromRule ?? 5 };
  }
  return { category: "other", icon: Package, maxQty: maxFromRule ?? 5 };
}

export default function StepEquipment({ services, equipment, onChange, onNext, onBack }: Props) {
  const { data: catalogData, isLoading, error } = useQuery({
    queryKey: ["field-catalog-full"],
    queryFn: () => fetchCatalog(),
    staleTime: 5 * 60 * 1000,
  });

  // Extract equipment products from the catalog
  const catalog: EquipmentItem[] = (catalogData?.products || [])
    .filter((p: any) => p.product_type === "equipment" && p.is_sellable)
    .map((p: any) => {
      const prices = (catalogData?.prices || []).filter((pr: any) => pr.product_id === p.id);
      const oneTimePrice = prices.find((pr: any) => pr.price_type === "one_time");
      const rules = (catalogData?.equipment_rules || []).filter((r: any) => r.equipment_product_id === p.id);
      const meta = resolveEquipmentMeta(p.name, rules);
      return {
        id: p.id,
        name: p.name,
        price: oneTimePrice ? Number(oneTimePrice.amount) : 0,
        category: meta.category,
        description: p.customer_description,
        requiredServiceCategory: meta.category,
        maxQty: meta.maxQty,
        icon: meta.icon,
      };
    });

  const selectedCategories = new Set(services.map((s) => s.category));

  const groupedEquipment = catalog.reduce<Record<string, EquipmentItem[]>>((acc, eq) => {
    if (!acc[eq.requiredServiceCategory]) acc[eq.requiredServiceCategory] = [];
    acc[eq.requiredServiceCategory].push(eq);
    return acc;
  }, {});

  const getQty = (id: string) => equipment.find((e) => e.id === id)?.quantity ?? 0;

  const setQty = (eq: EquipmentItem, qty: number) => {
    const clamped = Math.max(0, Math.min(qty, eq.maxQty));
    const filtered = equipment.filter((e) => e.id !== eq.id);
    if (clamped > 0) {
      filtered.push({ id: eq.id, name: eq.name, price: eq.price, category: eq.category, quantity: clamped });
    }
    onChange(filtered);
  };

  const totalEquipment = equipment.reduce((s, e) => s + e.price * e.quantity, 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" />
      </div>
    );
  }

  if (error || catalog.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#000000]">Équipement</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">Sélectionnez l'équipement nécessaire.</p>
        </div>
        {error ? (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626]">
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Erreur de chargement du catalogue d'équipement.
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
            Aucun équipement disponible dans le catalogue.
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
            ← Retour
          </button>
          <button type="button" onClick={onNext} className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors">
            Continuer sans équipement →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Équipement</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Sélectionnez l'équipement nécessaire selon les services choisis.
        </p>
      </div>

      {Object.entries(groupedEquipment).map(([categoryKey, items]) => {
        const isRelevant = selectedCategories.has(categoryKey);
        return (
          <div key={categoryKey} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#374151]">
                {SERVICE_CATEGORY_LABELS[categoryKey] || categoryKey}
              </h3>
              {isRelevant ? (
                <span className="text-[10px] font-medium bg-[#DCFCE7] text-[#16A34A] px-1.5 py-0.5 rounded">
                  Service sélectionné
                </span>
              ) : (
                <span className="text-[10px] font-medium bg-[#F3F4F6] text-[#9CA3AF] px-1.5 py-0.5 rounded">
                  Optionnel
                </span>
              )}
            </div>
            {items.map((eq) => {
              const qty = getQty(eq.id);
              const Icon = eq.icon;
              return (
                <div
                  key={eq.id}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all",
                    qty > 0 ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E5E7EB] bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        qty > 0 ? "bg-[#DCFCE7]" : "bg-[#F3F4F6]"
                      )}>
                        <Icon className={cn("h-5 w-5", qty > 0 ? "text-[#16A34A]" : "text-[#6B7280]")} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#000000]">{eq.name}</p>
                        <p className="text-xs text-[#6B7280]">
                          {eq.price === 0 ? "Gratuit" : `${eq.price.toFixed(2)} $`} · Frais unique · Max {eq.maxQty}
                        </p>
                        {eq.description && (
                          <p className="text-[10px] text-[#9CA3AF] mt-0.5 line-clamp-1">{eq.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty(eq, qty - 1)}
                        disabled={qty === 0}
                        className="h-8 w-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-[#000000]">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(eq, qty + 1)}
                        disabled={qty >= eq.maxQty}
                        className="h-8 w-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-30 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {totalEquipment > 0 && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-[#000000]">Total équipement (frais uniques)</span>
            <span className="text-[#16A34A]">{totalEquipment.toFixed(2)} $</span>
          </div>
        </div>
      )}

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
