/**
 * FieldLeadDetail — Lead detail view. Clean light UI.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Package, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";

const STATUS_FLOW = ["new", "contacted", "qualified", "submitted", "won", "lost"] as const;
const STATUS_LABELS: Record<string, string> = {
  new: "Nouveau", contacted: "Contacté", qualified: "Qualifié",
  submitted: "Soumis", won: "Gagné", lost: "Perdu",
};

export default function FieldLeadDetail() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["field-lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("field_leads").select("*").eq("id", leadId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "submitted") updates.submitted_at = new Date().toISOString();
      if (newStatus === "won") updates.won_at = new Date().toISOString();
      if (newStatus === "lost") updates.lost_at = new Date().toISOString();
      const { error } = await supabase.from("field_leads").update(updates).eq("id", leadId!);
      if (error) throw error;
      await logInternalAudit({ action: `lead_status_${newStatus}`, category: "operations", portal: "field", targetType: "lead", targetId: leadId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["field-leads"] });
      toast.success("Statut mis à jour");
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;
  if (!lead) return (
    <div className="text-center py-16">
      <p className="text-sm text-[#6B7280]">Lead introuvable</p>
      <button onClick={() => navigate(fieldPath("/leads"))} className="text-sm text-[#22C55E] hover:underline mt-2">Retour</button>
    </div>
  );

  const currentIdx = STATUS_FLOW.indexOf(lead.status as any);
  const canAdvance = currentIdx >= 0 && currentIdx < 3;
  const nextStatus = canAdvance ? STATUS_FLOW[currentIdx + 1] : null;
  const isClosed = lead.status === "won" || lead.status === "lost";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fieldPath("/leads"))} className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors">
          <ArrowLeft className="h-4 w-4 text-[#6B7280]" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-[#000000]">{lead.first_name} {lead.last_name}</h1>
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded",
            lead.status === "won" ? "bg-[#DCFCE7] text-[#16A34A]" :
            lead.status === "lost" ? "bg-[#FEE2E2] text-[#DC2626]" :
            lead.status === "submitted" ? "bg-[#DBEAFE] text-[#1D4ED8]" :
            "bg-[#FEF3C7] text-[#D97706]"
          )}>
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1">
        {STATUS_FLOW.filter(s => s !== "lost").map((s, i) => {
          const idx = STATUS_FLOW.indexOf(s);
          const isCompleted = currentIdx >= idx;
          const isCurrent = lead.status === s;
          return (
            <div key={s} className="flex-1">
              <div className={cn("h-1.5 rounded-full", isCompleted ? "bg-[#22C55E]" : "bg-[#E5E7EB]")} />
              <p className={cn("text-[9px] mt-1 text-center font-medium", isCurrent ? "text-[#22C55E]" : isCompleted ? "text-[#6B7280]" : "text-[#D1D5DB]")}>
                {STATUS_LABELS[s]}
              </p>
            </div>
          );
        })}
      </div>

      {/* Contact */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Contact</h3>
        {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-[#000000] hover:text-[#22C55E]"><Phone className="h-4 w-4 text-[#6B7280]" />{lead.phone}</a>}
        {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-[#000000] hover:text-[#22C55E]"><Mail className="h-4 w-4 text-[#6B7280]" />{lead.email}</a>}
        {lead.address && <div className="flex items-start gap-2 text-sm text-[#374151]"><MapPin className="h-4 w-4 text-[#6B7280] mt-0.5 shrink-0" /><span>{lead.address}{lead.city ? `, ${lead.city}` : ""}{lead.postal_code ? ` ${lead.postal_code}` : ""}</span></div>}
      </div>

      {/* Qualification */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Qualification</h3>
        {lead.service_need && <div><span className="text-[10px] text-[#9CA3AF]">Service</span><p className="text-sm text-[#000000] flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-[#22C55E]" />{lead.service_need}</p></div>}
        {lead.payment_method_intent && <div><span className="text-[10px] text-[#9CA3AF]">Paiement préféré</span><p className="text-sm text-[#000000]">{lead.payment_method_intent}</p></div>}
        {lead.eligibility_notes && <div><span className="text-[10px] text-[#9CA3AF]">Éligibilité</span><p className="text-sm text-[#374151]">{lead.eligibility_notes}</p></div>}
        {lead.notes && <div><span className="text-[10px] text-[#9CA3AF]">Notes</span><p className="text-sm text-[#374151]">{lead.notes}</p></div>}
      </div>

      {/* Actions */}
      {!isClosed && (
        <div className="space-y-2">
          {nextStatus && (
            <button
              onClick={() => updateStatusMutation.mutate(nextStatus)}
              disabled={updateStatusMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] text-white font-semibold text-sm hover:bg-[#16A34A] disabled:opacity-50 transition-colors"
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {nextStatus === "submitted" ? "Soumettre comme commande" : `Passer à "${STATUS_LABELS[nextStatus]}"`}
            </button>
          )}
          <button
            onClick={() => updateStatusMutation.mutate("lost")}
            disabled={updateStatusMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#FCA5A5] text-[#DC2626] text-sm font-medium hover:bg-[#FEF2F2] transition-colors"
          >
            <X className="h-4 w-4" />
            Marquer comme perdu
          </button>
        </div>
      )}
    </div>
  );
}
