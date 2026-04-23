import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Percent, DollarSign, Sparkles, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";

interface DiscountRow {
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

export default function FieldOffers() {
  const queryClient = useQueryClient();
  const { user } = useStaffUser();

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["field-offers-discounts", user?.id],
    enabled: !!user?.id,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DiscountRow[]> => {
      const { data: assignments, error: assignmentsError } = await supabase
        .from("agent_discount_assignments")
        .select("discount_id, agent_id, applies_to_all, role")
        .or(`agent_id.eq.${user!.id},applies_to_all.eq.true,role.eq.field_sales`);

      if (assignmentsError) throw assignmentsError;

      const ids = Array.from(new Set((assignments ?? []).map((item) => item.discount_id)));
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("agent_discounts")
        .select("id,name,type,value,applies_to,description,expires_at,max_uses,uses_count,is_active")
        .in("id", ids)
        .eq("is_active", true);

      if (error) throw error;

      const now = Date.now();
      return (data ?? []).filter((discount: any) => {
        const notExpired = !discount.expires_at || new Date(discount.expires_at).getTime() > now;
        const hasCapacity = discount.max_uses == null || Number(discount.uses_count ?? 0) < Number(discount.max_uses);
        return notExpired && hasCapacity;
      }) as DiscountRow[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const assignmentsChannel = supabase
      .channel(`field-offers-assignments-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_discount_assignments",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-offers-discounts", user.id] });
        }
      )
      .subscribe();

    const discountsChannel = supabase
      .channel(`field-offers-catalog-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_discounts",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["field-offers-discounts", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assignmentsChannel);
      supabase.removeChannel(discountsChannel);
    };
  }, [queryClient, user?.id]);

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Mes rabais</h1>
        <p className="text-sm text-[hsl(var(--field-text-muted))] mt-0.5">
          Rabais assignés par Nivra Core seulement
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
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
            const Icon = discount.type === "percentage" ? Percent : DollarSign;

            return (
              <div
                key={discount.id}
                className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[hsl(var(--field-accent)/0.15)] text-[hsl(var(--field-accent-glow))] flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h2 className="text-sm font-semibold text-white truncate">{discount.name}</h2>
                      <span className="text-base font-bold text-[hsl(var(--field-accent-glow))]">
                        {discount.type === "percentage" ? `${discount.value}%` : `${Number(discount.value).toFixed(2)} $`}
                      </span>
                    </div>

                    {discount.description && (
                      <p className="text-xs text-[hsl(var(--field-text-muted))] mt-1">{discount.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--field-bg-elevated))] text-[hsl(var(--field-text-dim))] border border-[hsl(var(--field-border-subtle))]">
                        {discount.applies_to === "all" ? "Tous services" : discount.applies_to}
                      </span>

                      {discount.max_uses != null && (
                        <span className="text-[10px] text-[hsl(var(--field-text-dim))]">
                          {discount.uses_count}/{discount.max_uses} utilisations
                        </span>
                      )}

                      {discount.expires_at && (
                        <span className="text-[10px] text-[hsl(var(--field-text-dim))] flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Expire le {new Date(discount.expires_at).toLocaleDateString("fr-CA")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
