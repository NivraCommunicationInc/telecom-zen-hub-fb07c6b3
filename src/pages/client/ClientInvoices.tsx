import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { FileText, Download, DollarSign, CheckCircle, Calendar, ChevronRight, Receipt, AlertCircle, ScrollText, FileSpreadsheet } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { safePDFDownload } from "@/lib/pdfUtils";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import PayInvoiceDialog from "@/components/client/PayInvoiceDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchInvoiceBreakdowns, type InvoiceBreakdown } from "@/lib/billing/useInvoiceBreakdown";
import { generateCanonicalInvoicePDF, generateCanonicalOrderSummaryPDF, generateCanonicalReceiptPDF } from "@/lib/pdf";

/**
 * ClientInvoices — CANONICAL DOCUMENT ARCHITECTURE
 * 
 * This page does NOT generate documents independently.
 * It uses the canonical document service (same engine as admin).
 * All financial data comes from compute_invoice_breakdown RPC.
 * All PDF generation uses the canonical pipeline.
 * Zero client-side math. Zero ad-hoc data assembly.
 */

// ─── Status config ───────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  paid_by_promo: "bg-purple-100 text-purple-700",
  overdue: "bg-red-100 text-red-700",
  partially_paid: "bg-orange-100 text-orange-700",
  void: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payée",
  paid_by_promo: "Payée par promo",
  overdue: "En retard",
  partially_paid: "Partiel",
  void: "Annulée",
  cancelled: "Annulée",
};

const TYPE_LABELS: Record<string, string> = {
  renewal: "Mensuelle",
  initial: "Achat",
  adjustment: "Ajustement",
  credit: "Crédit",
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
  const [payingInvoice, setPayingInvoice] = useState<InvoiceBreakdown | null>(null);

  // ── Profile (for pay dialog only, NOT for document generation) ──
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data } = await portalSupabase
        .from("profiles")
        .select("full_name, email, phone, client_number, service_address, service_city, service_postal_code")
        .eq("user_id", user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // ── Fetch V2 invoice IDs, then get breakdowns from RPC ──
  const { data: breakdowns, isLoading } = useQuery({
    queryKey: ["client-invoice-breakdowns", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!customer) return [];

      const { data: invoices } = await portalSupabase
        .from("billing_invoices")
        .select("id, invoice_number, total, status, balance_due")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (!invoices || invoices.length === 0) return [];

      const ids = invoices.map((i) => i.id);
      const bdMap = await fetchInvoiceBreakdowns(ids, portalSupabase);

      const result: InvoiceBreakdown[] = [];
      for (const inv of invoices) {
        const bd = bdMap.get(inv.id);
        if (!bd) {
          throw new Error(`CANONICAL_INVARIANT_VIOLATION: Missing breakdown for invoice ${inv.id}`);
        }

        const totalMatch = Math.round((Number(bd.total) || 0) * 100) === Math.round((Number(inv.total) || 0) * 100);
        const balanceMatch = Math.round((Number(bd.balance_due) || 0) * 100) === Math.round((Number(inv.balance_due) || 0) * 100);
        const statusMatch = bd.status === inv.status;
        const invoiceNumberMatch = bd.invoice_number === inv.invoice_number;

        if (!totalMatch || !balanceMatch || !statusMatch || !invoiceNumberMatch) {
          throw new Error(`CANONICAL_INVARIANT_VIOLATION: Portal/Core mismatch on invoice ${inv.id}`);
        }

        result.push(bd);
      }

      return result;
    },
    enabled: !!user?.id,
  });

  // ── Derived data ──
  const isOpen = (bd: InvoiceBreakdown) => {
    const s = bd.status;
    if (["paid", "paid_by_promo", "void", "cancelled"].includes(s)) return false;
    return bd.balance_due_cents > 0;
  };

  const pendingInvoices = useMemo(() => breakdowns?.filter(isOpen) || [], [breakdowns]);
  const currentInvoice = pendingInvoices[0] || null;

  const filteredInvoices = useMemo(() => {
    if (!breakdowns) return [];
    if (filterTab === "all") return breakdowns;
    return breakdowns.filter((bd) => {
      const ds = (bd as any).display_status || bd.status;
      return ds === filterTab;
    });
  }, [breakdowns, filterTab]);

  // ── CANONICAL PDF generation — uses the same engine as admin ──
  const handleViewPDF = useCallback(
    async (bd: InvoiceBreakdown) => {
      try {
        setPdfLoading(true);
        setPdfViewerOpen(true);
        setPdfTitle(`Facture ${bd.invoice_number}`);
        setPdfFilename(`Facture_${bd.invoice_number}.pdf`);
        
        // Use CANONICAL document service — identical to admin
        const result = await generateCanonicalInvoicePDF(portalSupabase, bd.invoice_id);
        if (result.success && result.blob) {
          setPdfBlob(result.blob);
        } else {
          throw new Error(result.error || "Document non disponible");
        }
      } catch (error: any) {
        console.error("[ClientInvoices] PDF error:", error);
        toast.error(error.message || "Erreur lors de la génération du PDF");
        setPdfViewerOpen(false);
      } finally {
        setPdfLoading(false);
      }
    },
    [],
  );

  const handleDownloadPDF = useCallback(
    async (bd: InvoiceBreakdown) => {
      try {
        // Use CANONICAL document service — identical to admin
        const result = await generateCanonicalInvoicePDF(portalSupabase, bd.invoice_id);
        if (result.success && result.blob && result.filename) {
          safePDFDownload(result.blob, result.filename);
          toast.success("Facture téléchargée");
        } else {
          throw new Error(result.error || "Document non disponible");
        }
      } catch (error: any) {
        console.error("[ClientInvoices] PDF download error:", error);
        toast.error("Impossible de générer la facture");
      }
    },
    [],
  );

  const handleViewReceiptPDF = useCallback(
    async (bd: InvoiceBreakdown) => {
      try {
        setPdfLoading(true);
        setPdfViewerOpen(true);
        setPdfTitle(`Reçu ${bd.invoice_number}`);
        setPdfFilename(`Recu_${bd.invoice_number}.pdf`);

        const result = await generateCanonicalReceiptPDF(portalSupabase, bd.invoice_id);
        if (result.success && result.blob) {
          setPdfBlob(result.blob);
        } else {
          throw new Error(result.error || "Reçu non disponible");
        }
      } catch (error: any) {
        console.error("[ClientInvoices] Receipt PDF error:", error);
        toast.error(error.message || "Erreur lors de la génération du reçu");
        setPdfViewerOpen(false);
      } finally {
        setPdfLoading(false);
      }
    },
    [],
  );

  const handleDownloadReceiptPDF = useCallback(
    async (bd: InvoiceBreakdown) => {
      try {
        const result = await generateCanonicalReceiptPDF(portalSupabase, bd.invoice_id);
        if (result.success && result.blob) {
          safePDFDownload(result.blob, result.filename || `Recu_${bd.invoice_number}.pdf`);
          toast.success("Reçu téléchargé");
        } else {
          throw new Error(result.error || "Reçu non disponible");
        }
      } catch (error: any) {
        console.error("[ClientInvoices] Receipt download error:", error);
        toast.error("Impossible de générer le reçu");
      }
    },
    [],
  );

  const handleViewOrderSummaryPDF = useCallback(
    async (bd: InvoiceBreakdown) => {
      if (!bd.order_id) {
        toast.error("Sommaire non disponible pour cette facture");
        return;
      }

      try {
        setPdfLoading(true);
        setPdfViewerOpen(true);
        setPdfTitle(`Sommaire ${bd.invoice_number}`);
        setPdfFilename(`Sommaire_${bd.invoice_number}.pdf`);

        const result = await generateCanonicalOrderSummaryPDF(portalSupabase, bd.order_id);
        if (result.success && result.blob) {
          setPdfBlob(result.blob);
        } else {
          throw new Error(result.error || "Sommaire non disponible");
        }
      } catch (error: any) {
        console.error("[ClientInvoices] Order summary PDF error:", error);
        toast.error(error.message || "Erreur lors de la génération du sommaire");
        setPdfViewerOpen(false);
      } finally {
        setPdfLoading(false);
      }
    },
    [],
  );

  const handleDownloadOrderSummaryPDF = useCallback(
    async (bd: InvoiceBreakdown) => {
      if (!bd.order_id) {
        toast.error("Sommaire non disponible pour cette facture");
        return;
      }

      try {
        const result = await generateCanonicalOrderSummaryPDF(portalSupabase, bd.order_id);
        if (result.success && result.blob) {
          safePDFDownload(result.blob, result.filename || `Sommaire_${bd.invoice_number}.pdf`);
          toast.success("Sommaire téléchargé");
        } else {
          throw new Error(result.error || "Sommaire non disponible");
        }
      } catch (error: any) {
        console.error("[ClientInvoices] Order summary download error:", error);
        toast.error("Impossible de générer le sommaire");
      }
    },
    [],
  );

  // ── Pay ──
  const handlePayInvoice = (bd: InvoiceBreakdown) => {
    setPayingInvoice(bd);
    setPayDialogOpen(true);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["client-invoice-breakdowns"] });
    queryClient.invalidateQueries({ queryKey: ["client-profile"] });
    queryClient.invalidateQueries({ queryKey: ["ledger-balance"] });
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
  const getDisplayStatus = (bd: InvoiceBreakdown) => (bd as any).display_status || bd.status;

  // ── CSV export of currently filtered invoices ──
  const handleExportCSV = useCallback(() => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      toast.error("Aucune facture à exporter");
      return;
    }
    const headers = [
      "Numero",
      "Date",
      "Type",
      "Statut",
      "Sous-total",
      "Rabais",
      "TPS",
      "TVQ",
      "Total",
      "Montant paye",
      "Solde du",
      "Echeance",
    ];
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredInvoices.map((bd) => [
      bd.invoice_number,
      format(new Date(bd.created_at), "yyyy-MM-dd"),
      TYPE_LABELS[bd.type] || bd.type,
      STATUS_LABELS[getDisplayStatus(bd)] || bd.status,
      Number(bd.subtotal || 0).toFixed(2),
      Number((bd as any).discounts_total || 0).toFixed(2),
      Number((bd as any).tps_amount || 0).toFixed(2),
      Number((bd as any).tvq_amount || 0).toFixed(2),
      Number(bd.total || 0).toFixed(2),
      Number((bd as any).amount_paid || 0).toFixed(2),
      Number(bd.balance_due || 0).toFixed(2),
      bd.due_date ? format(parseISO(bd.due_date), "yyyy-MM-dd") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    // Prepend BOM so Excel detects UTF-8 properly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factures_nivra_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filteredInvoices.length} facture(s) exportée(s)`);
  }, [filteredInvoices]);

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
                      {currentInvoice.invoice_number}
                    </span>
                    <Badge className={STATUS_COLORS[getDisplayStatus(currentInvoice)] || "bg-muted text-muted-foreground"}>
                      {STATUS_LABELS[getDisplayStatus(currentInvoice)] || currentInvoice.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[currentInvoice.type] || "Facture"}
                    </Badge>
                  </div>
                  {currentInvoice.due_date && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Échéance : {format(parseISO(currentInvoice.due_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                  <p className="text-xl font-bold text-amber-700">
                    Solde dû : {cad(currentInvoice.balance_due)}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {isOpen(currentInvoice) && (
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
                    Facture
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => handleViewReceiptPDF(currentInvoice)}>
                    <Receipt className="w-4 h-4" />
                    Reçu
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => handleViewOrderSummaryPDF(currentInvoice)}>
                    <ScrollText className="w-4 h-4" />
                    Sommaire
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => handleDownloadPDF(currentInvoice)}>
                    <Download className="w-4 h-4" />
                    Télécharger facture
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
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredInvoices.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filteredInvoices.map((bd) => {
                    const open = isOpen(bd);
                    const ds = getDisplayStatus(bd);
                    return (
                      <div key={bd.invoice_id} className="p-4 rounded-lg border border-border bg-card">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-mono text-sm font-semibold">{bd.invoice_number}</span>
                            <div className="flex gap-1.5 mt-1">
                              <Badge className={STATUS_COLORS[ds] || "bg-muted text-muted-foreground"}>
                                {STATUS_LABELS[ds] || ds}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {TYPE_LABELS[bd.type] || "Facture"}
                              </Badge>
                            </div>
                          </div>
                          <span className="font-bold">{cad(bd.total)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span>{format(new Date(bd.created_at), "d MMM yyyy", { locale: fr })}</span>
                          {bd.due_date && <span>Éch. {format(parseISO(bd.due_date), "d MMM", { locale: fr })}</span>}
                          {bd.balance_due > 0 && <span className="text-amber-600 font-medium">Solde: {cad(bd.balance_due)}</span>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {open && (
                            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8" onClick={() => handlePayInvoice(bd)}>
                              <DollarSign className="w-3.5 h-3.5 mr-1" />
                              Payer
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleViewPDF(bd)}>
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            Facture
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleViewReceiptPDF(bd)}>
                            <Receipt className="w-3.5 h-3.5 mr-1" />
                            Reçu
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleViewOrderSummaryPDF(bd)}>
                            <ScrollText className="w-3.5 h-3.5 mr-1" />
                            Sommaire
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadPDF(bd)} title="Télécharger facture">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadReceiptPDF(bd)} title="Télécharger reçu">
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadOrderSummaryPDF(bd)} title="Télécharger sommaire">
                            <ScrollText className="w-3.5 h-3.5" />
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
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Sous-total</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rabais</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solde dû</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((bd) => {
                        const open = isOpen(bd);
                        const ds = getDisplayStatus(bd);
                        return (
                          <tr key={bd.invoice_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 text-sm font-mono font-semibold text-foreground">{bd.invoice_number}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {format(new Date(bd.created_at), "d MMM yyyy", { locale: fr })}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-xs">
                                {TYPE_LABELS[bd.type] || "Facture"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">{cad(bd.subtotal)}</td>
                            <td className="py-3 px-4 text-sm">
                              {bd.discounts_total > 0 ? (
                                <span className="text-emerald-600">-{cad(bd.discounts_total)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm font-medium text-foreground">{cad(bd.total)}</td>
                            <td className="py-3 px-4 text-sm">
                              {bd.balance_due <= 0 ? (
                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  0,00 $
                                </span>
                              ) : (
                                <span className="text-amber-600 font-medium">{cad(bd.balance_due)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={STATUS_COLORS[ds] || "bg-muted text-muted-foreground"}>
                                {STATUS_LABELS[ds] || ds}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1.5 flex-wrap">
                                {open && (
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                                    onClick={() => handlePayInvoice(bd)}
                                  >
                                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                                    Payer
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleViewPDF(bd)} title="Voir facture">
                                  <FileText className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleViewReceiptPDF(bd)} title="Voir reçu">
                                  <Receipt className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleViewOrderSummaryPDF(bd)} title="Voir sommaire">
                                  <ScrollText className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadPDF(bd)} title="Télécharger facture">
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadReceiptPDF(bd)} title="Télécharger reçu">
                                  <Receipt className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleDownloadOrderSummaryPDF(bd)} title="Télécharger sommaire">
                                  <ScrollText className="w-3.5 h-3.5" />
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
        invoice={payingInvoice ? {
          id: payingInvoice.invoice_id,
          invoice_number: payingInvoice.invoice_number,
          total: payingInvoice.total,
          balance_due: payingInvoice.balance_due,
          status: payingInvoice.status,
        } : null}
        totalDue={payingInvoice?.balance_due || 0}
        profile={profile}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </ClientLayout>
  );
};

export default ClientInvoices;
