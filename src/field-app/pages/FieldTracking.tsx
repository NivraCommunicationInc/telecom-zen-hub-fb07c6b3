/**
 * FieldTracking — Sales tracking overview.
 * Shows pipeline status of all leads.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PIPELINE = [
  { key: "new", label: "Nouveaux", color: "bg-blue-500" },
  { key: "contacted", label: "Contactés", color: "bg-cyan-500" },
  { key: "qualified", label: "Qualifiés", color: "bg-amber-500" },
  { key: "submitted", label: "Soumis", color: "bg-purple-500" },
  { key: "won", label: "Gagnés", color: "bg-emerald-500" },
  { key: "lost", label: "Perdus", color: "bg-red-500" },
];

export default function FieldTracking() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["field-tracking", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_leads")
        .select("status")
        .eq("agent_id", user!.id);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const lead of data || []) {
        counts[lead.status] = (counts[lead.status] || 0) + 1;
      }
      return { counts, total: (data || []).length };
    },
    enabled: !!user?.id,
  });

  const total = data?.total ?? 0;
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Suivi des ventes</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">{total} lead{total !== 1 ? "s" : ""} au total</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        </div>
      ) : total === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,20%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucune donnée de vente</p>
        </div>
      ) : (
        <>
          {/* Pipeline funnel */}
          <div className="space-y-2">
            {PIPELINE.map((stage) => {
              const count = counts[stage.key] || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={stage.key} className="p-4 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{stage.label}</span>
                    <span className="text-lg font-bold text-white">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[hsl(225,15%,12%)] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", stage.color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conversion stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-4 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)]">
              <p className="text-[10px] text-[hsl(220,10%,42%)] font-medium">Taux de soumission</p>
              <p className="text-xl font-bold text-white mt-1">
                {total > 0 ? Math.round(((counts.submitted || 0) + (counts.won || 0)) / total * 100) : 0}%
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)]">
              <p className="text-[10px] text-[hsl(220,10%,42%)] font-medium">Taux de conversion</p>
              <p className="text-xl font-bold text-white mt-1">
                {total > 0 ? Math.round((counts.won || 0) / total * 100) : 0}%
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
