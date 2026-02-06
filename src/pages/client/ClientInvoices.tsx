import { useState, useCallback } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { FileText, Download, CreditCard, DollarSign, Eye, Copy, CheckCircle, Banknote, AlertTriangle, Printer, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { downloadInvoicePDF, getInvoicePDFBlob, type InvoiceData } from "@/lib/pdfEngine";
import { safePDFPrint } from "@/lib/pdfUtils";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import ClientBalanceSummary from "@/components/client/ClientBalanceSummary";
import PaymentDisputeDialog from "@/components/client/PaymentDisputeDialog";
import PaymentDisputeTimeline from "@/components/client/PaymentDisputeTimeline";
import PaymentHistoryV2 from "@/components/client/PaymentHistoryV2";
import MobileInvoiceCard from "@/components/client/MobileInvoiceCard";
import { ETRANSFER_CONFIG, COMPANY_CONTACT } from "@/config/company";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import PayPalButton from "@/components/payment/PayPalButton";
import { useIsMobile } from "@/hooks/use-mobile";

// E-transfer payment info
const ETRANSFER_INFO = {
  email: ETRANSFER_CONFIG.emailDisplay,
  question: "Nom du client ou nom de l'entreprise",
  answer: "Votre nom complet ou le nom de votre entreprise",
};

// Payment method type
type PaymentMethod = "etransfer" | "credit_card" | "paypal";

const ClientInvoices = () => {
  const { user } = useClientAuth();
  const { data: siteSettings } = useSiteSettings();
  const isMobile = useIsMobile();
  
  // Use site_settings as source of truth, COMPANY_CONTACT as fallback
  const supportPhone = siteSettings?.support_phone || COMPANY_CONTACT.supportPhoneDisplay;
  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const address = siteSettings?.address || COMPANY_CONTACT.fullAddress;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("invoices");
  const [filterTab, setFilterTab] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentInfoOpen, setPaymentInfoOpen] = useState(false);
  const [paymentDetailsOpen, setPaymentDetailsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [generalPaymentOpen, setGeneralPaymentOpen] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("etransfer");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [generalAmount, setGeneralAmount] = useState("");
  
  // PDF Viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // Dispute state
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputePayment, setDisputePayment] = useState<any>(null);

  // Fetch client profile for balance/credit info
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("balance, store_credit, account_status, full_name, email, phone, client_number, service_address, service_city")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // UNIFIED QUERY: Fetch from BOTH legacy "billing" AND V2 "billing_invoices"
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["client-invoices-all", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const allInvoices: any[] = [];
      
      // 1. LEGACY: billing table
      const { data: legacyData, error: legacyError } = await portalSupabase
        .from("billing")
        .select(`
          *,
          orders:order_id (
            order_number,
            service_type,
            equipment_details
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (legacyError) {
        console.error("[ClientInvoices] Legacy billing query error:", legacyError);
      }
      
      // Process legacy invoices
      if (legacyData) {
        for (const inv of legacyData) {
          const isOverdue = inv.status === "pending" && inv.due_date && isPast(parseISO(inv.due_date)) && !inv.late_fee_applied;
          allInvoices.push({
            ...inv,
            _source: "legacy",
            needsLateFee: isOverdue,
          });
        }
      }
      
      // 2. V2: billing_invoices table (via billing_customers)
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (customer) {
        const { data: v2Data, error: v2Error } = await portalSupabase
          .from("billing_invoices")
          .select(`
            *,
            billing_customers!inner (
              user_id,
              email,
              first_name,
              last_name
            )
          `)
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false });
        
        if (v2Error) {
          console.error("[ClientInvoices] V2 billing_invoices query error:", v2Error);
        }
        
        // Map V2 invoices to match legacy structure
        if (v2Data) {
          for (const inv of v2Data) {
            const isOverdue = inv.status !== "paid" && inv.due_date && isPast(parseISO(inv.due_date));
            allInvoices.push({
              id: inv.id,
              user_id: user.id,
              invoice_number: inv.invoice_number,
              amount: Number(inv.total) || 0,
              subtotal: Number(inv.total) || 0,
              fees: Number(inv.fees) || 0,
              credits: 0,
              amount_paid: Number(inv.amount_paid) || 0,
              balance_due: Number(inv.balance_due) || 0,
              status: isOverdue && inv.status !== "paid" ? "overdue" : inv.status,
              due_date: inv.due_date,
              paid_at: inv.paid_at,
              created_at: inv.created_at,
              notes: inv.notes,
              related_order_number: inv.related_order_number,
              // V2 source marker
              _source: "v2",
              needsLateFee: isOverdue && !inv.late_fee_applied,
            });
          }
        }
      }
      
      // Sort all by created_at descending
      allInvoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return allInvoices;
    },
    enabled: !!user?.id,
  });

  // UNIFIED QUERY: Fetch from BOTH legacy "payments" AND V2 "billing_payments"
  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ["client-payments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const allPayments: any[] = [];
      
      // 1. LEGACY: payments table
      const { data: legacyData, error: legacyError } = await portalSupabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (legacyError) {
        console.error("[ClientInvoices] Legacy payments query error:", legacyError);
      }
      
      if (legacyData) {
        for (const pay of legacyData) {
          allPayments.push({
            ...pay,
            _source: "legacy",
          });
        }
      }
      
      // 2. V2: billing_payments table (via billing_customers)
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (customer) {
        const { data: v2Data, error: v2Error } = await portalSupabase
          .from("billing_payments")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false });
        
        if (v2Error) {
          console.error("[ClientInvoices] V2 billing_payments query error:", v2Error);
        }
        
        // Map V2 payments to match legacy structure
        if (v2Data) {
          for (const pay of v2Data) {
            allPayments.push({
              id: pay.id,
              user_id: user.id,
              billing_id: pay.invoice_id,
              amount: Number(pay.amount) || 0,
              payment_method: pay.method || pay.provider,
              reference_number: pay.reference || pay.provider_payment_id,
              provider_payment_id: pay.provider_payment_id,
              status: pay.status === "confirmed" ? "completed" : pay.status,
              created_at: pay.created_at,
              notes: pay.notes,
              // V2 source marker
              _source: "v2",
            });
          }
        }
      }
      
      // Sort all by created_at descending
      allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return allPayments;
    },
    enabled: !!user?.id,
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async ({ 
      invoiceId, 
      amount, 
      method, 
      cardDetails,
      isGeneralPayment 
    }: { 
      invoiceId?: string; 
      amount: number; 
      method: PaymentMethod; 
      cardDetails?: { name: string; lastFour: string; type: string };
      isGeneralPayment?: boolean;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const referenceNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;

      // AUDIT TRAIL: Get client user info for self-service payments
      const clientName = profile?.full_name || user.email?.split('@')[0] || 'Client';
      
      // Create payment record
      const paymentData: any = {
        user_id: user.id,
        billing_id: invoiceId || null,
        amount,
        payment_method: method === "credit_card" ? "credit_card" : "etransfer",
        reference_number: referenceNumber,
        status: "completed",
        created_by_id: user.id,
        created_by_name: clientName,
        created_by_role: 'client',
        source: 'client_portal'
      };

      if (method === "credit_card" && cardDetails) {
        paymentData.card_last_four = cardDetails.lastFour;
        paymentData.card_type = cardDetails.type;
      }

      const { error: paymentError } = await portalSupabase
        .from("payments")
        .insert(paymentData);

      if (paymentError) throw paymentError;

      // Get current profile
      const { data: currentProfile } = await portalSupabase
        .from("profiles")
        .select("balance, store_credit")
        .eq("user_id", user.id)
        .maybeSingle();

      const currentBalance = Number(currentProfile?.balance || 0);
      const currentCredit = Number(currentProfile?.store_credit || 0);

      // If paying an invoice
      if (invoiceId && !isGeneralPayment) {
        const { data: invoice } = await portalSupabase
          .from("billing")
          .select("*")
          .eq("id", invoiceId)
          .maybeSingle();

        if (invoice) {
          const invoiceTotal = calculateTotal(invoice);
          const currentAmountPaid = Number(invoice.amount_paid) || 0;
          const newAmountPaid = currentAmountPaid + amount;
          
          if (newAmountPaid >= invoiceTotal) {
            // Full payment - mark as paid
            await portalSupabase
              .from("billing")
              .update({
                status: "paid",
                paid_at: new Date().toISOString(),
                amount_paid: invoiceTotal,
                notes: `${invoice.notes || ""}\n[Paiement reçu - ${method === "credit_card" ? `Carte ****${cardDetails?.lastFour}` : "Virement Interac"}] Réf: ${referenceNumber}`.trim(),
              })
              .eq("id", invoiceId);

            // If overpayment, add surplus to store credit
            if (newAmountPaid > invoiceTotal) {
              const surplus = newAmountPaid - invoiceTotal;
              await portalSupabase
                .from("profiles")
                .update({ store_credit: currentCredit + surplus })
                .eq("user_id", user.id);
            }
          } else {
            // Partial payment - update amount_paid and set status to partial
            await portalSupabase
              .from("billing")
              .update({
                status: "partial",
                amount_paid: newAmountPaid,
                notes: `${invoice.notes || ""}\n[Paiement partiel: $${amount.toFixed(2)} - ${method === "credit_card" ? `Carte ****${cardDetails?.lastFour}` : "Virement Interac"}] Réf: ${referenceNumber}`.trim(),
              })
              .eq("id", invoiceId);
          }
        }
      } else {
        // General payment without a specific invoice - add to store credit
        await portalSupabase
          .from("profiles")
          .update({ store_credit: currentCredit + amount })
          .eq("user_id", user.id);
      }

      return { referenceNumber, amount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-invoices-all"] });
      queryClient.invalidateQueries({ queryKey: ["client-payments"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      refetchInvoices();
      refetchPayments();
      refetchProfile();
      toast.success("Paiement effectué avec succès!");
      setPaymentInfoOpen(false);
      setGeneralPaymentOpen(false);
      resetPaymentForm();
    },
    onError: (error) => {
      console.error("Payment error:", error);
      toast.error("Erreur lors du paiement");
    },
  });

  const resetPaymentForm = () => {
    setPaymentMethod("etransfer");
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setCardName("");
    setCustomAmount("");
    setGeneralAmount("");
  };

  const filteredInvoices = invoices?.filter((inv: any) => {
    if (filterTab === "all") return true;
    return inv.status === filterTab;
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-500",
    paid: "bg-emerald-500/20 text-emerald-500",
    overdue: "bg-red-500/20 text-red-500",
    pre_authorized: "bg-blue-500/20 text-blue-500",
    renewal_due: "bg-orange-500/20 text-orange-500",
    in_verification: "bg-cyan-500/20 text-cyan-500",
    expired: "bg-red-600/20 text-red-600",
    suspended: "bg-red-500/20 text-red-500",
    partial: "bg-orange-500/20 text-orange-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    paid: "Payé",
    overdue: "Paiement en retard (Overdue)",
    pre_authorized: "Pré-autorisé",
    renewal_due: "Renouvellement dû",
    in_verification: "En vérification (grâce 24h)",
    expired: "Expiré (non-renouvelé)",
    suspended: "Service en suspension",
    partial: "Paiement partiel",
  };

  const calculateTotal = (inv: any) => {
    const base = Number(inv.amount) || 0;
    const fees = Number(inv.fees) || 0;
    const credits = Number(inv.credits) || 0;
    // Add 5% late fee if overdue and not already applied
    let lateFee = 0;
    if (inv.status === "overdue" || (inv.due_date && isPast(parseISO(inv.due_date)) && inv.status !== "paid")) {
      if (!inv.late_fee_applied) {
        lateFee = base * 0.05;
      }
    }
    return base + fees + lateFee - credits;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  // Create invoice data for PDF generation
  const createInvoiceData = useCallback((inv: any): InvoiceData => {
    const isOverdue = inv.due_date && isPast(parseISO(inv.due_date)) && inv.status !== "paid";
    
    // Extract line items from joined order data
    const orderData = inv.orders;
    const equipmentDetails = orderData?.equipment_details;
    const lineItems = equipmentDetails?.line_items || [];
    
    return {
      invoiceNumber: inv.invoice_number || `NVR-INV-QC-${new Date().getFullYear()}-${inv.id?.slice(0, 5).toUpperCase()}`,
      orderNumber: inv.related_order_number || orderData?.order_number,
      paymentReference: inv.payment_reference,
      clientNumber: profile?.client_number,
      clientName: profile?.full_name || "Client",
      clientEmail: profile?.email || user?.email || "",
      clientPhone: profile?.phone,
      clientAddress: profile?.service_address,
      clientCity: profile?.service_city,
      subtotal: Number(inv.subtotal || inv.amount) || 0,
      fees: Number(inv.fees) || 0,
      credits: Number(inv.credits) || 0,
      deliveryFee: Number(inv.delivery_fee) || 0,
      activationFee: Number(inv.activation_fee) || 0,
      installationFee: Number(inv.installation_fee) || 0,
      discountAmount: Number(inv.discount_amount) || 0,
      preauthDiscount: Number(inv.preauth_discount) || 0,
      tpsAmount: Number(inv.tps_amount) || 0,
      tvqAmount: Number(inv.tvq_amount) || 0,
      lateFeeAmount: Number(inv.late_fee_amount) || 0,
      dueDate: inv.due_date,
      createdAt: inv.created_at,
      status: isOverdue && inv.status !== "paid" ? "overdue" : inv.status,
      paidAt: inv.paid_at,
      notes: inv.notes,
      equipmentId: inv.equipment_id,
      // CRITICAL: Pass order line items for multi-service support
      orderLineItems: lineItems.length > 0 ? lineItems : undefined,
      // Pass site settings for PDF generation
      siteSettings: siteSettings ? {
        support_phone: siteSettings.support_phone,
        support_email: siteSettings.support_email,
        address: siteSettings.address,
        business_hours: siteSettings.business_hours,
      } : undefined,
    } as any; // Cast to any to allow extended interface
  }, [profile, user?.email, siteSettings]);

  // Open PDF in viewer dialog
  const handleViewPDF = useCallback((inv: any) => {
    try {
      setPdfLoading(true);
      setPdfViewerOpen(true);
      setPdfTitle(`Facture ${inv.invoice_number || inv.id?.slice(0, 8).toUpperCase()}`);
      setPdfFilename(`Facture_${inv.invoice_number || inv.id?.slice(0, 8)}.pdf`);
      
      // Generate PDF blob
      const invoiceData = createInvoiceData(inv);
      const blob = getInvoicePDFBlob(invoiceData);
      setPdfBlob(blob);
      setPdfLoading(false);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Erreur lors de la génération du PDF");
      setPdfLoading(false);
      setPdfViewerOpen(false);
    }
  }, [createInvoiceData]);

  // Download PDF directly (no popup, no new tab)
  const handleDownloadPDF = useCallback((inv: any) => {
    try {
      const invoiceData = createInvoiceData(inv);
      downloadInvoicePDF(invoiceData);
      toast.success("Facture téléchargée");
    } catch (error) {
      console.error("PDF download error:", error);
      toast.error("Impossible de générer la facture. Réessayez.");
    }
  }, [createInvoiceData]);

  const handlePayClick = (invoice: any) => {
    setSelectedInvoice(invoice);
    setCustomAmount(calculateTotal(invoice).toString());
    setPaymentInfoOpen(true);
  };

  const handleViewPayment = (payment: any) => {
    setSelectedPayment(payment);
    setPaymentDetailsOpen(true);
  };

  const handleProcessPayment = async (isInvoicePayment: boolean) => {
    setIsProcessing(true);
    try {
      const amount = Number(isInvoicePayment ? customAmount : generalAmount);
      if (amount <= 0) {
        toast.error("Montant invalide");
        return;
      }

      let cardDetails;
      if (paymentMethod === "credit_card") {
        if (!cardName || !cardNumber || !cardExpiry || !cardCvc) {
          toast.error("Veuillez remplir tous les champs de carte");
          return;
        }
        const cardNum = cardNumber.replace(/\s/g, "");
        cardDetails = {
          name: cardName,
          lastFour: cardNum.slice(-4),
          type: cardNum.startsWith("4") ? "Visa" : cardNum.startsWith("5") ? "Mastercard" : "Card",
        };
      }

      await processPaymentMutation.mutateAsync({
        invoiceId: isInvoicePayment ? selectedInvoice?.id : undefined,
        amount,
        method: paymentMethod,
        cardDetails,
        isGeneralPayment: !isInvoicePayment,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Facturation & Paiements</h1>
            <p className="text-muted-foreground mt-1">Consultez vos factures et historique de paiements</p>
          </div>
          <Button variant="hero" onClick={() => {
            setGeneralAmount("");
            setGeneralPaymentOpen(true);
          }}>
            <DollarSign className="w-4 h-4 mr-2" />
            Envoyer un paiement
          </Button>
        </div>

        {/* Billing Cycle Info - Prepaid Rules */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Cycle de facturation prépayé (Bill Cycle)</p>
                <p className="text-muted-foreground mb-2">
                  Votre cycle de facturation est basé sur votre <strong>Bill Cycle Day</strong> (jour du mois défini à la création de votre compte).
                </p>
                <ul className="text-muted-foreground space-y-1 list-disc pl-4">
                  <li>La facture est émise <strong>5 jours avant</strong> votre Bill Cycle (J-5)</li>
                  <li>Le paiement doit être confirmé <strong>avant</strong> le Bill Cycle (J0) pour renouveler</li>
                  <li>Si non payé au J0, le service devient <strong>Expiré (non-renouvelé)</strong></li>
                  <li>E-Transfer en vérification au J0 : fenêtre de grâce de 24h max</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Summary - Derived from Invoices */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ClientBalanceSummary userId={user?.id || ""} userEmail={profile?.email} />
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Crédit disponible</p>
                  <p className="text-xl font-bold text-emerald-500">
                    {Number(profile?.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  profile?.account_status === 'active' ? 'bg-emerald-500/20' :
                  profile?.account_status === 'frozen' ? 'bg-blue-500/20' :
                  profile?.account_status === 'hold' ? 'bg-amber-500/20' : 'bg-red-500/20'
                }`}>
                  <CheckCircle className={`w-5 h-5 ${
                    profile?.account_status === 'active' ? 'text-emerald-500' :
                    profile?.account_status === 'frozen' ? 'text-blue-500' :
                    profile?.account_status === 'hold' ? 'text-amber-500' : 'text-red-500'
                  }`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Statut du compte</p>
                  <p className={`text-xl font-bold ${
                    profile?.account_status === 'active' ? 'text-emerald-500' :
                    profile?.account_status === 'frozen' ? 'text-blue-500' :
                    profile?.account_status === 'hold' ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {profile?.account_status === 'active' ? 'Actif' :
                     profile?.account_status === 'frozen' ? 'Gelé' :
                     profile?.account_status === 'hold' ? 'En attente' : 'Désactivé'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                    <TabsList className="h-auto flex-wrap">
                      <TabsTrigger value="all" className="text-xs sm:text-sm">Toutes</TabsTrigger>
                      <TabsTrigger value="pending" className="text-xs sm:text-sm">En attente</TabsTrigger>
                      <TabsTrigger value="paid" className="text-xs sm:text-sm">Payées</TabsTrigger>
                      <TabsTrigger value="overdue" className="text-xs sm:text-sm">En retard</TabsTrigger>
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
                          onPreview={(inv) => {
                            setPreviewInvoice(inv);
                            setInvoicePreviewOpen(true);
                          }}
                          onPay={handlePayClick}
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
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nº</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Frais</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Crédits</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solde dû</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Échéance</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInvoices.map((inv: any) => {
                            const isOverdue = inv.due_date && isPast(parseISO(inv.due_date)) && inv.status !== "paid";
                            const total = calculateTotal(inv);
                            const lateFeeAmount = isOverdue && !inv.late_fee_applied ? Number(inv.amount) * 0.05 : 0;
                            
                            return (
                              <tr key={inv.id} className="border-b border-border/50 hover:bg-accent/50">
                                <td className="py-3 px-4 text-sm font-mono text-foreground">
                                  {inv.invoice_number || inv.id.slice(0, 8)}
                                </td>
                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                  {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                                </td>
                                <td className="py-3 px-4 text-sm text-foreground">
                                  {Number(inv.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {(Number(inv.fees || 0) + lateFeeAmount) > 0 ? (
                                    <span className="text-amber-500">
                                      +{(Number(inv.fees || 0) + lateFeeAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                      {lateFeeAmount > 0 && (
                                        <span className="text-xs block text-red-500">(+5% retard)</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {Number(inv.credits || 0) > 0 ? (
                                    <span className="text-emerald-500">
                                      -{Number(inv.credits || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-sm font-medium text-foreground">
                                  {total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {/* Solde dû column */}
                                  {inv.balance_due !== null && inv.balance_due !== undefined ? (
                                    Number(inv.balance_due) <= 0 ? (
                                      <span className="text-emerald-500 font-medium flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        0,00 $
                                      </span>
                                    ) : (
                                      <span className="text-amber-500 font-medium">
                                        {Number(inv.balance_due).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                  <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                                    {inv.due_date ? format(new Date(inv.due_date), "d MMM yyyy", { locale: fr }) : "—"}
                                    {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex flex-wrap gap-1">
                                    <Badge className={statusColors[isOverdue && inv.status !== "paid" ? "overdue" : inv.status] || "bg-muted"}>
                                      {isOverdue && inv.status !== "paid" ? "En retard" : statusLabels[inv.status] || inv.status}
                                    </Badge>
                                    {inv.preauth_discount_applied && (
                                      <Badge className="bg-emerald-500/20 text-emerald-500 text-xs">
                                        -5$/mois
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleViewPDF(inv)}
                                      title="Voir PDF"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleDownloadPDF(inv)}
                                      title="Télécharger PDF"
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setPreviewInvoice(inv);
                                        setInvoicePreviewOpen(true);
                                      }}
                                      title="Aperçu rapide"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    {/* Pay button: disabled if already paid OR balance_due <= 0 */}
                                    {inv.status !== "paid" && (Number(inv.balance_due) > 0 || inv.balance_due === null || inv.balance_due === undefined) && (
                                      <Button 
                                        size="sm" 
                                        variant="hero" 
                                        onClick={() => handlePayClick(inv)}
                                        disabled={Number(inv.balance_due) <= 0 && inv.balance_due !== null && inv.balance_due !== undefined}
                                      >
                                        <DollarSign className="w-4 h-4 mr-1" />
                                        Payer
                                      </Button>
                                    )}
                                    {/* Show "Paid" badge when balance is 0 but status not yet updated */}
                                    {inv.status !== "paid" && Number(inv.balance_due) <= 0 && inv.balance_due !== null && inv.balance_due !== undefined && (
                                      <Badge className="bg-emerald-500/20 text-emerald-500">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Payé
                                      </Badge>
                                    )}
                                    {inv.status === "paid" && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
                                        onClick={() => {
                                          setDisputePayment(inv);
                                          setDisputeDialogOpen(true);
                                        }}
                                        title="Contester ce paiement"
                                      >
                                        <AlertTriangle className="w-4 h-4" />
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
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucune facture pour le moment</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            {/* V2 Payment History - Source of truth */}
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

        {/* Invoice Payment Dialog */}
        <Dialog open={paymentInfoOpen} onOpenChange={(open) => {
          setPaymentInfoOpen(open);
          if (!open) resetPaymentForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Payer une facture</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-6 mt-4">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Solde de la facture</p>
                    <p className="font-bold text-foreground">
                      {calculateTotal(selectedInvoice).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Facture: {selectedInvoice.invoice_number || selectedInvoice.id.slice(0, 8)}
                  </p>
                  {Number(profile?.store_credit || 0) > 0 && (
                    <div className="mt-2 pt-2 border-t border-cyan-500/30 flex items-center justify-between">
                      <p className="text-sm text-emerald-500">Crédit disponible</p>
                      <p className="font-medium text-emerald-500">
                        {Number(profile?.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Custom Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="customAmount">Montant à payer</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="customAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      className="pl-8"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  {Number(customAmount) > calculateTotal(selectedInvoice) && (
                    <p className="text-xs text-emerald-500">
                      💰 Le surplus de {(Number(customAmount) - calculateTotal(selectedInvoice)).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} sera ajouté à votre crédit.
                    </p>
                  )}
                  {Number(customAmount) < calculateTotal(selectedInvoice) && Number(customAmount) > 0 && (
                    <p className="text-xs text-amber-500">
                      ⚠️ Paiement partiel. Solde restant: {(calculateTotal(selectedInvoice) - Number(customAmount)).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                  )}
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Méthode de paiement</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      variant={paymentMethod === "etransfer" ? "default" : "outline"}
                      className="flex items-center justify-center gap-2 h-14"
                      onClick={() => setPaymentMethod("etransfer")}
                    >
                      <Banknote className="w-5 h-5" />
                      <span>Interac</span>
                    </Button>
                    <Button
                      type="button"
                      variant={paymentMethod === "credit_card" ? "default" : "outline"}
                      className="flex items-center justify-center gap-2 h-14 opacity-50"
                      onClick={() => setPaymentMethod("credit_card")}
                      disabled
                    >
                      <CreditCard className="w-5 h-5" />
                      <span>Carte</span>
                    </Button>
                  </div>
                </div>

                {/* PayPal Payment */}
                {paymentMethod === "paypal" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-4">
                        Payez de façon sécurisée avec votre compte PayPal ou carte de crédit/débit.
                      </p>
                      <PayPalButton
                        amount={Number(customAmount) || calculateTotal(selectedInvoice)}
                        invoiceId={selectedInvoice.id}
                        description={`Facture ${selectedInvoice.invoice_number || selectedInvoice.id.slice(0, 8)}`}
                        onSuccess={(captureId) => {
                          toast.success("Paiement PayPal réussi!");
                          setPaymentInfoOpen(false);
                          resetPaymentForm();
                          refetchInvoices();
                          refetchProfile();
                          // Invalidate all billing-related caches for instant UI updates
                          queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
                          queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["client-balance"] });
                          queryClient.invalidateQueries({ queryKey: ["client-ledger"] });
                        }}
                        onError={(error) => {
                          toast.error("Erreur PayPal: " + error);
                        }}
                      />
                    </div>
                    
                    <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Vous serez redirigé vers PayPal pour compléter le paiement. Votre facture sera mise à jour automatiquement.
                      </p>
                    </div>
                  </div>
                )}

                {/* Interac E-Transfer */}
                {paymentMethod === "etransfer" && (
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
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        <strong>Important:</strong> Votre paiement sera traité dans les 24-48 heures ouvrables après réception.
                      </p>
                    </div>

                    <Button className="w-full" onClick={() => setPaymentInfoOpen(false)}>
                      Fermer
                    </Button>
                  </div>
                )}

                {/* Credit Card (disabled) */}
                {paymentMethod === "credit_card" && (
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

                    <Button 
                      className="w-full" 
                      disabled={isProcessing || !cardName || !cardNumber || !cardExpiry || !cardCvc || Number(customAmount) <= 0}
                      onClick={() => handleProcessPayment(true)}
                    >
                      {isProcessing ? "Traitement en cours..." : `Payer ${Number(customAmount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`}
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

        {/* General Payment Dialog */}
        <Dialog open={generalPaymentOpen} onOpenChange={(open) => {
          setGeneralPaymentOpen(open);
          if (!open) resetPaymentForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Envoyer un paiement</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <DollarSign className="w-6 h-6 text-cyan-500" />
                  <p className="text-sm text-muted-foreground">
                    Effectuez un paiement anticipé ou réglez un solde
                  </p>
                </div>
                {Number(profile?.balance || 0) > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-cyan-500/30">
                    <p className="text-sm text-amber-500">Solde actuel</p>
                    <p className="font-bold text-amber-500">
                      {Number(profile?.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                  </div>
                )}
                {Number(profile?.store_credit || 0) > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-cyan-500/30 mt-2">
                    <p className="text-sm text-emerald-500">Crédit disponible</p>
                    <p className="font-medium text-emerald-500">
                      {Number(profile?.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                  </div>
                )}
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="generalAmount">Montant à payer</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="generalAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-8"
                    value={generalAmount}
                    onChange={(e) => setGeneralAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {Number(profile?.balance || 0) > 0 && Number(generalAmount) > Number(profile?.balance || 0) && (
                  <p className="text-xs text-emerald-500">
                    💰 Le surplus de {(Number(generalAmount) - Number(profile?.balance || 0)).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} sera ajouté à votre crédit.
                  </p>
                )}
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Méthode de paiement</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    variant={paymentMethod === "etransfer" ? "default" : "outline"}
                    className="flex items-center justify-center gap-2 h-14"
                    onClick={() => setPaymentMethod("etransfer")}
                  >
                    <Banknote className="w-5 h-5" />
                    <span>Interac</span>
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === "credit_card" ? "default" : "outline"}
                    className="flex items-center justify-center gap-2 h-14 opacity-50"
                    onClick={() => setPaymentMethod("credit_card")}
                    disabled
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Carte</span>
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

                  <Button 
                    className="w-full" 
                    disabled={isProcessing || !cardName || !cardNumber || !cardExpiry || !cardCvc || Number(generalAmount) <= 0}
                    onClick={() => handleProcessPayment(false)}
                  >
                    {isProcessing ? "Traitement en cours..." : `Payer ${Number(generalAmount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`}
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
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      <strong>Note:</strong> Les paiements reçus seront appliqués à votre compte dans les 24-48 heures.
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

        {/* Invoice Preview Dialog */}
        <Dialog open={invoicePreviewOpen} onOpenChange={setInvoicePreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Aperçu de la facture
              </DialogTitle>
            </DialogHeader>
            {previewInvoice && (() => {
              const isOverdue = previewInvoice.due_date && isPast(parseISO(previewInvoice.due_date)) && previewInvoice.status !== "paid";
              const lateFeeAmount = isOverdue && !previewInvoice.late_fee_applied ? Number(previewInvoice.amount) * 0.05 : 0;
              const total = Number(previewInvoice.amount || 0) + Number(previewInvoice.fees || 0) + lateFeeAmount - Number(previewInvoice.credits || 0);
              
              return (
                <div className="space-y-6 py-4">
                  {/* Header */}
                  <div className="bg-cyan-500 text-white rounded-lg p-6 text-center">
                    <h2 className="text-2xl font-bold">NIVRA</h2>
                    <p className="text-sm opacity-90">Compagnie Télécom Indépendante</p>
                    <p className="text-xs opacity-75 mt-1">{supportPhone} | {supportEmail}</p>
                  </div>

                  {/* Invoice Info */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">FACTURE</h3>
                      <p className="text-sm text-muted-foreground">
                        N° {previewInvoice.invoice_number || previewInvoice.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <Badge className={`${
                      isOverdue && previewInvoice.status !== "paid" 
                        ? "bg-red-500/20 text-red-500" 
                        : previewInvoice.status === "paid" 
                          ? "bg-emerald-500/20 text-emerald-500" 
                          : "bg-amber-500/20 text-amber-500"
                    } text-sm px-3 py-1`}>
                      {isOverdue && previewInvoice.status !== "paid" ? "En retard" : 
                       previewInvoice.status === "paid" ? "Payée" : "En attente"}
                    </Badge>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4 bg-muted rounded-lg p-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Date d'émission</p>
                      <p className="font-medium">{format(new Date(previewInvoice.created_at), "d MMMM yyyy", { locale: fr })}</p>
                    </div>
                    {previewInvoice.due_date && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Date d'échéance</p>
                        <p className={`font-medium ${isOverdue ? "text-red-500" : ""}`}>
                          {format(new Date(previewInvoice.due_date), "d MMMM yyyy", { locale: fr })}
                          {isOverdue && <AlertTriangle className="w-4 h-4 inline ml-1" />}
                        </p>
                      </div>
                    )}
                    {previewInvoice.paid_at && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Payé le</p>
                        <p className="font-medium text-emerald-500">
                          {format(new Date(previewInvoice.paid_at), "d MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Client Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-cyan-500/30 rounded-lg p-4">
                      <h4 className="font-bold text-cyan-500 mb-2 text-sm">DE</h4>
                      <p className="text-sm font-medium">Nivra Télécommunications</p>
                      <p className="text-xs text-muted-foreground" data-testid="invoice-company-address">{address}</p>
                      <p className="text-xs text-muted-foreground" data-testid="invoice-company-phone">{supportPhone}</p>
                      <p className="text-xs text-muted-foreground" data-testid="invoice-company-email">{supportEmail}</p>
                    </div>
                    <div className="border border-cyan-500/30 rounded-lg p-4">
                      <h4 className="font-bold text-cyan-500 mb-2 text-sm">À</h4>
                      <p className="text-sm font-medium">{profile?.full_name || "Client"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.email || user?.email}</p>
                      {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-cyan-500 text-white px-4 py-2 grid grid-cols-2">
                      <span className="font-medium text-sm">Description</span>
                      <span className="font-medium text-sm text-right">Montant</span>
                    </div>
                    <div className="divide-y divide-border">
                      {/* Subtotal - Service fees */}
                      <div className="px-4 py-3 grid grid-cols-2">
                        <span className="text-sm">Services ({previewInvoice.related_order_number || 'N/A'})</span>
                        <span className="text-sm text-right">
                          {Number(previewInvoice.subtotal || previewInvoice.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </span>
                      </div>
                      {/* Delivery fee */}
                      {Number(previewInvoice.delivery_fee || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2">
                          <span className="text-sm">Frais de livraison</span>
                          <span className="text-sm text-right">
                            {Number(previewInvoice.delivery_fee || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* Activation fee */}
                      {Number(previewInvoice.activation_fee || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2">
                          <span className="text-sm">Frais d'activation</span>
                          <span className="text-sm text-right">
                            {Number(previewInvoice.activation_fee || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* Installation fee */}
                      {Number(previewInvoice.installation_fee || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2">
                          <span className="text-sm">Frais d'installation</span>
                          <span className="text-sm text-right">
                            {Number(previewInvoice.installation_fee || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* Equipment */}
                      {previewInvoice.equipment_id && (
                        <div className="px-4 py-3 grid grid-cols-2">
                          <span className="text-sm">Équipement ({previewInvoice.equipment_id})</span>
                          <span className="text-sm text-right text-muted-foreground">Inclus</span>
                        </div>
                      )}
                      {/* Additional fees */}
                      {Number(previewInvoice.fees || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2">
                          <span className="text-sm">Frais additionnels</span>
                          <span className="text-sm text-right text-amber-500">
                            +{Number(previewInvoice.fees || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* Discount */}
                      {Number(previewInvoice.discount_amount || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2 bg-emerald-50 dark:bg-emerald-950/20">
                          <span className="text-sm text-emerald-600 dark:text-emerald-400">Rabais appliqué</span>
                          <span className="text-sm text-right text-emerald-600 dark:text-emerald-400">
                            -{Number(previewInvoice.discount_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* TPS */}
                      {Number(previewInvoice.tps_amount || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2">
                          <span className="text-sm text-muted-foreground">TPS (5%)</span>
                          <span className="text-sm text-right text-muted-foreground">
                            {Number(previewInvoice.tps_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* TVQ */}
                      {Number(previewInvoice.tvq_amount || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2">
                          <span className="text-sm text-muted-foreground">TVQ (9.975%)</span>
                          <span className="text-sm text-right text-muted-foreground">
                            {Number(previewInvoice.tvq_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* Late fee */}
                      {lateFeeAmount > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2 bg-red-50 dark:bg-red-950/20">
                          <span className="text-sm text-red-600 dark:text-red-400">Frais de retard (5%)</span>
                          <span className="text-sm text-right text-red-600 dark:text-red-400">
                            +{lateFeeAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                      {/* Credits */}
                      {Number(previewInvoice.credits || 0) > 0 && (
                        <div className="px-4 py-3 grid grid-cols-2 bg-emerald-50 dark:bg-emerald-950/20">
                          <span className="text-sm text-emerald-600 dark:text-emerald-400">Crédits appliqués</span>
                          <span className="text-sm text-right text-emerald-600 dark:text-emerald-400">
                            -{Number(previewInvoice.credits || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="bg-muted px-4 py-3 grid grid-cols-2">
                      <span className="font-bold">TOTAL À PAYER</span>
                      <span className="font-bold text-right text-cyan-500">
                        {total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {previewInvoice.notes && (
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-xs text-muted-foreground uppercase mb-1">Notes</p>
                      <p className="text-sm">{previewInvoice.notes}</p>
                    </div>
                  )}

                  {/* Payment Info */}
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-xs text-muted-foreground uppercase mb-2">Informations de paiement</p>
                    <p className="text-sm"><strong>Virement Interac :</strong> Support@nivra-telecom.ca</p>
                    <p className="text-sm"><strong>Question :</strong> Nom du client ou nom de l'entreprise</p>
                    <p className="text-sm"><strong>Réponse :</strong> Votre nom complet ou le nom de votre entreprise</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setInvoicePreviewOpen(false)}>
                      Fermer
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        try {
                          const invoiceData = {
                            invoiceNumber: previewInvoice.invoice_number || previewInvoice.id.slice(0, 8).toUpperCase(),
                            orderNumber: previewInvoice.related_order_number,
                            clientName: profile?.full_name || "Client",
                            clientEmail: profile?.email || user?.email || "",
                            clientPhone: profile?.phone,
                            subtotal: Number(previewInvoice.subtotal || previewInvoice.amount) || 0,
                            fees: Number(previewInvoice.fees) || 0,
                            credits: Number(previewInvoice.credits) || 0,
                            deliveryFee: Number(previewInvoice.delivery_fee) || 0,
                            activationFee: Number(previewInvoice.activation_fee) || 0,
                            installationFee: Number(previewInvoice.installation_fee) || 0,
                            discountAmount: Number(previewInvoice.discount_amount) || 0,
                            tpsAmount: Number(previewInvoice.tps_amount) || 0,
                            tvqAmount: Number(previewInvoice.tvq_amount) || 0,
                            lateFeeAmount: Number(previewInvoice.late_fee_amount) || 0,
                            dueDate: previewInvoice.due_date,
                            createdAt: previewInvoice.created_at,
                            status: isOverdue && previewInvoice.status !== "paid" ? "overdue" : previewInvoice.status,
                            paidAt: previewInvoice.paid_at,
                            notes: previewInvoice.notes,
                            equipmentId: previewInvoice.equipment_id,
                          };
                          const pdfBlob = getInvoicePDFBlob(invoiceData);
                          safePDFPrint(pdfBlob);
                          toast.success("Ouverture pour impression...");
                        } catch (error) {
                          console.error("Print error:", error);
                          toast.error("Erreur lors de l'impression");
                        }
                      }}
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimer
                    </Button>
                    <Button 
                      variant="hero"
                      onClick={() => {
                        downloadInvoicePDF({
                          invoiceNumber: previewInvoice.invoice_number || previewInvoice.id.slice(0, 8).toUpperCase(),
                          orderNumber: previewInvoice.related_order_number,
                          clientName: profile?.full_name || "Client",
                          clientEmail: profile?.email || user?.email || "",
                          clientPhone: profile?.phone,
                          subtotal: Number(previewInvoice.subtotal || previewInvoice.amount) || 0,
                          fees: Number(previewInvoice.fees) || 0,
                          credits: Number(previewInvoice.credits) || 0,
                          deliveryFee: Number(previewInvoice.delivery_fee) || 0,
                          activationFee: Number(previewInvoice.activation_fee) || 0,
                          installationFee: Number(previewInvoice.installation_fee) || 0,
                          discountAmount: Number(previewInvoice.discount_amount) || 0,
                          tpsAmount: Number(previewInvoice.tps_amount) || 0,
                          tvqAmount: Number(previewInvoice.tvq_amount) || 0,
                          lateFeeAmount: Number(previewInvoice.late_fee_amount) || 0,
                          dueDate: previewInvoice.due_date,
                          createdAt: previewInvoice.created_at,
                          status: isOverdue && previewInvoice.status !== "paid" ? "overdue" : previewInvoice.status,
                          paidAt: previewInvoice.paid_at,
                          notes: previewInvoice.notes,
                          equipmentId: previewInvoice.equipment_id,
                        });
                        toast.success("Facture téléchargée");
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger PDF
                    </Button>
                    {previewInvoice.status !== "paid" && (
                      <Button 
                        onClick={() => {
                          setInvoicePreviewOpen(false);
                          handlePayClick(previewInvoice);
                        }}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Payer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* PDF Viewer Dialog - Full preview without redirect */}
        <PDFViewerDialog
          open={pdfViewerOpen}
          onOpenChange={setPdfViewerOpen}
          pdfBlob={pdfBlob}
          title={pdfTitle}
          filename={pdfFilename}
          isLoading={pdfLoading}
        />
      </div>
    </ClientLayout>
  );
};

export default ClientInvoices;
