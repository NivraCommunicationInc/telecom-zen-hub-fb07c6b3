import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { FileText, Download, DollarSign, CheckCircle, AlertTriangle, Clock, Calendar, ChevronRight, Receipt } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { generateInvoicePDF, type InvoiceDataV2 } from "@/lib/pdf";
import { safePDFDownload } from "@/lib/pdfUtils";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import PayInvoiceDialog from "@/components/client/PayInvoiceDialog";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Status config ───────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  partial: "bg-orange-100 text-orange-700",
  void: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-red-100 text-red-700",
  in_verification: "bg-teal-100 text-teal-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  overdue: "En retard",
  partial: "Partiel",
  void: "Annulée",
  cancelled: "Annulée",
  expired: "Expirée",
  in_verification: "En vérification",
};

const TYPE_LABELS: Record<string, string> = {
  recurring: "Mensuelle",
  onetime: "Achat",
  one_time: "Achat",
  renewal: "Renouvellement",
};

// ─── Helpers ─────────────────────────────────────────────────────────
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

// ─── Component ───────────────────────────────────────────────────────
const ClientInvoices = () => {
  const { user } = useClientAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState("all");

  // PDF state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Pay dialog state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<any>(null);

  // ── Profile ──
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data } = await portalSupabase
        .from("profiles")
        .select("full_name, email, phone, account_number, client_number, service_address, service_city")
        .eq("user_id", user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // ── Unified invoices (legacy + V2) ──
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["client-invoices-all", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const all: any[] = [];

      // Legacy billing
      const { data: legacy } = await portalSupabase
        .from("billing")
        .select("*, orders:order_id (order_number, service_type, equipment_details)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (legacy) {
        for (const inv of legacy) {
          all.push({
            ...inv,
            _source: "legacy",
            _type: "onetime",
          });
        }
      }

      // V2 billing_invoices
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (customer) {
        const { data: v2 } = await portalSupabase
          .from("billing_invoices")
          .select("*, billing_invoice_lines(id, description, quantity, unit_price, line_total)")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false });
        if (v2) {
          for (const inv of v2) {
            const isOverdue = inv.status !== "paid" && inv.due_date && isPast(parseISO(inv.due_date));
            all.push({
              id: inv.id,
              user_id: user.id,
              invoice_number: inv.invoice_number,
              amount: Number(inv.total) || 0,
              subtotal: Number(inv.subtotal) || 0,
              total: Number(inv.total) || 0,
              fees: Number(inv.fees) || 0,
              amount_paid: Number(inv.amount_paid) || 0,
              balance_due: Number(inv.balance_due) || 0,
              status: isOverdue && inv.status !== "paid" ? "overdue" : inv.status,
              due_date: inv.due_date,
              paid_at: inv.paid_at,
              created_at: inv.created_at,
              notes: inv.notes,
              tps_amount: inv.tps_amount,
              tvq_amount: inv.tvq_amount,
              _source: "v2",
              _type: inv.type || "recurring",
              _lines: inv.billing_invoice_lines || [],
            });
          }
        }
      }

      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return all;
    },
    enabled: !!user?.id,
  });

  // ── Derived data ──
  const pendingInvoices = invoices?.filter(isInvoiceOpen) || [];
  const currentInvoice = pendingInvoices[0] || null;

  const filteredInvoices = invoices?.filter((inv: any) => {
    if (filterTab === "all") return true;
    return inv.status === filterTab;
  }) || [];

  // ── PDF generation ──
  const createInvoiceData = useCallback((inv: any): InvoiceDataV2 => {
    const subtotal = Number(inv.subtotal || inv.amount) || 0;
    const tps = Number(inv.tps_amount) || 0;
    const tvq = Number(inv.tvq_amount) || 0;
    const total = subtotal + tps + tvq;

    // Build items from billing_invoice_lines (each service/equipment/fee as separate line)
    const lines: any[] = inv._lines || [];
    const items = lines.length > 0
      ? lines.map((line: any) => ({
          category: "Other" as const,
          description: line.description || "Service",
          qty: Number(line.quantity) || 1,
          unit_price: Number(line.unit_price) || 0,
          amount: Number(line.line_total) || 0,
          is_recurring: inv._type === "recurring",
        }))
      : [{
          category: "Other" as const,
          description: inv.notes || "Services télécom",
          qty: 1,
          unit_price: subtotal,
          amount: subtotal,
          is_recurring: inv._type === "recurring",
        }];

    return {
      invoice_type: (inv._type === "recurring" || inv._type === "renewal") ? "MONTHLY" : "ONETIME",
      invoice_number: inv.invoice_number || `NVR-INV-${inv.id?.slice(0, 8).toUpperCase()}`,
      account_number: profile?.account_number || profile?.client_number || "000000",
      invoice_date: inv.created_at,
      due_date: inv.due_date,
      currency: "CAD",
      status: inv.status,
      customer: {
        full_name: profile?.full_name || "Client",
        email: profile?.email || user?.email || "",
        phone: profile?.phone,
        address_line1: profile?.service_address || "",
        city: profile?.service_city || "",
        province: "QC",
        postal_code: "",
      },
      items,
      subtotal,
      taxes: { gst_rate: 0.05, gst_amount: tps, qst_rate: 0.09975, qst_amount: tvq },
      total,
      balance_due: inv.status === "paid" ? 0 : total,
      payments: inv.paid_at ? [{ method: "Manual", status: "Captured", paid_amount: total, paid_at: inv.paid_at, payment_reference: inv.payment_reference }] : [],
      payments_total: inv.paid_at ? total : 0,
    };
  }, [profile, user?.email]);

  const handleViewPDF = useCallback(async (inv: any) => {
    try {
      setPdfLoading(true);
      setPdfViewerOpen(true);
      setPdfTitle(`Facture ${inv.invoice_number || inv.id?.slice(0, 8).toUpperCase()}`);
      setPdfFilename(`Facture_${inv.invoice_number || inv.id?.slice(0, 8)}.pdf`);
      const result = await generateInvoicePDF(createInvoiceData(inv));
      if (result.success && result.blob) setPdfBlob(result.blob);
      else throw new Error(result.error);
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("Erreur lors de la génération du PDF");
      setPdfViewerOpen(false);
    } finally {
      setPdfLoading(false);
    }
  }, [createInvoiceData]);

  const handleDownloadPDF = useCallback(async (inv: any) => {
    try {
      const result = await generateInvoicePDF(createInvoiceData(inv));
      if (result.success && result.blob && result.filename) {
        safePDFDownload(result.blob, result.filename);
        toast.success("Facture téléchargée");
      } else throw new Error(result.error);
    } catch (error) {
      console.error("PDF download error:", error);
      toast.error("Impossible de générer la facture");
    }
  }, [createInvoiceData]);

  // ── Pay ──
  const handlePayInvoice = (inv: any) => {
    setPayingInvoice(inv);
    setPayDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["client-invoices-all"] });
    queryClient.invalidateQueries({ queryKey: ["client-profile"] });
    queryClient.invalidateQueries({ queryKey: ["ledger-balance"] });
    queryClient.invalidateQueries({ queryKey: ["client-balance"] });
    toast.success("Paiement enregistré!");
  };

  // Auto-pay from ?pay=true
  useEffect(() => {
    if (searchParams.get("pay") === "true" && !isLoading && pendingInvoices.length > 0 && !payDialogOpen) {
      handlePayInvoice(pendingInvoices[0]);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, isLoading, pendingInvoices.length]);

  // ── Currency formatter ──
  const cad = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground flex items-center gap-1.5">
          <span>MonNivra</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Mes factures</span>
        </nav>

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mes factures</h1>
          <p className="text-muted-foreground mt-1">Consultez, téléchargez et payez vos factures</p>
        </div>

        {/* ─── Section A: Facture actuelle ─── */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="w-5 h-5 text-teal-600" />
              Facture actuelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentInvoice ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-foreground">
                      {currentInvoice.invoice_number || currentInvoice.id?.slice(0, 8).toUpperCase()}
                    </span>
                    <Badge className={STATUS_COLORS[currentInvoice.status] || "bg-muted text-muted-foreground"}>
                      {STATUS_LABELS[currentInvoice.status] || currentInvoice.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[currentInvoice._type] || "Facture"}
                    </Badge>
                  </div>
                  {currentInvoice.due_date && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Échéance : {format(parseISO(currentInvoice.due_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                  <p className="text-xl font-bold text-amber-700">
                    Solde dû : {cad(getBalanceDue(currentInvoice))}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {isInvoiceOpen(currentInvoice) && (
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                      onClick={() => handlePayInvoice(currentInvoice)}
                    >
                      <DollarSign className="w-4 h-4" />
                      Payer
                    </Button>
                  )}
                  <Button variant="outline" className="gap-1.5" onClick={() => handleViewPDF(currentInvoice)}>
                    <FileText className="w-4 h-4" />
                    Voir PDF
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => handleDownloadPDF(currentInvoice)}>
                    <Download className="w-4 h-4" />
                    Télécharger
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-muted-foreground font-medium">Aucune facture en attente</p>
                <p className="text-sm text-muted-foreground mt-1">Toutes vos factures sont à jour.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section B: Historique des factures ─── */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-teal-600" />
                Historique des factures
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
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
              </div>
            ) : filteredInvoices.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filteredInvoices.map((inv: any) => {
                    const balance = getBalanceDue(inv);
                    const open = isInvoiceOpen(inv);
                    return (
                      <div key={inv.id} className="p-4 rounded-lg border border-border bg-card">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-mono text-sm font-semibold">{inv.invoice_number || inv.id?.slice(0, 8)}</span>
                            <div className="flex gap-1.5 mt-1">
                              <Badge className={STATUS_COLORS[inv.status] || "bg-muted text-muted-foreground"} >
                                {STATUS_LABELS[inv.status] || inv.status}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {TYPE_LABELS[inv._type] || "Facture"}
                              </Badge>
                            </div>
                          </div>
                          <span className="font-bold">{cad(Number(inv.amount || inv.total || 0))}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span>{format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}</span>
                          {inv.due_date && <span>Éch. {format(parseISO(inv.due_date), "d MMM", { locale: fr })}</span>}
                          {balance > 0 && <span className="text-amber-600 font-medium">Solde: {cad(balance)}</span>}
                        </div>
                        <div className="flex gap-2">
                          {open && (
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8" onClick={() => handlePayInvoice(inv)}>
                              <DollarSign className="w-3.5 h-3.5 mr-1" />Payer
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleViewPDF(inv)}>
                            <FileText className="w-3.5 h-3.5 mr-1" />PDF
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadPDF(inv)}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">N° Facture</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solde dû</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv: any) => {
                        const balance = getBalanceDue(inv);
                        const open = isInvoiceOpen(inv);
                        const isOverdue = inv.status === "overdue" || (inv.due_date && isPast(parseISO(inv.due_date)) && open);
                        return (
                          <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 text-sm font-mono font-semibold text-foreground">
                              {inv.invoice_number || inv.id?.slice(0, 8)}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-xs">
                                {TYPE_LABELS[inv._type] || "Facture"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm font-medium text-foreground">
                              {cad(Number(inv.amount || inv.total || 0))}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {balance <= 0 ? (
                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />0,00 $
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">{cad(balance)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={STATUS_COLORS[isOverdue ? "overdue" : inv.status] || "bg-muted text-muted-foreground"}>
                                {isOverdue ? STATUS_LABELS.overdue : STATUS_LABELS[inv.status] || inv.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1.5">
                                {open && (
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                                    onClick={() => handlePayInvoice(inv)}
                                  >
                                    <DollarSign className="w-3.5 h-3.5 mr-1" />Payer
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleViewPDF(inv)} title="Voir PDF">
                                  <FileText className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadPDF(inv)} title="Télécharger PDF">
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
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
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Aucune facture disponible</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PDF Viewer */}
      <PDFViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        filename={pdfFilename}
        isLoading={pdfLoading}
      />

      {/* Pay Invoice */}
      <PayInvoiceDialog
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        invoice={payingInvoice}
        totalDue={payingInvoice ? getBalanceDue(payingInvoice) : 0}
        profile={profile}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </ClientLayout>
  );
};

export default ClientInvoices;
