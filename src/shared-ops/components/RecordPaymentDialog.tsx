/**
 * RecordPaymentDialog — Canonical payment recording dialog for Employee + Field portals.
 * Uses shared-ops recordPayment action (apply_payment_to_invoice RPC).
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Loader2, CheckCircle } from "lucide-react";
import { recordPayment, type PaymentMethod } from "@/shared-ops/actions/recordPayment";
import { toast } from "sonner";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "interac", label: "Interac / Virement" },
  { value: "cash", label: "Comptant" },
  { value: "debit_credit", label: "Débit / Crédit" },
  { value: "square", label: "Square / Carte" },
  { value: "bank_transfer", label: "Transfert bancaire" },
  { value: "other", label: "Autre" },
];

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  customerId: string;
  invoiceNumber?: string;
  balanceDue?: number;
  portal: "employee" | "field";
  onSuccess?: () => void;
}

export function RecordPaymentDialog({
  open, onOpenChange, invoiceId, customerId,
  invoiceNumber, balanceDue, portal, onSuccess,
}: RecordPaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("interac");
  const [amount, setAmount] = useState(balanceDue?.toFixed(2) ?? "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const parsedAmount = Number.parseFloat(amount || "0");
  const canSubmit = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await recordPayment({
        invoiceId,
        customerId,
        amount: parsedAmount,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        portal,
      });
      setDone(true);
      toast.success(`Paiement de ${parsedAmount.toFixed(2)} $ enregistré`);
      onSuccess?.();
      setTimeout(() => onOpenChange(false), 1200);
    } catch (err: any) {
      toast.error(err.message || "Échec de l'enregistrement du paiement");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Paiement enregistré avec succès</p>
            <p className="text-xs text-muted-foreground">{invoiceNumber} — {parsedAmount.toFixed(2)} $</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Enregistrer un paiement
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Facture {invoiceNumber ?? "—"} — Solde dû: {balanceDue?.toFixed(2) ?? "—"} $
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Method */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Méthode de paiement</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    method === m.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/20"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Montant ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-mono"
            />
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Référence / numéro de confirmation</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: INT-20260323-001"
              maxLength={200}
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Note interne (optionnelle)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contexte du paiement…"
              maxLength={500}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Enregistrer {canSubmit ? `${parsedAmount.toFixed(2)} $` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
