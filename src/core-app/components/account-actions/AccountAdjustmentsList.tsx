/**
 * AccountAdjustmentsList — Read-only panel listing active and historical
 * `account_adjustments` for a given account. Use under the
 * "Ajustements actifs" section on the account 360 page.
 *
 * Supports all adjustment types from the canonical "Rabais Système Complet":
 *   credit | fee | remove_fee | first_month_free | one_time
 * Admins (has_role 'admin') can cancel an active adjustment (status -> cancelled).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import { toast } from "sonner";

type AdjustmentType =
  | "credit"
  | "fee"
  | "remove_fee"
  | "first_month_free"
  | "one_time";

interface Adjustment {
  id: string;
  type: AdjustmentType;
  amount: number;
  description: string;
  months_total: number;
  months_remaining: number;
  applied_count: number;
  status: "active" | "completed" | "cancelled";
  is_permanent: boolean | null;
  applies_to: string | null;
  created_at: string;
  last_applied_at: string | null;
}

interface Props {
  accountId: string | undefined;
}

const TYPE_BADGE: Record<AdjustmentType, { bg: string; fg: string; label: string }> = {
  credit:            { bg: "bg-violet-500/15", fg: "text-violet-300",  label: "Crédit" },
  fee:               { bg: "bg-amber-500/15",  fg: "text-amber-300",   label: "Frais" },
  remove_fee:        { bg: "bg-sky-500/15",    fg: "text-sky-300",     label: "Frais annulés" },
  first_month_free:  { bg: "bg-emerald-500/15",fg: "text-emerald-300", label: "1er mois offert" },
  one_time:          { bg: "bg-orange-500/15", fg: "text-orange-300",  label: "Promo unique" },
};

function formatAmount(a: Adjustment): string {
  if (a.type === "remove_fee") return "Gratuit ✓";
  if (a.type === "first_month_free") return `${Number(a.amount).toFixed(2)} $ (1er mois)`;
  if (a.type === "one_time") return `${Number(a.amount).toFixed(2)} $`;
  return `${Number(a.amount).toFixed(2)} $/mois`;
}

function formatDuration(a: Adjustment): string {
  if (a.is_permanent) return "Permanent";
  if (a.type === "one_time" || a.type === "remove_fee" || a.type === "first_month_free") {
    return "Une fois";
  }
  if (a.months_total > 0) {
    return `${a.months_remaining}/${a.months_total} mois restants`;
  }
  return "—";
}

export function AccountAdjustmentsList({ accountId }: Props) {
  const [items, setItems] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { isAdmin } = useIsCoreAdmin();

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const { data } = await supabase
      .from("account_adjustments")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data || []) as Adjustment[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => { cancelled = true; };
  }, [load]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const { error } = await supabase
      .from("account_adjustments")
      .update({ status: "cancelled" })
      .eq("id", id);
    setCancellingId(null);
    if (error) {
      toast.error(`Annulation impossible: ${error.message}`);
      return;
    }
    toast.success("Ajustement annulé");
    await load();
  };

  if (!accountId) return null;

  const active = items.filter(i => i.status === "active");
  const past = items.filter(i => i.status !== "active");

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          Ajustements actifs
        </h3>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {active.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Aucun ajustement actif.</p>
      ) : (
        <ul className="space-y-1.5">
          {active.map(a => {
            const badge = TYPE_BADGE[a.type] ?? TYPE_BADGE.credit;
            const isCredit = a.type !== "fee";
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isCredit
                    ? <Minus className="h-3 w-3 text-emerald-400 shrink-0" />
                    : <Plus className="h-3 w-3 text-amber-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[11px] font-medium text-foreground truncate">{a.description}</p>
                      <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.bg} ${badge.fg}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDuration(a)} · Appliqué {a.applied_count} fois
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-semibold shrink-0 ${
                    isCredit ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {formatAmount(a)}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleCancel(a.id)}
                    disabled={cancellingId === a.id}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    title="Annuler cet ajustement"
                  >
                    {cancellingId === a.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <X className="h-3 w-3" />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {past.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Historique ({past.length})
          </summary>
          <ul className="mt-1.5 space-y-1">
            {past.map(a => (
              <li key={a.id} className="flex items-center justify-between px-2 py-1 text-muted-foreground">
                <span className="truncate">
                  {formatAmount(a)} · {a.description}
                </span>
                <span className="text-[10px]">{a.status}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
