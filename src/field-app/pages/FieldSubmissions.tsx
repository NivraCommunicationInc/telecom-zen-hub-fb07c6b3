/**
 * FieldSubmissions — Submitted orders. Clean light UI.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { Send, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const ORDER_STATUS: Record<string, { label: string; classes: string }> = {
  submitted: { label: "Soumis", classes: "bg-[#DBEAFE] text-[#1D4ED8]" },
  pending: { label: "En révision", classes: "bg-[#FEF3C7] text-[#D97706]" },
  received: { label: "En révision", classes: "bg-[#FEF3C7] text-[#D97706]" },
  processing: { label: "En traitement", classes: "bg-[#E0E7FF] text-[#4338CA]" },
  approved: { label: "Approuvé", classes: "bg-[#DCFCE7] text-[#16A34A]" },
  completed: { label: "Activé", classes: "bg-[#DCFCE7] text-[#16A34A]" },
  cancelled: { label: "Annulé", classes: "bg-[#FEE2E2] text-[#DC2626]" },
};

export default function FieldSubmissions() {
  const { user } = useStaffUser();
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
        <h1 className="text-xl font-bold text-[#000000]">Soumissions</h1>
        <p className="text-sm text-[#6B7280]">{leads.length} soumission{leads.length !== 1 ? "s" : ""}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12">
          <Send className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Aucune soumission</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead: any) => {
            const sc = ORDER_STATUS[lead.status] || ORDER_STATUS.submitted;
            return (
              <button
                key={lead.id}
                onClick={() => navigate(fieldPath(`/leads/${lead.id}`))}
                className="w-full text-left p-4 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#D1D5DB] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-[#000000]">{lead.first_name} {lead.last_name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", sc.classes)}>{sc.label}</span>
                      {lead.service_need && <span className="text-[10px] text-[#9CA3AF]">{lead.service_need}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.submitted_at && <span className="text-[10px] text-[#9CA3AF]">{formatDistanceToNow(new Date(lead.submitted_at), { addSuffix: true, locale: fr })}</span>}
                    <ChevronRight className="h-4 w-4 text-[#D1D5DB]" />
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
