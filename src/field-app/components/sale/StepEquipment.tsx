/**
 * Step 3 — Équipement
 * Source: services table (category = "Équipement").
 * Per-item quantity selector (0..maxQty).
 *
 * Equipment shown:
 *  - Router Nivra Born WiFi  (max 1, 60$)
 *  - Terminal Nivra 4K Smart (max 4, 50$)
 *  - Physical SIM            (max 5, 30$)
 *  - eSIM                    (max 5, 25$)
 *
 * Caps come from useFieldConfig (admin-configurable), with per-item overrides
 * for items not covered by the central config (eSIM uses the SIM cap).
 */
import { ArrowLeft, ArrowRight, Loader2, Package, Plus, Minus, Wifi, Tv, Smartphone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFieldConfig } from "@/field-app/lib/useFieldConfig";
import { useEquipmentCatalog } from "@/field-app/lib/useEquipmentCatalog";
import type { FieldSaleEquipment } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  selected: FieldSaleEquipment[];
  onChange: (equipment: FieldSaleEquipment[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const ICON_FOR_CATEGORY: Record<string, typeof Package> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
};

export default function StepEquipment({ selected, onChange, onNext, onBack }: Props) {
  const { data: config } = useFieldConfig();
  const { data: catalog = [], isLoading, error } = useEquipmentCatalog(config);

  const getQty = (id: string) => selected.find((e) => e.id === id)?.quantity ?? 0;

  const setQty = (item: typeof catalog[number], qty: number) => {
    const clamped = Math.max(0, Math.min(qty, item.maxQty));
    const others = selected.filter((e) => e.id !== item.id);
    if (clamped === 0) {
      onChange(others);
      return;
    }
    onChange([
      ...others,
      {
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        quantity: clamped,
      },
    ]);
  };

  const equipmentTotal = selected.reduce((sum, e) => sum + e.price * e.quantity, 0);

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl font-bold text-white">Équipement</h2>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-1">
          Frais uniques — sélectionnez les quantités requises.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--field-accent))]" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-[hsl(var(--field-warning)/0.1)] border border-[hsl(var(--field-warning)/0.4)] text-sm text-[hsl(var(--field-warning))]">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Erreur de chargement de l'équipement.
        </div>
      ) : catalog.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-8 text-center">
          <Package className="h-10 w-10 text-[hsl(var(--field-text-dim))] mx-auto mb-3" />
          <p className="text-[hsl(var(--field-text-muted))] font-medium">Aucun équipement disponible</p>
        </div>
      ) : (
        <div className="space-y-2">
          {catalog.map((item) => {
            const qty = getQty(item.id);
            const Icon = ICON_FOR_CATEGORY[item.category] || item.icon || Package;
            const lineTotal = qty * item.price;
            const active = qty > 0;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all",
                  active
                    ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
                    : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))]"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(var(--field-accent)/0.15)] flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-[hsl(var(--field-accent-glow))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-[hsl(var(--field-text-dim))]">
                        {item.price.toFixed(2)} $ · max {item.maxQty}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setQty(item, qty - 1)}
                      disabled={qty === 0}
                      aria-label="Diminuer"
                      className="h-9 w-9 rounded-lg bg-[hsl(var(--field-card-hover))] border border-[hsl(var(--field-border-subtle))] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(var(--field-accent)/0.2)] transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-7 text-center text-base font-bold text-white">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item, qty + 1)}
                      disabled={qty >= item.maxQty}
                      aria-label="Augmenter"
                      className="h-9 w-9 rounded-lg bg-[hsl(var(--field-card-hover))] border border-[hsl(var(--field-border-subtle))] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[hsl(var(--field-accent)/0.2)] transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {active && (
                  <div className="mt-3 pt-3 border-t border-[hsl(var(--field-accent)/0.25)] flex justify-between text-xs">
                    <span className="text-[hsl(var(--field-text-muted))]">Sous-total</span>
                    <span className="font-semibold text-[hsl(var(--field-accent-glow))]">
                      {lineTotal.toFixed(2)} $
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Totals */}
      <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] bg-[hsl(var(--field-accent)/0.08)] p-4 flex justify-between items-center">
        <span className="text-sm font-semibold text-white">Total équipement</span>
        <span className="text-lg font-bold text-[hsl(var(--field-accent-glow))]">
          {equipmentTotal.toFixed(2)} $
        </span>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-12 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium hover:bg-[hsl(var(--field-card-hover))] transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 h-12 rounded-xl field-gradient-accent text-white font-semibold field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2"
        >
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
