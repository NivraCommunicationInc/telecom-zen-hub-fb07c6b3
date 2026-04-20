import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wallet, Info } from "lucide-react";
import { toast } from "sonner";
import { PayPalButton } from "@/components/payment/PayPalButton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PayInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  totalDue: number;
  profile: any;
  onPaymentSuccess?: () => void;
}

/**
 * PayInvoiceDialog — Portail client
 * 
 * Nivra n'accepte que PayPal (incluant les cartes de crédit via PayPal).
 * Interac/virement n'est plus accepté.
 */
const PayInvoiceDialog = ({
  open,
  onOpenChange,
  invoice,
  totalDue,
  profile,
  onPaymentSuccess,
}: PayInvoiceDialogProps) => {
  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || "—";
  const amount = totalDue;

  const handlePaymentSuccess = () => {
    toast.success("Paiement effectué avec succès!");
    onOpenChange(false);
    onPaymentSuccess?.();
  };

  const handlePaymentError = (error: string) => {
    toast.error(`Erreur de paiement: ${error}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Payer la facture
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Summary */}
        <div className="bg-muted/50 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Facture</span>
            <span className="font-mono font-semibold text-foreground">{invoiceNumber}</span>
          </div>
          {invoice.due_date && (
            <div className="flex items-center justify-between mb-2">
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

        {/* PayPal — seul mode accepté */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Mode de paiement</p>

          <div className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-primary bg-primary/5 text-left">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">PayPal / Carte de crédit</p>
              <p className="text-xs text-muted-foreground">
                Payez avec votre compte PayPal ou par carte de crédit via PayPal
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary border-0 text-xs">Sécurisé</Badge>
          </div>
        </div>

        <div className="mt-2 space-y-3">
          <PayPalButton
            amount={amount}
            invoiceId={invoice.id}
            description={`Facture ${invoiceNumber} - Nivra Telecom`}
            customer={{ email: profile?.email || undefined }}
            onSuccess={() => handlePaymentSuccess()}
            onError={handlePaymentError}
          />

          <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Nivra n'accepte que PayPal (incluant les cartes de crédit via PayPal).
              Aucun virement Interac, comptant ou chèque.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
