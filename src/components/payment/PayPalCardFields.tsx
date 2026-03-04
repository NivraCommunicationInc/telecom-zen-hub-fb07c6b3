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
        getState: () => Record<string, unknown>;
        on: (event: string, callback: (data: unknown) => void) => void;
      };
      Buttons?: (config: unknown) => {
        render: (container: string | HTMLElement) => Promise<void>;
      };
    };
  }
}

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
  const [fieldsValid, setFieldsValid] = useState(false);
  const cardFieldRef = useRef<ReturnType<NonNullable<Window["paypal"]>["CardFields"]> | null>(null);
  const mountedRef = useRef(true);

  const callbacksRef = useRef({ onSuccess, onError });
  useEffect(() => {
    callbacksRef.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Load PayPal SDK
  useEffect(() => {
    let cancelled = false;

    const loadSdk = async () => {
      if (window.paypal?.CardFields) {
        setSdkReady(true);
        return;
      }

      try {
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
          "paypal-client-token"
        );
        if (tokenError) throw tokenError;
        if (!tokenData?.client_token) throw new Error("No client token returned");
        if (cancelled) return;

        document.querySelectorAll('script[src*="paypal.com/sdk/js"]').forEach((s) => s.remove());
        delete (window as any).paypal;

        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
        if (!clientId) {
          setSdkError("Configuration PayPal manquante");
          return;
        }

        const script = document.createElement("script");
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=card-fields&intent=capture&currency=CAD&locale=fr_CA`;
        script.setAttribute("data-client-token", tokenData.client_token);
        script.async = true;
        script.onload = () => {
          if (cancelled) return;
          console.log("[PayPal SDK] Loaded. paypal object keys:", Object.keys(window.paypal || {}));
          console.log("[PayPal SDK] CardFields available:", !!window.paypal?.CardFields);
          setSdkReady(true);
        };
        script.onerror = () => { if (!cancelled) setSdkError("Impossible de charger PayPal"); };
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
          const { data, error } = await supabase.functions.invoke("paypal-create-order", {
            body: {
              invoice_id: invoiceId,
              amount,
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
              { body: { paypal_order_id: data.orderID, invoice_id: invoiceId } }
            );
            if (error) throw error;
            if (!captureData?.capture_id) throw new Error("No capture ID returned");

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
          if (mountedRef.current) setIsSubmitting(false);
        },

        style: {
          input: {
            "font-size": "16px",
            "font-family": "system-ui, -apple-system, sans-serif",
            color: "#0f172a",
            padding: "12px",
          },
          ".invalid": { color: "#dc2626" },
        },
      });

      const isElig = cardField.isEligible();
      console.log("[PayPal CardFields] isEligible():", isElig);

      if (isElig) {
        setEligible(true);
        cardFieldRef.current = cardField;

        // Listen for validity changes from PayPal iframes
        cardField.on("validityChange", (event: unknown) => {
          console.log("[PayPal CardFields] validityChange event:", JSON.stringify(event, null, 2));
          try {
            const state = cardField.getState();
            console.log("[PayPal CardFields] Full state after validityChange:", JSON.stringify(state, null, 2));
            
            const s = state as any;
            const fields = s.fields || s;
            const numberValid = fields?.cardNumberField?.isValid || fields?.cardNumber?.isValid || false;
            const expiryValid = fields?.cardExpiryField?.isValid || fields?.cardExpiry?.isValid || fields?.expirationDate?.isValid || false;
            const cvvValid = fields?.cardCvvField?.isValid || fields?.cardCvv?.isValid || fields?.cvv?.isValid || false;
            
            const allValid = numberValid && expiryValid && cvvValid;
            console.log("[PayPal CardFields] Field validity:", { numberValid, expiryValid, cvvValid, allValid });
            
            if (mountedRef.current) setFieldsValid(allValid);
          } catch (e) {
            console.warn("[PayPal CardFields] Could not parse state:", e);
          }
        });

        // Render individual hosted fields (iframes)
        cardField.NameField().render("#card-name-field");
        cardField.NumberField().render("#card-number-field");
        cardField.ExpiryField().render("#card-expiry-field");
        cardField.CVVField().render("#card-cvv-field");
      } else {
        setEligible(false);
        console.warn("[PayPal CardFields] NOT eligible. SDK components:", Object.keys(window.paypal || {}));
      }
    } catch (err) {
      console.error("[PayPal CardFields] Mount error:", err);
      setEligible(false);
    }
  }, [sdkReady, disabled, invoiceId, amount, description]);

  const handleSubmit = useCallback(async () => {
    if (!cardFieldRef.current || isSubmitting) return;

    // Log full state for debugging
    try {
      const state = cardFieldRef.current.getState();
      console.log("[PayPal CardFields] State at submit:", JSON.stringify(state, null, 2));
    } catch (e) {
      console.warn("[PayPal CardFields] Could not read state:", e);
    }

    // Don't block on our local validity tracking — just submit and let PayPal validate.
    // PayPal's submit() will reject with an error if fields are invalid,
    // and onError will fire. This avoids false negatives from incorrect state parsing.
    setIsSubmitting(true);
    try {
      await cardFieldRef.current.submit();
      // onApprove handles the rest; if fields are invalid PayPal throws here
    } catch (err: any) {
      console.error("[PayPal CardFields] Submit error:", err);
      // PayPal returns specific field errors — show them
      const message = err?.message || err?.details?.[0]?.description || "Erreur lors du traitement. Veuillez réessayer.";
      toast.error(message);
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
        Le paiement par carte n'est pas disponible pour le moment. Veuillez utiliser Interac.
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Expiry + CVV */}
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

      {/* Debug: validity indicator */}
      {fieldsValid && (
        <p className="text-xs text-primary text-center">✓ Champs carte validés par PayPal</p>
      )}
    </div>
  );
};

export default PayPalCardFields;
