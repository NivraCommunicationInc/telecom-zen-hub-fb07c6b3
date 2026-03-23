/**
 * Employee Quote Detail — View, manage, track, and follow up on a single quote.
 */
import { useParams, useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { useQuoteDetail } from "@/shared-ops/useQuoteDetail";
import { updateQuoteStatus, sendQuote, duplicateQuote, logFollowUp, convertQuoteToOrder, downloadQuotePDF, getQuotePublicUrl, resendQuoteEmail } from "@/shared-ops/quoteOperations";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Send, Copy, Clock, CheckCircle, XCircle, FileText, User, MessageSquare, RefreshCw, UserPlus, Download, ExternalLink, Link2, ArrowRightCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Brouillon", variant: "secondary", icon: FileText },
  pending_review: { label: "En révision", variant: "outline", icon: Clock },
  approved: { label: "Approuvée", variant: "default", icon: CheckCircle },
  sent: { label: "Envoyée", variant: "default", icon: Send },
  viewed: { label: "Consultée", variant: "outline", icon: FileText },
  accepted: { label: "Acceptée", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejetée", variant: "destructive", icon: XCircle },
  expired: { label: "Expirée", variant: "secondary", icon: Clock },
  converted: { label: "Convertie", variant: "default", icon: CheckCircle },
};

export default function EmployeeQuoteDetail() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { quote, lines, adjustments, events, customer, isLoading, refetchAll } = useQuoteDetail(quoteId);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;
  if (!quote) return <div className="text-center py-12 text-muted-foreground">Soumission introuvable</div>;

  const st = STATUS_CONFIG[quote.status] || { label: quote.status, variant: "secondary" as const, icon: FileText };
  const canSend = ["approved"].includes(quote.status);
  const canResend = ["sent", "viewed"].includes(quote.status);
  const canConvert = ["approved", "accepted"].includes(quote.status) && !quote.converted_order_id;

  const handleAction = async (action: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (action === "submit_review") {
        await updateQuoteStatus(quote.id, "pending_review", session.user.id, "employee", "Soumise pour approbation");
      } else if (action === "send" || action === "resend") {
        await sendQuote(quote.id, session.user.id, "employee");
        toast.success("Soumission envoyée au client");
        refetchAll();
        return;
      } else if (action === "duplicate") {
        const newQuote = await duplicateQuote(quote.id, session.user.id, "employee");
        toast.success("Soumission dupliquée");
        queryClient.invalidateQueries({ queryKey: ["quotes-list"] });
        navigate(employeePath(`/quotes/${newQuote.id}`));
        return;
      } else if (action === "followup") {
        await logFollowUp(quote.id, session.user.id, "employee");
      } else if (action === "convert") {
        const result = await convertQuoteToOrder(quote.id, session.user.id, "employee");
        toast.success(`Commande ${result.orderNumber} créée`);
        queryClient.invalidateQueries({ queryKey: ["quotes-list"] });
        refetchAll();
        return;
      } else if (action === "pdf") {
        await downloadQuotePDF(quote.id);
        toast.success("PDF téléchargé");
        return;
      }

      toast.success("Action effectuée");
      refetchAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCopyLink = () => {
    if (quote.public_token) {
      navigator.clipboard.writeText(getQuotePublicUrl(quote.public_token));
      toast.success("Lien public copié");
    }
  };

  const handleOpenPublic = () => {
    if (quote.public_token) {
      window.open(getQuotePublicUrl(quote.public_token), "_blank");
    }
  };

  const clientName = quote.is_prospect ? (quote.prospect_name || "Prospect") : (customer?.full_name || "—");
  const clientEmail = quote.is_prospect ? quote.prospect_email : customer?.email;
  const clientPhone = quote.is_prospect ? quote.prospect_phone : customer?.phone;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(employeePath("/quotes"))}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground font-mono">{quote.quote_number}</h1>
              <Badge variant={st.variant}>{st.label}</Badge>
              {quote.is_prospect && <Badge variant="outline" className="text-[10px]"><UserPlus className="h-3 w-3 mr-0.5" />Prospect</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Créée le {format(new Date(quote.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {quote.status === "draft" && (
            <Button size="sm" onClick={() => handleAction("submit_review")}>
              <Clock className="h-3.5 w-3.5 mr-1" /> Soumettre
            </Button>
          )}
          {canSend && (
            <Button size="sm" onClick={() => handleAction("send")}>
              <Send className="h-3.5 w-3.5 mr-1" /> Envoyer au client
            </Button>
          )}
          {canResend && (
            <Button size="sm" variant="outline" onClick={() => handleAction("resend")}>
              <Send className="h-3.5 w-3.5 mr-1" /> Renvoyer
            </Button>
          )}
          {canResend && (
            <Button size="sm" variant="outline" onClick={() => handleAction("followup")}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Relancer
            </Button>
          )}
          {canConvert && (
            <Button size="sm" variant="default" onClick={() => handleAction("convert")}>
              <ArrowRightCircle className="h-3.5 w-3.5 mr-1" /> Convertir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => handleAction("pdf")}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          {quote.public_token && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Link2 className="h-3.5 w-3.5 mr-1" /> Copier lien
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenPublic}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Aperçu
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => handleAction("duplicate")}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Dupliquer
          </Button>
        </div>
      </div>

      {/* Converted order link */}
      {quote.converted_order_id && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium">Convertie en commande</span>
          <Button size="sm" variant="outline" onClick={() => navigate(employeePath(`/orders/${quote.converted_order_id}`))}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Voir commande
          </Button>
        </div>
      )}

      {/* Follow-up info */}
      {(quote.last_followup_at || quote.last_sent_at) && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {quote.last_sent_at && <span>Dernier envoi: {format(new Date(quote.last_sent_at), "d MMM yyyy HH:mm", { locale: fr })}</span>}
          {quote.last_followup_at && <span>Dernière relance: {format(new Date(quote.last_followup_at), "d MMM yyyy HH:mm", { locale: fr })}</span>}
          {quote.next_followup_at && <span>Prochaine relance: {format(new Date(quote.next_followup_at), "d MMM yyyy", { locale: fr })}</span>}
        </div>
      )}

      {/* Client */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" /> {quote.is_prospect ? "Prospect" : "Client"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{clientName}</p>
          <p className="text-sm text-muted-foreground">{clientEmail}{clientPhone ? ` · ${clientPhone}` : ""}</p>
          {quote.valid_until && (
            <p className="text-xs text-muted-foreground mt-1">
              Valide jusqu'au {format(new Date(quote.valid_until), "d MMMM yyyy", { locale: fr })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Services & frais</CardTitle>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune ligne</p>
          ) : (
            <div className="space-y-1">
              {lines.map((l: any) => (
                <div key={l.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
                  <div>
                    <span className="font-medium">{l.label}</span>
                    {l.quantity > 1 && <span className="text-muted-foreground ml-1">× {l.quantity}</span>}
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{(l.unit_price * l.quantity).toFixed(2)} $</span>
                    <span className="text-xs text-muted-foreground ml-1.5">
                      {l.billing_frequency === "monthly" ? "/mois" : "unique"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ajustements</CardTitle>
          </CardHeader>
          <CardContent>
            {adjustments.map((a: any) => (
              <div key={a.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span>{a.label}</span>
                  <Badge variant={a.approval_status === "approved" ? "default" : a.approval_status === "rejected" ? "destructive" : "outline"}>
                    {a.approval_status === "approved" ? "Approuvé" : a.approval_status === "rejected" ? "Rejeté" : "En attente"}
                  </Badge>
                </div>
                <span className="text-destructive font-medium">-{Number(a.amount).toFixed(2)} $</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Totals */}
      <Card>
        <CardContent className="pt-6 space-y-1">
          <div className="flex justify-between text-sm"><span>Sous-total</span><span>{Number(quote.subtotal).toFixed(2)} $</span></div>
          {Number(quote.discounts_total) > 0 && <div className="flex justify-between text-sm text-destructive"><span>Rabais</span><span>-{Number(quote.discounts_total).toFixed(2)} $</span></div>}
          {Number(quote.credits_total) > 0 && <div className="flex justify-between text-sm text-destructive"><span>Crédits</span><span>-{Number(quote.credits_total).toFixed(2)} $</span></div>}
          <div className="flex justify-between text-sm"><span>Taxes</span><span>{Number(quote.taxes_total).toFixed(2)} $</span></div>
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
            <span>Total dû maintenant</span><span>{Number(quote.total_due_now).toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-primary">
            <span>Mensuel récurrent</span><span>{Number(quote.total_monthly).toFixed(2)} $ /mois</span>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(quote.client_note || quote.internal_note) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quote.client_note && (
              <div className="p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground mb-0.5">Note au client</p>
                <p className="text-sm">{quote.client_note}</p>
              </div>
            )}
            {quote.internal_note && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] text-amber-600 mb-0.5">Note interne</p>
                <p className="text-sm">{quote.internal_note}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Historique</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement</p>
          ) : (
            <div className="space-y-2">
              {events.map((e: any) => (
                <div key={e.id} className="flex gap-3 text-sm">
                  <div className="w-1 rounded-full bg-border shrink-0" />
                  <div>
                    <p className="font-medium">{e.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "d MMM yyyy HH:mm", { locale: fr })} · {e.actor_role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
