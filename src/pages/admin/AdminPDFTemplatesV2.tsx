/**
 * Admin PDF Templates V2 Preview Page
 * Test and preview all V2 PDF templates with REAL order/invoice selection
 * Allows generating PDFs from actual database records
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, FileText, RefreshCw, Eye, Database, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Import V2.4 generators from the new template system
import { 
  useInvoiceMonthlyV2PDF, 
  useInvoiceOneTimeV2PDF, 
} from "@/hooks/usePDFTemplates";
import type { InvoiceDataV2 } from "@/lib/pdf";
import { generateAccountNumber, generateInvoiceNumber } from "@/lib/secureIdGenerator";
import { BlankPDFTemplatesEmailer } from "@/components/admin/BlankPDFTemplatesEmailer";

// =============================================================================
// DATA FETCHING
// =============================================================================

const useOrders = () => {
  return useQuery({
    queryKey: ["admin-orders-for-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          confirmation_number,
          payment_status,
          total_amount,
          client_first_name,
          client_last_name,
          client_email,
          client_phone,
          payment_reference,
          provider_payment_id,
          equipment_details,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });
};

const useInvoices = () => {
  return useQuery({
    queryKey: ["admin-invoices-for-pdf"],
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
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(20);
      
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

// Helper to safely access equipment_details
const getEquipmentDetails = (order: any): any => {
  if (!order?.equipment_details) return {};
  if (typeof order.equipment_details === 'string') {
    try { return JSON.parse(order.equipment_details); } catch { return {}; }
  }
  return order.equipment_details;
};

// Build InvoiceDataV2 from an order
const buildInvoiceDataFromOrder = (order: any, isMonthly: boolean): InvoiceDataV2 => {
  const equipment = getEquipmentDetails(order);
  const billing = equipment.billing_totals || {};
  const today = new Date().toISOString().split("T")[0];
  
  return {
    invoice_type: isMonthly ? "MONTHLY" : "ONETIME",
    invoice_number: generateInvoiceNumber(),
    invoice_date: today,
    due_date: today,
    account_number: generateAccountNumber(),
    billing_period_start: isMonthly ? today : undefined,
    billing_period_end: isMonthly ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : undefined,
    currency: "CAD",
    status: order.payment_status === "captured" ? "Paid" : "Pending",
    
    customer: {
      full_name: `${order.client_first_name || ""} ${order.client_last_name || ""}`.trim() || "Client",
      email: order.client_email || "",
      phone: order.client_phone || "",
      address_line1: equipment.service_address?.address || "",
      city: equipment.service_address?.city || "",
      province: equipment.service_address?.province || "QC",
      postal_code: equipment.service_address?.postal_code || "",
    },
    
    items: equipment.line_items?.map((item: any) => ({
      category: item.category || "Service",
      description: item.name || item.description || "Service",
      qty: item.quantity || 1,
      unit_price: item.price || 0,
      amount: (item.quantity || 1) * (item.price || 0),
      is_recurring: item.is_recurring || false,
    })) || [
      { category: "Service", description: "Services commandés", qty: 1, unit_price: billing.subtotal || 0, amount: billing.subtotal || 0, is_recurring: false }
    ],
    
    discounts: billing.discount_amount > 0 ? [
      { label: billing.promo_name || "Rabais", amount: billing.discount_amount }
    ] : [],
    
    subtotal: billing.subtotal || order.total_amount || 0,
    taxes: {
      gst_rate: 0.05,
      gst_amount: billing.tps_amount || 0,
      qst_rate: 0.09975,
      qst_amount: billing.tvq_amount || 0,
    },
    total: billing.total || order.total_amount || 0,
    balance_due: order.payment_status === "captured" ? 0 : (billing.total || order.total_amount || 0),
    
    payments: order.payment_status === "captured" ? [{
      method: billing.payment_method === "paypal" ? "PayPal" : "Interac",
      status: "Captured",
      paid_amount: billing.total || order.total_amount || 0,
      paid_at: order.created_at,
      payment_reference: order.payment_reference || "",
      processor_txn_id: order.provider_payment_id || "",
    }] : [],
    payments_total: order.payment_status === "captured" ? (billing.total || order.total_amount || 0) : 0,
  };
};

// =============================================================================
// COMPONENT
// =============================================================================

const AdminPDFTemplatesV2 = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("from-order");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [invoiceType, setInvoiceType] = useState<"MONTHLY" | "ONETIME">("ONETIME");
  const [jsonPreview, setJsonPreview] = useState<string>("");
  
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useOrders();
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useInvoices();

  const monthlyV2PDF = useInvoiceMonthlyV2PDF();
  const oneTimeV2PDF = useInvoiceOneTimeV2PDF();

  // Get selected order
  const selectedOrder = useMemo(() => {
    return orders?.find(o => o.id === selectedOrderId);
  }, [orders, selectedOrderId]);

  // Build InvoiceDataV2 from selected order
  const invoiceDataFromOrder = useMemo(() => {
    if (!selectedOrder) return null;
    const data = buildInvoiceDataFromOrder(selectedOrder, invoiceType === "MONTHLY");
    setJsonPreview(JSON.stringify(data, null, 2));
    return data;
  }, [selectedOrder, invoiceType]);

  const handleGeneratePDF = async () => {
    if (!invoiceDataFromOrder) {
      toast({ title: "Erreur", description: "Sélectionnez une commande", variant: "destructive" });
      return;
    }

    try {
      if (invoiceType === "MONTHLY") {
        await monthlyV2PDF.open(invoiceDataFromOrder);
      } else {
        await oneTimeV2PDF.open(invoiceDataFromOrder);
      }
      toast({ title: "PDF généré!", description: "Aperçu ouvert dans un nouvel onglet" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoiceDataFromOrder) {
      toast({ title: "Erreur", description: "Sélectionnez une commande", variant: "destructive" });
      return;
    }

    try {
      if (invoiceType === "MONTHLY") {
        await monthlyV2PDF.download(invoiceDataFromOrder);
      } else {
        await oneTimeV2PDF.download(invoiceDataFromOrder);
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
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
                Templates PDF V2.4
              </h1>
              <p className="text-muted-foreground">
                Générer des PDFs à partir de commandes/factures réelles
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">V2.4 — Règle 2-9</Badge>
        </div>

        <BlankPDFTemplatesEmailer />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="from-order" className="gap-2">
              <Database className="w-4 h-4" />
              Depuis commande
            </TabsTrigger>
            <TabsTrigger value="from-invoice" className="gap-2">
              <FileText className="w-4 h-4" />
              Depuis facture
            </TabsTrigger>
          </TabsList>

          {/* Tab: From Order */}
          <TabsContent value="from-order" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Selection & Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Sélectionner une commande
                  </CardTitle>
                  <CardDescription>
                    Choisissez une commande pour générer un PDF avec ses données réelles
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner une commande..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ordersLoading ? (
                          <SelectItem value="loading" disabled>Chargement...</SelectItem>
                        ) : orders?.map(order => {
                          const equip = getEquipmentDetails(order);
                          const total = equip.billing_totals?.total || order.total_amount;
                          return (
                            <SelectItem key={order.id} value={order.id}>
                              #{order.confirmation_number} — {order.client_first_name} {order.client_last_name} — {formatCurrency(total)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => refetchOrders()}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  {selectedOrder && (
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Confirmation:</span>
                        <span className="font-mono">{selectedOrder.confirmation_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Client:</span>
                        <span>{selectedOrder.client_first_name} {selectedOrder.client_last_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span>{selectedOrder.client_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Statut paiement:</span>
                        <Badge variant={selectedOrder.payment_status === "captured" ? "default" : "secondary"}>
                          {selectedOrder.payment_status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total (billing_totals):</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(getEquipmentDetails(selectedOrder).billing_totals?.total)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PayPal/Provider ID:</span>
                        <span className="font-mono text-xs">{selectedOrder.provider_payment_id || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Réf. paiement:</span>
                        <span className="font-mono">{selectedOrder.payment_reference || "—"}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Type de facture</Label>
                    <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as "MONTHLY" | "ONETIME")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONETIME">Facture Unique (équipement/frais)</SelectItem>
                        <SelectItem value="MONTHLY">Facture Mensuelle (services récurrents)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={handleGeneratePDF} 
                      disabled={!selectedOrder || monthlyV2PDF.isGenerating || oneTimeV2PDF.isGenerating}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Aperçu PDF
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleDownloadPDF}
                      disabled={!selectedOrder || monthlyV2PDF.isGenerating || oneTimeV2PDF.isGenerating}
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
                    Données utilisées pour générer le PDF — vérifiez que tout est correct
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    value={jsonPreview}
                    readOnly
                    className="font-mono text-xs h-[400px]"
                    placeholder="Sélectionnez une commande pour voir les données..."
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: From Invoice */}
          <TabsContent value="from-invoice" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Depuis facture existante</CardTitle>
                <CardDescription>
                  Sélectionnez une facture billing_invoices pour regénérer son PDF
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
                
                <p className="text-sm text-muted-foreground">
                  Cette fonctionnalité génère un PDF à partir des données de billing_invoices.
                  Pour des tests complets avec les nouvelles templates V2.4, utilisez l'onglet "Depuis commande".
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Status Bar */}
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Templates V2.4 — Règle 2-9 Active</p>
              <p className="text-sm text-muted-foreground">
                Tous les numéros générés commencent par 2-9. 
                Montants extraits de billing_totals (snapshot checkout).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPDFTemplatesV2;
