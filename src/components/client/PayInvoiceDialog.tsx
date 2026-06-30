import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Copy, Lock, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface PayInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  totalDue: number;
  profile: any;
  onPaymentSuccess?: () => void;
}

const PayInvoiceDialog = ({
  open,
  onOpenChange,
  invoice,
  totalDue,
  profile,
}: PayInvoiceDialogProps) => {
  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || "—";
  const amount = totalDue;
  const accountNumber = profile?.account_number || profile?.ACCOUNT_NUMBER || "—";
  const interacEmail = "support@nivra-telecom.ca";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Payer la facture
          </DialogTitle>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="bg-muted/50 rounded-xl p-4 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Facture</span>
            <span className="font-mono font-semibold text-foreground">{invoiceNumber}</span>
          </div>
          {invoice.due_date && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Échéance</span>
              <span className="text-sm text-foreground">
                {format(new Date(invoice.due_date), "d MMMM yyyy", { locale: fr })}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-medium text-foreground">Solde à payer</span>
            <span className="text-2xl font-bold text-foreground">
              {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </span>
          </div>
        </div>

        {/* Interac instructions */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Mode de paiement</p>

          <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Virement Interac</p>
              <p className="text-xs text-muted-foreground">Traitement automatique — aucune intervention requise</p>
            </div>
            <Badge className="ml-auto bg-primary/10 text-primary border-0 text-xs">Sécurisé</Badge>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Adresse courriel</p>
                <p className="text-sm font-semibold text-foreground">{interacEmail}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(interacEmail, "Courriel")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Montant</p>
                <p className="text-sm font-semibold text-foreground">
                  {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(amount.toFixed(2), "Montant")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Réponse à la question de sécurité</p>
                <p className="text-sm font-bold text-foreground">{accountNumber}</p>
                <p className="text-xs text-amber-600 mt-0.5">⚠️ Utilisez exactement ce numéro</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(String(accountNumber), "Numéro de compte")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Les virements Interac sont traités automatiquement. Une fois reçu et validé, votre paiement sera appliqué à votre compte sans intervention supplémentaire.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
