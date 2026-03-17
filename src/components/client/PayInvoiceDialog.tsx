import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banknote, Mail, Copy, Check, Info, CreditCard, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";
import { StripeCheckoutButton } from "@/components/payment/StripeCheckoutButton";
import { PayPalCheckoutButton } from "@/components/payment/PayPalCheckoutButton";
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

const PayInvoiceDialog = ({
  open,
  onOpenChange,
  invoice,
  totalDue,
  profile,
  onPaymentSuccess,
}: PayInvoiceDialogProps) => {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "interac" | null>(null);
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || invoice.id?.slice(0, 8).toUpperCase();
  const amount = totalDue;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success("Courriel copié!");
    setTimeout(() => setCopied(false), 2000);
  };

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

        {/* Invoice Summary — always visible */}
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

        {/* Payment Method Selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Choisir un mode de paiement</p>

          {/* Credit Card (TELUS-style) */}
          <button
            onClick={() => setPaymentMethod("card")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "card"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30 bg-background"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Carte de crédit ou débit</p>
              <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex — paiement sécurisé</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-0 text-xs">Recommandé</Badge>
          </button>

          {/* Interac */}
          <button
            onClick={() => setPaymentMethod("interac")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "interac"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-border hover:border-muted-foreground/30 bg-background"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Virement Interac</p>
              <p className="text-xs text-muted-foreground">Envoyez un virement par votre banque</p>
            </div>
          </button>
        </div>

        {/* ============ Payment Form Based on Selection ============ */}

        {/* Credit/Debit Card via PayPal Checkout redirect */}
        {paymentMethod === "card" && (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              Vous serez redirigé vers PayPal pour compléter le paiement de façon sécurisée par carte de crédit, débit ou compte PayPal.
            </p>
            <PayPalCheckoutButton
              invoiceId={invoice.id}
              amount={amount}
              description={`Facture ${invoiceNumber} - Nivra Telecom`}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        )}

        {/* Interac */}
        {paymentMethod === "interac" && (
          <div className="space-y-3 mt-2">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <p className="text-sm font-medium text-foreground mb-3">
                Envoyez votre virement Interac à :
              </p>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-emerald-200 dark:border-emerald-800">
                <Mail className="w-5 h-5 text-emerald-600" />
                <span className="font-mono text-base flex-1">{ETRANSFER_CONFIG.emailDisplay}</span>
                <Button variant="outline" size="sm" onClick={handleCopyEmail} className="gap-1.5 shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copié!</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Question de sécurité</p>
                <p className="text-sm font-medium text-foreground">{ETRANSFER_CONFIG.securityQuestion}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Réponse</p>
                <p className="text-sm font-medium text-foreground">{ETRANSFER_CONFIG.securityAnswer}</p>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Montant exact à envoyer</p>
              <p className="text-lg font-bold text-foreground">
                {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Incluez votre numéro de facture <strong className="text-foreground">{invoiceNumber}</strong> dans le message du virement.
                Le paiement sera traité automatiquement dès réception.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
