import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
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
import PDFViewerDialog from "@/components/PDFViewerDialog";
import PayInvoiceDialog from "@/components/client/PayInvoiceDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchInvoiceBreakdowns, type InvoiceBreakdown } from "@/lib/billing/useInvoiceBreakdown";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { useClientPDF } from "@/hooks/useClientPDF";

/**
 * ClientInvoices — CANONICAL DOCUMENT ARCHITECTURE
 *
 * This page does NOT generate documents independently.
 * It uses the canonical document service (same engine as admin).
 * All financial data comes from compute_invoice_breakdown RPC.
 * All PDF generation uses the canonical pipeline.
 * Zero client-side math. Zero ad-hoc data assembly.
 */

/* ─── Dark tokens ───────────────────────────────────────────── */
const D = {
  bg:        "#0A0A0F",
  card:      "#111122",
  border:    "rgba(124,58,237,0.2)",
  borderLt:  "rgba(124,58,237,0.12)",
  text:      "#FFFFFF",
  textSec:   "#A0A0B8",
  textMuted: "#6B6B85",
  accent:    "#7C3AED",
  accentLt:  "#a78bfa",
  success:   "rgba(16,185,129,0.12)",
  successTx: "#34d399",
  successBd: "rgba(16,185,129,0.3)",
  warning:   "rgba(245,158,11,0.12)",
  warningTx: "#fbbf24",
  warningBd: "rgba(245,158,11,0.3)",
  error:     "rgba(239,68,68,0.12)",
  errorTx:   "#f87171",
};

// ─── Status config (dark mode) ─────────────────────────────────────────
const STATUS_DARK: Record<string, { bg: string; color: string; border: string }> = {
  pending:        { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
  paid:           { bg: "rgba(16,185,129,0.12)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  paid_by_promo:  { bg: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "rgba(124,58,237,0.3)" },
  overdue:        { bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(239,68,68,0.3)"  },
  partially_paid: { bg: "rgba(249,115,22,0.12)", color: "#fb923c", border: "rgba(249,115,22,0.3)" },
  void:           { bg: "rgba(107,107,133,0.12)",color: "#6B6B85", border: "rgba(107,107,133,0.3)"},
  cancelled:      { bg: "rgba(107,107,133,0.12)",color: "#6B6B85", border: "rgba(107,107,133,0.3)"},
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

/* ─── Dark status badge ─────────────────────────────────────── */
const DarkBadge = ({ status, label }: { status: string; label: string }) => {
  const s = STATUS_DARK[status] || { bg: "rgba(107,107,133,0.12)", color: "#6B6B85", border: "rgba(107,107,133,0.3)" };
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {label}
    </span>
  );
};

/* ─── Dark card ─────────────────────────────────────────────── */
const DCard = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden", ...style }}>
    {children}
  </div>
);

const DCardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderBottom: `1px solid ${D.borderLt}` }}>
    {children}
  </div>
);

// ─── Component ───────────────────────────────────────────────────────
const ClientInvoices = () => {
  const { user } = useClientAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState("all");

  // PDF state
  // PDF viewer state — kept for legacy compat; server-side generation opens in new tab directly

  // Pay dialog state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<InvoiceBreakdown | null>(null);
  const { data: canonicalData, isLoading: canonicalLoading } = useCanonicalClientData(user?.id);

  const profile = canonicalData?.profile;

  // ── Fetch V2 invoice IDs (with order_id fallback), then get breakdowns from RPC ──
  const { data: breakdowns, isLoading } = useQuery({
    queryKey: ["client-invoice-breakdowns", user?.id],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) return [];
      const invoices = canonicalData?.invoices || [];
      if (invoices.length === 0) return [];

      const ids = invoices.map((i) => i.id);
      const bdMap = await fetchInvoiceBreakdowns(ids, portalSupabase);

      const result: InvoiceBreakdown[] = [];
      for (const inv of invoices) {
        const bd = bdMap.get(inv.id);
        if (!bd) {
          console.warn(`[ClientInvoices] Missing breakdown for invoice ${inv.id} — skipping`);
          continue;
        }

        const totalMatch = Math.round((Number(bd.total) || 0) * 100) === Math.round((Number(inv.total) || 0) * 100);
        const balanceMatch = Math.round((Number(bd.balance_due) || 0) * 100) === Math.round((Number(inv.balance_due) || 0) * 100);
        const statusMatch = bd.status === inv.status;
        const invoiceNumberMatch = bd.invoice_number === inv.invoice_number;

        if (!totalMatch || !balanceMatch || !statusMatch || !invoiceNumberMatch) {
          console.warn(`[ClientInvoices] Data mismatch on invoice ${inv.id} — displaying breakdown data`);
        }

        result.push(bd);
      }

      return result;
    },
    enabled: !!user?.id && !canonicalLoading,
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

  // ── CANONICAL PDF generation ──
    const clientPDF = useClientPDF();

  const handleViewPDF        = useCallback((bd: InvoiceBreakdown) => clientPDF.view("invoice", bd.invoice_id), [clientPDF]);
  const handleDownloadPDF    = useCallback((bd: InvoiceBreakdown) => clientPDF.download("invoice", bd.invoice_id), [clientPDF]);
  const handleViewReceiptPDF = useCallback((bd: InvoiceBreakdown) => clientPDF.view("receipt", bd.invoice_id), [clientPDF]);
  const handleDownloadReceiptPDF = useCallback((bd: InvoiceBreakdown) => clientPDF.download("receipt", bd.invoice_id), [clientPDF]);
  const handleViewOrderSummaryPDF = useCallback((bd: InvoiceBreakdown) => {
    if (!bd.order_id) { toast.error("Sommaire non disponible — commande non liée"); return; }
    clientPDF.view("summary", bd.order_id);
  }, [clientPDF]);
  const handleDownloadOrderSummaryPDF = useCallback((bd: InvoiceBreakdown) => {
    if (!bd.order_id) { toast.error("Sommaire non disponible — commande non liée"); return; }
    clientPDF.download("summary", bd.order_id);
  }, [clientPDF]);

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

  const cad = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  const getDisplayStatus = (bd: InvoiceBreakdown) => (bd as any).display_status || bd.status;

  // ── CSV export ──
  const handleExportCSV = useCallback(() => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      toast.error("Aucune facture à exporter");
      return;
    }
    const headers = ["Numero","Date","Type","Statut","Sous-total","Rabais","TPS","TVQ","Total","Montant paye","Solde du","Echeance"];
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
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
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
      <div className="space-y-6" style={{ color: D.text }}>

        {/* Breadcrumb */}
        <nav className="text-sm flex items-center gap-1.5" style={{ color: D.textMuted }}>
          <span>MonNivra</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-medium" style={{ color: D.text }}>Mes factures</span>
        </nav>

        {/* Page Header */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0A0A0F 0%,#1A0A2E 60%,#0D0D1F 100%)", border: `1px solid ${D.border}`, padding: "24px 28px" }}>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 300, height: 300, top: -80, right: -60, background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent)", filter: "blur(40px)" }} />
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: D.text }}>Mes factures</h1>
            <p className="mt-1" style={{ color: D.textSec }}>Consultez, téléchargez et payez vos factures</p>
          </div>
        </div>

        {/* ─── Facture actuelle ─── */}
        <DCard>
          <DCardHeader>
            <div className="flex items-center gap-2 text-lg font-bold" style={{ color: D.text }}>
              <Receipt className="w-5 h-5" style={{ color: D.accentLt }} />
              Facture actuelle
            </div>
          </DCardHeader>
          <div className="p-6">
            {currentInvoice ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl" style={{ background: D.warning, border: `1px solid ${D.warningBd}` }}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold" style={{ color: D.text }}>
                      {currentInvoice.invoice_number}
                    </span>
                    <DarkBadge status={getDisplayStatus(currentInvoice)} label={STATUS_LABELS[getDisplayStatus(currentInvoice)] || currentInvoice.status} />
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.12)", color: D.accentLt, border: `1px solid rgba(124,58,237,0.25)` }}>
                      {TYPE_LABELS[currentInvoice.type] || "Facture"}
                    </span>
                  </div>
                  {currentInvoice.due_date && (
                    <p className="text-sm flex items-center gap-1.5" style={{ color: D.textSec }}>
                      <Calendar className="w-3.5 h-3.5" />
                      Échéance : {format(parseISO(currentInvoice.due_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                  <p className="text-xl font-bold" style={{ color: D.warningTx }}>
                    Solde dû : {cad(currentInvoice.balance_due)}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {isOpen(currentInvoice) && (
                    <Button
                      className="gap-1.5"
                      onClick={() => handlePayInvoice(currentInvoice)}
                      style={{ background: "#7C3AED", color: "#FFFFFF", border: "none" }}
                    >
                      <DollarSign className="w-4 h-4" />
                      Payer
                    </Button>
                  )}
                  <Button variant="outline" className="gap-1.5" onClick={() => handleViewPDF(currentInvoice)}
                    style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                    <FileText className="w-4 h-4" />
                    Facture
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => handleViewReceiptPDF(currentInvoice)}
                    style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                    <Receipt className="w-4 h-4" />
                    Reçu
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => handleViewOrderSummaryPDF(currentInvoice)}
                    style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                    <ScrollText className="w-4 h-4" />
                    Sommaire
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => handleDownloadPDF(currentInvoice)}
                    style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                    <Download className="w-4 h-4" />
                    Télécharger facture
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: D.successTx }} />
                <p className="font-medium" style={{ color: D.text }}>Aucune facture en attente</p>
                <p className="text-sm mt-1" style={{ color: D.textSec }}>Toutes vos factures sont à jour.</p>
              </div>
            )}
          </div>
        </DCard>

        {/* ─── Historique ─── */}
        <DCard>
          <DCardHeader>
            <div className="flex items-center gap-2 text-lg font-bold" style={{ color: D.text }}>
              <FileText className="w-5 h-5" style={{ color: D.accentLt }} />
              Historique des factures
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={filterTab} onValueChange={setFilterTab}>
                <TabsList className="h-auto flex-wrap" style={{ background: "#1A1A2E", border: `1px solid ${D.border}` }}>
                  {["all","pending","paid","overdue"].map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm"
                      style={filterTab === tab ? { background: "#7C3AED", color: "#FFFFFF" } : { color: D.textSec }}>
                      {tab === "all" ? "Toutes" : tab === "pending" ? "En attente" : tab === "paid" ? "Payées" : "En retard"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleExportCSV}
                disabled={!filteredInvoices.length}
                title="Exporter la sélection en CSV (Excel)"
                style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exporter CSV
              </Button>
            </div>
          </DCardHeader>

          <div className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "#1A1A2E" }} />
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
                      <div key={bd.invoice_id} className="p-4 rounded-xl" style={{ background: "#0D0D1F", border: `1px solid ${D.border}` }}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-mono text-sm font-semibold" style={{ color: D.text }}>{bd.invoice_number}</span>
                            <div className="flex gap-1.5 mt-1">
                              <DarkBadge status={ds} label={STATUS_LABELS[ds] || ds} />
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.1)", color: D.accentLt, border: "1px solid rgba(124,58,237,0.2)" }}>
                                {TYPE_LABELS[bd.type] || "Facture"}
                              </span>
                            </div>
                          </div>
                          <span className="font-bold" style={{ color: D.text }}>{cad(bd.total)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs mb-3" style={{ color: D.textMuted }}>
                          <span>{format(new Date(bd.created_at), "d MMM yyyy", { locale: fr })}</span>
                          {bd.due_date && <span>Éch. {format(parseISO(bd.due_date), "d MMM", { locale: fr })}</span>}
                          {bd.balance_due > 0 && <span style={{ color: D.warningTx, fontWeight: 600 }}>Solde: {cad(bd.balance_due)}</span>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {open && (
                            <Button size="sm" className="text-xs h-8" onClick={() => handlePayInvoice(bd)}
                              style={{ background: "#7C3AED", color: "#FFFFFF", border: "none" }}>
                              <DollarSign className="w-3.5 h-3.5 mr-1" />
                              Payer
                            </Button>
                          )}
                          {[
                            { label: "Facture", fn: () => handleViewPDF(bd), icon: <FileText className="w-3.5 h-3.5 mr-1" /> },
                            { label: "Reçu", fn: () => handleViewReceiptPDF(bd), icon: <Receipt className="w-3.5 h-3.5 mr-1" /> },
                            { label: "Sommaire", fn: () => handleViewOrderSummaryPDF(bd), icon: <ScrollText className="w-3.5 h-3.5 mr-1" /> },
                          ].map((btn) => (
                            <Button key={btn.label} size="sm" variant="outline" className="h-8 text-xs" onClick={btn.fn}
                              style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                              {btn.icon}{btn.label}
                            </Button>
                          ))}
                          {[
                            { title: "Télécharger facture", fn: () => handleDownloadPDF(bd) },
                            { title: "Télécharger reçu", fn: () => handleDownloadReceiptPDF(bd) },
                            { title: "Télécharger sommaire", fn: () => handleDownloadOrderSummaryPDF(bd) },
                          ].map((btn) => (
                            <Button key={btn.title} size="sm" variant="outline" className="h-8 w-8 p-0" onClick={btn.fn} title={btn.title}
                              style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full" style={{ color: D.text }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                        {["N° Facture","Date","Type","Sous-total","Rabais","Total","Solde dû","Statut","Actions"].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-sm font-medium" style={{ color: D.textMuted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((bd) => {
                        const open = isOpen(bd);
                        const ds = getDisplayStatus(bd);
                        return (
                          <tr key={bd.invoice_id}
                            style={{ borderBottom: `1px solid rgba(124,58,237,0.08)` }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.05)"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                          >
                            <td className="py-3 px-4 text-sm font-mono font-semibold" style={{ color: D.text }}>{bd.invoice_number}</td>
                            <td className="py-3 px-4 text-sm" style={{ color: D.textSec }}>
                              {format(new Date(bd.created_at), "d MMM yyyy", { locale: fr })}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.1)", color: D.accentLt, border: "1px solid rgba(124,58,237,0.2)" }}>
                                {TYPE_LABELS[bd.type] || "Facture"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm" style={{ color: D.textSec }}>{cad(bd.subtotal)}</td>
                            <td className="py-3 px-4 text-sm">
                              {bd.discounts_total > 0 ? (
                                <span style={{ color: D.successTx }}>-{cad(bd.discounts_total)}</span>
                              ) : (
                                <span style={{ color: D.textMuted }}>—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm font-medium" style={{ color: D.text }}>{cad(bd.total)}</td>
                            <td className="py-3 px-4 text-sm">
                              {bd.balance_due <= 0 ? (
                                <span className="flex items-center gap-1 font-medium" style={{ color: D.successTx }}>
                                  <CheckCircle className="w-3 h-3" />
                                  0,00 $
                                </span>
                              ) : (
                                <span className="font-medium" style={{ color: D.warningTx }}>{cad(bd.balance_due)}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <DarkBadge status={ds} label={STATUS_LABELS[ds] || ds} />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1.5 flex-wrap">
                                {open && (
                                  <Button size="sm" className="h-8 px-3 text-xs" onClick={() => handlePayInvoice(bd)}
                                    style={{ background: "#7C3AED", color: "#FFFFFF", border: "none" }}>
                                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                                    Payer
                                  </Button>
                                )}
                                {[
                                  { title: "Voir facture", fn: () => handleViewPDF(bd), Icon: FileText },
                                  { title: "Voir reçu", fn: () => handleViewReceiptPDF(bd), Icon: Receipt },
                                  { title: "Voir sommaire", fn: () => handleViewOrderSummaryPDF(bd), Icon: ScrollText },
                                  { title: "Télécharger facture", fn: () => handleDownloadPDF(bd), Icon: Download },
                                  { title: "Télécharger reçu", fn: () => handleDownloadReceiptPDF(bd), Icon: Receipt },
                                  { title: "Télécharger sommaire", fn: () => handleDownloadOrderSummaryPDF(bd), Icon: ScrollText },
                                ].map(({ title, fn, Icon }) => (
                                  <Button key={title} size="sm" variant="outline" className="h-8 w-8 p-0" onClick={fn} title={title}
                                    style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
                                    <Icon className="w-3.5 h-3.5" />
                                  </Button>
                                ))}
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
                <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: D.textMuted }} />
                <p className="font-medium" style={{ color: D.textSec }}>Aucune facture disponible</p>
              </div>
            )}
          </div>
        </DCard>
      </div>

      {/* PDF Viewer — server-side generation now opens in new tab directly */}

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
