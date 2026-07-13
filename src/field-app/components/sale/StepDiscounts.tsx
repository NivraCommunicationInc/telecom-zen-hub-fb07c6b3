/**
 * Step 3 — Rabais agent.
 *
 * Loads ALL active discounts assigned to either:
 *  - this specific agent (agent_discount_assignments.agent_id)
 *  - any field_sales agent (assignments.role = 'field_sales')
 *  - everyone (applies_to_all = true)
 *
 * Eligibility (greyed-out + tooltip if not met):
 *  - `min_plan_price` requires at least one selected service ≥ that price
 *  - `applies_to = 'installation'` requires an installation fee > 0
 *  - `applies_to = 'plan_only'` / `first_month_free` requires ≥ 1 service
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Tag,
  Percent,
  DollarSign,
  Check,
  AlertCircle,
  Sparkles,
  Wrench,
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  FieldSaleDiscount,
  FieldSaleService,
} from "@/field-app/lib/fieldSaleTypes";
import { isDiscountEligible } from "@/field-app/lib/fieldDiscountMath";

interface Props {
  selected: FieldSaleDiscount | null;
  services: FieldSaleService[];
  installationFee?: number;
  allowCustomDiscount?: boolean;
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
  duration_months: number | null;
  min_plan_price: number | null;
}

const iconFor = (type: string) => {
  if (type === "remove_fee") return Wrench;
  if (type === "first_month_free") return Sparkles;
  if (type === "percentage") return Percent;
  return DollarSign;
};

const valueLabel = (d: RawDiscount): string => {
  if (d.type === "remove_fee") return "Gratuit";
  if (d.type === "first_month_free") return "1er mois";
  if (d.type === "percentage") return `${d.value}%`;
  return `${Number(d.value || 0).toFixed(2)} $`;
};

export default function StepDiscounts({
  selected,
  services,
  installationFee = 0,
  allowCustomDiscount = false,
  onChange,
  onNext,
  onBack,
}: Props) {
  const { user } = useStaffUser();
  const [error, setError] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("Rabais personnalisé Core");
  const [customAmount, setCustomAmount] = useState("6");
  const [customDuration, setCustomDuration] = useState("24");

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["field-agent-discounts", user?.id, allowCustomDiscount ? "core-catalog" : "assigned"],
    enabled: allowCustomDiscount || !!user?.id,
    queryFn: async (): Promise<RawDiscount[]> => {
      if (allowCustomDiscount) {
        const { data: rows, error: derr } = await supabase
          .from("agent_discounts")
          .select(
            "id,name,type,value,applies_to,description,expires_at,max_uses,uses_count,is_active,duration_months,min_plan_price",
          )
          .eq("is_active", true);
        if (derr) throw derr;

        const now = Date.now();
        return (rows ?? []).filter((d) => {
          if (String(d.type) === "first_month_free") return false;
          const notExpired = !d.expires_at || new Date(d.expires_at).getTime() > now;
          const hasCapacity = d.max_uses == null || (d.uses_count ?? 0) < d.max_uses;
          return notExpired && hasCapacity;
        }) as RawDiscount[];
      }

      const { data: assignments, error: aerr } = await supabase
        .from("agent_discount_assignments")
        .select("discount_id, applies_to_all, agent_id, role")
        .or(`agent_id.eq.${user!.id},applies_to_all.eq.true,role.eq.field_sales`);
      if (aerr) throw aerr;

      const ids = Array.from(new Set((assignments ?? []).map((a) => a.discount_id)));
      if (ids.length === 0) return [];

      const { data: rows, error: derr } = await supabase
        .from("agent_discounts")
        .select(
          "id,name,type,value,applies_to,description,expires_at,max_uses,uses_count,is_active,duration_months,min_plan_price",
        )
        .in("id", ids)
        .eq("is_active", true);
      if (derr) throw derr;

      const now = Date.now();
      return (rows ?? []).filter((d) => {
        // RULE 2 — first_month_free is applied AUTOMATICALLY by the sale flow,
        // so the agent must never be able to pick it as an additional discount.
        if (String(d.type) === "first_month_free") return false;
        const notExpired = !d.expires_at || new Date(d.expires_at).getTime() > now;
        const hasCapacity = d.max_uses == null || (d.uses_count ?? 0) < d.max_uses;
        return notExpired && hasCapacity;
      }) as RawDiscount[];
    },
    staleTime: 30_000,
  });

  /* Realtime — assignments + discounts.
     Invalidates the catalog when Core RH adds/revokes a discount. */
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user?.id) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["field-agent-discounts", user.id] });
    const channel = supabase
      .channel(`field-step-discounts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_discount_assignments" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_discounts" },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, allowCustomDiscount, queryClient]);

  const toFieldDiscount = (d: RawDiscount): FieldSaleDiscount => ({
    id: d.id,
    name: d.name,
    type: d.type as FieldSaleDiscount["type"],
    value: d.value,
    applies_to: d.applies_to as FieldSaleDiscount["applies_to"],
    description: d.description,
    duration_months: d.duration_months,
    min_plan_price: d.min_plan_price,
  });

  const select = (d: RawDiscount) => {
    if (selected?.id === d.id) {
      onChange(null);
      setError(null);
      return;
    }
    const candidate = toFieldDiscount(d);
    const { eligible, reason } = isDiscountEligible(candidate, services, installationFee);
    if (!eligible) {
      setError(reason ?? "Ce rabais n'est pas applicable.");
      return;
    }
    setError(null);
    onChange(candidate);
  };

  // Drop selection if it disappears or becomes ineligible.
  // If the discount was revoked while in the active sale, warn the agent.
  const lastDiscountIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(discounts.map((d) => d.id));
    const prev = lastDiscountIdsRef.current;
    if (selected && prev && prev.has(selected.id) && !ids.has(selected.id)) {
      toast.warning("Ce rabais n'est plus disponible", {
        description: "Le rabais a été retiré de la vente en cours.",
      });
    }
    lastDiscountIdsRef.current = ids;

    if (!selected) return;
    // Custom Core discounts are not part of the catalogue — never auto-drop them here.
    if (selected.source === "custom_core") {
      const { eligible } = isDiscountEligible(selected, services, installationFee);
      if (!eligible) onChange(null);
      return;
    }
    if (!ids.has(selected.id)) {
      onChange(null);
      return;
    }
    const { eligible } = isDiscountEligible(selected, services, installationFee);
    if (!eligible) onChange(null);
  }, [discounts, selected, services, installationFee, onChange]);

  const sortedDiscounts = useMemo(
    () =>
      [...discounts].sort((a, b) => {
        const aE = isDiscountEligible(toFieldDiscount(a), services, installationFee).eligible ? 0 : 1;
        const bE = isDiscountEligible(toFieldDiscount(b), services, installationFee).eligible ? 0 : 1;
        if (aE !== bE) return aE - bE;
        return a.name.localeCompare(b.name);
      }),
    [discounts, services, installationFee],
  );

  useEffect(() => {
    if (selected?.source !== "custom_core") return;
    setCustomLabel(selected.name || "Rabais personnalisé Core");
    setCustomAmount(String(Number(selected.value || 0)));
    setCustomDuration(String(Number(selected.duration_months || 1)));
  }, [selected]);

  const applyCustomDiscount = () => {
    const amount = Number(customAmount);
    const duration = Math.round(Number(customDuration));
    if (!allowCustomDiscount) return;
    if (!customLabel.trim()) {
      setError("Libellé du rabais requis.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Montant du rabais invalide.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60) {
      setError("Durée invalide — entre 1 et 60 mois.");
      return;
    }
    if (services.length === 0) {
      setError("Ajoutez au moins un forfait avant de créer un rabais mensuel.");
      return;
    }
    setError(null);
    onChange({
      id: selected?.source === "custom_core" ? selected.id : `custom-core-${Date.now()}`,
      name: customLabel.trim(),
      type: "fixed_monthly",
      value: Number(amount.toFixed(2)),
      applies_to: "all",
      description: "Rabais personnalisé créé depuis Nivra Core — Nouvelle commande manuelle.",
      duration_months: duration,
      min_plan_price: null,
      source: "custom_core",
    });
  };

  const removeCustomDiscount = () => {
    if (selected?.source !== "custom_core") return;
    onChange(null);
    setError(null);
    setCustomLabel("Rabais personnalisé Core");
    setCustomAmount("6");
    setCustomDuration("24");
  };

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">Rabais agent</h2>
        <p className="text-sm md:text-base text-[hsl(var(--field-text-muted))] mt-1">
          {allowCustomDiscount
            ? "Promotions du catalogue actif et rabais personnalisé Core."
            : "Sélectionnez un rabais Nivra à appliquer à cette commande."}
        </p>
      </div>

      {/* RULE 1 — Automatic, mandatory, locked */}
      {services.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--field-success)/0.4)] bg-[hsl(var(--field-success)/0.08)] p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--field-success)/0.2)] flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-[hsl(var(--field-success))]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">1er mois offert ✓ (automatique)</p>
            <p className="text-xs text-[hsl(var(--field-text-muted))]">
              Appliqué automatiquement à toute commande avec forfait — non modifiable.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--field-success)/0.15)] text-[hsl(var(--field-success))] border border-[hsl(var(--field-success)/0.4)]">
            Verrouillé
          </span>
        </div>
      )}

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
      ) : sortedDiscounts.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-8 text-center">
          <Sparkles className="h-10 w-10 text-[hsl(var(--field-text-dim))] mx-auto mb-3" />
          <p className="text-[hsl(var(--field-text-muted))] font-medium">
            Aucun rabais disponible. Les rabais sont assignés par Nivra Core.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sortedDiscounts.map((discount) => {
            const active = selected?.id === discount.id;
            const candidate = toFieldDiscount(discount);
            const { eligible, reason } = isDiscountEligible(
              candidate,
              services,
              installationFee,
            );
            const Icon = iconFor(discount.type);

            return (
              <button
                key={discount.id}
                type="button"
                onClick={() => select(discount)}
                disabled={!eligible && !active}
                title={!eligible ? reason : undefined}
                className={cn(
                  "field-card-interactive text-left rounded-2xl p-5 border transition-all relative overflow-hidden min-h-[120px]",
                  active
                    ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)] field-glow"
                    : eligible
                      ? "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] hover:border-[hsl(var(--field-accent)/0.4)]"
                      : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] opacity-50 cursor-not-allowed",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      active
                        ? "bg-[hsl(var(--field-accent))] text-white"
                        : "bg-[hsl(var(--field-bg-elevated))] text-[hsl(var(--field-accent-glow))]",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white text-base leading-tight">
                        {discount.name}
                      </h3>
                      <span className="text-base font-bold text-[hsl(var(--field-accent-glow))] flex-shrink-0">
                        {valueLabel(discount)}
                      </span>
                    </div>
                    {discount.description && (
                      <p className="text-xs md:text-sm text-[hsl(var(--field-text-muted))] mt-1.5 line-clamp-3">
                        {discount.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--field-bg-elevated))] text-[hsl(var(--field-text-dim))] border border-[hsl(var(--field-border-subtle))]">
                        {discount.applies_to === "all"
                          ? "Tous services"
                          : discount.applies_to.replace(/_/g, " ")}
                      </span>
                      {discount.duration_months ? (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--field-accent)/0.15)] text-[hsl(var(--field-accent-glow))] border border-[hsl(var(--field-accent)/0.3)] inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {discount.duration_months} mois
                        </span>
                      ) : null}
                      {discount.min_plan_price ? (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--field-bg-elevated))] text-[hsl(var(--field-text-dim))] border border-[hsl(var(--field-border-subtle))]">
                          Min. {Number(discount.min_plan_price).toFixed(0)} $
                        </span>
                      ) : null}
                      {!eligible && (
                        <span className="text-[10px] text-[hsl(var(--field-warning))]">
                          {reason ?? "Non applicable"}
                        </span>
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

      {allowCustomDiscount && (
        <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.35)] bg-[hsl(var(--field-card))] p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Rabais personnalisé Core</h3>
              <p className="text-xs text-[hsl(var(--field-text-muted))] mt-1">
                Crée un rabais mensuel récurrent sauvegardé avec la commande et le compte après activation.
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--field-accent)/0.15)] text-[hsl(var(--field-accent-glow))] border border-[hsl(var(--field-accent)/0.3)]">
              Core
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px]">
            <div className="space-y-1.5">
              <Label className="text-xs text-[hsl(var(--field-text-muted))]">Libellé</Label>
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="h-11 rounded-xl border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] text-white"
                placeholder="Ex: Rabais agent -6$/mois"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[hsl(var(--field-text-muted))]">Montant / mois</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="h-11 rounded-xl border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[hsl(var(--field-text-muted))]">Durée</Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                className="h-11 rounded-xl border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] text-white"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <button
              type="button"
              onClick={applyCustomDiscount}
              className="w-full min-h-[48px] rounded-xl border border-[hsl(var(--field-accent)/0.45)] bg-[hsl(var(--field-accent)/0.1)] text-[hsl(var(--field-accent-glow))] font-semibold hover:bg-[hsl(var(--field-accent)/0.16)] transition-colors flex items-center justify-center gap-2"
            >
              {selected?.source === "custom_core" ? (
                <>
                  <Pencil className="h-4 w-4" /> Modifier ce rabais personnalisé
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Appliquer ce rabais personnalisé
                </>
              )}
            </button>
            {selected?.source === "custom_core" && (
              <button
                type="button"
                onClick={removeCustomDiscount}
                className="min-h-[48px] rounded-xl border border-[hsl(var(--field-warning)/0.45)] bg-[hsl(var(--field-warning)/0.08)] px-4 text-[hsl(var(--field-warning))] font-semibold hover:bg-[hsl(var(--field-warning)/0.14)] transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            )}
          </div>
          {selected?.source === "custom_core" && (
            <div className="rounded-xl border border-[hsl(var(--field-success)/0.35)] bg-[hsl(var(--field-success)/0.08)] p-3 text-sm text-[hsl(var(--field-success))] flex items-center gap-2">
              <Check className="h-4 w-4" /> {selected.name} — {Number(selected.value).toFixed(2)} $/mois × {selected.duration_months} mois appliqué
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          onChange(null);
          setError(null);
        }}
        className={cn(
          "w-full text-sm md:text-base py-4 rounded-xl border border-dashed transition-colors min-h-[48px]",
          selected
            ? "border-[hsl(var(--field-border-subtle))] text-[hsl(var(--field-text-muted))] hover:text-white hover:border-[hsl(var(--field-accent)/0.4)]"
            : "border-[hsl(var(--field-accent)/0.4)] bg-[hsl(var(--field-accent)/0.08)] text-[hsl(var(--field-accent-glow))]",
        )}
      >
        <Tag className="h-4 w-4 inline-block mr-2" />
        {selected ? "Continuer sans rabais" : "Aucun rabais sélectionné — continuer"}
      </button>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-14 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium hover:bg-[hsl(var(--field-card-hover))] transition-colors flex items-center justify-center gap-2 text-base"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 h-14 rounded-xl field-gradient-accent text-white font-semibold field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 text-base"
        >
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
