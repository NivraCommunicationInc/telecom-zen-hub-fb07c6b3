import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check, DollarSign, Calendar, Shield, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoPayPalOptionProps {
  isFrench: boolean;
  isEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  monthlyAmount: number;
  discountAmount?: number;
  disabled?: boolean;
}

/**
 * Auto-billing PayPal option with $5 monthly discount.
 * When enabled, creates a PayPal recurring subscription.
 *
 * ⚠️ NOT WIRED IN GUEST CHECKOUT (Fix 3 — Option B, 2026-04-19).
 * The component is functional but not rendered in src/pages/GuestCheckout.tsx
 * because the full PayPal subscription approval flow (approval_url redirect +
 * return handler) is not yet implemented for guest users. The backend
 * (billing-create-order-with-paypal-subscription, paypal-webhook,
 * paypal-charge-subscription reconciler) is ready. To activate end-to-end:
 *   1) Render <AutoPayPalOption /> in checkout step 5
 *   2) Switch order endpoint to billing-create-order-with-paypal-subscription
 *      when isEnabled === true
 *   3) Redirect the user to the returned approval_url and add a /commander/paypal-return
 *      route that resumes order finalization
 *   4) Set recurring_payment_accepted: true in checkout_consent_records
 * See mem://technical/paypal/canonical-lifecycle-standard-v2.
 */
export const AutoPayPalOption = ({
  isFrench,
  isEnabled,
  onEnabledChange,
  monthlyAmount,
  discountAmount = 5,
  disabled = false,
}: AutoPayPalOptionProps) => {
  const discountedAmount = monthlyAmount - discountAmount;

  const benefits = isFrench
    ? [
        { icon: Gift, text: `${discountAmount}$ de rabais chaque mois` },
        { icon: Calendar, text: "Paiement automatique à chaque cycle" },
        { icon: Shield, text: "Aucun risque d'interruption de service" },
        { icon: CreditCard, text: "Square débite votre carte automatiquement" },
      ]
    : [
        { icon: Gift, text: `$${discountAmount} off every month` },
        { icon: Calendar, text: "Automatic payment each billing cycle" },
        { icon: Shield, text: "No risk of service interruption" },
        { icon: CreditCard, text: "Square automatically charges your card" },
      ];

  return (
    <Card
      className={cn(
        "transition-all duration-300 cursor-pointer",
        isEnabled
          ? "bg-emerald-500/10 border-2 border-emerald-500 shadow-lg shadow-emerald-500/20"
          : "bg-card border-border hover:border-primary/50",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      onClick={() => !disabled && onEnabledChange(!isEnabled)}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Checkbox
            id="auto-square-billing"
            checked={isEnabled}
            onCheckedChange={(checked) => !disabled && onEnabledChange(checked === true)}
            disabled={disabled}
            className="mt-1"
          />
          <div className="flex-1 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="auto-square-billing"
                  className="text-base font-semibold cursor-pointer"
                >
                  {isFrench ? "Activer le paiement automatique" : "Enable automatic payments"}
                </Label>
              </div>
              <Badge className="bg-emerald-500 text-white border-0 gap-1">
                <Gift className="w-3 h-3" />
                {isFrench ? `Économisez ${discountAmount}$/mois` : `Save $${discountAmount}/month`}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground">
              {isFrench
                ? `Acceptez que Square débite automatiquement votre carte à chaque cycle de facturation et profitez d'un rabais de ${discountAmount}$ sur chaque facture.`
                : `Allow Square to automatically charge your card each billing cycle and enjoy $${discountAmount} off every invoice.`}
            </p>

            {/* Benefits */}
            {isEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <div className="p-1 rounded bg-emerald-500/20">
                      <benefit.icon className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <span className="text-foreground">{benefit.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Price comparison */}
            {isEnabled && (
              <div className="flex items-center gap-4 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground line-through">
                    {monthlyAmount.toFixed(2)}$/
                    {isFrench ? "mois" : "mo"}
                  </span>
                  <span className="text-lg font-bold text-emerald-500">
                    {discountedAmount.toFixed(2)}$/
                    {isFrench ? "mois" : "mo"}
                  </span>
                </div>
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/50 bg-emerald-500/10">
                  <Check className="w-3 h-3 mr-1" />
                  {isFrench ? "Rabais appliqué" : "Discount applied"}
                </Badge>
              </div>
            )}

            {/* Terms notice */}
            <p className="text-xs text-muted-foreground">
              {isFrench
                ? "Vous pouvez annuler le paiement automatique à tout moment depuis votre portail client. Le montant restera le même tout au long de votre abonnement."
                : "You can cancel automatic payments anytime from your client portal. The amount will remain the same throughout your subscription."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AutoPayPalOption;
