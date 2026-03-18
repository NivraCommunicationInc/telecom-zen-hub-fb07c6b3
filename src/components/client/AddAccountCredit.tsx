/**
 * AddAccountCredit — Custom amount payment via Stripe
 * 
 * Rules:
 * - If balance_due > 0, payment applies to balance first
 * - Any excess becomes account credit
 * - If balance_due = 0, full amount becomes credit
 * 
 * Uses canonical edge function: portal-add-credit
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StripeInlinePayment, type StripeInlinePaymentSuccessPayload } from "@/components/payment/StripeInlinePayment";
import { useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { toast } from "sonner";
import {
  Plus,
  DollarSign,
  CreditCard,
  Info,
  CheckCircle,
  ArrowRight,
  Wallet,
} from "lucide-react";

interface AddAccountCreditProps {
  userId: string;
  userEmail?: string;
  currentBalance: number; // positive = owes, negative = has credit
  onPaymentSuccess?: () => void;
}

const PRESET_AMOUNTS = [25, 50, 100, 200];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 1000;

export const AddAccountCredit = ({
  userId,
  userEmail,
  currentBalance,
  onPaymentSuccess,
}: AddAccountCreditProps) => {
  const queryClient = useQueryClient();
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [showStripe, setShowStripe] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const balanceDue = currentBalance > 0 ? currentBalance : 0;
  const existingCredit = currentBalance < 0 ? Math.abs(currentBalance) : 0;

  const amount = selectedAmount || parseFloat(customAmount) || 0;
  const isValid = amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;

  // Calculate application breakdown
  const appliedToBalance = Math.min(amount, balanceDue);
  const appliedToCredit = Math.max(0, amount - balanceDue);

  const handleSelectPreset = (preset: number) => {
    setSelectedAmount(preset);
    setCustomAmount("");
    setShowStripe(false);
    setPaymentComplete(false);
  };

  const handleCustomChange = (value: string) => {
    // Only allow numbers and decimals
    const sanitized = value.replace(/[^0-9.]/g, "");
    setCustomAmount(sanitized);
    setSelectedAmount(null);
    setShowStripe(false);
    setPaymentComplete(false);
  };

  const handleProceedToPayment = () => {
    if (!isValid) return;
    setShowStripe(true);
  };

  const handlePaymentSuccess = useCallback(
    async (payload: StripeInlinePaymentSuccessPayload) => {
      try {
        // Call edge function to record the credit payment
        const { data, error } = await supabase.functions.invoke("portal-add-credit", {
          body: {
            user_id: userId,
            amount,
            payment_intent_id: payload.paymentIntentId,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setPaymentComplete(true);
        setShowStripe(false);

        toast.success(
          appliedToCredit > 0
            ? `Paiement de ${amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} effectué! Crédit ajouté: ${appliedToCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
            : `Paiement de ${amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} appliqué à votre solde!`
        );

        // Invalidate all relevant queries
        queryClient.invalidateQueries({ queryKey: ["ledger-balance"] });
        queryClient.invalidateQueries({ queryKey: ["billing-hub-unpaid"] });
        queryClient.invalidateQueries({ queryKey: ["billing-hub-all-invoices"] });
        queryClient.invalidateQueries({ queryKey: ["client-invoice-breakdowns"] });
        queryClient.invalidateQueries({ queryKey: ["pending-invoices-canonical"] });
        queryClient.invalidateQueries({ queryKey: ["client-subscriptions"] });

        onPaymentSuccess?.();
      } catch (err) {
        console.error("[AddAccountCredit] Error recording credit:", err);
        toast.error("Le paiement a été effectué mais l'enregistrement a échoué. Contactez le support.");
      }
    },
    [userId, amount, appliedToCredit, queryClient, onPaymentSuccess]
  );

  if (paymentComplete) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardContent className="p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Paiement confirmé!</h3>
          <p className="text-muted-foreground mb-4">
            {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} traité avec succès.
          </p>
          {appliedToBalance > 0 && (
            <p className="text-sm text-foreground mb-1">
              → {appliedToBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} appliqué au solde
            </p>
          )}
          {appliedToCredit > 0 && (
            <p className="text-sm text-primary font-medium mb-1">
              → {appliedToCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} ajouté en crédit au compte
            </p>
          )}
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setPaymentComplete(false);
              setSelectedAmount(null);
              setCustomAmount("");
            }}
          >
            Faire un autre paiement
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Comment fonctionne le crédit au compte?</p>
            {balanceDue > 0 ? (
              <p>
                Votre solde actuel est de{" "}
                <strong className="text-amber-600">
                  {balanceDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </strong>
                . Le montant payé sera d'abord appliqué à votre solde. Tout excédent sera converti en crédit disponible.
              </p>
            ) : existingCredit > 0 ? (
              <p>
                Vous avez déjà un crédit de{" "}
                <strong className="text-primary">
                  {existingCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </strong>
                . Le montant ajouté sera ajouté à votre crédit existant.
              </p>
            ) : (
              <p>
                Votre compte est à jour. Le montant payé sera converti en crédit disponible pour vos prochaines factures.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Amount Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-primary" />
            Choisir un montant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset amounts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                onClick={() => handleSelectPreset(preset)}
                className={`py-4 px-3 rounded-xl border-2 transition-all font-semibold text-lg ${
                  selectedAmount === preset
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {preset.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Montant personnalisé"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              className={`pl-10 h-12 text-lg ${selectedAmount === null && customAmount ? 'border-primary' : ''}`}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Minimum: {MIN_AMOUNT.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} · Maximum: {MAX_AMOUNT.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </p>
        </CardContent>
      </Card>

      {/* Breakdown Preview */}
      {isValid && !showStripe && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              Répartition du paiement
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant total</span>
                <span className="font-semibold text-foreground">
                  {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </span>
              </div>
              {appliedToBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">→ Appliqué au solde dû</span>
                  <span className="text-amber-600 font-medium">
                    {appliedToBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">→ Crédit au compte</span>
                <span className="text-primary font-medium">
                  {appliedToCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </span>
              </div>
              {existingCredit > 0 && appliedToCredit > 0 && (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground">Crédit total après paiement</span>
                  <span className="text-primary font-bold">
                    {(existingCredit + appliedToCredit).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
              )}
            </div>
            <Button onClick={handleProceedToPayment} className="w-full mt-2" size="lg">
              <CreditCard className="w-5 h-5 mr-2" />
              Procéder au paiement par carte
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stripe Payment Form */}
      {showStripe && isValid && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-5 h-5 text-primary" />
              Paiement sécurisé — {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StripeInlinePayment
              intentContext="invoice_payment"
              amount={amount}
              description={`Crédit au compte — Nivra Telecom`}
              customerEmail={userEmail}
              onSuccess={handlePaymentSuccess}
              onError={(msg) => toast.error(msg)}
            />
            <Button
              variant="ghost"
              className="w-full mt-3 text-muted-foreground"
              onClick={() => setShowStripe(false)}
            >
              ← Modifier le montant
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AddAccountCredit;
