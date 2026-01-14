import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Shield, Lock, AlertCircle, Info, Banknote, Wrench, Mail, Copy, Check as CheckIcon } from "lucide-react";
import { toast } from "sonner";

interface SavedCard {
  id: string;
  card_type: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
  is_preauthorized?: boolean;
}

interface CheckoutPaymentSectionProps {
  isFrench: boolean;
  savedCards: SavedCard[];
  selectedPaymentMethod: "saved" | "new" | "etransfer";
  onPaymentMethodChange: (method: "saved" | "new" | "etransfer") => void;
  selectedCardId: string;
  onSelectedCardChange: (cardId: string) => void;
  cvv: string;
  onCvvChange: (cvv: string) => void;
  newCardData: {
    cardNumber: string;
    cardName: string;
    expiry: string;
    cvv: string;
  };
  onNewCardChange: (data: { cardNumber: string; cardName: string; expiry: string; cvv: string }) => void;
  saveNewCard: boolean;
  onSaveNewCardChange: (save: boolean) => void;
  totalAmount: number;
  cvvError?: string;
}

// E-Transfer configuration
const ETRANSFER_EMAIL = "paiement@nivra.ca";

export const CheckoutPaymentSection = ({
  isFrench,
  savedCards,
  selectedPaymentMethod,
  onPaymentMethodChange,
  selectedCardId,
  onSelectedCardChange,
  cvv,
  onCvvChange,
  newCardData,
  onNewCardChange,
  saveNewCard,
  onSaveNewCardChange,
  totalAmount,
  cvvError,
}: CheckoutPaymentSectionProps) => {
  const [copied, setCopied] = useState(false);
  const hasSavedCards = savedCards && savedCards.length > 0;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_EMAIL);
    setCopied(true);
    toast.success(isFrench ? "Courriel copié!" : "Email copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Credit card is in maintenance mode
  const isCreditCardMaintenance = true;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-cyan-500" />
          {isFrench ? "Mode de paiement" : "Payment Method"}
        </CardTitle>
        <CardDescription>
          {isFrench 
            ? "Sélectionnez votre méthode de paiement."
            : "Select your payment method."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup 
          value={selectedPaymentMethod} 
          onValueChange={(v) => {
            // Only allow etransfer when credit card is in maintenance
            if (isCreditCardMaintenance && (v === "saved" || v === "new")) {
              return;
            }
            onPaymentMethodChange(v as "saved" | "new" | "etransfer");
          }}
        >
          {/* Interac E-Transfer Option - PRIMARY */}
          <div 
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPaymentMethod === "etransfer" 
                ? "border-cyan-500 bg-cyan-500/5" 
                : "border-border hover:border-cyan-500/50"
            }`}
            onClick={() => onPaymentMethodChange("etransfer")}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="etransfer" id="payment-etransfer" className="mt-1" />
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="payment-etransfer" className="text-base font-medium cursor-pointer flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-emerald-500" />
                    {isFrench ? "Virement Interac" : "Interac E-Transfer"}
                  </Label>
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-0">
                    {isFrench ? "Recommandé" : "Recommended"}
                  </Badge>
                </div>

                {selectedPaymentMethod === "etransfer" && (
                  <div className="space-y-4 pt-2">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <p className="text-sm font-medium text-foreground mb-3">
                        {isFrench 
                          ? "Envoyez le virement Interac à :"
                          : "Send Interac E-Transfer to:"}
                      </p>
                      <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                        <Mail className="w-5 h-5 text-emerald-500" />
                        <span className="font-mono text-lg flex-1">{ETRANSFER_EMAIL}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyEmail}
                          className="gap-2"
                        >
                          {copied ? (
                            <>
                              <CheckIcon className="w-4 h-4 text-emerald-500" />
                              {isFrench ? "Copié!" : "Copied!"}
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              {isFrench ? "Copier" : "Copy"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <strong>{isFrench ? "Montant à envoyer:" : "Amount to send:"}</strong>{" "}
                        <span className="text-foreground font-semibold">{totalAmount.toFixed(2)}$</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <strong>{isFrench ? "Message/Référence:" : "Message/Reference:"}</strong>{" "}
                        <span className="text-foreground">{isFrench ? "Votre numéro de téléphone" : "Your phone number"}</span>
                      </p>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        {isFrench 
                          ? "Votre commande sera traitée dès réception du paiement. Un courriel de confirmation vous sera envoyé."
                          : "Your order will be processed upon payment receipt. A confirmation email will be sent."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Credit Card Option - MAINTENANCE MODE */}
          <div 
            className="p-4 rounded-lg border-2 border-border bg-muted/50 cursor-not-allowed opacity-60"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="new" id="payment-new" className="mt-1" disabled />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="payment-new" className="text-base font-medium cursor-not-allowed flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="w-5 h-5" />
                    {isFrench ? "Carte de crédit" : "Credit Card"}
                  </Label>
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600/50 bg-amber-500/10">
                    <Wrench className="w-3 h-3" />
                    {isFrench ? "Maintenance" : "Maintenance"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isFrench 
                    ? "Le paiement par carte est temporairement indisponible. Veuillez utiliser le virement Interac."
                    : "Card payment is temporarily unavailable. Please use Interac E-Transfer."}
                </p>
              </div>
            </div>
          </div>

          {/* Saved Card Option - Also in maintenance */}
          {hasSavedCards && (
            <div 
              className="p-4 rounded-lg border-2 border-border bg-muted/50 cursor-not-allowed opacity-60"
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value="saved" id="payment-saved" className="mt-1" disabled />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="payment-saved" className="text-base font-medium cursor-not-allowed flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="w-5 h-5" />
                      {isFrench ? "Carte enregistrée" : "Saved Card"}
                      <span className="text-xs">({savedCards.length})</span>
                    </Label>
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600/50 bg-amber-500/10">
                      <Wrench className="w-3 h-3" />
                      {isFrench ? "Maintenance" : "Maintenance"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Les paiements par carte enregistrée sont temporairement indisponibles."
                      : "Saved card payments are temporarily unavailable."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </RadioGroup>

        {/* Security notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
          <Lock className="w-4 h-4" />
          <span>
            {isFrench 
              ? "Paiement sécurisé. Vos informations sont protégées."
              : "Secure payment. Your information is protected."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckoutPaymentSection;
