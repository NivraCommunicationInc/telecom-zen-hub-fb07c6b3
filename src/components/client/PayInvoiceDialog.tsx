import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Banknote, Mail, Copy, Check, Info, CreditCard, Wallet, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";
import { StripeInlinePayment } from "@/components/payment/StripeInlinePayment";
import { PayPalButton } from "@/components/payment/PayPalButton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { portalClient as supabase } from "@/integrations/backend/portalClient";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";


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
  const [interacReference, setInteracReference] = useState("");
  const [isSubmittingInterac, setIsSubmittingInterac] = useState(false);

  if (!invoice) return null;

  const invoiceNumber = invoice.invoice_number || "—";
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

  const handleSubmitInterac = async () => {
    if (!invoice?.id) return;
    if (!interacReference.trim()) {
      toast.error("Entrez une référence de virement Interac.");
      return;
    }

    setIsSubmittingInterac(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-submit-interac-payment", {
        body: {
          invoice_id: invoice.id,
          reference: interacReference.trim(),
          amount,
        },
      });

      if (error) throw error;

      if (data?.already_exists) {
        toast.success("Ce virement est déjà enregistré et en vérification.");
      } else {
        toast.success("Votre virement Interac a été soumis. Nous le validerons rapidement.");
      }

      onOpenChange(false);
      onPaymentSuccess?.();
    } catch (err) {
      const message = await getInvokeErrorMessage(err);
      toast.error(message);
    } finally {
      setIsSubmittingInterac(false);
    }
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

          {/* Credit Card — PRIMARY */}
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
              <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex — paiement sécurisé via Stripe</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-0 text-xs">Recommandé</Badge>
          </button>

          {/* PayPal */}
          <button
            onClick={() => setPaymentMethod("paypal")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "paypal"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30 bg-background"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">PayPal</p>
              <p className="text-xs text-muted-foreground">Payez avec votre compte PayPal ou carte via PayPal</p>
            </div>
          </button>

          {/* Interac */}
          <button
            onClick={() => setPaymentMethod("interac")}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
              paymentMethod === "interac"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30 bg-background"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Virement Interac</p>
              <p className="text-xs text-muted-foreground">Envoyez et soumettez votre référence directement ici</p>
            </div>
          </button>
        </div>

        {/* ============ Payment Form Based on Selection ============ */}

        {/* Credit/Debit Card via Stripe Elements (inline) — only if not in maintenance */}
        {paymentMethod === "card" && !CARD_PAYMENTS_DISABLED && (
          <div className="mt-2">
            <StripeInlinePayment
              invoiceId={invoice.id}
              intentContext="invoice_payment"
              amount={amount}
              description={`Facture ${invoiceNumber} - Nivra Telecom`}
              customerEmail={profile?.email}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        )}

        {/* PayPal */}
        {paymentMethod === "paypal" && (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              Paiement immédiat sécurisé avec PayPal.
            </p>
            <PayPalButton
              amount={amount}
              invoiceId={invoice.id}
              description={`Facture ${invoiceNumber} - Nivra Telecom`}
              customer={{ email: profile?.email || undefined }}
              onSuccess={() => handlePaymentSuccess()}
              onError={handlePaymentError}
            />
          </div>
        )}

        {/* Interac */}
        {paymentMethod === "interac" && (
          <div className="space-y-3 mt-2">
            <div className="p-4 bg-muted/50 border border-border rounded-xl">
              <p className="text-sm font-medium text-foreground mb-3">
                Envoyez votre virement Interac à :
              </p>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                <Mail className="w-5 h-5 text-primary" />
                <span className="font-mono text-base flex-1">{ETRANSFER_CONFIG.emailDisplay}</span>
                <Button variant="outline" size="sm" onClick={handleCopyEmail} className="gap-1.5 shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5 text-primary" /> Copié!</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
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

            <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-2">
              <label className="text-xs text-muted-foreground">Référence de votre virement Interac</label>
              <Input
                value={interacReference}
                onChange={(e) => setInteracReference(e.target.value)}
                placeholder="Ex: TRF-847291"
              />
              <p className="text-xs text-muted-foreground">
                Incluez votre numéro de facture <strong className="text-foreground">{invoiceNumber}</strong> dans le message du virement.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmitInterac}
              disabled={isSubmittingInterac || !interacReference.trim()}
            >
              {isSubmittingInterac ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Soumission en cours…
                </>
              ) : (
                "J’ai envoyé le virement"
              )}
            </Button>

            <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg">
              <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Votre paiement Interac sera marqué payé après validation.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PayInvoiceDialog;
