import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, CreditCard, DollarSign, Eye, Copy, CheckCircle, Banknote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// E-transfer payment info
const ETRANSFER_INFO = {
  email: "NivraTelecom@gmail.com",
  question: "Nom du client ou nom de l'entreprise",
  answer: "Votre nom complet ou le nom de votre entreprise",
};

// Payment method type
type PaymentMethod = "etransfer" | "credit_card";

const ClientInvoices = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("invoices");
  const [filterTab, setFilterTab] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [generalPaymentOpen, setGeneralPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("etransfer");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["client-invoices-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["client-payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const filteredInvoices = invoices?.filter((inv: any) => {
    if (filterTab === "all") return true;
    return inv.status === filterTab;
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-500",
    paid: "bg-emerald-500/20 text-emerald-500",
    overdue: "bg-red-500/20 text-red-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    paid: "Payé",
    overdue: "En retard",
  };

  const calculateTotal = (inv: any) => {
    const base = Number(inv.amount) || 0;
    const fees = Number(inv.fees) || 0;
    const credits = Number(inv.credits) || 0;
    return base + fees - credits;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const handlePayClick = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentInfoOpen(true);
  };

  const handleViewPayment = (payment: any) => {
    setSelectedPayment(payment);
    setPaymentDetailsOpen(true);
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Facturation & Paiements</h1>
            <p className="text-muted-foreground mt-1">Consultez vos factures et historique de paiements</p>
          </div>
          <Button variant="hero" onClick={() => setGeneralPaymentOpen(true)}>
            <DollarSign className="w-4 h-4 mr-2" />
            Envoyer un paiement
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Factures
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Paiements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Mes factures
                  </CardTitle>
                  <Tabs value={filterTab} onValueChange={setFilterTab}>
                    <TabsList>
                      <TabsTrigger value="all">Toutes</TabsTrigger>
                      <TabsTrigger value="pending">En attente</TabsTrigger>
                      <TabsTrigger value="paid">Payées</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredInvoices && filteredInvoices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nº</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Échéance</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((inv: any) => (
                          <tr key={inv.id} className="border-b border-border/50 hover:bg-accent/50">
                            <td className="py-3 px-4 text-sm font-mono text-foreground">
                              {inv.invoice_number || inv.id.slice(0, 8)}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                            </td>
                            <td className="py-3 px-4 text-sm font-medium text-foreground">
                              {calculateTotal(inv).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {inv.due_date ? format(new Date(inv.due_date), "d MMM yyyy", { locale: fr }) : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={statusColors[inv.status] || "bg-muted"}>
                                {statusLabels[inv.status] || inv.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline">
                                  <Download className="w-4 h-4" />
                                </Button>
                                {inv.status !== "paid" && (
                                  <Button size="sm" variant="hero" onClick={() => handlePayClick(inv)}>
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Payer
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucune facture pour le moment</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                  Historique des paiements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : payments && payments.length > 0 ? (
                  <div className="space-y-3">
                    {payments.map((payment: any) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 bg-accent/50 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {payment.amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {payment.payment_method === "credit_card" ? "Carte de crédit" : "Virement Interac"}
                              {payment.card_last_four && ` •••• ${payment.card_last_four}`}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              Réf: {payment.reference_number}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                          <Button size="sm" variant="ghost" onClick={() => handleViewPayment(payment)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun paiement enregistré</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment Dialog */}
        <Dialog open={paymentInfoOpen} onOpenChange={(open) => {
          setPaymentInfoOpen(open);
          if (!open) {
            setPaymentMethod("etransfer");
            setCardNumber("");
            setCardExpiry("");
            setCardCvc("");
            setCardName("");
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Payer une facture</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-6 mt-4">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Montant à payer</p>
                  <p className="text-3xl font-bold text-foreground">
                    {calculateTotal(selectedInvoice).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Facture: {selectedInvoice.invoice_number || selectedInvoice.id.slice(0, 8)}
                  </p>
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Méthode de paiement</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={paymentMethod === "credit_card" ? "default" : "outline"}
                      className="flex items-center justify-center gap-2 h-16"
                      onClick={() => setPaymentMethod("credit_card")}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span>Carte de crédit</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "etransfer" ? "default" : "outline"}
                      className="flex items-center justify-center gap-2 h-16"
                      onClick={() => setPaymentMethod("etransfer")}
                    >
                      <Banknote className="w-5 h-5" />
                      <span>Virement Interac</span>
                    </Button>
                  </div>
                </div>

                {paymentMethod === "credit_card" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardName">Nom sur la carte</Label>
                      <Input
                        id="cardName"
                        placeholder="Nom complet"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Numéro de carte</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 16);
                          const formatted = value.replace(/(.{4})/g, "$1 ").trim();
                          setCardNumber(formatted);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cardExpiry">Expiration</Label>
                        <Input
                          id="cardExpiry"
                          placeholder="MM/AA"
                          value={cardExpiry}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, "").slice(0, 4);
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + "/" + value.slice(2);
                            }
                            setCardExpiry(value);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardCvc">CVC</Label>
                        <Input
                          id="cardCvc"
                          placeholder="123"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        />
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        <strong>Note:</strong> Le paiement par carte de crédit sera traité de manière sécurisée. 
                        Vous recevrez une confirmation par courriel.
                      </p>
                    </div>

                    <Button 
                      className="w-full" 
                      disabled={isProcessing || !cardName || !cardNumber || !cardExpiry || !cardCvc}
                      onClick={async () => {
                        setIsProcessing(true);
                        try {
                          // Simulate processing - in production, integrate with payment gateway
                          await new Promise(resolve => setTimeout(resolve, 1500));
                          toast.success("Paiement effectué avec succès!");
                          setPaymentInfoOpen(false);
                        } catch (error) {
                          toast.error("Erreur lors du paiement");
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                    >
                      {isProcessing ? "Traitement en cours..." : "Payer maintenant"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground">Informations de paiement Interac</h3>
                    
                    <div className="bg-muted rounded-lg p-4 space-y-4">
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wide">Courriel de paiement</label>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-medium text-foreground">{ETRANSFER_INFO.email}</span>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(ETRANSFER_INFO.email, "Courriel")}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="border-t border-border pt-4">
                        <label className="text-xs text-muted-foreground uppercase tracking-wide">Question de sécurité</label>
                        <p className="font-medium text-foreground mt-1">{ETRANSFER_INFO.question}</p>
                      </div>
                      
                      <div className="border-t border-border pt-4">
                        <label className="text-xs text-muted-foreground uppercase tracking-wide">Réponse</label>
                        <p className="font-medium text-foreground mt-1">{ETRANSFER_INFO.answer}</p>
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          (Utilisez votre nom complet tel qu'il apparaît sur votre compte)
                        </p>
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        <strong>Important:</strong> Votre paiement sera traité dans les 24-48 heures ouvrables après réception. 
                        Vous recevrez une confirmation par courriel une fois le paiement enregistré.
                      </p>
                    </div>

                    <Button className="w-full" onClick={() => setPaymentInfoOpen(false)}>
                      Fermer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Details Dialog */}
        <Dialog open={paymentDetailsOpen} onOpenChange={setPaymentDetailsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Confirmation de paiement
              </DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4 mt-4">
                <div className="text-center py-4 bg-emerald-500/10 rounded-lg">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {Number(selectedPayment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Paiement complété</p>
                </div>

                <div className="bg-muted rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Numéro de référence</span>
                    <span className="font-mono font-medium">{selectedPayment.reference_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(new Date(selectedPayment.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Méthode</span>
                    <span>{selectedPayment.payment_method === "credit_card" ? "Carte de crédit" : "Virement Interac"}</span>
                  </div>
                  {selectedPayment.card_type && selectedPayment.card_last_four && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carte</span>
                      <span>{selectedPayment.card_type} •••• {selectedPayment.card_last_four}</span>
                    </div>
                  )}
                  {selectedPayment.etransfer_sender_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expéditeur</span>
                      <span>{selectedPayment.etransfer_sender_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Statut</span>
                    <Badge className="bg-emerald-500/20 text-emerald-500">Complété</Badge>
                  </div>
                </div>

                <Button className="w-full" onClick={() => setPaymentDetailsOpen(false)}>
                  Fermer
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* General Payment Dialog (for $0 balance or advance payments) */}
        <Dialog open={generalPaymentOpen} onOpenChange={(open) => {
          setGeneralPaymentOpen(open);
          if (!open) {
            setPaymentMethod("etransfer");
            setCardNumber("");
            setCardExpiry("");
            setCardCvc("");
            setCardName("");
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Envoyer un paiement</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 text-center">
                <DollarSign className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Effectuez un paiement anticipé, un dépôt ou réglez un solde
                </p>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Méthode de paiement</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={paymentMethod === "credit_card" ? "default" : "outline"}
                    className="flex items-center justify-center gap-2 h-16"
                    onClick={() => setPaymentMethod("credit_card")}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Carte de crédit</span>
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === "etransfer" ? "default" : "outline"}
                    className="flex items-center justify-center gap-2 h-16"
                    onClick={() => setPaymentMethod("etransfer")}
                  >
                    <Banknote className="w-5 h-5" />
                    <span>Virement Interac</span>
                  </Button>
                </div>
              </div>

              {paymentMethod === "credit_card" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="genCardName">Nom sur la carte</Label>
                    <Input
                      id="genCardName"
                      placeholder="Nom complet"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genCardNumber">Numéro de carte</Label>
                    <Input
                      id="genCardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 16);
                        const formatted = value.replace(/(.{4})/g, "$1 ").trim();
                        setCardNumber(formatted);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="genCardExpiry">Expiration</Label>
                      <Input
                        id="genCardExpiry"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, "").slice(0, 4);
                          if (value.length >= 2) {
                            value = value.slice(0, 2) + "/" + value.slice(2);
                          }
                          setCardExpiry(value);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genCardCvc">CVC</Label>
                      <Input
                        id="genCardCvc"
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      />
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      <strong>Note:</strong> Le paiement par carte de crédit sera traité de manière sécurisée. 
                      Vous recevrez une confirmation par courriel.
                    </p>
                  </div>

                  <Button 
                    className="w-full" 
                    disabled={isProcessing || !cardName || !cardNumber || !cardExpiry || !cardCvc}
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        // Simulate processing - in production, integrate with payment gateway
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        toast.success("Paiement effectué avec succès!");
                        setGeneralPaymentOpen(false);
                      } catch (error) {
                        toast.error("Erreur lors du paiement");
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                  >
                    {isProcessing ? "Traitement en cours..." : "Payer maintenant"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Informations de paiement Interac</h3>
                  
                  <div className="bg-muted rounded-lg p-4 space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Courriel de paiement</label>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-medium text-foreground">{ETRANSFER_INFO.email}</span>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(ETRANSFER_INFO.email, "Courriel")}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="border-t border-border pt-4">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Question de sécurité</label>
                      <p className="font-medium text-foreground mt-1">{ETRANSFER_INFO.question}</p>
                    </div>
                    
                    <div className="border-t border-border pt-4">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Réponse</label>
                      <p className="font-medium text-foreground mt-1">{ETRANSFER_INFO.answer}</p>
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        (Utilisez votre nom complet tel qu'il apparaît sur votre compte)
                      </p>
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      <strong>Note:</strong> Les paiements reçus seront appliqués à votre compte dans les 24-48 heures ouvrables. 
                      Vous recevrez une confirmation par courriel.
                    </p>
                  </div>

                  <Button className="w-full" onClick={() => setGeneralPaymentOpen(false)}>
                    Fermer
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ClientLayout>
  );
};

export default ClientInvoices;
