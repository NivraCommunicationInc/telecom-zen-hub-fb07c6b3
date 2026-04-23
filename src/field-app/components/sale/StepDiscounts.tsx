import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Tag, Percent, DollarSign, Check, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { cn } from "@/lib/utils";
import type { FieldSaleDiscount, FieldSaleService } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  selected: FieldSaleDiscount | null;
  services: FieldSaleService[];
  onChange: (discount: FieldSaleDiscount | null) => void;
  onNext: () => void;
  onBack: () => void;
}

interface RawDiscount {
  id: string;
  name: string;
  type: string;
  value: number;
  applies_to: string;
  description: string | null;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
}

export default function StepDiscounts({ selected, services, onChange, onNext, onBack }: Props) {
  const { user } = useStaffUser();
  const [error, setError] = useState<string | null>(null);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["field-agent-discounts", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<RawDiscount[]> => {
      const { data: assignments, error: aerr } = await supabase
        .from("agent_discount_assignments")
        .select("discount_id, applies_to_all, agent_id, role")
        .or(`agent_id.eq.${user!.id},applies_to_all.eq.true,role.eq.field_sales`);
      if (aerr) throw aerr;

      const ids = Array.from(new Set((assignments ?? []).map((a) => a.discount_id)));
      if (ids.length === 0) return [];

      const { data: rows, error: derr } = await supabase
        .from("agent_discounts")
        .select("id,name,type,value,applies_to,description,expires_at,max_uses,uses_count,is_active")
        .in("id", ids)
        .eq("is_active", true);
      if (derr) throw derr;

      const now = Date.now();
      return (rows ?? []).filter((d) => {
        const notExpired = !d.expires_at || new Date(d.expires_at).getTime() > now;
        const hasCapacity = d.max_uses == null || (d.uses_count ?? 0) < d.max_uses;
        return notExpired && hasCapacity;
      }) as RawDiscount[];
    },
    staleTime: 30_000,
  });

  const serviceCategories = new Set(services.map((service) => service.category));

  const isApplicable = (discount: RawDiscount): boolean => {
    if (discount.applies_to === "all") return true;
    if (services.length === 0) return false;
    return serviceCategories.has(discount.applies_to);
  };

  const select = (discount: RawDiscount) => {
    if (selected?.id === discount.id) {
      onChange(null);
      return;
    }

    if (!isApplicable(discount)) {
      setError(`Ce rabais s'applique uniquement à : ${discount.applies_to}. Aucun forfait ${discount.applies_to} sélectionné.`);
      return;
    }

    setError(null);
    onChange({
      id: discount.id,
      name: discount.name,
      type: discount.type as FieldSaleDiscount["type"],
      value: discount.value,
      applies_to: discount.applies_to as FieldSaleDiscount["applies_to"],
      description: discount.description,
    });
  };

  useEffect(() => {
    if (selected && !discounts.some((discount) => discount.id === selected.id)) {
      onChange(null);
    }
  }, [discounts, selected, onChange]);

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl font-bold text-white">Rabais agent</h2>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-1">
          Sélectionnez un rabais assigné par Nivra Core.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[hsl(var(--field-warning)/0.1)] border border-[hsl(var(--field-warning)/0.4)]">
          <AlertCircle className="h-4 w-4 text-[hsl(var(--field-warning))] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[hsl(var(--field-warning))]">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--field-accent))]" />
        </div>
      ) : discounts.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-8 text-center">
          <Sparkles className="h-10 w-10 text-[hsl(var(--field-text-dim))] mx-auto mb-3" />
          <p className="text-[hsl(var(--field-text-muted))] font-medium">
            Aucun rabais disponible. Les rabais sont assignés par Nivra Core.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {discounts.map((discount) => {
            const active = selected?.id === discount.id;
            const usable = isApplicable(discount);
            const Icon = discount.type === "percentage" ? Percent : DollarSign;

            return (
              <button
                key={discount.id}
                type="button"
                onClick={() => select(discount)}
                disabled={!usable && !active}
                className={cn(
                  "field-card-interactive text-left rounded-2xl p-4 border transition-all relative overflow-hidden",
                  active
                    ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
                    : usable
                      ? "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] hover:border-[hsl(var(--field-accent)/0.4)]"
                      : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      active
                        ? "bg-[hsl(var(--field-accent))] text-white"
                        : "bg-[hsl(var(--field-bg-elevated))] text-[hsl(var(--field-accent-glow))]"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white truncate">{discount.name}</h3>
                      <span className="text-base font-bold text-[hsl(var(--field-accent-glow))] flex-shrink-0">
                        {discount.type === "percentage" ? `${discount.value}%` : `${discount.value.toFixed(2)} $`}
                      </span>
                    </div>
                    {discount.description && (
                      <p className="text-xs text-[hsl(var(--field-text-muted))] mt-1 line-clamp-2">
                        {discount.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--field-bg-elevated))] text-[hsl(var(--field-text-dim))] border border-[hsl(var(--field-border-subtle))]">
                        {discount.applies_to === "all" ? "Tous services" : discount.applies_to}
                      </span>
                      {discount.max_uses != null && (
                        <span className="text-[10px] text-[hsl(var(--field-text-dim))]">
                          {discount.uses_count}/{discount.max_uses} utilisations
                        </span>
                      )}
                      {!usable && (
                        <span className="text-[10px] text-[hsl(var(--field-warning))]">Non applicable</span>
                      )}
                    </div>
                  </div>
                  {active && <Check className="h-5 w-5 text-[hsl(var(--field-accent-glow))] flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "w-full text-sm py-3 rounded-xl border border-dashed transition-colors",
          selected
            ? "border-[hsl(var(--field-border-subtle))] text-[hsl(var(--field-text-muted))] hover:text-white hover:border-[hsl(var(--field-accent)/0.4)]"
            : "border-[hsl(var(--field-accent)/0.4)] bg-[hsl(var(--field-accent)/0.08)] text-[hsl(var(--field-accent-glow))]"
        )}
      >
        <Tag className="h-4 w-4 inline-block mr-2" />
        {selected ? "Continuer sans rabais" : "Aucun rabais sélectionné — continuer"}
      </button>

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
