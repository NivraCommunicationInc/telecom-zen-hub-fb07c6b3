import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Shield, Lock, AlertCircle, Info, Banknote, Wrench, Mail, Copy, Check as CheckIcon, Gift } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";
import { CARD_PAYMENTS_DISABLED } from "@/config/paymentMaintenance";
import PayPalButton from "@/components/payment/PayPalButton";
import PayPalSubscriptionButton from "@/components/payment/PayPalSubscriptionButton";

interface SavedCard {
  id: string;
  card_type: string;
  last_four: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
  is_preauthorized?: boolean;
}

interface ServiceItem {
  plan_code: string;
  plan_name: string;
  plan_price: number;
  category: string;
}

interface CheckoutPaymentSectionProps {
  isFrench: boolean;
  savedCards: SavedCard[];
  selectedPaymentMethod: "saved" | "new" | "etransfer" | "paypal";
  onPaymentMethodChange: (method: "saved" | "new" | "etransfer" | "paypal") => void;
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
  onPayPalSuccess?: (captureId: string) => void;
  // Auto-billing subscription props
  enableAutoBilling?: boolean;
  subscriptionServices?: ServiceItem[];
  customerInfo?: {
    user_id?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  discountAmount?: number;
}

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
  onPayPalSuccess,
  enableAutoBilling = false,
  subscriptionServices,
  customerInfo,
  discountAmount = 5,
}: CheckoutPaymentSectionProps) => {
  const [copied, setCopied] = useState(false);
  const hasSavedCards = savedCards && savedCards.length > 0;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success(isFrench ? "Courriel copié!" : "Email copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Credit card is in maintenance mode — use central config
  const isCreditCardMaintenance = CARD_PAYMENTS_DISABLED;

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
            // Only allow etransfer and paypal when credit card is in maintenance
            if (isCreditCardMaintenance && (v === "saved" || v === "new")) {
              return;
            }
            onPaymentMethodChange(v as "saved" | "new" | "etransfer" | "paypal");
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
                        <span className="font-mono text-lg flex-1">{ETRANSFER_CONFIG.emailDisplay}</span>
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
                        <span className="text-foreground">{isFrench ? "Numéro de facture" : "Invoice number"}</span>
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

          {/* PayPal Option */}
          <div 
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPaymentMethod === "paypal" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => onPaymentMethodChange("paypal")}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="paypal" id="payment-paypal" className="mt-1" />
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="payment-paypal" className="text-base font-medium cursor-pointer flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z" fill="#179BD7"/>
                      <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z" fill="#222D65"/>
                      <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z" fill="#253B80"/>
                    </svg>
                    PayPal
                  </Label>
                  <Badge className="bg-blue-500/20 text-blue-600 border-0">
                    {isFrench ? "Sécurisé" : "Secure"}
                  </Badge>
                </div>

                {selectedPaymentMethod === "paypal" && (
                  <div className="space-y-4 pt-2">
                    {enableAutoBilling && subscriptionServices && customerInfo ? (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-4">
                        <div className="flex items-center gap-2">
                          <Gift className="w-5 h-5 text-emerald-500" />
                          <p className="text-sm font-medium text-emerald-600">
                            {isFrench 
                              ? `Paiement automatique activé - ${discountAmount}$/mois de rabais!`
                              : `Automatic payment enabled - $${discountAmount}/month discount!`}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {isFrench 
                            ? "Vous serez redirigé vers PayPal pour approuver les prélèvements automatiques mensuels."
                            : "You will be redirected to PayPal to approve automatic monthly payments."}
                        </p>
                        <PayPalSubscriptionButton
                          services={subscriptionServices}
                          customerInfo={customerInfo}
                          isFrench={isFrench}
                          onSuccess={(result) => {
                            console.log("Subscription created:", result);
                          }}
                          onError={(error) => {
                            console.error("Subscription error:", error);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-4">
                          {isFrench 
                            ? "Payez de façon sécurisée avec votre compte PayPal ou carte de crédit/débit."
                            : "Pay securely with your PayPal account or credit/debit card."}
                        </p>
                        <PayPalButton
                          amount={totalAmount}
                          description={isFrench ? "Commande Nivra Telecom" : "Nivra Telecom Order"}
                          onSuccess={(captureId) => {
                            onPayPalSuccess?.(captureId);
                          }}
                          onError={(error) => {
                            console.error("PayPal error:", error);
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                      <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        {isFrench 
                          ? "Vous serez redirigé vers PayPal pour compléter le paiement. Votre commande sera confirmée automatiquement."
                          : "You will be redirected to PayPal to complete payment. Your order will be confirmed automatically."}
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
                    ? "Le paiement par carte directe est temporairement indisponible. Utilisez PayPal ou Interac."
                    : "Direct card payment is temporarily unavailable. Use PayPal or Interac."}
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
