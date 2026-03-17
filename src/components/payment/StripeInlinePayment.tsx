/**
 * StripeInlinePayment — Embedded Stripe Payment Element.
 * Replaces StripeCheckoutButton with a fully inline card form.
 * No redirect, no external tab. Card data never touches Nivra servers.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { STRIPE_PUBLISHABLE_KEY } from "@/config/stripe";

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

export interface StripeBillingDetails {
  firstName: string;
  lastName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email: string;
}

export interface StripeInlinePaymentSuccessPayload {
  paymentIntentId: string;
}

interface InnerFormProps {
  amount: number;
  customerEmail?: string;
  collectBillingDetails: boolean;
  defaultBillingDetails?: Partial<StripeBillingDetails>;
  onSuccess?: (payload: StripeInlinePaymentSuccessPayload) => void;
  onError?: (msg: string) => void;
}

const normalizeCountryCode = (value: string): string => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "CA";
  if (["CANADA", "CA"].includes(trimmed)) return "CA";
  if (["UNITED STATES", "USA", "US"].includes(trimmed)) return "US";
  return trimmed.slice(0, 2);
};

function PaymentForm({
  amount,
  customerEmail,
  collectBillingDetails,
  defaultBillingDetails,
  onSuccess,
  onError,
}: InnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [paymentElementReady, setPaymentElementReady] = useState(false);
  const [paymentElementError, setPaymentElementError] = useState<string | null>(null);
  const [billingDetails, setBillingDetails] = useState<StripeBillingDetails>({
    firstName: defaultBillingDetails?.firstName || "",
    lastName: defaultBillingDetails?.lastName || "",
    addressLine1: defaultBillingDetails?.addressLine1 || "",
    city: defaultBillingDetails?.city || "",
    state: defaultBillingDetails?.state || "QC",
    postalCode: defaultBillingDetails?.postalCode || "",
    country: normalizeCountryCode(defaultBillingDetails?.country || "CA"),
    email: defaultBillingDetails?.email || customerEmail || "",
  });
  const queryClient = useQueryClient();

  const isBillingComplete =
    !collectBillingDetails ||
    [
      billingDetails.firstName,
      billingDetails.lastName,
      billingDetails.addressLine1,
      billingDetails.city,
      billingDetails.state,
      billingDetails.postalCode,
      billingDetails.country,
      billingDetails.email,
    ].every((field) => field.trim().length > 0);

  const canSubmit =
    !!stripe &&
    !!elements &&
    !isProcessing &&
    paymentElementReady &&
    !paymentElementError &&
    isBillingComplete;

  const handleBillingFieldChange = (field: keyof StripeBillingDetails, value: string) => {
    setBillingDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements || isProcessing) return;
      if (!paymentElementReady) {
        const msg = "Le formulaire de carte sécurisé n'est pas encore prêt.";
        toast.error(msg);
        onError?.(msg);
        return;
      }

      if (collectBillingDetails && !isBillingComplete) {
        const msg = "Veuillez compléter toutes les informations de facturation.";
        toast.error(msg);
        onError?.(msg);
        return;
      }

      const mountedPaymentElement = elements.getElement(PaymentElement);
      if (!mountedPaymentElement) {
        const msg = "Le formulaire Stripe n'est pas monté. Veuillez réessayer.";
        toast.error(msg);
        onError?.(msg);
        return;
      }

      setIsProcessing(true);

      try {
        const submitResult = await elements.submit();
        if (submitResult.error) {
          const submitMsg = submitResult.error.message || "Le formulaire Stripe n'est pas valide.";
          toast.error(submitMsg);
          onError?.(submitMsg);
          return;
        }

        const fullName = `${billingDetails.firstName} ${billingDetails.lastName}`.trim();
        const billingPayload = collectBillingDetails
          ? {
              name: fullName || undefined,
              email: billingDetails.email.trim() || customerEmail || undefined,
              address: {
                line1: billingDetails.addressLine1.trim(),
                city: billingDetails.city.trim(),
                state: billingDetails.state.trim(),
                postal_code: billingDetails.postalCode.trim(),
                country: normalizeCountryCode(billingDetails.country),
              },
            }
          : undefined;

        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/portal/payment-success`,
            payment_method_data: billingPayload
              ? {
                  billing_details: billingPayload,
                }
              : undefined,
            receipt_email: billingPayload?.email,
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
          onSuccess?.({ paymentIntentId: paymentIntent.id });
        } else {
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
    [
      stripe,
      elements,
      isProcessing,
      paymentElementReady,
      collectBillingDetails,
      isBillingComplete,
      billingDetails,
      customerEmail,
      queryClient,
      onSuccess,
      onError,
    ]
  );

  if (isComplete) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="w-10 h-10 text-primary" />
        <p className="text-sm font-semibold text-foreground">Paiement réussi !</p>
        <p className="text-xs text-muted-foreground">Votre facture a été mise à jour.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {collectBillingDetails && (
        <div className="space-y-3 rounded-md border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">Informations de facturation</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="billing-first-name">Prénom</Label>
              <Input
                id="billing-first-name"
                value={billingDetails.firstName}
                onChange={(e) => handleBillingFieldChange("firstName", e.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-last-name">Nom</Label>
              <Input
                id="billing-last-name"
                value={billingDetails.lastName}
                onChange={(e) => handleBillingFieldChange("lastName", e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="billing-address">Adresse de facturation</Label>
              <Input
                id="billing-address"
                value={billingDetails.addressLine1}
                onChange={(e) => handleBillingFieldChange("addressLine1", e.target.value)}
                autoComplete="address-line1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-city">Ville</Label>
              <Input
                id="billing-city"
                value={billingDetails.city}
                onChange={(e) => handleBillingFieldChange("city", e.target.value)}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-state">Province / État</Label>
              <Input
                id="billing-state"
                value={billingDetails.state}
                onChange={(e) => handleBillingFieldChange("state", e.target.value)}
                autoComplete="address-level1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-postal-code">Code postal</Label>
              <Input
                id="billing-postal-code"
                value={billingDetails.postalCode}
                onChange={(e) => handleBillingFieldChange("postalCode", e.target.value)}
                autoComplete="postal-code"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-country">Pays (code ISO)</Label>
              <Input
                id="billing-country"
                value={billingDetails.country}
                onChange={(e) => handleBillingFieldChange("country", e.target.value.toUpperCase())}
                maxLength={2}
                autoComplete="country"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="billing-email">Email</Label>
              <Input
                id="billing-email"
                type="email"
                value={billingDetails.email}
                onChange={(e) => handleBillingFieldChange("email", e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>
        </div>
      )}

      <div data-testid="stripe-payment-element" className="space-y-2 rounded-md border border-border bg-background p-4">
        <p className="text-sm font-semibold text-foreground">Informations de carte (Stripe sécurisé)</p>
        <PaymentElement
          onReady={() => {
            setPaymentElementReady(true);
            setPaymentElementError(null);
          }}
          onLoadError={() => {
            const msg = "Impossible de charger le formulaire de carte sécurisé.";
            setPaymentElementError(msg);
            setPaymentElementReady(false);
            onError?.(msg);
          }}
          options={{
            layout: "tabs",
          }}
        />
        {!paymentElementReady && !paymentElementError && (
          <p className="text-xs text-muted-foreground">Chargement du formulaire Stripe…</p>
        )}
        {paymentElementError && <p className="text-xs text-destructive">{paymentElementError}</p>}
      </div>

      <Button type="submit" disabled={!canSubmit} className="w-full h-11 text-sm font-semibold gap-2" size="lg">
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
  collectBillingDetails?: boolean;
  defaultBillingDetails?: Partial<StripeBillingDetails>;
  onSuccess?: (payload: StripeInlinePaymentSuccessPayload) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

export function StripeInlinePayment({
  invoiceId,
  amount,
  description,
  customerEmail,
  customerId,
  collectBillingDetails = false,
  defaultBillingDetails,
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
  }, [invoiceId, amount, description, customerEmail, customerId, disabled, onError]);

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
            colorPrimary: "hsl(var(--primary))",
            borderRadius: "8px",
          },
        },
        locale: "fr",
      }}
    >
      <PaymentForm
        amount={amount}
        customerEmail={customerEmail}
        collectBillingDetails={collectBillingDetails}
        defaultBillingDetails={defaultBillingDetails}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

export default StripeInlinePayment;
