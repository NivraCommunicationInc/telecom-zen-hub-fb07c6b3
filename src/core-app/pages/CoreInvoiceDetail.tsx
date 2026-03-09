/**
 * Nivra Core — Invoice Detail (ops-grade)
 * Reuses useAdminInvoiceDetail hook — zero duplicated business logic.
 * Document actions use canonical PDF services.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAdminInvoiceDetail } from "@/hooks/admin/useAdminInvoiceDetail";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Loader2, ArrowLeft, RefreshCw, FileText, User, Mail, Phone, Hash, Eye, Download, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { generateCanonicalInvoicePDF } from "@/lib/pdf/canonicalDocumentService";
import { adminClient } from "@/integrations/backend";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { toast } from "sonner";

const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", partially_paid: "Partielle",
  paid: "Payée", paid_by_promo: "Promo", failed: "Échouée",
  cancelled: "Annulée", refunded: "Remboursée", overdue: "En retard",
  void: "Annulée", not_renewed: "Non renouvelée",
};

const InfoRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex justify-between py-1.5 border-b border-[hsl(220,15%,13%)] last:border-0">
    <span className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider font-medium">{label}</span>
    <span className={`text-xs text-white ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

const CoreInvoiceDetail = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data: inv, isLoading, refetch } = useAdminInvoiceDetail(invoiceId);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleViewInvoicePDF = async () => {
    if (!invoiceId) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const result = await generateCanonicalInvoicePDF(adminClient, invoiceId);
      if (result.success && result.blob) {
        setPdfBlob(result.blob);
        setPdfOpen(true);
      } else {
        setPdfError(result.error || "Erreur de génération");
        toast.error(result.error || "Erreur de génération du PDF");
      }
    } catch (err: any) {
      setPdfError(err.message || "Erreur inattendue");
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadInvoicePDF = async () => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Facture_${inv?.invoice_number || ""}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await handleViewInvoicePDF();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[hsl(220,10%,40%)]" /></div>;
  }

  if (!inv) {
    return (
      <div className="py-20 text-center">
        <FileText className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-[hsl(220,10%,40%)] text-xs">Facture introuvable</p>
        <Link to="/core/invoices" className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour aux factures</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link to="/core/invoices" className="flex items-center gap-1.5 text-[12px] text-[hsl(220,10%,50%)] hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Factures
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={handleViewInvoicePDF} disabled={pdfLoading} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:border-blue-500/30 transition-colors disabled:opacity-50">
            {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Voir PDF
          </button>
          <button onClick={handleDownloadInvoicePDF} disabled={pdfLoading} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Télécharger
          </button>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* PDF Error */}
      {pdfError && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300">{pdfError}</p>
        </div>
      )}

      {/* Header */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[hsl(220,15%,16%)] flex items-center justify-center">
              <FileText className="h-5 w-5 text-[hsl(220,10%,45%)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight font-mono">{inv.invoice_number}</h1>
              <p className="text-[hsl(220,10%,50%)] text-xs mt-0.5 capitalize">{inv.type}</p>
            </div>
          </div>
          <StatusBadge label={STATUS_LABELS[inv.status ?? ""] || inv.status || "—"} variant={statusToVariant(inv.status ?? "")} size="sm" />
        </div>

        {/* Client + Meta */}
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Client</p>
            <p className="text-white text-xs flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />{inv.customer_name || "—"}</p>
            {inv.customer_email && <p className="text-[hsl(220,10%,45%)] text-[11px] flex items-center gap-1.5"><Mail className="h-3 w-3" />{inv.customer_email}</p>}
            {inv.customer_phone && <p className="text-[hsl(220,10%,45%)] text-[11px] flex items-center gap-1.5"><Phone className="h-3 w-3" />{inv.customer_phone}</p>}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Références</p>
            {inv.account_number && <p className="text-[hsl(220,10%,50%)] text-[11px] flex items-center gap-1.5"><Hash className="h-3 w-3" />Compte {inv.account_number}</p>}
            {inv.order_number && <p className="text-blue-400 text-[11px] font-mono">Commande {inv.order_number}</p>}
            <p className="text-[hsl(220,10%,45%)] text-[11px]">Créée le {fmtDate(inv.created_at)}</p>
            <p className="text-[hsl(220,10%,45%)] text-[11px]">Échéance {fmtDate(inv.due_date)}</p>
            {inv.paid_at && <p className="text-emerald-400 text-[11px]">Payée le {fmtDate(inv.paid_at)}</p>}
          </div>
        </div>
      </div>

      {/* Financial Breakdown + Balance */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-3">Ventilation financière</p>
          <InfoRow label="Sous-total" value={fmtCAD(inv.subtotal)} mono />
          {(inv.fees ?? 0) > 0 && <InfoRow label="Frais" value={fmtCAD(inv.fees)} mono />}
          {(inv.activation_fee ?? 0) > 0 && <InfoRow label="Frais d'activation" value={fmtCAD(inv.activation_fee)} mono />}
          <InfoRow label="TPS (5%)" value={fmtCAD(inv.tps_amount)} mono />
          <InfoRow label="TVQ (9.975%)" value={fmtCAD(inv.tvq_amount)} mono />
          <div className="flex justify-between py-2 mt-1 border-t border-[hsl(220,15%,18%)]">
            <span className="text-xs font-semibold text-white">Total</span>
            <span className="text-sm font-bold text-white font-mono">{fmtCAD(inv.total)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium">Payé</p>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-1">{fmtCAD(inv.amount_paid)}</p>
          </div>
          <div className={`rounded-lg border p-4 text-center ${(inv.balance_due ?? 0) > 0 ? "border-red-500/30 bg-red-500/5" : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]"}`}>
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium">Solde dû</p>
            <p className={`text-lg font-bold font-mono mt-1 ${(inv.balance_due ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>{fmtCAD(inv.balance_due)}</p>
          </div>
        </div>
      </div>

      {/* Invoice Lines */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Lignes de facturation ({inv.lines.length})</p>
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Description", "Type", "Qté", "Prix unit.", "Total"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.lines.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,30%)] text-xs">Aucune ligne</td></tr>
              ) : inv.lines.map(l => (
                <tr key={l.id} className="border-b border-[hsl(220,15%,13%)] last:border-0">
                  <td className="px-3 py-2 text-white">{l.description}</td>
                  <td className="px-3 py-2 text-[hsl(220,10%,50%)]">{l.line_type}</td>
                  <td className="px-3 py-2 tabular-nums text-[hsl(220,10%,50%)]">{l.quantity}</td>
                  <td className="px-3 py-2 tabular-nums text-[hsl(220,10%,50%)] font-mono">{fmtCAD(l.unit_price)}</td>
                  <td className="px-3 py-2 tabular-nums text-white font-mono font-medium">{fmtCAD(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Paiements appliqués ({inv.payments.length})</p>
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["#", "Montant", "Méthode", "Statut", "Référence", "Reçu le", "Par"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.payments.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[hsl(220,10%,30%)] text-xs">Aucun paiement</td></tr>
              ) : inv.payments.map(p => (
                <tr key={p.id} className="border-b border-[hsl(220,15%,13%)] last:border-0">
                  <td className="px-3 py-2 font-mono text-white">{p.payment_number}</td>
                  <td className="px-3 py-2 tabular-nums text-emerald-400 font-medium font-mono">{fmtCAD(p.amount)}</td>
                  <td className="px-3 py-2 text-[hsl(220,10%,55%)] capitalize">{p.method}</td>
                  <td className="px-3 py-2"><StatusBadge label={p.status || "—"} variant={statusToVariant(p.status || "")} size="sm" /></td>
                  <td className="px-3 py-2 font-mono text-[hsl(220,10%,40%)] text-[11px]">{p.reference || "—"}</td>
                  <td className="px-3 py-2 text-[hsl(220,10%,40%)] whitespace-nowrap">{fmtDate(p.received_at)}</td>
                  <td className="px-3 py-2 text-[hsl(220,10%,40%)] truncate max-w-[100px]">{p.confirmed_by_name || p.created_by_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {inv.notes && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] font-medium mb-2">Notes</p>
          <p className="text-[hsl(220,10%,55%)] text-xs whitespace-pre-wrap">{inv.notes}</p>
        </div>
      )}

      {/* PDF Viewer Dialog */}
      <PDFViewerDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        pdfBlob={pdfBlob}
        title={`Facture ${inv.invoice_number}`}
        filename={`Facture_${inv.invoice_number}.pdf`}
      />
    </div>
  );
};

export default CoreInvoiceDetail;
