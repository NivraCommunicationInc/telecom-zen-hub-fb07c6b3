import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Lock, ShieldCheck, CreditCard } from "lucide-react";
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

/** Brand card logos rendered as tiny inline pills (no external assets) */
const CardBrandLogos = () => (
  <div className="flex items-center gap-1.5">
    <span className="inline-flex items-center justify-center h-6 px-2 rounded bg-white border border-[#E5E7EB] text-[10px] font-bold tracking-tight text-[#1A1F71]">
      VISA
    </span>
    <span className="inline-flex items-center justify-center h-6 px-1.5 rounded bg-white border border-[#E5E7EB]">
      <span className="w-2.5 h-2.5 rounded-full bg-[#EB001B] -mr-1" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#F79E1B]/90" />
    </span>
    <span className="inline-flex items-center justify-center h-6 px-2 rounded bg-[#006FCF] text-[9px] font-bold text-white">
      AMEX
    </span>
  </div>
);

export const CheckoutPaymentSection = ({
  isFrench,
  selectedPaymentMethod,
  onPaymentMethodChange,
  totalAmount,
  onPayPalSuccess,
}: CheckoutPaymentSectionProps) => {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
      {/* Header — SSL badge + card logos */}
      <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB] bg-[#F5F7FA] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#00A651]/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#00A651]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1A2E] leading-tight">
              {isFrench ? "Paiement sécurisé" : "Secure payment"}
            </p>
            <p className="text-[11px] text-[#6B7280] leading-tight">
              {isFrench ? "SSL 256-bit · PCI-DSS Level 1" : "SSL 256-bit · PCI-DSS Level 1"}
            </p>
          </div>
        </div>
        <CardBrandLogos />
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        <RadioGroup
          value={selectedPaymentMethod}
          onValueChange={(v) => onPaymentMethodChange(v as "etransfer" | "paypal")}
        >
          <div
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedPaymentMethod === "paypal"
                ? "border-[#0066CC] bg-[#0066CC]/[0.03]"
                : "border-[#E5E7EB] hover:border-[#0066CC]/40"
            }`}
            onClick={() => onPaymentMethodChange("paypal")}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="paypal" id="payment-paypal" className="mt-1 border-[#0066CC] text-[#0066CC]" />
              <div className="flex-1 space-y-4 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label
                    htmlFor="payment-paypal"
                    className="text-base font-semibold cursor-pointer flex items-center gap-2 text-[#1A1A2E]"
                  >
                    <CreditCard className="w-5 h-5 text-[#0066CC]" />
                    {isFrench ? "Carte de crédit ou débit" : "Credit or debit card"}
                  </Label>
                  <Badge className="bg-[#00A651]/15 text-[#00A651] border-0 hover:bg-[#00A651]/15">
                    {isFrench ? "Recommandé" : "Recommended"}
                  </Badge>
                </div>

                <p className="text-xs text-[#6B7280]">
                  {isFrench
                    ? "Visa, Mastercard, Amex, débit Visa/Mastercard et cartes prépayées acceptées."
                    : "Visa, Mastercard, Amex, Visa/Mastercard debit and prepaid cards accepted."}
                </p>

                {selectedPaymentMethod === "paypal" && (
                  <div className="pt-2 border-t border-[#E5E7EB]">
                    <p className="text-xs font-medium text-[#1A1A2E] mb-3">
                      {isFrench ? "Informations de la carte" : "Card details"}
                    </p>
                    <SquarePaymentForm
                      amount={totalAmount}
                      onSuccess={(_, paymentId) => onPayPalSuccess?.(paymentId ?? "")}
                    />
                    <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#6B7280]">
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {isFrench
                          ? "Paiement chiffré 256-bit SSL — Square PCI-DSS Level 1"
                          : "256-bit SSL encrypted — Square PCI-DSS Level 1"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </RadioGroup>

        <div className="flex items-start gap-2 p-3 bg-[#0066CC]/[0.05] border border-[#0066CC]/20 rounded-lg">
          <Lock className="w-4 h-4 text-[#0066CC] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#6B7280]">
            {isFrench
              ? "Vos informations bancaires sont chiffrées et traitées directement par Square. Nivra ne stocke jamais votre numéro de carte."
              : "Your banking information is encrypted and processed directly by Square. Nivra never stores your card number."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPaymentSection;
