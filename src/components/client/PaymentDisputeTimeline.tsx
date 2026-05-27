import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, 
  MessageSquare, Loader2, ChevronDown, ChevronUp 
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

type DisputeStatus = "submitted" | "under_review" | "awaiting_client" | "resolved_approved" | "resolved_rejected";

const statusConfig: Record<DisputeStatus, { label: string; labelEn: string; color: string; icon: any }> = {
  submitted: { label: "Soumise", labelEn: "Submitted", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  under_review: { label: "En examen", labelEn: "Under Review", color: "bg-blue-500/20 text-blue-500", icon: RefreshCw },
  awaiting_client: { label: "Info requise", labelEn: "Info Required", color: "bg-purple-500/20 text-purple-500", icon: AlertTriangle },
  resolved_approved: { label: "Approuvée", labelEn: "Approved", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  resolved_rejected: { label: "Rejetée", labelEn: "Rejected", color: "bg-red-500/20 text-red-500", icon: XCircle },
};

const reasonCodeLabels: Record<string, string> = {
  duplicate_charge: "Frais en double",
  incorrect_amount: "Montant incorrect",
  service_not_received: "Service non reçu",
  unauthorized: "Paiement non autorisé",
  fraud: "Fraude suspectée",
  other: "Autre raison",
};

const PaymentDisputeTimeline = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const { data: canonical, isLoading } = useCanonicalClientData(user?.id);
  const invoicesById = new Map<string, any>(((canonical?.invoices || []) as any[]).map((i) => [i.id, i]));
  const paymentsById = new Map<string, any>(((canonical?.payments || []) as any[]).map((p) => [p.id, p]));
  const disputes = ((canonical?.paymentDisputes || []) as any[])
    .slice()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((d) => {
      const pay = paymentsById.get(d.payment_id);
      const inv = pay?.invoice_id ? invoicesById.get(pay.invoice_id) : null;
      return {
        ...d,
        billing: inv
          ? { invoice_number: inv.invoice_number, amount: inv.total ?? inv.amount }
          : pay
          ? { invoice_number: null, amount: pay.amount }
          : null,
      };
    });

  const respondMutation = useMutation({
    mutationFn: async ({ disputeId, message }: { disputeId: string; message: string }) => {
      const { error } = await portalSupabase
        .from("payment_disputes")
        .update({ client_message: message })
        .eq("id", disputeId)
        .eq("status", "awaiting_client");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
      setResponseText("");
      toast.success("Réponse envoyée");
    },
    onError: () => {
      toast.error("Erreur lors de l'envoi de la réponse");
    },
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!disputes || disputes.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Mes contestations ({disputes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {disputes.map((dispute: any) => {
          const statusInfo = statusConfig[dispute.status as DisputeStatus] || statusConfig.submitted;
          const StatusIcon = statusInfo.icon;
          const isExpanded = expandedId === dispute.id;
          const canRespond = dispute.status === "awaiting_client";

          return (
            <div
              key={dispute.id}
              className="p-4 bg-accent/50 rounded-lg border border-border"
            >
              <div 
                className="flex items-start justify-between gap-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : dispute.id)}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{dispute.dispute_number}</span>
                    <Badge className={statusInfo.color} variant="secondary">
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Facture: {dispute.billing?.invoice_number || "-"} • 
                    {Number(dispute.billing?.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reasonCodeLabels[dispute.reason_code] || dispute.reason_code} • 
                    {format(new Date(dispute.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <Button variant="ghost" size="icon">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  {/* Timeline */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Chronologie</Label>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {["submitted", "under_review", "awaiting_client"].map((step) => {
                        const stepInfo = statusConfig[step as DisputeStatus];
                        const isActive = dispute.status === step;
                        const isPast = Object.keys(statusConfig).indexOf(dispute.status) >= Object.keys(statusConfig).indexOf(step);
                        return (
                          <div 
                            key={step} 
                            className={`flex items-center gap-1 px-2 py-1 rounded ${isActive ? stepInfo.color : isPast ? "bg-muted text-muted-foreground" : "bg-muted/50 text-muted-foreground/50"}`}
                          >
                            {stepInfo.label}
                          </div>
                        );
                      })}
                      {dispute.status?.startsWith("resolved") && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${statusConfig[dispute.status as DisputeStatus]?.color}`}>
                          {statusConfig[dispute.status as DisputeStatus]?.label}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Your message */}
                  {dispute.client_message && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Votre message</Label>
                      <p className="text-sm p-2 bg-background rounded mt-1">"{dispute.client_message}"</p>
                    </div>
                  )}

                  {/* Staff message */}
                  {dispute.public_message && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <Label className="text-xs text-purple-500">Message de l'équipe</Label>
                      <p className="text-sm mt-1">{dispute.public_message}</p>
                    </div>
                  )}

                  {/* Resolution */}
                  {dispute.resolution_notes && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <Label className="text-xs text-emerald-500">Résolution</Label>
                      <p className="text-sm mt-1">{dispute.resolution_notes}</p>
                    </div>
                  )}

                  {/* Rejection */}
                  {dispute.rejection_reason && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <Label className="text-xs text-red-500">Raison du rejet</Label>
                      <p className="text-sm mt-1">{dispute.rejection_reason}</p>
                    </div>
                  )}

                  {/* Respond form */}
                  {canRespond && (
                    <div className="space-y-2 pt-2">
                      <Label>Répondre à la demande d'information</Label>
                      <Textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Fournissez les informations demandées..."
                        rows={3}
                      />
                      <Button 
                        onClick={() => respondMutation.mutate({ disputeId: dispute.id, message: responseText })}
                        disabled={respondMutation.isPending || !responseText.trim()}
                        className="w-full"
                      >
                        {respondMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Envoyer la réponse
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default PaymentDisputeTimeline;
