/**
 * ClientBillingHub — Telecom-grade payment portal
 *
 * Structured billing hub with clear sections:
 * - Pay Invoice (existing unpaid invoices)
 * - Add Credit (custom amount via PayPal)
 * - Invoices (full list)
 * - Payment History
 *
 * All financial data from canonical billing_invoices + billing_payments.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { ClientPayBalanceCard } from "@/components/client/ClientPayBalanceCard";
import { ClientPaymentMethodCard } from "@/components/client/ClientPaymentMethodCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CreditCard,
  FileText,
  Receipt,
  DollarSign,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Wallet,
  ShieldCheck,
  Eye,
  Download,
  Lock,
  Copy,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientPDF } from "@/hooks/useClientPDF";
import PayInvoiceDialog from "@/components/client/PayInvoiceDialog";
import { PaymentHistoryV2 } from "@/components/client/PaymentHistoryV2";
import { AddAccountCredit } from "@/components/client/AddAccountCredit";
import { fetchInvoiceBreakdowns, type InvoiceBreakdown } from "@/lib/billing/useInvoiceBreakdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400",
  paid: "bg-emerald-500/20 text-emerald-400",
  overdue: "bg-red-500/20 text-red-400",
  partially_paid: "bg-orange-500/20 text-orange-400",
  void: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  overdue: "Renouvellement requis",
  partially_paid: "Partiel",
  void: "Annulée",
  cancelled: "Annulée",
};

const ClientBillingHub = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const writeGuard = useWriteGuard();
  const clientPDF = useClientPDF();
  const { data: canonicalData } = useCanonicalClientData(user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "pay-invoice";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Realtime: refresh billing hub when invoices/payments/subscriptions/account change
  usePortalRealtime(
    ["billing_invoices", "billing_payments", "billing_subscriptions", "accounts"],
    [
      ["billing-hub-unpaid", user?.id],
      ["billing-hub-all-invoices", user?.id],
      ["ledger-balance", user?.id],
      ["client-invoice-breakdowns"],
      ["client-invoices"],
      ["pending-invoices-canonical"],
      ["canonical-client-data", user?.id],
    ],
  );

  // Sync tab to URL
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== activeTab) setActiveTab(urlTab);
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Ledger balance
  const { data: ledger, isLoading: ledgerLoading } = useLedgerBalance(user?.id, portalSupabase);

  // Profile for payment dialog (derived from canonical snapshot)
  const profile = canonicalData?.profile ?? null;

  // Unpaid invoices for "Pay Invoice" tab (needs async breakdown fetch)
  const { data: unpaidInvoices, isLoading: unpaidLoading } = useQuery({
    queryKey: ["billing-hub-unpaid", user?.id, (canonicalData?.invoices || []).length],
    queryFn: async () => {
      if (!user?.id) return [];
      const invoices = (canonicalData?.invoices || [])
        .filter((invoice: any) => !["paid", "cancelled", "refunded", "void", "paid_by_promo"].includes(String(invoice?.status || "").toLowerCase()))
        .sort((a: any, b: any) => new Date(a?.due_date || a?.created_at || 0).getTime() - new Date(b?.due_date || b?.created_at || 0).getTime());

      if (!invoices || invoices.length === 0) return [];

      const ids = invoices.map((i) => i.id);
      const bdMap = await fetchInvoiceBreakdowns(ids, portalSupabase);

      return invoices.map((inv) => {
        const bd = bdMap.get(inv.id);
        return {
          ...inv,
          breakdown: bd || null,
          balance_due: Number(inv.balance_due) || Number(inv.total) || 0,
        };
      });
    },
    enabled: !!user?.id,
  });

  // All invoices for "Invoices" tab (derived from canonical snapshot)
  const allLoading = !canonicalData && !!user?.id;
  const allInvoices = [...(canonicalData?.invoices || [])]
    .sort((a: any, b: any) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
    .slice(0, 50);

  // Pay dialog state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<any>(null);

  const handlePayInvoice = (invoice: any) => {
    setPayingInvoice(invoice);
    setPayDialogOpen(true);
  };

  const [payingBalance, setPayingBalance] = useState(false);
  const [showInteracDialog, setShowInteracDialog] = useState(false);
  const interacAccountNumber =
    (canonicalData?.profile as any)?.account_number ||
    (canonicalData?.account as any)?.account_number ||
    "—";

  // Card payment form state
  const [cardForm, setCardForm] = useState({
    card_number: "",
    card_expiry: "",
    cvv: "",
    card_name: "",
  });
  const [cardPaymentLoading, setCardPaymentLoading] = useState(false);

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  };

  const handleCardPayment = async () => {
    if (!user?.id) return;
    if (!cardForm.card_name.trim()) { toast.error("Entrez le nom sur la carte"); return; }
    const rawCard = cardForm.card_number.replace(/\s/g, "");
    if (rawCard.length < 13) { toast.error("Numéro de carte invalide"); return; }
    if (!/^\d{2}\/\d{2}$/.test(cardForm.card_expiry)) { toast.error("Date d'expiration invalide (MM/AA)"); return; }
    if (!/^\d{3,4}$/.test(cardForm.cvv)) { toast.error("CVV invalide"); return; }
    if (balance <= 0) { toast.error("Aucun solde à payer"); return; }

    setCardPaymentLoading(true);
    try {
      const { data: result, error: invokeErr } = await portalSupabase.functions.invoke(
        "portal-card-payment",
        {
          body: {
            card_number: rawCard,
            card_expiry: cardForm.card_expiry,
            cvv: cardForm.cvv,
            card_name: cardForm.card_name,
            amount: displayBalance,
          },
        }
      );
      if (invokeErr || result?.error) {
        throw new Error(result?.error || invokeErr?.message || "Erreur de paiement");
      }
      toast.success(`Paiement de ${displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} accepté!`);
      setCardForm({ card_number: "", card_expiry: "", cvv: "", card_name: "" });
      handlePaymentSuccess();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement par carte");
    } finally {
      setCardPaymentLoading(false);
    }
  };

  const handlePrimaryPayNow = () => {
    if (!unpaidInvoices?.length) { handleTabChange("pay-invoice"); return; }
    setShowInteracDialog(true);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["billing-hub-unpaid"] });
    queryClient.invalidateQueries({ queryKey: ["billing-hub-all-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["ledger-balance"] });
    queryClient.invalidateQueries({ queryKey: ["client-invoice-breakdowns"] });
    queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["pending-invoices-canonical"] });
  };

  const balance = ledger?.balance ?? 0;
  const isCredit = balance < 0;
  const displayBalance = Math.abs(balance);
  const unpaidCount = unpaidInvoices?.length ?? 0;

  return (
    <ClientLayout>
      <div className="space-y-6">
        <ClientPayBalanceCard />

        {/* Auto-pay status / activation — sits above the invoice list */}
        <ClientPaymentMethodCard />

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Facturation et paiement
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos factures, effectuez des paiements et ajoutez du crédit
          </p>
        </div>

        {/* Balance Overview Card */}
        <Card className={`border-2 ${!isCredit && balance > 0 ? 'border-amber-500/30 bg-amber-50/30' : isCredit ? 'border-primary/30 bg-primary/5' : 'border-emerald-500/30 bg-emerald-50/30'}`}>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  isCredit ? 'bg-primary/20' : balance > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                }`}>
                  {isCredit ? (
                    <Wallet className="w-7 h-7 text-primary" />
                  ) : (
                    <DollarSign className={`w-7 h-7 ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isCredit ? "Crédit disponible" : balance > 0 ? "Solde à payer" : "Compte à jour"}
                  </p>
                  <p className={`text-3xl font-bold ${
                    isCredit ? 'text-primary' : balance > 0 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                {balance > 0 && (
                  <Button
                    onClick={writeGuard(handlePrimaryPayNow)}
                    disabled={writeGuard.isReadOnly || payingBalance}
                    title={writeGuard.disabledReason}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {`Payer le solde (${displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })})`}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleTabChange("add-credit")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un crédit
                </Button>
              </div>
            </div>
            {ledger?.lastPaymentDate && (
              <div className="mt-4 pt-3 border-t border-border/50 text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Dernier paiement: {ledger.lastPaymentAmount?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} le {format(new Date(ledger.lastPaymentDate), "d MMMM yyyy", { locale: fr })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="pay-invoice" className="gap-2 text-xs sm:text-sm py-2.5">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Payer une facture</span>
              <span className="sm:hidden">Payer</span>
              {unpaidCount > 0 && (
                <Badge className="bg-amber-500 text-white text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                  {unpaidCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="add-credit" className="gap-2 text-xs sm:text-sm py-2.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ajouter un crédit</span>
              <span className="sm:hidden">Crédit</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2 text-xs sm:text-sm py-2.5">
              <FileText className="w-4 h-4" />
              Factures
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm py-2.5">
              <Receipt className="w-4 h-4" />
              Historique
            </TabsTrigger>
            <TabsTrigger value="card-payment" className="gap-2 text-xs sm:text-sm py-2.5">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Payer par carte</span>
              <span className="sm:hidden">Carte</span>
            </TabsTrigger>
          </TabsList>

          {/* ─── PAY INVOICE TAB ─── */}
          <TabsContent value="pay-invoice" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Factures à payer</h2>
                {unpaidCount > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {unpaidCount} facture{unpaidCount > 1 ? 's' : ''} en attente
                  </Badge>
                )}
              </div>

              {unpaidLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4 h-24" />
                    </Card>
                  ))}
                </div>
              ) : unpaidCount === 0 ? (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-foreground mb-1">Tout est à jour!</h3>
                    <p className="text-sm text-muted-foreground">
                      Aucune facture en attente de paiement.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {unpaidInvoices?.map((invoice) => {
                    const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();
                    const balanceDue = invoice.balance_due;

                    return (
                      <Card
                        key={invoice.id}
                        className={`border transition-all hover:shadow-md ${
                          isOverdue ? 'border-red-300 bg-red-50/30' : 'border-border'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-semibold text-foreground">
                                  {invoice.invoice_number}
                                </span>
                                <Badge className={STATUS_COLORS[invoice.status] || STATUS_COLORS.pending}>
                                  {isOverdue ? "Renouvellement requis" : STATUS_LABELS[invoice.status] || invoice.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {invoice.due_date && (
                                  <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                                    <Clock className="w-3.5 h-3.5" />
                                    Échéance: {format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })}
                                  </span>
                                )}
                                <span>
                                  Total: {Number(invoice.total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-xs text-muted-foreground">Solde dû</p>
                                <p className="text-xl font-bold text-foreground">
                                  {balanceDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => clientPDF.view("invoice", invoice.id)}
                                title="Voir la facture PDF"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handlePayInvoice(invoice)}
                                className="whitespace-nowrap"
                              >
                                <CreditCard className="w-4 h-4 mr-2" />
                                Payer
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── ADD CREDIT TAB ─── */}
          <TabsContent value="add-credit" className="mt-6">
            {user?.id && (
              <AddAccountCredit
                userId={user.id}
                userEmail={profile?.email}
                currentBalance={balance}
                onPaymentSuccess={handlePaymentSuccess}
              />
            )}
          </TabsContent>

          {/* ─── ALL INVOICES TAB ─── */}
          <TabsContent value="invoices" className="mt-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Toutes les factures</h2>
              {allLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4 h-16" />
                    </Card>
                  ))}
                </div>
              ) : !allInvoices || allInvoices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Aucune facture trouvée.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {allInvoices.map((inv: any) => {
                    const isPaid = inv.status === "paid" || inv.status === "paid_by_promo";
                    return (
                      <Card key={inv.id} className="border-border">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isPaid ? 'bg-emerald-500/15' : 'bg-amber-500/15'
                              }`}>
                                {isPaid ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Clock className="w-4 h-4 text-amber-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
                                  <Badge className={`${STATUS_COLORS[inv.status] || 'bg-muted text-muted-foreground'} text-xs`}>
                                    {STATUS_LABELS[inv.status] || inv.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => clientPDF.view("invoice", inv.id)}
                                title="Voir PDF"
                              >
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <div className="text-right">
                                <p className="font-semibold text-foreground">
                                  {Number(inv.total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </p>
                                {!isPaid && Number(inv.balance_due) > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-1 text-xs h-7"
                                    onClick={() => handlePayInvoice(inv)}
                                  >
                                    Payer
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── PAYMENT HISTORY TAB ─── */}
          <TabsContent value="history" className="mt-6">
            {user?.id && <PaymentHistoryV2 userId={user.id} />}
          </TabsContent>

          {/* ─── CARD PAYMENT TAB ─── */}
          <TabsContent value="card-payment" className="mt-6">
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Paiement sécurisé par carte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {balance <= 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">Aucun solde à payer.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      Solde à payer: <strong>{displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</strong>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="card_name">Nom sur la carte</Label>
                      <Input
                        id="card_name"
                        placeholder="Jean Tremblay"
                        value={cardForm.card_name}
                        onChange={e => setCardForm(f => ({ ...f, card_name: e.target.value }))}
                        autoComplete="cc-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="card_number">Numéro de carte</Label>
                      <Input
                        id="card_number"
                        placeholder="XXXX XXXX XXXX XXXX"
                        value={cardForm.card_number}
                        onChange={e => setCardForm(f => ({ ...f, card_number: formatCardNumber(e.target.value) }))}
                        maxLength={19}
                        inputMode="numeric"
                        autoComplete="cc-number"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="card_expiry">Expiration (MM/AA)</Label>
                        <Input
                          id="card_expiry"
                          placeholder="MM/AA"
                          value={cardForm.card_expiry}
                          onChange={e => setCardForm(f => ({ ...f, card_expiry: formatExpiry(e.target.value) }))}
                          maxLength={5}
                          inputMode="numeric"
                          autoComplete="cc-exp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv">CVV</Label>
                        <Input
                          id="cvv"
                          placeholder="123"
                          value={cardForm.cvv}
                          onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                          maxLength={4}
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          type="password"
                        />
                      </div>
                    </div>
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={writeGuard(handleCardPayment)}
                      disabled={writeGuard.isReadOnly || cardPaymentLoading}
                      title={writeGuard.disabledReason}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      {cardPaymentLoading
                        ? "Traitement en cours…"
                        : `Payer ${displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} par carte`}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Paiement chiffré SSL — Square PCI-DSS
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Pay Invoice Dialog */}
        <PayInvoiceDialog
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
          invoice={payingInvoice}
          totalDue={payingInvoice?.balance_due || 0}
          profile={profile}
          onPaymentSuccess={handlePaymentSuccess}
        />

        {/* Interac balance payment dialog */}
        <Dialog open={showInteracDialog} onOpenChange={setShowInteracDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Payer par virement Interac
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">Solde total à payer</p>
                <p className="text-2xl font-bold text-amber-600">
                  {displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
                {[
                  { label: "Adresse courriel", value: "support@nivra-telecom.ca" },
                  { label: "Montant", value: displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold">{value}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copié !`); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Réponse à la question de sécurité</p>
                    <p className="text-sm font-bold">{interacAccountNumber}</p>
                    <p className="text-xs text-amber-600 mt-0.5">⚠️ Utilisez exactement ce numéro</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(String(interacAccountNumber)); toast.success("Numéro copié !"); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
                Traitement automatique — votre paiement sera appliqué à votre compte une fois reçu.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ClientLayout>
  );
};

export default ClientBillingHub;
