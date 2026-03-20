/**
 * FieldSubmissions — Orders submitted by this field agent.
 * Tracks: Submitted → Under review → Approved → Activated → Cancelled
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { Send, Loader2, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "Soumis", color: "text-blue-400", bg: "bg-blue-500/10" },
  pending: { label: "En révision", color: "text-amber-400", bg: "bg-amber-500/10" },
  received: { label: "En révision", color: "text-amber-400", bg: "bg-amber-500/10" },
  processing: { label: "En traitement", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  approved: { label: "Approuvé", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  completed: { label: "Activé", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  cancelled: { label: "Annulé", color: "text-red-400", bg: "bg-red-500/10" },
};

export default function FieldSubmissions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["field-submissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_leads")
        .select("*")
        .eq("agent_id", user!.id)
        .in("status", ["submitted", "won"])
        .order("submitted_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Soumissions</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">
          {leads.length} soumission{leads.length !== 1 ? "s" : ""}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12">
          <Send className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,20%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucune soumission</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead: any) => {
            const sc = ORDER_STATUS[lead.status] || ORDER_STATUS.submitted;
            return (
              <button
                key={lead.id}
                onClick={() => navigate(fieldPath(`/leads/${lead.id}`))}
                className="w-full text-left p-4 rounded-xl border border-[hsl(225,15%,12%)] bg-[hsl(225,20%,7%)] hover:bg-[hsl(225,20%,9%)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white">
                      {lead.first_name} {lead.last_name}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.color, sc.bg)}>
                        {sc.label}
                      </span>
                      {lead.service_need && (
                        <span className="text-[10px] text-[hsl(220,10%,40%)]">{lead.service_need}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.submitted_at && (
                      <span className="text-[10px] text-[hsl(220,10%,30%)]">
                        {formatDistanceToNow(new Date(lead.submitted_at), { addSuffix: true, locale: fr })}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-[hsl(220,10%,25%)]" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
