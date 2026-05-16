/**
 * Account360RowDialogs — Click-through detail dialogs for invoices, payments,
 * contracts, plus account-level Pause (temporary) and Cancel dialogs.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { corePath } from "@/core-app/lib/corePaths";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtCAD, fmtDate, fmtDateTime } from "./Account360Helpers";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40";
const btnDanger = "rounded-md bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40";
const btnWarning = "rounded-md bg-amber-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-40";

const Row = ({ label, value }: any) => (
  <div className="flex justify-between gap-3 py-1 border-b border-border/40 last:border-0">
    <span className="text-muted-foreground text-[11px]">{label}</span>
    <span className="text-foreground text-[11px] text-right">{value ?? "—"}</span>
  </div>
);

/* ────────── Invoice Detail ────────── */
export function InvoiceDetailDialog({ invoice, open, onClose }: any) {
  if (!invoice) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono">
            Facture {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Row label="Type" value={invoice.type} />
          <Row label="Statut" value={invoice.status} />
          <Row label="Sous-total" value={fmtCAD(invoice.subtotal)} />
          <Row label="TPS" value={fmtCAD(invoice.tps_amount)} />
          <Row label="TVQ" value={fmtCAD(invoice.tvq_amount)} />
          <Row label="Total" value={<strong>{fmtCAD(invoice.total)}</strong>} />
          <Row label="Payé" value={fmtCAD(invoice.amount_paid)} />
          <Row label="Solde dû" value={<strong className={invoice.balance_due > 0 ? "text-red-400" : "text-emerald-400"}>{fmtCAD(invoice.balance_due)}</strong>} />
          <Row label="Émise" value={fmtDate(invoice.created_at)} />
          <Row label="Échéance" value={fmtDate(invoice.due_date)} />
          <Row label="Payée le" value={fmtDate(invoice.paid_at)} />
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Fermer</button>
          <Link to={corePath(`/invoices/${invoice.id}`)} className={btnPrimary}>Ouvrir la facture →</Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────── Payment Detail ────────── */
export function PaymentDetailDialog({ payment, invoices, open, onClose }: any) {
  if (!payment) return null;
  const linkedInvoice = invoices?.find((i: any) => i.id === payment.invoice_id);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono">
            Paiement {payment.payment_number || payment.id?.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Row label="Montant" value={<strong className="text-emerald-400">{fmtCAD(payment.amount)}</strong>} />
          <Row label="Méthode" value={payment.method} />
          <Row label="Statut" value={payment.status} />
          <Row label="Référence" value={<span className="font-mono">{payment.reference || "—"}</span>} />
          <Row label="Fournisseur" value={payment.provider || "—"} />
          <Row label="ID fournisseur" value={<span className="font-mono text-[10px]">{payment.provider_payment_id || "—"}</span>} />
          <Row label="Reçu le" value={fmtDateTime(payment.received_at)} />
          <Row label="Créé le" value={fmtDateTime(payment.created_at)} />
          <Row label="Capturé le" value={fmtDateTime(payment.captured_at)} />
          {payment.notes && <Row label="Notes" value={payment.notes} />}
          {linkedInvoice && (
            <Row label="Facture liée" value={
              <Link to={corePath(`/invoices/${linkedInvoice.id}`)} className="text-emerald-400 hover:underline font-mono">
                {linkedInvoice.invoice_number}
              </Link>
            } />
          )}
        </div>
        <DialogFooter>
          <button onClick={onClose} className={btnSecondary}>Fermer</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────── Contract / Document Detail ────────── */
export function ContractDetailDialog({ doc, open, onClose }: any) {
  if (!doc) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{doc.document_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Row label="Type" value={doc.document_type} />
          <Row label="Signé / Ajouté" value={fmtDateTime(doc.signed_at || doc.created_at)} />
          {doc.signer && <Row label="Signataire" value={doc.signer} />}
          {doc.contract_number && <Row label="N° contrat" value={<span className="font-mono">{doc.contract_number}</span>} />}
          {doc.status && <Row label="Statut" value={doc.status} />}
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Fermer</button>
          {doc.url ? (
            <a href={doc.url} target="_blank" rel="noreferrer" className={btnPrimary}>Ouvrir le document →</a>
          ) : (
            <span className="text-[11px] text-muted-foreground italic px-3 py-1.5">Aucun fichier PDF associé</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
