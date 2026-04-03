/**
 * Step 3 — Equipment selection (dynamic based on selected services).
 */
import { Router, Tv, Smartphone, Package, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSaleEquipment, FieldSaleService } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  services: FieldSaleService[];
  equipment: FieldSaleEquipment[];
  onChange: (eq: FieldSaleEquipment[]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface EquipmentOption {
  id: string;
  name: string;
  price: number;
  category: string;
  requiredServiceCategory: string;
  maxQty: number;
  icon: typeof Router;
}

const EQUIPMENT_CATALOG: EquipmentOption[] = [
  // Internet
  { id: "eq-modem", name: "Modem câble", price: 0, category: "modem", requiredServiceCategory: "internet", maxQty: 1, icon: Package },
  { id: "eq-router", name: "Routeur Wi-Fi 6", price: 99.99, category: "router", requiredServiceCategory: "internet", maxQty: 1, icon: Router },
  { id: "eq-borne", name: "Borne Wi-Fi (extension)", price: 79.99, category: "borne", requiredServiceCategory: "internet", maxQty: 3, icon: Router },
  { id: "eq-mesh", name: "Kit Mesh Wi-Fi (2 bornes)", price: 149.99, category: "mesh", requiredServiceCategory: "internet", maxQty: 1, icon: Router },
  // TV
  { id: "eq-tv-terminal", name: "Terminal IPTV", price: 75, category: "terminal", requiredServiceCategory: "tv", maxQty: 5, icon: Tv },
  { id: "eq-tv-hdmi", name: "Câble HDMI (inclus)", price: 0, category: "accessoire", requiredServiceCategory: "tv", maxQty: 5, icon: Tv },
  // Mobile
  { id: "eq-sim", name: "Carte SIM physique", price: 10, category: "sim", requiredServiceCategory: "mobile", maxQty: 5, icon: Smartphone },
  { id: "eq-esim", name: "eSIM (activation)", price: 0, category: "esim", requiredServiceCategory: "mobile", maxQty: 5, icon: Smartphone },
  // Security
  { id: "eq-cam-int", name: "Caméra intérieure Wi-Fi", price: 89.99, category: "camera", requiredServiceCategory: "security", maxQty: 4, icon: Package },
  { id: "eq-cam-ext", name: "Caméra extérieure PoE", price: 129.99, category: "camera", requiredServiceCategory: "security", maxQty: 4, icon: Package },
  { id: "eq-sensor", name: "Détecteur mouvement", price: 29.99, category: "sensor", requiredServiceCategory: "security", maxQty: 6, icon: Package },
  { id: "eq-panel", name: "Panneau de contrôle", price: 199.99, category: "panel", requiredServiceCategory: "security", maxQty: 1, icon: Package },
];

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  internet: "Internet",
  tv: "Télévision",
  mobile: "Mobile",
  security: "Sécurité",
};

export default function StepEquipment({ services, equipment, onChange, onNext, onBack }: Props) {
  const selectedCategories = new Set(services.map((s) => s.category));

  // Show ALL equipment, grouped by category — highlight relevant ones
  const groupedEquipment = EQUIPMENT_CATALOG.reduce<Record<string, EquipmentOption[]>>((acc, eq) => {
    if (!acc[eq.requiredServiceCategory]) acc[eq.requiredServiceCategory] = [];
    acc[eq.requiredServiceCategory].push(eq);
    return acc;
  }, {});

  const getQty = (id: string) => equipment.find((e) => e.id === id)?.quantity ?? 0;

  const setQty = (eq: EquipmentOption, qty: number) => {
    const clamped = Math.max(0, Math.min(qty, eq.maxQty));
    const filtered = equipment.filter((e) => e.id !== eq.id);
    if (clamped > 0) {
      filtered.push({ id: eq.id, name: eq.name, price: eq.price, category: eq.category, quantity: clamped });
    }
    onChange(filtered);
  };

  const totalEquipment = equipment.reduce((s, e) => s + e.price * e.quantity, 0);

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
              {isRelevant && (
                <span className="text-[10px] font-medium bg-[#DCFCE7] text-[#16A34A] px-1.5 py-0.5 rounded">
                  Service sélectionné
                </span>
              )}
              {!isRelevant && (
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

      {/* Equipment total */}
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
