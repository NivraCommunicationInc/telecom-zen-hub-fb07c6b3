/**
 * Core Admin Quote Detail — Full review, approve/reject, convert to order.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuoteDetail } from "@/shared-ops/useQuoteDetail";
import { approveQuote, rejectQuote, updateQuoteStatus, convertQuoteToOrder, sendQuote } from "@/shared-ops/quoteOperations";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, XCircle, Send, ArrowRightCircle, User, Clock, FileText, MessageSquare, ShoppingCart, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  pending_review: { label: "En révision", variant: "outline" },
  approved: { label: "Approuvée", variant: "default" },
  sent: { label: "Envoyée", variant: "default" },
  viewed: { label: "Consultée", variant: "outline" },
  accepted: { label: "Acceptée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
  expired: { label: "Expirée", variant: "secondary" },
  converted: { label: "Convertie", variant: "default" },
};

export default function CoreQuoteDetail() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const { quote, lines, adjustments, events, approvals, customer, isLoading, refetchAll } = useQuoteDetail(quoteId);

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Chargement...</div>;
  if (!quote) return <div className="text-center py-12 text-muted-foreground">Soumission introuvable</div>;

  const st = STATUS_CONFIG[quote.status] || { label: quote.status, variant: "secondary" as const };

  const doAction = async (fn: () => Promise<any>, successMsg: string) => {
    setProcessing(true);
    try {
      await fn();
      toast.success(successMsg);
      refetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return session;
  };

  const handleApprove = async () => {
    const session = await getSession();
    await doAction(() => approveQuote(quote.id, session.user.id, "admin"), "Soumission approuvée");
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    const session = await getSession();
    await doAction(() => rejectQuote(quote.id, session.user.id, "admin", rejectReason), "Soumission rejetée");
    setShowRejectDialog(false);
    setRejectReason("");
  };

  const handleSend = async () => {
    const session = await getSession();
    await doAction(() => sendQuote(quote.id, session.user.id, "admin"), "Soumission envoyée");
  };

  const handleConvert = async () => {
    const session = await getSession();
    setProcessing(true);
    try {
      const result = await convertQuoteToOrder(quote.id, session.user.id, "admin");
      toast.success(`Commande ${result.orderNumber} créée`);
      setShowConvertDialog(false);
      refetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const canApprove = ["pending_review"].includes(quote.status);
  const canSend = ["approved"].includes(quote.status);
  const canConvert = ["approved", "accepted"].includes(quote.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/core/quotes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono">{quote.quote_number}</h1>
              <Badge variant={st.variant}>{st.label}</Badge>
              <Badge variant="outline" className="text-[10px]">{quote.source_portal === "employee" ? "Employé" : "Core"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Créée le {format(new Date(quote.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {canApprove && (
            <>
              <Button size="sm" variant="default" onClick={handleApprove} disabled={processing}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approuver
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={processing}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeter
              </Button>
            </>
          )}
          {canSend && (
            <Button size="sm" onClick={handleSend} disabled={processing}>
              <Send className="h-3.5 w-3.5 mr-1" /> Envoyer au client
            </Button>
          )}
          {canConvert && (
            <Button size="sm" variant="default" onClick={() => setShowConvertDialog(true)} disabled={processing}>
              <ArrowRightCircle className="h-3.5 w-3.5 mr-1" /> Convertir en commande
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="col-span-2 space-y-4">
          {/* Client */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Client</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{customer?.full_name || "—"}</p>
              <p className="text-sm text-muted-foreground">{customer?.email} · {customer?.phone}</p>
              {quote.valid_until && (
                <p className="text-xs text-muted-foreground mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Valide jusqu'au {format(new Date(quote.valid_until), "d MMMM yyyy", { locale: fr })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Services & frais</CardTitle>
            </CardHeader>
            <CardContent>
              {lines.map((l: any) => (
                <div key={l.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
                  <div>
                    <span className="font-medium">{l.label}</span>
                    {l.quantity > 1 && <span className="text-muted-foreground ml-1">× {l.quantity}</span>}
                    <Badge variant="outline" className="ml-2 text-[10px]">{l.line_type}</Badge>
                  </div>
                  <span className="font-medium">
                    {(l.unit_price * l.quantity).toFixed(2)} $ {l.billing_frequency === "monthly" ? "/mois" : ""}
                  </span>
                </div>
              ))}
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
                        {a.approval_status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{a.source}</Badge>
                    </div>
                    <span className="text-destructive font-medium">-{Number(a.amount).toFixed(2)} $</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {(quote.client_note || quote.internal_note) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quote.client_note && (
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Note client</p>
                    <p className="text-sm">{quote.client_note}</p>
                  </div>
                )}
                {quote.internal_note && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <p className="text-[10px] text-amber-600">Note interne</p>
                    <p className="text-sm">{quote.internal_note}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right 1/3 */}
        <div className="space-y-4">
          {/* Totals */}
          <Card>
            <CardContent className="pt-6 space-y-1.5">
              <div className="flex justify-between text-sm"><span>Sous-total</span><span>{Number(quote.subtotal).toFixed(2)} $</span></div>
              {Number(quote.discounts_total) > 0 && <div className="flex justify-between text-sm text-destructive"><span>Rabais</span><span>-{Number(quote.discounts_total).toFixed(2)} $</span></div>}
              {Number(quote.credits_total) > 0 && <div className="flex justify-between text-sm text-destructive"><span>Crédits</span><span>-{Number(quote.credits_total).toFixed(2)} $</span></div>}
              <div className="flex justify-between text-sm"><span>Taxes</span><span>{Number(quote.taxes_total).toFixed(2)} $</span></div>
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>Total</span><span>{Number(quote.total_due_now).toFixed(2)} $</span>
              </div>
              <div className="flex justify-between text-sm text-primary font-medium">
                <span>Mensuel</span><span>{Number(quote.total_monthly).toFixed(2)} $/mois</span>
              </div>
            </CardContent>
          </Card>

          {/* Converted order link */}
          {quote.converted_order_id && (
            <Card>
              <CardContent className="pt-6">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate(`/core/orders/${quote.converted_order_id}`)}
                >
                  <ExternalLink className="h-4 w-4" /> Voir la commande
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Approvals */}
          {approvals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Décisions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {approvals.map((a: any) => (
                  <div key={a.id} className="p-2 rounded border border-border">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.decision === "approved" ? "default" : "destructive"}>
                        {a.decision === "approved" ? "Approuvé" : "Rejeté"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{a.actor_role}</span>
                    </div>
                    {a.reason && <p className="text-xs mt-1">{a.reason}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(a.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                  </div>
                ))}
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
                <p className="text-xs text-muted-foreground">Aucun événement</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e: any) => (
                    <div key={e.id} className="flex gap-2 text-xs">
                      <div className="w-0.5 rounded-full bg-border shrink-0 mt-1" style={{ minHeight: 20 }} />
                      <div>
                        <p className="font-medium text-foreground">{e.message}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(e.created_at), "d MMM HH:mm", { locale: fr })} · {e.actor_role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la soumission</DialogTitle>
            <DialogDescription>Indiquez la raison du rejet. L'agent sera notifié.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Raison du rejet..." rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || processing}>Rejeter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir en commande</DialogTitle>
            <DialogDescription>
              Cette action créera une commande canonique à partir de cette soumission.
              Les totaux seront recalculés côté serveur. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded bg-muted/50 text-sm space-y-1">
            <div className="flex justify-between"><span>Client</span><span className="font-medium">{customer?.full_name}</span></div>
            <div className="flex justify-between"><span>Total</span><span className="font-medium">{Number(quote.total_due_now).toFixed(2)} $</span></div>
            <div className="flex justify-between"><span>Mensuel</span><span className="font-medium">{Number(quote.total_monthly).toFixed(2)} $ /mois</span></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConvertDialog(false)}>Annuler</Button>
            <Button onClick={handleConvert} disabled={processing}>
              <ArrowRightCircle className="h-4 w-4 mr-1" /> Confirmer la conversion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
