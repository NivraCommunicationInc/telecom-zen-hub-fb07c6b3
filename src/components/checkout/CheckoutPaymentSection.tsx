import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Lock, AlertCircle, Banknote, Mail, Copy, Check as CheckIcon, Gift, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";

import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";

interface ServiceItem {
  plan_code: string;
  plan_name: string;
  plan_price: number;
  category: string;
}

interface CheckoutPaymentSectionProps {
  isFrench: boolean;
  /** @deprecated Card payments are permanently disabled. This prop is ignored. */
  savedCards?: any[];
  selectedPaymentMethod: "etransfer" | "paypal";
  onPaymentMethodChange: (method: "etransfer" | "paypal") => void;
  /** @deprecated Card payments disabled */
  selectedCardId?: string;
  /** @deprecated Card payments disabled */
  onSelectedCardChange?: (cardId: string) => void;
  /** @deprecated Card payments disabled */
  cvv?: string;
  /** @deprecated Card payments disabled */
  onCvvChange?: (cvv: string) => void;
  /** @deprecated Card payments disabled */
  newCardData?: {
    cardNumber: string;
    cardName: string;
    expiry: string;
    cvv: string;
  };
  /** @deprecated Card payments disabled */
  onNewCardChange?: (data: { cardNumber: string; cardName: string; expiry: string; cvv: string }) => void;
  /** @deprecated Card payments disabled */
  saveNewCard?: boolean;
  /** @deprecated Card payments disabled */
  onSaveNewCardChange?: (save: boolean) => void;
  totalAmount: number;
  /** @deprecated Card payments disabled */
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
  selectedPaymentMethod,
  onPaymentMethodChange,
  totalAmount,
  onPayPalSuccess,
  enableAutoBilling = false,
  subscriptionServices,
  customerInfo,
  discountAmount = 5,
}: CheckoutPaymentSectionProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success(isFrench ? "Courriel copié!" : "Email copied!");
    setTimeout(() => setCopied(false), 2000);
  };

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
          onValueChange={(v) => onPaymentMethodChange(v as "etransfer" | "paypal")}
        >
          {/* ── 1. Carte de crédit (Square) — PRIMARY ── */}
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
                    <CreditCard className="w-5 h-5 text-primary" />
                    {isFrench ? "Carte de crédit" : "Credit card"}
                  </Label>
                  <Badge className="bg-emerald-500/20 text-emerald-600 border-0">
                    {isFrench ? "Recommandé" : "Recommended"}
                  </Badge>
                </div>

                {selectedPaymentMethod === "paypal" && (
                  <div className="pt-2">
                    <SquarePaymentForm
                      amount={totalAmount}
                      onSuccess={(_, paymentId) => onPayPalSuccess?.(paymentId ?? "")}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </RadioGroup>

        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Lock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {isFrench
              ? "Paiement sécurisé Square PCI-DSS. Visa, Mastercard, débit Visa, débit Mastercard et cartes prépayées acceptées."
              : "Secure Square PCI-DSS payment. Visa, Mastercard, Visa debit, Mastercard debit and prepaid cards accepted."}
          </p>
        </div>

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
