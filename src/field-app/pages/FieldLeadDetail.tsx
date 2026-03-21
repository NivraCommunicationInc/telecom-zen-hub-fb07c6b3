/**
 * FieldLeadDetail — Lead detail view with operational context.
 * Pre-submission leads only. Once submitted, redirects to order view.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Package, Send, X, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";

const STATUS_FLOW = ["new", "contacted", "qualified"] as const;
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

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!lead) return (
    <div className="text-center py-16">
      <p className="text-sm text-muted-foreground">Lead introuvable</p>
      <button onClick={() => navigate(fieldPath("/leads"))} className="text-sm text-primary hover:underline mt-2">Retour</button>
    </div>
  );

  const isClosed = lead.status === "won" || lead.status === "lost";
  const isSubmitted = lead.status === "submitted" || lead.status === "won";
  const currentIdx = STATUS_FLOW.indexOf(lead.status as any);
  const canAdvance = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1;
  const nextStatus = canAdvance ? STATUS_FLOW[currentIdx + 1] : null;
  const isPreSubmission = !isSubmitted && !isClosed;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(fieldPath("/leads"))} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">{lead.first_name} {lead.last_name}</h1>
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded",
            lead.status === "won" ? "bg-emerald-50 text-emerald-700" :
            lead.status === "lost" ? "bg-red-50 text-red-700" :
            lead.status === "submitted" ? "bg-blue-50 text-blue-700" :
            "bg-amber-50 text-amber-700"
          )}>
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
        </div>
      </div>

      {/* Progress — only for pre-submission leads */}
      {isPreSubmission && (
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((s, i) => {
            const idx = STATUS_FLOW.indexOf(s);
            const isCompleted = currentIdx >= idx;
            const isCurrent = lead.status === s;
            return (
              <div key={s} className="flex-1">
                <div className={cn("h-1.5 rounded-full", isCompleted ? "bg-primary" : "bg-muted")} />
                <p className={cn("text-[9px] mt-1 text-center font-medium", isCurrent ? "text-primary" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/40")}>
                  {STATUS_LABELS[s]}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* If submitted, show redirect to order flow */}
      {isSubmitted && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-medium text-blue-700 mb-2">Ce lead a été converti en commande.</p>
          <p className="text-xs text-blue-600 mb-3">Consultez la page Commandes pour voir le statut opérationnel complet.</p>
          <button
            onClick={() => navigate(fieldPath("/submissions"))}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            Voir mes commandes
          </button>
        </div>
      )}

      {/* Contact */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h3>
        {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary"><Phone className="h-4 w-4 text-muted-foreground" />{lead.phone}</a>}
        {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary"><Mail className="h-4 w-4 text-muted-foreground" />{lead.email}</a>}
        {lead.address && <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span>{lead.address}{lead.city ? `, ${lead.city}` : ""}{lead.postal_code ? ` ${lead.postal_code}` : ""}</span></div>}
      </div>

      {/* Qualification */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qualification</h3>
        {lead.service_need && <div><span className="text-[10px] text-muted-foreground">Service</span><p className="text-sm text-foreground flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-primary" />{lead.service_need}</p></div>}
        {lead.payment_method_intent && <div><span className="text-[10px] text-muted-foreground">Paiement préféré</span><p className="text-sm text-foreground">{lead.payment_method_intent}</p></div>}
        {lead.eligibility_notes && <div><span className="text-[10px] text-muted-foreground">Éligibilité</span><p className="text-sm text-muted-foreground">{lead.eligibility_notes}</p></div>}
        {lead.notes && <div><span className="text-[10px] text-muted-foreground">Notes</span><p className="text-sm text-muted-foreground">{lead.notes}</p></div>}
      </div>

      {/* Actions — only for pre-submission leads */}
      {isPreSubmission && (
        <div className="space-y-2">
          {/* Primary: Start sale workflow */}
          <button
            onClick={() => navigate(fieldPath("/sale/new"))}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            Démarrer une vente pour ce lead
          </button>

          {/* Secondary: Advance lead status */}
          {nextStatus && (
            <button
              onClick={() => updateStatusMutation.mutate(nextStatus)}
              disabled={updateStatusMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Passer à « {STATUS_LABELS[nextStatus]} »
            </button>
          )}

          {/* Danger: Mark as lost — only for pre-submission */}
          <button
            onClick={() => {
              if (confirm("Marquer ce lead comme perdu ?")) {
                updateStatusMutation.mutate("lost");
              }
            }}
            disabled={updateStatusMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            <X className="h-4 w-4" />
            Marquer comme perdu
          </button>
        </div>
      )}
    </div>
  );
}
