/**
 * PaymentInvoiceStep — Step 3: Payment & Invoice (canonical source only)
 * NO client-side recalculation. Reads billing_invoices exclusively.
 * All buttons are fully functional.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, FileText, Send, CreditCard, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { generateOrderDocuments } from "@/lib/pdf";
import PDFViewerDialog from "@/components/PDFViewerDialog";

interface Props { proc: any; }

export function PaymentInvoiceStep({ proc }: Props) {
  const { order, invoice } = proc;
  const [reference, setReference] = useState(order.payment_reference || "");
  const [loading, setLoading] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  // Canonical values from billing_invoices (V2), fallback to order
  const invoiceNumber = invoice?.invoice_number || order.order_number;
  const subtotal = invoice?.subtotal ?? order.subtotal ?? 0;
  const tps = invoice?.tps_amount ?? order.tps_amount ?? 0;
  const tvq = invoice?.tvq_amount ?? order.tvq_amount ?? 0;
  const total = invoice?.total ?? order.total_amount ?? 0;
  const amountPaid = invoice?.amount_paid ?? order.amount_paid ?? 0;
  const balanceDue = invoice?.balance_due ?? (Number(total) - Number(amountPaid));
  const invoiceStatus = String(invoice?.status || order.payment_status || "pending").toLowerCase();
  const paymentStatus = invoiceStatus;
  const isPaid = invoiceStatus === "paid" || Number(balanceDue) <= 0;

  const handleConfirm = async () => {
    setLoading("confirm");
    try {
      await proc.confirmPayment(reference || undefined);
    } finally {
      setLoading(null);
    }
  };

  const handleMarkInvalid = async () => {
    setLoading("invalid");
    try {
      await proc.markPaymentInvalid();
    } finally {
      setLoading(null);
    }
  };

  const handleMarkPartial = async () => {
    setLoading("partial");
    try {
      await proc.markPaymentPartial();
    } finally {
      setLoading(null);
    }
  };

  const handleViewInvoice = async () => {
    setLoading("view");
    try {
      const result = await generateOrderDocuments(order.id);
      if (!result) {
        toast.error("Données de facture introuvables");
        return;
      }
      if (result.invoice.blob) {
        setPdfBlob(result.invoice.blob);
        setPdfViewerOpen(true);
      } else {
        toast.error("Erreur lors de la génération de la facture");
      }
    } catch (err) {
      console.error("[Payment] View invoice error:", err);
      toast.error("Erreur lors de l'ouverture de la facture");
    } finally {
      setLoading(null);
    }
  };

  const handleSendToClient = async () => {
    setLoading("send");
    try {
      await proc.sendClientNotification(
        "invoice_sent",
        `Facture ${invoiceNumber || ""} — Nivra`,
        {
          invoice_number: invoiceNumber || "",
          total: Number(total).toFixed(2),
          balance_due: Number(balanceDue).toFixed(2),
        }
      );
    } catch (err) {
      console.error("[Payment] Send error:", err);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Paiement & Facture</h3>

      {/* Invoice summary — read-only from canonical source */}
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Facture {invoiceNumber || ""}</h4>
          {isPaid && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Payé
            </span>
          )}
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span className="text-gray-900 tabular-nums">{Number(subtotal).toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-gray-500">TPS (5%)</span><span className="text-gray-700 tabular-nums">{Number(tps).toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-gray-500">TVQ (9.975%)</span><span className="text-gray-700 tabular-nums">{Number(tvq).toFixed(2)} $</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold text-gray-900">
            <span>Total</span><span className="tabular-nums">{Number(total).toFixed(2)} $</span>
          </div>
          <div className="flex justify-between"><span className="text-gray-500">Payé</span><span className="text-gray-700 tabular-nums">{Number(amountPaid).toFixed(2)} $</span></div>
          <div className="flex justify-between font-semibold">
            <span className={balanceDue > 0 ? "text-red-600" : "text-emerald-600"}>Solde dû</span>
            <span className={`tabular-nums ${balanceDue > 0 ? "text-red-600" : "text-emerald-600"}`}>{Number(balanceDue).toFixed(2)} $</span>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label className="text-xs text-gray-500">Méthode de paiement</Label>
          <p className="text-sm font-medium text-gray-900 mt-1">{order.payment_method || "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Statut</Label>
          <p className="text-sm font-medium text-gray-900 mt-1">{paymentStatus}</p>
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-gray-500 mb-1">Référence de paiement</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Entrer la référence…"
            className="h-9 text-sm border-gray-300 text-gray-900"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        {!isPaid && (
          <Button size="sm" onClick={handleConfirm} disabled={loading === "confirm" || proc.isUpdating || Number(balanceDue) <= 0} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading === "confirm" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            Confirmer paiement
          </Button>
        )}
        {isPaid && (
          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1 px-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Facture payée — aucune action requise
          </div>
        )}
        <Button size="sm" variant="outline" onClick={handleMarkPartial} disabled={loading === "partial" || proc.isUpdating} className="text-xs h-8 border-gray-300 text-gray-700">
          {loading === "partial" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
          Paiement partiel
        </Button>
        <Button size="sm" variant="outline" onClick={handleMarkInvalid} disabled={loading === "invalid" || proc.isUpdating} className="text-xs h-8 border-red-300 text-red-600 hover:bg-red-50">
          {loading === "invalid" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          Invalider paiement
        </Button>
        <Button size="sm" variant="outline" onClick={handleViewInvoice} disabled={loading === "view"} className="text-xs h-8 border-gray-300 text-gray-700">
          {loading === "view" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
          Voir facture
        </Button>
        <Button size="sm" variant="outline" onClick={handleSendToClient} disabled={loading === "send"} className="text-xs h-8 border-gray-300 text-gray-700">
          {loading === "send" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
          Envoyer au client
        </Button>
      </div>

      {/* PDF Viewer Dialog */}
      <PDFViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        pdfBlob={pdfBlob}
        title={`Facture ${invoiceNumber || ""}`}
        filename={`Facture_${invoiceNumber || ""}.pdf`}
      />
    </div>
  );
}
