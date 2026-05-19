/**
 * CrmQuotaCard — Shows the current agent's daily call and sales objectives
 * with live progress bars. Auto-refresh every 30s.
 */
import { useEffect, useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Quota {
  calls: number;
  calls_target: number;
  sales: number;
  sales_target: number;
}

export function CrmQuotaCard({ isDark }: { isDark?: boolean }) {
  const [q, setQ] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.rpc("crm_my_quota_progress");
    const r = data as any;
    if (r?.ok) setQ({ calls: r.calls, calls_target: r.calls_target, sales: r.sales, sales_target: r.sales_target });
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const cardCls = isDark ? "rounded-xl bg-gray-800 border border-gray-700 p-3" : "rounded-xl bg-card border border-border p-3";
  const titleCls = isDark ? "text-white" : "text-foreground";
  const mutedCls = isDark ? "text-gray-400" : "text-muted-foreground";

  if (loading) {
    return <div className={cardCls}><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (!q) return null;

  const pctCalls = Math.min(100, Math.round((q.calls / Math.max(1, q.calls_target)) * 100));
  const pctSales = Math.min(100, Math.round((q.sales / Math.max(1, q.sales_target)) * 100));

  return (
    <div className={cardCls}>
      <div className={cn("flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-bold mb-2", titleCls)}>
        <Target className="h-3.5 w-3.5 text-violet-500" />
        Objectifs du jour
      </div>

      <div className="space-y-2">
        <div>
          <div className={cn("flex items-center justify-between text-[11px]", mutedCls)}>
            <span>📞 Appels</span>
            <span className="font-bold">{q.calls} / {q.calls_target}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${pctCalls}%` }} />
          </div>
        </div>
        <div>
          <div className={cn("flex items-center justify-between text-[11px]", mutedCls)}>
            <span>🟢 Ventes</span>
            <span className="font-bold">{q.sales} / {q.sales_target}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctSales}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
