/**
 * Admin PDF Templates V2.5 Preview Page
 * Generate PDFs from REAL billing_invoices using invoiceEngine V2.5 ONLY
 * Logs every generation to pdf_generation_logs with real invoice_number
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, FileText, RefreshCw, Eye, Database, CheckCircle, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { adminClient as supabase } from "@/integrations/backend";
import { useQuery } from "@tanstack/react-query";
import { generateInvoicePDF } from "@/lib/pdf/invoiceEngine";
import type { InvoiceDataV2 } from "@/lib/pdf/types";
import { safePDFDownload, safePDFOpen } from "@/lib/pdfUtils";

// =============================================================================
// DATA FETCHING - Using adminClient for RLS bypass
// =============================================================================

const useInvoices = () => {
  return useQuery({
    queryKey: ["admin-invoices-for-pdf-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select(`
          id,
          invoice_number,
          customer_id,
          type,
          subtotal,
          tps_amount,
          tvq_amount,
          total,
          status,
          cycle_start_date,
          cycle_end_date,
          due_date,
          amount_paid,
          balance_due,
          paid_at,
          payment_method,
          fees,
          activation_fee,
          late_fee_amount,
          notes,
          created_at,
          billing_snapshot_client,
          billing_snapshot_account_number,
          billing_snapshot_payment,
          billing_customers (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          billing_invoice_lines (
            id,
            description,
            quantity,
            unit_price,
            line_total
          )
        `)
        .in("status", ["paid", "pending", "overdue"])
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });
};

// =============================================================================
// HELPERS
// =============================================================================

const formatCurrency = (amount: number | null | undefined): string => {
  return (amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
};

/**
 * Build InvoiceDataV2 from a billing_invoice record (REAL data)
 */
const buildInvoiceDataFromInvoice = (invoice: any): InvoiceDataV2 => {
  // PRIORITY: Use billing snapshots first, then fallback to billing_customers
  const snapshotClient = invoice.billing_snapshot_client as Record<string, any> | null;
  const snapshotPayment = invoice.billing_snapshot_payment as Record<string, any> | null;
  const snapshotAccountNumber = invoice.billing_snapshot_account_number as string | null;
  
  // Fallback: billing_customers (for legacy invoices without snapshots)
  const customerRecord = Array.isArray(invoice.billing_customers) 
    ? invoice.billing_customers[0] 
    : invoice.billing_customers;
    
  const lines = invoice.billing_invoice_lines || [];
  
  // Determine invoice type from DB type field
  const invoiceType = invoice.type === "renewal" ? "MONTHLY" : "ONETIME";
  
  // Build items from billing_invoice_lines
  const items = lines.length > 0 
    ? lines.map((line: any) => ({
        category: "Service" as const,
        description: line.description || "Service",
        qty: line.quantity || 1,
        unit_price: Number(line.unit_price) || 0,
        amount: Number(line.line_total) || 0,
        is_recurring: invoiceType === "MONTHLY",
      }))
    : [{
        category: "Service" as const,
        description: "Services Nivra",
        qty: 1,
        unit_price: Number(invoice.subtotal) || 0,
        amount: Number(invoice.subtotal) || 0,
        is_recurring: invoiceType === "MONTHLY",
      }];
  
  const total = Number(invoice.total) || 0;
  const amountPaid = Number(invoice.amount_paid) || 0;
  const balanceDue = Math.max(0, total - amountPaid);
  
  // Use snapshot account_number (6-digit) OR fallback to customer_id prefix
  const accountNumber = snapshotAccountNumber 
    || invoice.customer_id?.substring(0, 8).toUpperCase() 
    || "000000";
  
  // Build customer data from snapshot OR fallback
  const customerData = snapshotClient 
    ? {
        full_name: snapshotClient.full_name || "Client",
        email: snapshotClient.email || "",
        phone: snapshotClient.phone || "",
        address_line1: snapshotClient.address_line1 || "",
        city: snapshotClient.city || "",
        province: snapshotClient.province || "QC",
        postal_code: snapshotClient.postal_code || "",
      }
    : {
        full_name: customerRecord ? `${customerRecord.first_name || ""} ${customerRecord.last_name || ""}`.trim() : "Client",
        email: customerRecord?.email || "",
        phone: customerRecord?.phone || "",
        address_line1: "",
        city: "",
        province: "QC",
        postal_code: "",
      };
  
  // Build payments array - use snapshot OR construct from invoice fields
  const payments = invoice.status === "paid" 
    ? [{
        method: (snapshotPayment?.method || invoice.payment_method || "Manual") as "PayPal" | "Interac" | "card" | string,
        status: "Captured" as const,
        paid_amount: snapshotPayment?.paid_amount || amountPaid,
        paid_at: snapshotPayment?.paid_at || invoice.paid_at || invoice.created_at,
        payment_reference: snapshotPayment?.reference || "—",
        processor_txn_id: snapshotPayment?.transaction_id || snapshotPayment?.capture_id,
      }]
    : [];
  
  return {
    invoice_type: invoiceType,
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
    due_date: invoice.due_date?.split("T")[0] || new Date().toISOString().split("T")[0],
    account_number: accountNumber,
    billing_period_start: invoiceType === "MONTHLY" ? invoice.cycle_start_date?.split("T")[0] : undefined,
    billing_period_end: invoiceType === "MONTHLY" ? invoice.cycle_end_date?.split("T")[0] : undefined,
    currency: "CAD",
    status: invoice.status === "paid" ? "Paid" : "Pending",
    
    customer: customerData,
    items,
    
    subtotal: Number(invoice.subtotal) || 0,
    taxes: {
      gst_rate: 0.05,
      gst_amount: Number(invoice.tps_amount) || 0,
      qst_rate: 0.09975,
      qst_amount: Number(invoice.tvq_amount) || 0,
    },
    total,
    balance_due: balanceDue,
    
    payments,
    payments_total: amountPaid,
  };
};

// =============================================================================
// COMPONENT
// =============================================================================

const AdminPDFTemplatesV2 = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("from-invoice");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [jsonPreview, setJsonPreview] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useInvoices();

  // Get selected invoice
  const selectedInvoice = useMemo(() => {
    return invoices?.find(i => i.id === selectedInvoiceId);
  }, [invoices, selectedInvoiceId]);

  // Build InvoiceDataV2 from selected invoice
  const invoiceData = useMemo(() => {
    if (!selectedInvoice) {
      setJsonPreview("");
      return null;
    }
    const data = buildInvoiceDataFromInvoice(selectedInvoice);
    setJsonPreview(JSON.stringify(data, null, 2));
    return data;
  }, [selectedInvoice]);

  /**
   * Generate PDF using invoiceEngine V2.5 ONLY
   * Logs automatically to pdf_generation_logs with real invoice_number
   */
  const handleGeneratePDF = async (action: "open" | "download") => {
    if (!invoiceData || !selectedInvoice) {
      toast({ title: "Erreur", description: "Sélectionnez une facture", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setLastError(null);

    try {
      // Call invoiceEngine V2.5 - this automatically logs to pdf_generation_logs
      const result = await generateInvoicePDF(invoiceData, {
        invoice_id: selectedInvoice.id,
        user_id: selectedInvoice.customer_id,
      });

      if (!result.success || !result.blob) {
        throw new Error(result.error || "Échec de la génération PDF");
      }

      const filename = result.filename || `Facture-${invoiceData.invoice_number}.pdf`;

      if (action === "open") {
        safePDFOpen(result.blob, filename);
        toast({ title: "PDF généré!", description: `${filename} ouvert dans un nouvel onglet` });
      } else {
        safePDFDownload(result.blob, filename);
        toast({ title: "PDF téléchargé!", description: filename });
      }
    } catch (error: any) {
      const errorMsg = error.message || "Erreur inconnue";
      setLastError(errorMsg);
      toast({ title: "Erreur génération PDF", description: errorMsg, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/billing">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Templates PDF V2.5
              </h1>
              <p className="text-muted-foreground">
                Générer des PDFs depuis billing_invoices réelles — invoiceEngine V2.5
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">V2.5 — invoiceEngine</Badge>
        </div>

        {/* Error Alert */}
        {lastError && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Erreur de génération</p>
                <p className="text-sm text-destructive/80">{lastError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-1 w-full max-w-md">
            <TabsTrigger value="from-invoice" className="gap-2">
              <FileText className="w-4 h-4" />
              Depuis facture (billing_invoices)
            </TabsTrigger>
          </TabsList>

          {/* Tab: From Invoice - MAIN FUNCTIONALITY */}
          <TabsContent value="from-invoice" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Selection & Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Sélectionner une facture réelle
                  </CardTitle>
                  <CardDescription>
                    Choisissez une facture billing_invoices (paid/pending) pour générer son PDF
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner une facture..." />
                      </SelectTrigger>
                      <SelectContent>
                        {invoicesLoading ? (
                          <SelectItem value="loading" disabled>Chargement...</SelectItem>
                        ) : invoices?.length === 0 ? (
                          <SelectItem value="empty" disabled>Aucune facture trouvée</SelectItem>
                        ) : invoices?.map(inv => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoice_number} — {inv.type} — {formatCurrency(inv.total)} — {inv.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => refetchInvoices()}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  {selectedInvoice && (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invoice #:</span>
                        <span className="font-mono font-semibold">{selectedInvoice.invoice_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <Badge variant={selectedInvoice.type === "renewal" ? "default" : "secondary"}>
                          {selectedInvoice.type === "renewal" ? "MONTHLY" : "ONETIME"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Client:</span>
                        <span>
                          {(() => {
                            const cust = (selectedInvoice as any).billing_customers;
                            if (Array.isArray(cust)) {
                              return `${cust[0]?.first_name || ""} ${cust[0]?.last_name || ""}`.trim();
                            }
                            return `${cust?.first_name || ""} ${cust?.last_name || ""}`.trim();
                          })() || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span>
                          {(() => {
                            const cust = (selectedInvoice as any).billing_customers;
                            if (Array.isArray(cust)) {
                              return cust[0]?.email || "—";
                            }
                            return cust?.email || "—";
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Statut:</span>
                        <Badge variant={selectedInvoice.status === "paid" ? "default" : "secondary"}>
                          {selectedInvoice.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TPS:</span>
                        <span>{formatCurrency(selectedInvoice.tps_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TVQ:</span>
                        <span>{formatCurrency(selectedInvoice.tvq_amount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-muted-foreground font-semibold">Total:</span>
                        <span className="font-semibold text-primary">{formatCurrency(selectedInvoice.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Montant payé:</span>
                        <span className="text-green-600">{formatCurrency(selectedInvoice.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Solde dû:</span>
                        <span className={selectedInvoice.balance_due > 0 ? "text-orange-600" : "text-green-600"}>
                          {formatCurrency(selectedInvoice.balance_due)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={() => handleGeneratePDF("open")} 
                      disabled={!selectedInvoice || isGenerating}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {isGenerating ? "Génération..." : "Aperçu PDF"}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleGeneratePDF("download")}
                      disabled={!selectedInvoice || isGenerating}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Right: JSON Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    InvoiceDataV2 (JSON)
                  </CardTitle>
                  <CardDescription>
                    Données envoyées à generateInvoicePDF() — vérifiez les champs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    value={jsonPreview}
                    readOnly
                    className="font-mono text-xs h-[400px]"
                    placeholder="Sélectionnez une facture pour voir les données..."
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Status Bar */}
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">invoiceEngine V2.5 — Source: billing_invoices</p>
              <p className="text-sm text-muted-foreground">
                Chaque génération est loggée dans pdf_generation_logs avec invoice_number réel.
                Mapping: initial→ONETIME, renewal→MONTHLY.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPDFTemplatesV2;
