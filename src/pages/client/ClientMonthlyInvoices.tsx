import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, Calendar, Download, CreditCard, CheckCircle, Clock, AlertTriangle, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBillingCycleDescription, BILLING_CONSTANTS } from "@/lib/billingCycleUtils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-blue-500/20 text-blue-500",
  paid: "bg-emerald-500/20 text-emerald-500",
  overdue: "bg-red-500/20 text-red-500",
  void: "bg-gray-500/20 text-gray-500",
};

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  issued: "Émise",
  paid: "Payée",
  overdue: "En retard",
  void: "Annulée",
};

const ClientMonthlyInvoices = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // Fetch client's monthly invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["client-monthly-invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("*")
        .eq("client_id", user.id)
        .order("period_start", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch client's subscriptions to show bill cycle info
  const { data: subscriptions } = useQuery({
    queryKey: ["client-subscriptions-billing", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, plan_name, amount, bill_cycle_day, next_invoice_date, status")
        .eq("user_id", user.id)
        .in("status", ["active", "shipped", "installed", "installation_completed"]);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
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
  });

  // Mark invoice as paid (simulated - in reality would integrate with payment gateway)
  const payInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("monthly_invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_reference: `PAY-${Date.now()}`,
        })
        .eq("id", invoiceId)
        .eq("client_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
      toast({ title: "Paiement effectué", description: "Votre facture a été payée avec succès." });
      setPayingInvoiceId(null);
    },
    onError: () => {
      toast({ title: "Erreur de paiement", variant: "destructive" });
      setPayingInvoiceId(null);
    },
  });

  // Get billing cycle day from account or subscriptions
  const billCycleDay = account?.billing_cycle_day 
    || (subscriptions?.length ? Math.min(...subscriptions.map(s => s.bill_cycle_day || 1)) : null);

  const nextInvoiceDate = account?.next_invoice_date 
    || (subscriptions?.length
      ? subscriptions.reduce((earliest, s) => {
          if (!s.next_invoice_date) return earliest;
          if (!earliest) return s.next_invoice_date;
          return s.next_invoice_date < earliest ? s.next_invoice_date : earliest;
        }, null as string | null)
      : null);

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
                        <strong>Échéance paiement:</strong> {format(addDays(new Date(nextInvoiceDate), BILLING_CONSTANTS.PAYMENT_GRACE_DAYS), "d MMMM yyyy", { locale: fr })} ({BILLING_CONSTANTS.PAYMENT_GRACE_DAYS} jours après émission)
                      </p>
                    </div>
                  )}
                  
                  {/* Policy info */}
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Chaque facture doit être payée dans les {BILLING_CONSTANTS.PAYMENT_GRACE_DAYS} jours suivant la date d'émission. 
                      Après ce délai, le compte peut être suspendu jusqu'au règlement.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Services Summary */}
        {subscriptions && subscriptions.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Services actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">{sub.plan_name}</span>
                    <span className="text-lg font-bold text-cyan-500">
                      {Number(sub.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 border-t border-border mt-2 pt-4">
                  <span className="font-bold">Total mensuel (avant taxes)</span>
                  <span className="text-xl font-bold text-cyan-500">
                    {subscriptions.reduce((sum, s) => sum + (s.amount || 0), 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                                setPayingInvoiceId(invoice.id);
                                payInvoiceMutation.mutate(invoice.id);
                              }}
                              disabled={payingInvoiceId === invoice.id}
                            >
                              {payingInvoiceId === invoice.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <CreditCard className="w-4 h-4 mr-1" />
                              )}
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
                            {invoice.status === "overdue" && " (en retard)"}
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
      </div>
    </ClientLayout>
  );
};

export default ClientMonthlyInvoices;
