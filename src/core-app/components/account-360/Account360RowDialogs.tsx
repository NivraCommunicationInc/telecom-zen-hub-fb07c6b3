/**
 * Account360RowDialogs — Click-through PDF viewers + account ops dialogs.
 *
 * Invoices  → real invoice PDF (generateCanonicalInvoicePDF) + receipt button.
 * Payments  → real receipt PDF (generateCanonicalReceiptPDF) for the paid invoice.
 * Contracts → real contract PDF (generateCanonicalContractPDF), or the document_url
 *             for non-contract documents.
 * PauseAccountDialog / CancelAccountDialog — unchanged operations.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { fmtCAD } from "./Account360Helpers";
import {
  generateCanonicalInvoicePDF,
  generateCanonicalContractPDF,
  generateCanonicalReceiptPDF,
} from "@/lib/pdf";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/50";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40";
const btnDanger = "rounded-md bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40";
const btnWarning = "rounded-md bg-amber-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-40";

type PDFState = {
  open: boolean;
  blob: Blob | null;
  title: string;
  filename: string;
  loading: boolean;
  error: string | null;
};
const initialPdf: PDFState = { open: false, blob: null, title: "", filename: "", loading: false, error: null };

function usePdfRunner() {
  const [state, setState] = useState<PDFState>(initialPdf);

  const run = async (title: string, filename: string, generator: () => Promise<any>) => {
    setState({ open: true, blob: null, title, filename, loading: true, error: null });
    try {
      const result = await generator();
      if (!result?.success || !result?.blob) {
        const msg = result?.error || "Document indisponible";
        setState((s) => ({ ...s, loading: false, error: msg }));
        toast.error(msg);
        return;
      }
      setState((s) => ({ ...s, loading: false, blob: result.blob, error: null }));
    } catch (e: any) {
      const msg = e?.message || "Erreur de génération";
      setState((s) => ({ ...s, loading: false, error: msg }));
      toast.error(msg);
    }
  };

  const close = () => setState(initialPdf);

  return { state, run, close };
}

/* ────────── Invoice → real invoice PDF ────────── */
export function InvoiceDetailDialog({ invoice, open, onClose }: any) {
  const { state, run, close } = usePdfRunner();

  useEffect(() => {
    if (!open || !invoice?.id) return;
    run(
      `Facture ${invoice.invoice_number}`,
      `facture-${invoice.invoice_number || invoice.id.slice(0, 8)}.pdf`,
      () => generateCanonicalInvoicePDF(supabase as any, invoice.id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  return (
    <PDFViewerDialog
      open={open && state.open}
      onOpenChange={(o) => { if (!o) { close(); onClose(); } }}
      pdfBlob={state.blob}
      title={state.title || "Facture"}
      filename={state.filename || "facture.pdf"}
      isLoading={state.loading}
      error={state.error}
    />
  );
}

/* ────────── Payment → real receipt PDF for linked invoice ────────── */
export function PaymentDetailDialog({ payment, open, onClose }: any) {
  const { state, run, close } = usePdfRunner();

  useEffect(() => {
    if (!open || !payment) return;
    const invoiceId = payment.invoice_id;
    if (!invoiceId) {
      // No linked invoice → cannot build a receipt
      toast.error("Aucune facture liée à ce paiement — reçu indisponible.");
      onClose();
      return;
    }
    run(
      `Reçu ${payment.payment_number || ""}`,
      `recu-${payment.payment_number || payment.id?.slice(0, 8) || "paiement"}.pdf`,
      () => generateCanonicalReceiptPDF(supabase as any, invoiceId),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id]);

  return (
    <PDFViewerDialog
      open={open && state.open}
      onOpenChange={(o) => { if (!o) { close(); onClose(); } }}
      pdfBlob={state.blob}
      title={state.title || "Reçu"}
      filename={state.filename || "recu.pdf"}
      isLoading={state.loading}
      error={state.error}
    />
  );
}

/* ────────── Contract / Document → real PDF ────────── */
export function ContractDetailDialog({ doc, open, onClose }: any) {
  const { state, run, close } = usePdfRunner();

  useEffect(() => {
    if (!open || !doc) return;

    // Generic document with an existing URL → open in a new tab and close
    const rawId: string = doc.id || "";
    const isContract = rawId.startsWith("c-");

    if (!isContract) {
      if (doc.url) {
        window.open(doc.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Aucun fichier PDF associé à ce document.");
      }
      onClose();
      return;
    }

    const contractId = rawId.replace(/^c-/, "");
    run(
      doc.document_name || "Contrat",
      `${(doc.contract_number || contractId).toString()}.pdf`,
      () => generateCanonicalContractPDF(supabase as any, contractId, { source: "contract" }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc?.id]);

  return (
    <PDFViewerDialog
      open={open && state.open}
      onOpenChange={(o) => { if (!o) { close(); onClose(); } }}
      pdfBlob={state.blob}
      title={state.title || "Contrat"}
      filename={state.filename || "contrat.pdf"}
      isLoading={state.loading}
      error={state.error}
    />
  );
}

/* ────────── Pause (suspension temporaire) ────────── */
export function PauseAccountDialog({ accountId, monthlyRevenue, open, onClose, onRefresh }: any) {
  const [until, setUntil] = useState<string>("");
  const [pct, setPct] = useState<number>(35);
  const [reason, setReason] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const monthlyCharge = Number(monthlyRevenue || 0) * (pct / 100);

  async function submit() {
    if (!accountId || !until) {
      toast.error("Date de fin requise");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("accounts").update({
      status: "suspended",
      paused_at: new Date().toISOString(),
      paused_until: new Date(until).toISOString(),
      pause_charge_pct: pct,
      pause_reason: reason || null,
      updated_at: new Date().toISOString(),
    }).eq("id", accountId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Compte mis en pause temporaire");
    onRefresh(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Suspension temporaire</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-[11px]">
          <p className="text-muted-foreground">
            Le compte sera suspendu jusqu'à la date choisie. Une charge réduite continuera d'être facturée pendant la pause.
          </p>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Suspendre jusqu'au</span>
            <input type="date" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Charge mensuelle pendant la pause (% du forfait)</span>
            <input type="number" min={0} max={100} step={5} className={inputCls} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
            <span className="block text-emerald-400 mt-1">
              ≈ {fmtCAD(monthlyCharge)} / mois (forfait actuel: {fmtCAD(monthlyRevenue)})
            </span>
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Raison (optionnel)</span>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: client absent 2 mois en voyage" />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={submit} disabled={saving} className={btnWarning}>
            {saving ? "Enregistrement…" : "Mettre en pause"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────── Cancel account ────────── */
export function CancelAccountDialog({ accountId, open, onClose, onRefresh }: any) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!accountId) return;
    if (confirm.trim().toUpperCase() !== "ANNULER") {
      toast.error('Tapez "ANNULER" pour confirmer');
      return;
    }
    setSaving(true);
    const nowIso = new Date().toISOString();
    const { error } = await supabase.from("accounts").update({
      status: "cancelled",
      cancelled_at: nowIso,
      cancellation_reason: reason || null,
      updated_at: nowIso,
    }).eq("id", accountId);
    if (!error) {
      await supabase.from("billing_subscriptions")
        .update({ status: "cancelled", cancelled_at: nowIso })
        .eq("account_id", accountId)
        .in("status", ["active", "past_due", "trialing"]);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Compte annulé");
    onRefresh(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm text-red-400">Annulation du compte</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-[11px]">
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-red-400">
            ⚠ Cette action annule définitivement le compte et arrête toute facturation récurrente. Les soldes impayés restent dus.
          </div>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Raison de l'annulation</span>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: déménagement hors zone" />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Tapez <strong>ANNULER</strong> pour confirmer</span>
            <input className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Fermer</button>
          <button onClick={submit} disabled={saving} className={btnDanger}>
            {saving ? "Annulation…" : "Annuler le compte"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
