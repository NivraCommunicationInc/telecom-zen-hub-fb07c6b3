/**
 * FieldTracking — Sales pipeline tracking. Clean light UI.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PIPELINE = [
  { key: "new", label: "Nouveaux", color: "bg-[#3B82F6]" },
  { key: "contacted", label: "Contactés", color: "bg-[#06B6D4]" },
  { key: "qualified", label: "Qualifiés", color: "bg-[#F59E0B]" },
  { key: "submitted", label: "Soumis", color: "bg-[#8B5CF6]" },
  { key: "won", label: "Gagnés", color: "bg-[#22C55E]" },
  { key: "lost", label: "Perdus", color: "bg-[#EF4444]" },
];

export default function FieldTracking() {
  const { user } = useStaffUser();

  const { data, isLoading } = useQuery({
    queryKey: ["field-tracking", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_leads")
        .select("status")
        .eq("agent_id", user!.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const lead of data || []) counts[lead.status] = (counts[lead.status] || 0) + 1;
      return { counts, total: (data || []).length };
    },
    enabled: !!user?.id,
  });

  const total = data?.total ?? 0;
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#000000]">Suivi des ventes</h1>
        <p className="text-sm text-[#6B7280]">{total} lead{total !== 1 ? "s" : ""} au total</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : total === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Aucune donnée de vente</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {PIPELINE.map((stage) => {
              const count = counts[stage.key] || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={stage.key} className="p-4 rounded-xl border border-[#E5E7EB] bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#000000]">{stage.label}</span>
                    <span className="text-lg font-bold text-[#000000]">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", stage.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Taux de soumission</p>
              <p className="text-xl font-bold text-[#000000] mt-1">
                {total > 0 ? Math.round(((counts.submitted || 0) + (counts.won || 0)) / total * 100) : 0}%
              </p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Taux de conversion</p>
              <p className="text-xl font-bold text-[#000000] mt-1">
                {total > 0 ? Math.round((counts.won || 0) / total * 100) : 0}%
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
