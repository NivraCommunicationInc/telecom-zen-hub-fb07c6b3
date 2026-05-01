/**
 * AccountAdjustmentsList — Read-only panel listing active and historical
 * `account_adjustments` for a given account. Use under the
 * "Ajustements actifs" section on the account 360 page.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minus, Plus } from "lucide-react";

interface Adjustment {
  id: string;
  type: "credit" | "fee";
  amount: number;
  description: string;
  months_total: number;
  months_remaining: number;
  applied_count: number;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  last_applied_at: string | null;
}

interface Props {
  accountId: string | undefined;
}

export function AccountAdjustmentsList({ accountId }: Props) {
  const [items, setItems] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("account_adjustments")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setItems((data || []) as Adjustment[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

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
          {active.map(a => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {a.type === "credit"
                  ? <Minus className="h-3 w-3 text-emerald-400 shrink-0" />
                  : <Plus className="h-3 w-3 text-amber-400 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{a.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.applied_count}/{a.months_total} appliqué(s) · {a.months_remaining} restant(s)
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  a.type === "credit" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {a.type === "credit" ? "−" : "+"}{Number(a.amount).toFixed(2)} $
              </span>
            </li>
          ))}
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
                  {a.type === "credit" ? "−" : "+"}{Number(a.amount).toFixed(2)} $ · {a.description}
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
