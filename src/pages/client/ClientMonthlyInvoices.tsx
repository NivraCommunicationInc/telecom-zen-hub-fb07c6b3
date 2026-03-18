import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { StripeInlinePayment } from "@/components/payment/StripeInlinePayment";
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
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "interac" | "card">("card");

  // Fetch client's invoices from canonical billing_invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["client-monthly-invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Resolve billing_customer first
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!customer) return [];

      const { data, error } = await supabase
        .from("billing_invoices")
        .select("*")
        .eq("customer_id", customer.id)
        .not("order_id", "is", null)
        .not("status", "in", "(\"void\",\"failed\")")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Map canonical fields to the shape used by the template
      return (data || []).map((inv: any) => ({
        ...inv,
        period_start: inv.cycle_start_date,
        period_end: inv.cycle_end_date,
        issue_date: inv.created_at,
      }));
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Fetch client's subscriptions to show bill cycle info
  const { data: subscriptions } = useQuery({
    queryKey: ["client-subscriptions-billing", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Resolve billing_customer first
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!customer) return [];
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, service_category")
        .eq("customer_id", customer.id)
        .in("status", ["active", "pending", "suspended"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Fetch account info for billing cycle
  const { data: account } = useQuery({
    queryKey: ["client-account-billing", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_number, billing_cycle_day, next_invoice_date, status")
        .eq("client_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

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

                {/* Payment method selection */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Mode de paiement</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      type="button"
                      variant={paymentMethod === "card" ? "default" : "outline"}
                      className="flex items-center justify-center gap-2 h-14"
                      onClick={() => setPaymentMethod("card")}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span>Carte</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "paypal" ? "default" : "outline"}
                      className="flex items-center justify-center gap-2 h-14"
                      onClick={() => setPaymentMethod("paypal")}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z" fill="#179BD7"/>
                        <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z" fill="#222D65"/>
                        <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z" fill="#253B80"/>
                      </svg>
                      <span>PayPal</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "interac" ? "default" : "outline"}
                      className="flex items-center justify-center gap-2 h-14"
                      onClick={() => setPaymentMethod("interac")}
                    >
                      <Banknote className="w-5 h-5" />
                      <span>Interac</span>
                    </Button>
                  </div>
                </div>

                {/* Card via Stripe Elements */}
                {paymentMethod === "card" && (
                  <div className="space-y-4">
                    <StripeInlinePayment
                      invoiceId={selectedInvoice.id}
                      amount={Number(selectedInvoice.balance_due || selectedInvoice.total)}
                      description={`Facture ${selectedInvoice.invoice_number}`}
                      onSuccess={() => {
                        setPaymentDialogOpen(false);
                        setSelectedInvoice(null);
                        queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
                        queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
                        queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
                        queryClient.invalidateQueries({ queryKey: ["client-balance"] });
                        queryClient.invalidateQueries({ queryKey: ["client-ledger"] });
                      }}
                      onError={(error) => {
                        toast({ title: "Erreur de paiement", description: error, variant: "destructive" });
                      }}
                    />
                  </div>
                )}

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

                {/* Interac Instructions */}
                {paymentMethod === "interac" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-3">
                      <p className="text-sm font-medium">Envoyez votre paiement à :</p>
                      <div className="p-3 bg-background rounded-lg border">
                        <p className="font-mono text-lg">{ETRANSFER_CONFIG.emailDisplay}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Question</p>
                          <p className="font-medium">{ETRANSFER_CONFIG.securityQuestion}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Réponse</p>
                          <p className="font-medium">{ETRANSFER_CONFIG.securityAnswer}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Incluez le numéro de facture <strong>{selectedInvoice.invoice_number}</strong> dans le message du virement.
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setPaymentDialogOpen(false);
                        toast({ title: "Instructions envoyées", description: "Consultez votre courriel pour les détails du virement." });
                      }}
                    >
                      Fermer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ClientLayout>
  );
};

export default ClientMonthlyInvoices;
