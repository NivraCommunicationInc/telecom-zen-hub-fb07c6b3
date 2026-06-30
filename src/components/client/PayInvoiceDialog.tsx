import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Lock, Send } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const INTERAC_EMAIL = "support@nivra-telecom.ca";

interface PayInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  totalDue: number;
  profile: any;
  customerId?: string;
  squareCardId?: string | null;
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

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Payer la facture</DialogTitle>
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

        {/* Interac */}
        <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Virement Interac</p>
              <p className="text-xs text-muted-foreground">Traitement automatique dès réception</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background divide-y divide-border">
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-xs text-muted-foreground">Courriel</p>
                <p className="text-sm font-semibold text-foreground">{INTERAC_EMAIL}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(INTERAC_EMAIL, "Courriel")}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-xs text-muted-foreground">Montant</p>
                <p className="text-sm font-semibold text-foreground">
                  {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(amount.toFixed(2), "Montant")}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-xs text-muted-foreground">Réponse sécurité</p>
                <p className="text-sm font-bold text-foreground">{accountNumber}</p>
                <p className="text-xs text-amber-600">⚠️ Exactement ce numéro</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(String(accountNumber), "Numéro")}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Paiement appliqué automatiquement à votre compte dès réception.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
