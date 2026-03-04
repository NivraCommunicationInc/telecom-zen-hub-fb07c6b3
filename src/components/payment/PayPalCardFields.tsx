import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";

interface PayPalCardFieldsProps {
  invoiceId: string;
  amount: number;
  description?: string;
  onSuccess?: (captureId: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    paypal?: {
      CardFields: (config: unknown) => {
        isEligible: () => boolean;
        NameField: () => { render: (container: string | HTMLElement) => Promise<void> };
        NumberField: () => { render: (container: string | HTMLElement) => Promise<void> };
        ExpiryField: () => { render: (container: string | HTMLElement) => Promise<void> };
        CVVField: () => { render: (container: string | HTMLElement) => Promise<void> };
        submit: () => Promise<void>;
        getState: () => { isFormValid: boolean };
      };
      Buttons?: (config: unknown) => {
        render: (container: string | HTMLElement) => Promise<void>;
      };
    };
  }
}

/**
 * PayPal Advanced Card Fields — TELUS-style embedded card form.
 * Uses PayPal CardFields (PCI-compliant hosted fields) so the client
 * never leaves the page.
 */
export const PayPalCardFields = ({
  invoiceId,
  amount,
  description,
  onSuccess,
  onError,
  disabled = false,
}: PayPalCardFieldsProps) => {
  const [sdkReady, setSdkReady] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const cardFieldRef = useRef<ReturnType<NonNullable<Window["paypal"]>["CardFields"]> | null>(null);
  const mountedRef = useRef(true);

  // Stable callbacks
  const callbacksRef = useRef({ onSuccess, onError });
  useEffect(() => {
    callbacksRef.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Load PayPal SDK with card-fields component + client-token
  useEffect(() => {
    let cancelled = false;

    const loadSdk = async () => {
      // If SDK already loaded with card-fields, skip
      if (window.paypal?.CardFields) {
        setSdkReady(true);
        return;
      }

      try {
        // 1. Get client token from backend
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
          "paypal-client-token"
        );
        if (tokenError) throw tokenError;
        if (!tokenData?.client_token) throw new Error("No client token returned");

        if (cancelled) return;

        // 2. Remove existing PayPal scripts (they may not have card-fields)
        document.querySelectorAll('script[src*="paypal.com/sdk/js"]').forEach((s) => s.remove());
        // Reset paypal global
        delete (window as any).paypal;

        // 3. Load SDK with card-fields component
        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
        if (!clientId) {
          setSdkError("Configuration PayPal manquante");
          return;
        }

        const script = document.createElement("script");
        script.src = `https://www.paypal.com/sdk/js?components=card-fields&client-id=${clientId}&currency=CAD&locale=fr_CA`;
        script.setAttribute("data-client-token", tokenData.client_token);
        script.async = true;
        script.onload = () => {
          if (!cancelled) setSdkReady(true);
        };
        script.onerror = () => {
          if (!cancelled) setSdkError("Impossible de charger PayPal");
        };
        document.body.appendChild(script);
      } catch (err) {
        console.error("[PayPal CardFields] SDK load error:", err);
        if (!cancelled) setSdkError("Erreur de chargement PayPal");
      }
    };

    loadSdk();
    return () => { cancelled = true; };
  }, []);

  // Mount card fields once SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.paypal?.CardFields || disabled) return;

    try {
      const cardField = window.paypal.CardFields({
        createOrder: async () => {
          // Backend creates order from DB amount (not frontend)
          const { data, error } = await supabase.functions.invoke("paypal-create-order", {
            body: {
              invoice_id: invoiceId,
              amount, // fallback — backend should override from DB
              description: description || "Paiement Nivra Telecom",
            },
          });

          if (error) throw error;
          if (!data?.paypal_order_id) throw new Error("No order ID returned");
          return data.paypal_order_id;
        },

        onApprove: async (data: { orderID: string }) => {
          if (!mountedRef.current) return;
          setIsSubmitting(true);

          try {
            const { data: captureData, error } = await supabase.functions.invoke(
              "paypal-capture-order",
              {
                body: {
                  paypal_order_id: data.orderID,
                  invoice_id: invoiceId,
                },
              }
            );

            if (error) throw error;
            if (!captureData?.capture_id) throw new Error("No capture ID returned");

            // ★ Log capture proof in console for DevTools validation
            console.log("[PayPal CardFields] ★ CAPTURE PROOF:", {
              capture_id: captureData.capture_id,
              amount: captureData.amount,
              currency: captureData.currency,
              status: captureData.status,
              invoice_updated: captureData.invoice_updated,
              updated_invoice: captureData.updated_invoice,
            });

            toast.success("Paiement par carte réussi!");
            callbacksRef.current.onSuccess?.(captureData.capture_id);
          } catch (err) {
            console.error("[PayPal CardFields] Capture error:", err);
            const msg = await getInvokeErrorMessage(err);
            toast.error(msg);
            callbacksRef.current.onError?.(msg);
          } finally {
            if (mountedRef.current) setIsSubmitting(false);
          }
        },

        onError: (err: Error) => {
          console.error("[PayPal CardFields] Error:", err);
          toast.error("Erreur de paiement. Veuillez réessayer.");
          callbacksRef.current.onError?.(err.message || "Erreur PayPal");
        },

        style: {
          input: {
            "font-size": "16px",
            "font-family": "system-ui, -apple-system, sans-serif",
            color: "#0f172a",
            padding: "12px",
          },
          ".invalid": {
            color: "#dc2626",
          },
        },
      });

      if (cardField.isEligible()) {
        setEligible(true);
        cardFieldRef.current = cardField;

        // Render individual fields into their containers
        cardField.NameField().render("#card-name-field");
        cardField.NumberField().render("#card-number-field");
        cardField.ExpiryField().render("#card-expiry-field");
        cardField.CVVField().render("#card-cvv-field");
      } else {
        setEligible(false);
        console.warn("[PayPal CardFields] Not eligible for card fields");
      }
    } catch (err) {
      console.error("[PayPal CardFields] Mount error:", err);
      setEligible(false);
    }
  }, [sdkReady, disabled, invoiceId, amount, description]);

  const handleSubmit = useCallback(async () => {
    if (!cardFieldRef.current || isSubmitting) return;

    const state = cardFieldRef.current.getState();
    if (!state.isFormValid) {
      toast.error("Veuillez remplir tous les champs de la carte correctement.");
      return;
    }

    setIsSubmitting(true);
    try {
      await cardFieldRef.current.submit();
      // onApprove will handle the rest
    } catch (err) {
      console.error("[PayPal CardFields] Submit error:", err);
      toast.error("Erreur lors du traitement. Veuillez réessayer.");
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [isSubmitting]);

  if (sdkError) {
    return (
      <div className="text-sm text-destructive p-3 text-center">
        {sdkError}
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Chargement du formulaire de paiement…</span>
      </div>
    );
  }

  if (eligible === false) {
    return (
      <div className="text-sm text-muted-foreground p-3 text-center">
        Le paiement par carte n'est pas disponible pour le moment. Veuillez utiliser PayPal ou Interac.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Security notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="w-3.5 h-3.5" />
        <span>Vos informations sont chiffrées et sécurisées.</span>
      </div>

      {/* Card Number */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Numéro de carte
          <span className="float-right inline-flex items-center gap-1 text-muted-foreground font-normal">
            <CreditCard className="w-3.5 h-3.5" />
            Visa, Mastercard, Amex
          </span>
        </label>
        <div
          id="card-number-field"
          className="border border-input rounded-md bg-background min-h-[44px]"
        />
      </div>

      {/* Expiry + CVV row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Date d'expiration <span className="text-muted-foreground font-normal">MM/AA</span>
          </label>
          <div
            id="card-expiry-field"
            className="border border-input rounded-md bg-background min-h-[44px]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Code de sécurité
          </label>
          <div
            id="card-cvv-field"
            className="border border-input rounded-md bg-background min-h-[44px]"
          />
        </div>
      </div>

      {/* Name on card */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Nom sur la carte
        </label>
        <div
          id="card-name-field"
          className="border border-input rounded-md bg-background min-h-[44px]"
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || disabled}
        className="w-full h-12 text-base font-semibold"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Traitement en cours…
          </>
        ) : (
          `Confirmer et payer ${amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
        )}
      </Button>
    </div>
  );
};

export default PayPalCardFields;
