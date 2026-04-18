/**
 * PaymentInvoiceStep — Step 3: Payment & Invoice
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Send, CreditCard, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { generateOrderDocuments } from "@/lib/pdf";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { toMoney, toNonNegativeMoney } from "@/lib/pricing/money";
import { StepCompletionCard } from "../StepCompletionCard";

interface Props { proc: any; }

export function PaymentInvoiceStep({ proc }: Props) {
  const { order, invoice } = proc;
  const [reference, setReference] = useState(order.payment_reference || "");
  const [loading, setLoading] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  const invoiceNumber = invoice?.invoice_number || order.order_number;
  const subtotal = toNonNegativeMoney(invoice?.subtotal ?? order.subtotal ?? 0);
  const tps = toNonNegativeMoney(invoice?.tps_amount ?? order.tps_amount ?? 0);
  const tvq = toNonNegativeMoney(invoice?.tvq_amount ?? order.tvq_amount ?? 0);
  const total = toNonNegativeMoney(invoice?.total ?? (order.pricing_snapshot as any)?.grand_total ?? order.total_amount ?? 0);
  const amountPaid = toNonNegativeMoney(invoice?.amount_paid ?? order.amount_paid ?? 0);
  const balanceDue = toNonNegativeMoney(invoice?.balance_due ?? toMoney(total - amountPaid));
  const invoiceStatus = String(invoice?.status || order.payment_status || "pending").toLowerCase();
  const paymentStatus = invoiceStatus;
  const isPaid = invoiceStatus === "paid" || balanceDue <= 0;

  const handleConfirm = async () => {
    setLoading("confirm");
    try { await proc.confirmPayment(reference || undefined); } finally { setLoading(null); }
  };

  const handleMarkInvalid = async () => {
    setLoading("invalid");
    try { await proc.markPaymentInvalid(); } finally { setLoading(null); }
  };

  const handleMarkPartial = async () => {
    setLoading("partial");
    try { await proc.markPaymentPartial(); } finally { setLoading(null); }
  };

  const handleViewInvoice = async () => {
    setLoading("view");
    try {
      const result = await generateOrderDocuments(order.id);
      if (!result) { toast.error("Données de facture introuvables"); return; }
      if (result.invoice.blob) {
        setPdfBlob(result.invoice.blob);
        setPdfViewerOpen(true);
      } else {
        toast.error("Erreur lors de la génération de la facture");
      }
    } catch (err) {
      console.error("[Payment] View invoice error:", err);
      toast.error("Erreur lors de l'ouverture de la facture");
    } finally { setLoading(null); }
  };

  const handleSendToClient = async () => {
    setLoading("send");
    try {
      await proc.sendClientNotification("invoice_sent", `Facture ${invoiceNumber || ""} — Nivra`, {
        invoice_number: invoiceNumber || "",
        total: total.toFixed(2),
        balance_due: balanceDue.toFixed(2),
      });
    } catch (err) {
      console.error("[Payment] Send error:", err);
      toast.error("Erreur lors de l'envoi");
    } finally { setLoading(null); }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Étape 3 — Paiement & Facture</div>

      {isPaid && (
        <StepCompletionCard
          title="Paiement reçu et facture acquittée"
          at={invoice?.paid_at || order.payment_confirmed_at}
          details={[
            { label: "Montant payé", value: `${Number(amountPaid).toFixed(2)} $` },
            { label: "Méthode", value: order.payment_method },
            { label: "Référence", value: order.payment_reference, mono: true },
            { label: "Facture", value: invoiceNumber, mono: true },
          ]}
        />
      )}

      {/* Invoice card */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Facture {invoiceNumber || ""}</h4>
          {isPaid ? (
            <span className="bg-green-900/50 text-green-300 text-[10px] font-medium px-2 py-1 rounded-full inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Payé
            </span>
          ) : (
            <span className="bg-amber-900/50 text-amber-300 text-[10px] font-medium px-2 py-1 rounded-full">{paymentStatus}</span>
          )}
        </div>
        <div className="p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Sous-total</span><span className="text-slate-100 tabular-nums">{Number(subtotal).toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-slate-500">TPS (5%)</span><span className="text-slate-300 tabular-nums">{Number(tps).toFixed(2)} $</span></div>
          <div className="flex justify-between"><span className="text-slate-500">TVQ (9.975%)</span><span className="text-slate-300 tabular-nums">{Number(tvq).toFixed(2)} $</span></div>
          <div className="flex justify-between border-t border-slate-700/50 pt-1.5 font-bold text-slate-100">
            <span>Total</span><span className="tabular-nums">{Number(total).toFixed(2)} $</span>
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Payé</span><span className="text-slate-300 tabular-nums">{Number(amountPaid).toFixed(2)} $</span></div>
          <div className="flex justify-between font-semibold">
            <span className={balanceDue > 0 ? "text-red-300" : "text-green-300"}>Solde dû</span>
            <span className={`tabular-nums ${balanceDue > 0 ? "text-red-300" : "text-green-300"}`}>{Number(balanceDue).toFixed(2)} $</span>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Détails de paiement</h4>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Méthode</Label>
            <p className="text-sm font-medium text-slate-100">{order.payment_method || "—"}</p>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Statut</Label>
            <p className="text-sm font-medium text-slate-100">{paymentStatus}</p>
          </div>
          <div className="col-span-2">
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Référence de paiement</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Entrer la référence…"
              className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700/50">
        {!isPaid && (
          <Button size="sm" onClick={handleConfirm} disabled={loading === "confirm" || proc.isUpdating || Number(balanceDue) <= 0} className="text-sm bg-green-600 hover:bg-green-700 text-white">
            {loading === "confirm" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            Confirmer paiement
          </Button>
        )}
        {isPaid && (
          <div className="bg-green-950/50 border border-green-700/50 text-green-300 rounded-lg px-3 py-2 text-sm flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Facture payée — aucune action requise
          </div>
        )}
        <Button size="sm" onClick={handleMarkPartial} disabled={loading === "partial" || proc.isUpdating} className="text-sm bg-orange-700 hover:bg-orange-800 text-white">
          {loading === "partial" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
          Paiement partiel
        </Button>
        <Button size="sm" onClick={handleMarkInvalid} disabled={loading === "invalid" || proc.isUpdating} className="text-sm bg-red-700 hover:bg-red-800 text-white">
          {loading === "invalid" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          Invalider
        </Button>
        <Button size="sm" variant="outline" onClick={handleViewInvoice} disabled={loading === "view"} className="text-sm bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
          {loading === "view" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
          Voir facture
        </Button>
        <Button size="sm" variant="outline" onClick={handleSendToClient} disabled={loading === "send"} className="text-sm bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
          {loading === "send" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
          Envoyer au client
        </Button>
      </div>

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
