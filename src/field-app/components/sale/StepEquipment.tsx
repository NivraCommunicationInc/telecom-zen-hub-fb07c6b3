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
  { id: "eq-router", name: "Routeur Wi-Fi", price: 60, category: "router", requiredServiceCategory: "internet", maxQty: 1, icon: Router },
  { id: "eq-tv-terminal", name: "Terminal TV", price: 50, category: "terminal", requiredServiceCategory: "tv", maxQty: 3, icon: Tv },
  { id: "eq-sim", name: "Carte SIM", price: 25, category: "sim", requiredServiceCategory: "mobile", maxQty: 1, icon: Smartphone },
  { id: "eq-esim", name: "eSIM (activation)", price: 25, category: "esim", requiredServiceCategory: "mobile", maxQty: 1, icon: Smartphone },
];

export default function StepEquipment({ services, equipment, onChange, onNext, onBack }: Props) {
  const selectedCategories = new Set(services.map((s) => s.category));

  const availableEquipment = EQUIPMENT_CATALOG.filter((eq) =>
    selectedCategories.has(eq.requiredServiceCategory)
  );

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

      {availableEquipment.length === 0 ? (
        <div className="bg-[#F3F4F6] rounded-xl p-6 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-[#9CA3AF]" />
          <p className="text-sm text-[#6B7280]">Aucun équipement requis pour les services sélectionnés.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {availableEquipment.map((eq) => {
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
                        {eq.price.toFixed(2)} $ · Frais unique · Max {eq.maxQty}
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
      )}

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
