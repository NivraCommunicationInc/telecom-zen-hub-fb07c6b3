import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { FileText, Download, CreditCard, DollarSign, Copy, CheckCircle, Banknote, AlertTriangle, Clock, Calendar } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { generateInvoicePDF, type InvoiceDataV2 } from "@/lib/pdf";
import { safePDFDownload } from "@/lib/pdfUtils";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import ClientBalanceSummary from "@/components/client/ClientBalanceSummary";
import PaymentDisputeDialog from "@/components/client/PaymentDisputeDialog";
import PaymentDisputeTimeline from "@/components/client/PaymentDisputeTimeline";
import PaymentHistoryV2 from "@/components/client/PaymentHistoryV2";
import MobileInvoiceCard from "@/components/client/MobileInvoiceCard";
import PayInvoiceDialog from "@/components/client/PayInvoiceDialog";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useIsMobile } from "@/hooks/use-mobile";

const ClientInvoices = () => {
  const { user } = useClientAuth();
  const { data: siteSettings } = useSiteSettings();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("invoices");
  const [filterTab, setFilterTab] = useState("all");

  // PDF Viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Dispute state
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputePayment, setDisputePayment] = useState<any>(null);

  // Pay invoice dialog state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<any>(null);

  // Fetch client profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("balance, store_credit, account_status, full_name, email, phone, client_number, account_number, service_address, service_city")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // UNIFIED QUERY: Fetch from BOTH legacy "billing" AND V2 "billing_invoices"
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["client-invoices-all", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const allInvoices: any[] = [];

      // 1. LEGACY: billing table
      const { data: legacyData, error: legacyError } = await portalSupabase
        .from("billing")
        .select(`*, orders:order_id (order_number, service_type, equipment_details)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (legacyError) console.error("[ClientInvoices] Legacy billing query error:", legacyError);
      if (legacyData) {
        for (const inv of legacyData) {
          const isOverdue = inv.status === "pending" && inv.due_date && isPast(parseISO(inv.due_date)) && !inv.late_fee_applied;
          allInvoices.push({ ...inv, _source: "legacy", needsLateFee: isOverdue });
        }
      }

      // 2. V2: billing_invoices table
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (customer) {
        const { data: v2Data, error: v2Error } = await portalSupabase
          .from("billing_invoices")
          .select(`*, billing_customers!inner (user_id, email, first_name, last_name)`)
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false });
        if (v2Error) console.error("[ClientInvoices] V2 billing_invoices query error:", v2Error);
        if (v2Data) {
          for (const inv of v2Data) {
            const isOverdue = inv.status !== "paid" && inv.due_date && isPast(parseISO(inv.due_date));
            allInvoices.push({
              id: inv.id, user_id: user.id, invoice_number: inv.invoice_number,
              amount: Number(inv.total) || 0, subtotal: Number(inv.total) || 0,
              fees: Number(inv.fees) || 0, credits: 0,
              amount_paid: Number(inv.amount_paid) || 0, balance_due: Number(inv.balance_due) || 0,
              status: isOverdue && inv.status !== "paid" ? "overdue" : inv.status,
              due_date: inv.due_date, paid_at: inv.paid_at, created_at: inv.created_at,
              notes: inv.notes, related_order_number: inv.related_order_number,
              _source: "v2", needsLateFee: isOverdue && !inv.late_fee_applied,
            });
          }
        }
      }
      allInvoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return allInvoices;
    },
    enabled: !!user?.id,
  });

  const filteredInvoices = invoices?.filter((inv: any) => {
    if (filterTab === "all") return true;
    return inv.status === filterTab;
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    paid: "bg-emerald-100 text-emerald-700",
    overdue: "bg-red-100 text-red-700",
    pre_authorized: "bg-blue-100 text-blue-700",
    renewal_due: "bg-orange-100 text-orange-700",
    in_verification: "bg-teal-100 text-teal-700",
    expired: "bg-red-100 text-red-700",
    partial: "bg-orange-100 text-orange-700",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    paid: "Payé",
    overdue: "Renouvellement requis",
    pre_authorized: "Pré-autorisé",
    renewal_due: "Renouvellement dû",
    in_verification: "En vérification (grâce 24h)",
    expired: "Expiré (non renouvelé)",
    partial: "Paiement partiel",
    void: "Annulé",
    not_renewed: "Non renouvelé",
  };

  const calculateTotal = (inv: any) => {
    const base = Number(inv.amount) || 0;
    const fees = Number(inv.fees) || 0;
    const credits = Number(inv.credits) || 0;
    let lateFee = 0;
    if (inv.status === "overdue" || (inv.due_date && isPast(parseISO(inv.due_date)) && inv.status !== "paid")) {
      if (!inv.late_fee_applied) lateFee = base * 0.05;
    }
    return base + fees + lateFee - credits;
  };

  const getBalanceDue = (inv: any) => {
    if (inv?.balance_due !== null && inv?.balance_due !== undefined) {
      const explicit = Number(inv.balance_due);
      if (Number.isFinite(explicit)) return Math.max(0, explicit);
    }
    const total = Number(inv?.total ?? inv?.amount) || 0;
    const amountPaid = Number(inv?.amount_paid) || 0;
    return Math.max(0, total - amountPaid);
  };

  const isInvoiceOpen = (inv: any) => {
    const status = String(inv?.status || "").toLowerCase();
    if (["paid", "void", "cancelled", "refunded"].includes(status)) return false;
    return getBalanceDue(inv) > 0;
  };

  // Create invoice data for PDF generation
  const createInvoiceData = useCallback((inv: any): InvoiceDataV2 => {
    const isOverdue = inv.due_date && isPast(parseISO(inv.due_date)) && inv.status !== "paid";
    const orderData = inv.orders;
    const equipmentDetails = orderData?.equipment_details;
    const lineItems = equipmentDetails?.line_items || [];
    const subtotal = Number(inv.subtotal || inv.amount) || 0;
    const tps = Number(inv.tps_amount) || 0;
    const tvq = Number(inv.tvq_amount) || 0;
    const total = subtotal + tps + tvq;

    return {
      invoice_type: "ONETIME",
      invoice_number: inv.invoice_number || `NVR-INV-QC-${new Date().getFullYear()}-${inv.id?.slice(0, 5).toUpperCase()}`,
      account_number: profile?.account_number || profile?.client_number || "000000",
      invoice_date: inv.created_at,
      due_date: inv.due_date,
      currency: "CAD",
      status: isOverdue && inv.status !== "paid" ? "overdue" : inv.status,
      customer: {
        full_name: profile?.full_name || "Client",
        email: profile?.email || user?.email || "",
        phone: profile?.phone,
        address_line1: profile?.service_address || "",
        city: profile?.service_city || "",
        province: "QC",
        postal_code: "",
      },
      items: lineItems.length > 0 ? lineItems.map((li: any) => ({
        category: "Equipment",
        description: li.name || li.description || "Article",
        qty: li.qty || 1,
        unit_price: Number(li.price || li.unit_price) || 0,
        amount: Number(li.total || li.line_total) || 0,
        is_recurring: false,
      })) : [{
        category: "Other",
        description: inv.notes || "Services télécom",
        qty: 1,
        unit_price: subtotal,
        amount: subtotal,
        is_recurring: false,
      }],
      subtotal,
      taxes: { gst_rate: 0.05, gst_amount: tps, qst_rate: 0.09975, qst_amount: tvq },
      total,
      balance_due: inv.status === "paid" ? 0 : total,
      payments: inv.paid_at ? [{ method: "Manual", status: "Captured", paid_amount: total, paid_at: inv.paid_at, payment_reference: inv.payment_reference }] : [],
      payments_total: inv.paid_at ? total : 0,
    };
  }, [profile, user?.email]);

  // Open PDF in viewer dialog
  const handleViewPDF = useCallback(async (inv: any) => {
    try {
      setPdfLoading(true);
      setPdfViewerOpen(true);
      setPdfTitle(`Facture ${inv.invoice_number || inv.id?.slice(0, 8).toUpperCase()}`);
      setPdfFilename(`Facture_${inv.invoice_number || inv.id?.slice(0, 8)}.pdf`);
      const invoiceData = createInvoiceData(inv);
      const result = await generateInvoicePDF(invoiceData);
      if (result.success && result.blob) {
        setPdfBlob(result.blob);
      } else {
        throw new Error(result.error);
      }
      setPdfLoading(false);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur lors de la génération du PDF");
      setPdfLoading(false);
      setPdfViewerOpen(false);
    }
  }, [createInvoiceData]);

  // Download PDF
  const handleDownloadPDF = useCallback(async (inv: any) => {
    try {
      const invoiceData = createInvoiceData(inv);
      const result = await generateInvoicePDF(invoiceData);
      if (result.success && result.blob && result.filename) {
        safePDFDownload(result.blob, result.filename);
      } else {
        throw new Error(result.error);
      }
      toast.success("Facture téléchargée");
    } catch (error) {
      console.error("PDF download error:", error);
      toast.error("Impossible de générer la facture. Réessayez.");
    }
  }, [createInvoiceData]);

  // Open pay dialog for a specific invoice
  const handlePayInvoice = (inv: any) => {
    setPayingInvoice(inv);
    setPayDialogOpen(true);
  };

  // Pay the first pending invoice (header button)
  const handlePayClick = () => {
    const firstPending = pendingInvoices[0];
    if (firstPending) {
      handlePayInvoice(firstPending);
    } else {
      navigate("/portal/payments");
    }
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["client-invoices-all"] });
    queryClient.invalidateQueries({ queryKey: ["client-profile"] });
  };

  // Pending invoices for summary section
  const pendingInvoices = invoices?.filter((inv: any) => isInvoiceOpen(inv)) || [];
  const totalDue = pendingInvoices.reduce((sum: number, inv: any) => sum + getBalanceDue(inv), 0);

  // Last payment info
  const lastPayment = invoices?.find((inv: any) => inv.status === "paid");
  const accountStatus =
    profile?.account_status === "deactivated"
      ? "deactivated"
      : profile?.account_status === "frozen"
        ? "frozen"
        : profile?.account_status === "hold"
          ? "hold"
          : "active";

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Facturation et paiement</h1>
            <p className="text-slate-500 mt-1">Consultez vos factures et historique de paiements</p>
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            onClick={handlePayClick}
          >
            <DollarSign className="w-4 h-4" />
            Faire un paiement
          </Button>
        </div>

        {/* Billing Cycle Info */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-slate-900 mb-1">Cycle de facturation prépayé (Bill Cycle)</p>
                <p className="text-slate-600 mb-2">
                  Votre cycle de facturation est basé sur votre <strong>Bill Cycle Day</strong> (jour du mois défini à la création de votre compte).
                </p>
                <ul className="text-slate-600 space-y-1 list-disc pl-4">
                  <li>La facture est émise <strong>5 jours avant</strong> votre Bill Cycle (J-5)</li>
                  <li>Le paiement doit être confirmé <strong>avant</strong> le Bill Cycle (J0) pour renouveler</li>
                  <li>Si non payé au J0, le service devient <strong>Expiré (non-renouvelé)</strong></li>
                  <li>E-Transfer en vérification au J0 : fenêtre de grâce de 24h max</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Solde dû */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-block px-2 py-1 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 mb-3">
                    Service prépayé = renouvellement seulement si paiement confirmé.
                  </div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">SOLDE DÛ</p>
                  <p className={`text-3xl font-bold mt-1 ${totalDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {totalDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                  {totalDue > 0 && (
                    <Button
                      size="sm"
                      className="mt-3 bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                      onClick={handlePayClick}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Renouveler
                    </Button>
                  )}
                </div>
                <DollarSign className={`w-8 h-8 ${totalDue > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
              </div>

              {/* Last payment */}
              {lastPayment && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Dernier paiement</span>
                  <span className="ml-auto font-medium text-slate-700">
                    {calculateTotal(lastPayment).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                  <span className="text-slate-400">
                    {format(new Date(lastPayment.paid_at || lastPayment.created_at), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              )}

              {/* Pending invoices list */}
              {pendingInvoices.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">Factures en attente ({pendingInvoices.length})</p>
                  <div className="space-y-2">
                    {pendingInvoices.slice(0, 3).map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700">{inv.invoice_number || inv.id.slice(0, 7)}</span>
                          <Badge className={statusColors[inv.status] || "bg-slate-100 text-slate-600"}>
                            {statusLabels[inv.status] || inv.status}
                          </Badge>
                        </div>
                        <span className="font-medium text-slate-900">
                          {getBalanceDue(inv).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Crédit disponible */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">CRÉDIT DISPONIBLE</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {Number(profile?.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statut du compte */}
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  accountStatus === 'active' ? 'bg-emerald-50' :
                  accountStatus === 'frozen' ? 'bg-blue-50' :
                  accountStatus === 'hold' ? 'bg-amber-50' : 'bg-red-50'
                }`}>
                  <CheckCircle className={`w-5 h-5 ${
                    accountStatus === 'active' ? 'text-emerald-600' :
                    accountStatus === 'frozen' ? 'text-blue-600' :
                    accountStatus === 'hold' ? 'text-amber-600' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">STATUT DU COMPTE</p>
                  <p className={`text-2xl font-bold ${
                    accountStatus === 'active' ? 'text-emerald-600' :
                    accountStatus === 'frozen' ? 'text-blue-600' :
                    accountStatus === 'hold' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {accountStatus === 'active' ? 'Actif' :
                     accountStatus === 'frozen' ? 'Gelé' :
                     accountStatus === 'hold' ? 'En attente' : 'Désactivé'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Factures / Paiements */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-white border border-slate-200">
            <TabsTrigger value="invoices" className="flex items-center gap-2 data-[state=active]:bg-slate-100">
              <FileText className="w-4 h-4" />
              Factures
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2 data-[state=active]:bg-slate-100">
              <DollarSign className="w-4 h-4" />
              Paiements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <FileText className="w-5 h-5 text-teal-600" />
                    Mes factures
                  </CardTitle>
                  <Tabs value={filterTab} onValueChange={setFilterTab}>
                    <TabsList className="h-auto flex-wrap bg-slate-50 border border-slate-200">
                      <TabsTrigger value="all" className="text-xs sm:text-sm">Toutes</TabsTrigger>
                      <TabsTrigger value="pending" className="text-xs sm:text-sm">En attente</TabsTrigger>
                      <TabsTrigger value="paid" className="text-xs sm:text-sm">Payées</TabsTrigger>
                      <TabsTrigger value="overdue" className="text-xs sm:text-sm">À renouveler</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : filteredInvoices && filteredInvoices.length > 0 ? (
                  <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                      {filteredInvoices.map((inv: any) => (
                        <MobileInvoiceCard
                          key={inv.id}
                          invoice={inv}
                          statusLabels={statusLabels}
                          statusColors={statusColors}
                          calculateTotal={calculateTotal}
                          onViewPDF={handleViewPDF}
                          onDownloadPDF={handleDownloadPDF}
                          onPreview={handleViewPDF}
                          onPay={(inv) => handlePayInvoice(inv)}
                          onDispute={(inv) => {
                            setDisputePayment(inv);
                            setDisputeDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Nº</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Date</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Montant</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Frais</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Crédits</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Total</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Solde dû</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Échéance</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Statut</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInvoices.map((inv: any) => {
                            const isOverdue = inv.due_date && isPast(parseISO(inv.due_date)) && isInvoiceOpen(inv);
                            const total = calculateTotal(inv);
                            const lateFeeAmount = isOverdue && !inv.late_fee_applied ? Number(inv.amount) * 0.05 : 0;

                            return (
                              <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4 text-sm font-mono font-semibold text-slate-900">
                                  {inv.invoice_number || inv.id.slice(0, 8)}
                                </td>
                                <td className="py-3 px-4 text-sm text-slate-600">
                                  {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                                </td>
                                <td className="py-3 px-4 text-sm text-slate-900">
                                  {Number(inv.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {(Number(inv.fees || 0) + lateFeeAmount) > 0 ? (
                                    <span className="text-amber-600">
                                      +{(Number(inv.fees || 0) + lateFeeAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                      {lateFeeAmount > 0 && <span className="text-xs block text-red-600">(+5% retard)</span>}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {Number(inv.credits || 0) > 0 ? (
                                    <span className="text-emerald-600">
                                      -{Number(inv.credits || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-sm font-medium text-slate-900">
                                  {total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {getBalanceDue(inv) <= 0 ? (
                                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      0,00 $
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 font-medium">
                                      {getBalanceDue(inv).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-sm text-slate-600">
                                  <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                    {inv.due_date ? format(new Date(inv.due_date), "d MMM yyyy", { locale: fr }) : "—"}
                                    {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge className={statusColors[isOverdue ? "overdue" : inv.status] || "bg-slate-100 text-slate-600"}>
                                    {isOverdue ? statusLabels.overdue : statusLabels[inv.status] || inv.status}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-1.5">
                                    {/* Pay — only for unpaid invoices */}
                                    {isInvoiceOpen(inv) && (
                                      <Button
                                        size="sm"
                                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                                        onClick={() => handlePayInvoice(inv)}
                                        title="Payer cette facture"
                                      >
                                        <DollarSign className="w-3.5 h-3.5 mr-1" />
                                        Payer
                                      </Button>
                                    )}
                                    {/* View PDF */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0 border-slate-200"
                                      onClick={() => handleViewPDF(inv)}
                                      title="Voir la facture PDF"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </Button>
                                    {/* Download PDF */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0 border-slate-200"
                                      onClick={() => handleDownloadPDF(inv)}
                                      title="Télécharger PDF"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </Button>
                                    {/* Dispute (only for paid) */}
                                    {inv.status === "paid" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 w-8 p-0 border-amber-200 text-amber-600 hover:bg-amber-50"
                                        onClick={() => {
                                          setDisputePayment(inv);
                                          setDisputeDialogOpen(true);
                                        }}
                                        title="Contester"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Aucune facture pour le moment</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            {user?.id && <PaymentHistoryV2 userId={user.id} />}
          </TabsContent>
        </Tabs>

        {/* Disputes Timeline */}
        <PaymentDisputeTimeline />

        {/* Dispute Dialog */}
        <PaymentDisputeDialog
          open={disputeDialogOpen}
          onOpenChange={setDisputeDialogOpen}
          payment={disputePayment}
        />

        {/* PDF Viewer Dialog */}
        <PDFViewerDialog
          open={pdfViewerOpen}
          onOpenChange={setPdfViewerOpen}
          pdfBlob={pdfBlob}
          title={pdfTitle}
          filename={pdfFilename}
          isLoading={pdfLoading}
        />

        {/* Pay Invoice Dialog */}
        <PayInvoiceDialog
          open={payDialogOpen}
          onOpenChange={setPayDialogOpen}
          invoice={payingInvoice}
          totalDue={payingInvoice ? calculateTotal(payingInvoice) : 0}
          profile={profile}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </ClientLayout>
  );
};

export default ClientInvoices;
