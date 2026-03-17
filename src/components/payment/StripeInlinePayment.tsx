/**
 * StripeInlinePayment — Embedded Stripe Payment Element.
 * Replaces StripeCheckoutButton with a fully inline card form.
 * No redirect, no external tab. Card data never touches Nivra servers.
 *
 * Usage:
 *   <StripeInlinePayment
 *     invoiceId="xxx"
 *     amount={45.99}
 *     customerEmail="client@example.com"
 *     customerId="billing-customer-uuid"
 *     onSuccess={() => ...}
 *     onError={(msg) => ...}
 *   />
 */
import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { STRIPE_PUBLISHABLE_KEY } from "@/config/stripe";

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// ─────────────────────────────────────────────────
// Inner form (rendered inside <Elements>)
// ─────────────────────────────────────────────────

interface InnerFormProps {
  amount: number;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
  invoiceId: string;
}

function PaymentForm({ amount, onSuccess, onError, invoiceId }: InnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements || isProcessing) return;

      setIsProcessing(true);

      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/portal/payment-success`,
          },
          redirect: "if_required",
        });

        if (error) {
          const msg = error.message || "Erreur lors du paiement";
          toast.error(msg);
          onError?.(msg);
        } else if (paymentIntent?.status === "succeeded") {
          setIsComplete(true);
          toast.success("Paiement par carte confirmé !");
          // Invalidate all billing caches
          queryClient.invalidateQueries({ queryKey: ["ledger-balance"] });
          queryClient.invalidateQueries({ queryKey: ["overdue-count-unified"] });
          queryClient.invalidateQueries({ queryKey: ["ledger-history-v2"] });
          queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
          queryClient.invalidateQueries({ queryKey: ["client-subscriptions"] });
          queryClient.invalidateQueries({ queryKey: ["client-profile-dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
          queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
          queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
          queryClient.invalidateQueries({ queryKey: ["client-balance"] });
          queryClient.invalidateQueries({ queryKey: ["client-ledger"] });
          onSuccess?.();
        } else {
          // Payment requires additional action or is processing
          toast.info("Le paiement est en cours de traitement.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inattendue";
        toast.error(msg);
        onError?.(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [stripe, elements, isProcessing, queryClient, onSuccess, onError]
  );

  if (isComplete) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <p className="text-sm font-semibold text-foreground">Paiement réussi !</p>
        <p className="text-xs text-muted-foreground">Votre facture a été mise à jour.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      <Button
        type="submit"
        disabled={!stripe || !elements || isProcessing}
        className="w-full h-11 text-sm font-semibold gap-2"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Traitement en cours…
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Payer {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <ShieldCheck className="w-3 h-3" />
        Paiement sécurisé — vos données de carte ne transitent jamais par nos serveurs
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────
// Outer wrapper: fetches PaymentIntent, wraps in <Elements>
// ─────────────────────────────────────────────────

export interface StripeInlinePaymentProps {
  invoiceId: string;
  amount: number;
  description?: string;
  customerEmail?: string;
  customerId?: string;
  onSuccess?: () => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

export function StripeInlinePayment({
  invoiceId,
  amount,
  description,
  customerEmail,
  customerId,
  onSuccess,
  onError,
  disabled = false,
}: StripeInlinePaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled || !invoiceId || amount <= 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "stripe-create-payment-intent",
          {
            body: {
              invoice_id: invoiceId,
              amount,
              description: description || undefined,
              customer_email: customerEmail || undefined,
              customer_id: customerId || undefined,
            },
          }
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        if (!data?.client_secret) throw new Error("Aucun secret de paiement retourné");

        if (!cancelled) {
          setClientSecret(data.client_secret);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Erreur d'initialisation Stripe";
          setError(msg);
          onError?.(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoiceId, amount, description, customerEmail, customerId, disabled]);

  if (disabled) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Chargement du formulaire de paiement…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "hsl(220, 90%, 56%)",
            borderRadius: "8px",
          },
        },
        locale: "fr",
      }}
    >
      <PaymentForm
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
        invoiceId={invoiceId}
      />
    </Elements>
  );
}

export default StripeInlinePayment;
