/**
 * Step 2 — Service / Plan Selection
 * Source: services table (same source as the website).
 * Dark theme: Navy bg + white text + purple accents.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Wifi, Smartphone, Tv, Package, Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { FieldSaleService } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  selected: FieldSaleService[];
  onChange: (services: FieldSaleService[]) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ServiceRow {
  id: string;
  name: string;
  category: string;
  price: number | string | null;
  description: string | null;
  short_description: string | null;
  features_json: any;
  display_order: number | null;
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

const toMonthlyPrice = (value: ServiceRow["price"]): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export default function StepServices({ selected, onChange, onNext, onBack }: Props) {
  const queryClient = useQueryClient();
  const { data: services = [], isLoading, error } = useQuery({
    queryKey: ["field-services-catalog"],
    queryFn: async (): Promise<ServiceRow[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,category,price,description,short_description,features_json,display_order")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ServiceRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  /* Realtime — services catalog. If a price changes for a service in the
     current draft, warn the agent and update the price in place. */
  useEffect(() => {
    const channel = supabase
      .channel("field-services-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-services-catalog"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Detect price changes against the current sale draft.
  useEffect(() => {
    if (!services.length || !selected.length) return;
    let changed = false;
    const next = selected.map((sel) => {
      const fresh = services.find((s) => s.id === sel.id);
      if (!fresh) return sel;
      const newPrice = toMonthlyPrice(fresh.price);
      if (newPrice !== sel.monthlyPrice) {
        changed = true;
        return { ...sel, monthlyPrice: newPrice };
      }
      return sel;
    });
    if (changed) {
      toast.warning("Le prix d'un service a changé", {
        description: "Le prix a été mis à jour dans la vente en cours.",
      });
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  // Group by category
  const grouped: Record<string, ServiceRow[]> = {};
  for (const s of services) {
    const cat = s.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const getSpeed = (s: ServiceRow): string | undefined => {
    const f = s.features_json;
    if (f && typeof f === "object" && f.speed) return String(f.speed);
    if (f && typeof f === "object" && f.download_speed) return `${f.download_speed} Mbps`;
    return undefined;
  };

  const isSelected = (id: string) => selected.some((s) => s.id === id);

  const toggleService = (s: ServiceRow) => {
    if (isSelected(s.id)) {
      onChange(selected.filter((x) => x.id !== s.id));
    } else {
      onChange([
        ...selected,
        {
          id: s.id,
          name: s.name,
          category: s.category,
          monthlyPrice: toMonthlyPrice(s.price),
          description: s.short_description || s.description,
          speed: getSpeed(s),
        },
      ]);
    }
  };

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl font-bold text-white">Sélection des forfaits</h2>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-1">
          Catalogue officiel — tarification fixe.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--field-accent))]" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-[hsl(var(--field-warning)/0.1)] border border-[hsl(var(--field-warning)/0.4)] text-sm text-[hsl(var(--field-warning))]">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Erreur de chargement du catalogue.
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-8 text-center">
          <Package className="h-10 w-10 text-[hsl(var(--field-text-dim))] mx-auto mb-3" />
          <p className="text-[hsl(var(--field-text-muted))] font-medium">Aucun forfait disponible</p>
        </div>
      ) : (
        sortedCategories.map((category) => {
          const items = grouped[category];
          const Icon = CATEGORY_ICONS[category] || Package;
          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[hsl(var(--field-accent-glow))]" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <span className="text-[10px] text-[hsl(var(--field-text-dim))] font-medium">
                  {items.length} forfait{items.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((service) => {
                  const active = isSelected(service.id);
                  const price = toMonthlyPrice(service.price);
                  const speed = getSpeed(service);

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all",
                        active
                          ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
                          : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] hover:border-[hsl(var(--field-accent)/0.4)]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">{service.name}</span>
                            {speed && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[hsl(var(--field-accent)/0.15)] text-[hsl(var(--field-accent-glow))]">
                                {speed}
                              </span>
                            )}
                          </div>
                          {(service.short_description || service.description) && (
                            <p className="text-xs text-[hsl(var(--field-text-muted))] mt-0.5 line-clamp-1">
                              {service.short_description || service.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">
                              {price.toFixed(2)} $
                            </p>
                            <p className="text-[10px] text-[hsl(var(--field-text-dim))]">/mois</p>
                          </div>
                          <div
                            className={cn(
                              "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors",
                              active
                                ? "bg-[hsl(var(--field-accent))] border-[hsl(var(--field-accent))]"
                                : "border-[hsl(var(--field-border-subtle))]"
                            )}
                          >
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
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.4)] bg-[hsl(var(--field-accent)/0.08)] p-4">
          <p className="text-xs font-semibold text-[hsl(var(--field-accent-glow))] uppercase tracking-wider mb-2">
            {selected.length} service{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5">
            {selected.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-white">{s.name}</span>
                <span className="font-semibold text-white">{s.monthlyPrice.toFixed(2)} $/mois</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t border-[hsl(var(--field-accent)/0.3)] pt-2 mt-2">
              <span className="text-white">Total mensuel</span>
              <span className="text-[hsl(var(--field-accent-glow))]">
                {selected.reduce((s, sv) => s + sv.monthlyPrice, 0).toFixed(2)} $/mois
              </span>
            </div>
          </div>
        </div>
      )}

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
          disabled={selected.length === 0}
          className="flex-1 h-12 rounded-xl field-gradient-accent text-white font-semibold field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
