import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, Calendar, Download, CreditCard, CheckCircle, Clock, AlertTriangle, Loader2, Info, Banknote, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBillingCycleDescription, BILLING_CONSTANTS } from "@/lib/billingCycleUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PayPalButton } from "@/components/payment/PayPalButton";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

import { ETRANSFER_CONFIG } from "@/config/company";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-blue-500/20 text-blue-500",
  paid: "bg-emerald-500/20 text-emerald-500",
  overdue: "bg-red-500/20 text-red-500",
  void: "bg-gray-500/20 text-gray-500",
};

// PREPAID TERMINOLOGY: No debt language
const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  issued: "Émise",
  paid: "Payée",
  overdue: "Renouvellement requis", // Not "En retard"
  void: "Annulée (non-renouvellement)",
  expired: "Expiré (non renouvelé)",
  not_renewed: "Non renouvelé",
};

const ClientMonthlyInvoices = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: canonicalData } = useCanonicalClientData(user?.id);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  // B3: Interac removed from client portal — PayPal only (cards work via PayPal guest)
  const [paymentMethod, setPaymentMethod] = useState<"paypal">("paypal");

  // Derived from canonical snapshot (single source of truth)
  const isLoading = !canonicalData && !!user?.id;
  const invoices = (canonicalData?.invoices || [])
    .filter((inv: any) => inv?.order_id && !["void", "failed"].includes(String(inv?.status || "").toLowerCase()))
    .map((inv: any) => ({
      ...inv,
      period_start: inv.cycle_start_date,
      period_end: inv.cycle_end_date,
      issue_date: inv.created_at,
    }));

  const subscriptions = (canonicalData?.subscriptions || []).filter((s: any) =>
    ["active", "pending", "suspended"].includes(String(s?.status || "").toLowerCase())
  );

  const account = canonicalData?.account
    ? {
        id: canonicalData.account.id,
        account_number: canonicalData.account.account_number,
        billing_cycle_day: canonicalData.account.billing_cycle_day,
        next_invoice_date: canonicalData.account.next_invoice_date,
        status: canonicalData.account.status,
      }
    : null;

  // ============================================================
  // FAKE PAYMENT MUTATION REMOVED (P0 cleanup)
  // Payments are ONLY created via canonical Core flows:
  //   - PayPal capture → paypal-capture-order edge function
  //   - Interac → admin records in Core console
  // The client portal does NOT fabricate payment records.
  // ============================================================

  // Get billing cycle day from account or derive from subscription cycle_end_date
  const billCycleDay = account?.billing_cycle_day 
    || (subscriptions?.length ? new Date(subscriptions[0].cycle_end_date).getDate() : null);

  const nextInvoiceDate = account?.next_invoice_date 
    || (subscriptions?.length
      ? subscriptions.reduce((earliest: string | null, s: any) => {
          const endDate = s.cycle_end_date;
          if (!endDate) return earliest;
          if (!earliest) return endDate;
          return endDate < earliest ? endDate : earliest;
        }, null as string | null)
      : null);

  useEffect(() => {
    if (!user?.id) return;

    const refreshBillingData = () => {
      queryClient.invalidateQueries({ queryKey: ["client-subscriptions-billing", user.id] });
      queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices", user.id] });
      queryClient.invalidateQueries({ queryKey: ["client-balance", user.id] });
      queryClient.invalidateQueries({ queryKey: ["client-ledger", user.id] });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshBillingData();
      }
    };

    refreshBillingData();
    window.addEventListener("focus", refreshBillingData);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshBillingData);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.id, queryClient]);

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Factures mensuelles</h1>
          <p className="text-muted-foreground">Consultez et payez vos factures de services</p>
        </div>

        {/* Billing Cycle Info */}
        {billCycleDay && (
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-cyan-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Cycle de facturation</p>
                  <p className="text-2xl font-bold text-cyan-500">
                    {formatBillingCycleDescription(billCycleDay)}
                  </p>
                  {nextInvoiceDate && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        <strong>Prochaine facture:</strong> {format(new Date(nextInvoiceDate), "d MMMM yyyy", { locale: fr })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Paiement requis:</strong> Avant le Bill Cycle (J0) pour renouveler le service
                      </p>
                    </div>
                  )}
                  
                  {/* Policy info */}
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Le paiement doit être confirmé AVANT la date du Bill Cycle (J0) pour renouveler le service. 
                      Si non payé, le service devient Expiré (non-renouvelé).
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Services Summary */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Services actifs</CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions && subscriptions.length > 0 ? (
              <div className="space-y-2">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">{sub.plan_name}</span>
                    <span className="text-lg font-bold text-cyan-500">
                      {Number(sub.plan_price || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 border-t border-border mt-2 pt-4">
                  <span className="font-bold">Total mensuel (avant taxes)</span>
                  <span className="text-xl font-bold text-cyan-500">
                    {subscriptions.reduce((sum: number, s: any) => sum + (s.plan_price || 0), 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground font-medium">Aucun service actif</p>
                <p className="text-sm text-muted-foreground mt-1">Votre total mensuel est actuellement à 0 $.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-cyan-400" />
              Historique des factures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              </div>
            ) : invoices && invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div 
                    key={invoice.id} 
                    className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          {invoice.status === "paid" ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : invoice.status === "overdue" ? (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            Période: {format(new Date(invoice.period_start), "d MMM", { locale: fr })} - {format(new Date(invoice.period_end), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <Badge className={statusColors[invoice.status]}>
                          {statusLabels[invoice.status] || invoice.status}
                        </Badge>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {Number(invoice.total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Émise le {format(new Date(invoice.issue_date), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-1" />
                            PDF
                          </Button>
                          {(invoice.status === "issued" || invoice.status === "overdue") && (
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              <CreditCard className="w-4 h-4 mr-1" />
                              Payer
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Invoice breakdown */}
                    <div className="mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Sous-total</span>
                        <span>{Number(invoice.subtotal).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TPS (5%)</span>
                        <span>{Number(invoice.tps_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TVQ (9.975%)</span>
                        <span>{Number(invoice.tvq_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                      {invoice.due_date && (
                        <div className={`flex justify-between mt-2 pt-2 border-t border-border/30 ${
                          invoice.status === "overdue" ? "text-red-500 font-medium" : ""
                        }`}>
                          <span>Échéance</span>
                          <span>
                            {format(new Date(invoice.due_date), "d MMMM yyyy", { locale: fr })}
                            {invoice.status === "overdue" && " (renouvellement requis)"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune facture pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Payer la facture</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-6">
                {/* Invoice summary */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Facture</span>
                    <span className="font-medium">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">Montant à payer</span>
                    <span className="text-xl font-bold text-primary">
                      {Number(selectedInvoice.total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </div>
                </div>

                {/* B3: Interac removed from client portal — PayPal only.
                    PayPal accepts credit/debit cards without requiring an account. */}

                {/* PayPal Button */}
                {paymentMethod === "paypal" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-4">
                        Payez de façon sécurisée avec votre compte PayPal ou carte de crédit/débit.
                      </p>
                      <PayPalButton
                        amount={Number(selectedInvoice.total)}
                        invoiceId={selectedInvoice.id}
                        description={`Facture ${selectedInvoice.invoice_number}`}
                        onSuccess={() => {
                          toast({ title: "Paiement réussi!", description: "Votre facture a été payée." });
                          setPaymentDialogOpen(false);
                          setSelectedInvoice(null);
                          // Invalidate all billing-related caches for instant UI updates
                          queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
                          queryClient.invalidateQueries({ queryKey: ["client-balance"] });
                          queryClient.invalidateQueries({ queryKey: ["client-ledger"] });
                        }}
                        onError={(error) => {
                          toast({ title: "Erreur PayPal", description: error, variant: "destructive" });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* B3: Interac instructions removed — PayPal handles cards directly */}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ClientLayout>
  );
};

export default ClientMonthlyInvoices;
