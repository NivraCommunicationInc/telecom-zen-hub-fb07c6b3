import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";
import { notifyNivraCorePaid } from "@/lib/nivraCore";

interface CustomerInfo {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    admin_area_2?: string; // City
    admin_area_1?: string; // Province/State
    postal_code?: string;
    country_code?: string;
  };
}

export interface PayPalPayerAddress {
  address_line_1?: string;
  address_line_2?: string;
  admin_area_2?: string; // city
  admin_area_1?: string; // province/state
  postal_code?: string;
  country_code?: string;
}

interface PayPalButtonProps {
  amount: number;
  invoiceId?: string;
  orderId?: string;
  description?: string;
  customer?: CustomerInfo;
  /** Payment number from Nivra Core — used to notify backend after capture */
  paymentNumber?: string;
  onSuccess?: (captureId: string, payerAddress?: PayPalPayerAddress | null) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: unknown) => {
        render: (container: string | HTMLElement) => Promise<void>;
        isEligible?: () => boolean;
      };
      FUNDING?: {
        CARD: string;
        PAYPAL: string;
      };
    };
  }
}

export const PayPalButton = ({
  amount,
  invoiceId,
  orderId,
  description,
  customer,
  paymentNumber,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  className = "",
}: PayPalButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const containerId = `paypal-button-container-${invoiceId || orderId || "main"}`;
  const cardContainerId = `paypal-card-container-${invoiceId || orderId || "main"}`;

  // IMPORTANT:
  // Plusieurs parties du site refetch en arrière-plan (bannières statut, sécurité, etc.).
  // Si on recrée les boutons PayPal à chaque re-render, PayPal peut fermer la fenêtre
  // (ou annuler le flux) et l'utilisateur revient au checkout.
  // => On stabilise les callbacks + on ne re-render les boutons que si les props
  //    réellement pertinentes changent.
  const callbacksRef = useRef({ onSuccess, onError, onCancel });
  useEffect(() => {
    callbacksRef.current = { onSuccess, onError, onCancel };
  }, [onSuccess, onError, onCancel]);

  const customerSignature = useMemo(() => {
    const a = customer?.address;
    return [
      customer?.first_name ?? "",
      customer?.last_name ?? "",
      customer?.email ?? "",
      customer?.phone ?? "",
      a?.address_line_1 ?? "",
      a?.address_line_2 ?? "",
      a?.admin_area_2 ?? "",
      a?.admin_area_1 ?? "",
      a?.postal_code ?? "",
      a?.country_code ?? "",
    ].join("|");
  }, [
    customer?.first_name,
    customer?.last_name,
    customer?.email,
    customer?.phone,
    customer?.address?.address_line_1,
    customer?.address?.address_line_2,
    customer?.address?.admin_area_2,
    customer?.address?.admin_area_1,
    customer?.address?.postal_code,
    customer?.address?.country_code,
  ]);

  const normalizedAmount = useMemo(() => {
    if (!Number.isFinite(amount)) return NaN;
    // Keep PayPal values stable and strictly 2-decimal compatible.
    return Math.round(amount * 100) / 100;
  }, [amount]);

  const renderKey = useMemo(() => {
    return [normalizedAmount, invoiceId ?? "", orderId ?? "", description ?? "", customerSignature].join("::");
  }, [normalizedAmount, invoiceId, orderId, description, customerSignature]);

  const lastRenderedKeyRef = useRef<string | null>(null);

  // Load PayPal SDK
  useEffect(() => {
    const loadPayPalSdk = async () => {
      // Check if SDK is already loaded
      if (window.paypal) {
        setSdkReady(true);
        return;
      }

      // Get client ID from edge function (more secure)
      const script = document.createElement("script");
      // Enable card funding source explicitly so the standalone card button is rendered.
      script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || ""}&currency=CAD&locale=fr_CA&enable-funding=card&components=buttons,funding-eligibility`;
      script.async = true;
      script.onload = () => setSdkReady(true);
      script.onerror = () => {
        console.error("Failed to load PayPal SDK");
        toast.error("Erreur de chargement PayPal");
      };
      document.body.appendChild(script);
    };

    loadPayPalSdk();
  }, []);

  // Render PayPal buttons when SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.paypal || disabled) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Prevent tearing down & re-creating PayPal buttons on unrelated re-renders.
    if (lastRenderedKeyRef.current === renderKey) return;
    lastRenderedKeyRef.current = renderKey;

    // Clear any existing buttons
    container.innerHTML = "";

    window.paypal.Buttons({
      style: {
        layout: "horizontal",
        color: "blue",
        shape: "rect",
        label: "pay",
        height: 45,
      },
      createOrder: async () => {
        setIsLoading(true);
        try {
          if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
            const msg = "Montant PayPal invalide. Vérifiez le total à payer.";
            toast.error(msg);
            callbacksRef.current.onError?.(msg);
            throw new Error(msg);
          }

          const { data, error } = await supabase.functions.invoke("paypal-create-order", {
            body: {
              amount: normalizedAmount,
              invoice_id: invoiceId,
              order_id: orderId,
              description: description || "Paiement Nivra Telecom",
              customer: customer,
            },
          });

          if (error) throw error;
          if (!data?.paypal_order_id) throw new Error("No order ID returned");

          return data.paypal_order_id;
        } catch (err) {
          console.error("PayPal create order error:", err);
          const errorMessage = await getInvokeErrorMessage(err);
          toast.error(errorMessage);
          callbacksRef.current.onError?.(errorMessage);
          throw err;
        } finally {
          setIsLoading(false);
        }
      },

      onApprove: async (data: { orderID: string }) => {
        setIsLoading(true);
        try {
          const { data: captureData, error } = await supabase.functions.invoke("paypal-capture-order", {
            body: {
              paypal_order_id: data.orderID,
              invoice_id: invoiceId,
              order_id: orderId,
            },
          });

          if (error) throw error;
          if (!captureData?.capture_id) throw new Error("No capture ID returned");

          toast.success("Paiement PayPal réussi!");

          // Notify Nivra Core backend (fire-and-forget)
          if (paymentNumber) {
            notifyNivraCorePaid({
              paymentNumber,
              paypalOrderId: data.orderID,
              paypalCaptureId: captureData.capture_id,
            });
          }

          callbacksRef.current.onSuccess?.(captureData.capture_id);
        } catch (err) {
          console.error("PayPal capture error:", err);
          const errorMessage = await getInvokeErrorMessage(err);
          toast.error(errorMessage);
          callbacksRef.current.onError?.(errorMessage);
        } finally {
          setIsLoading(false);
        }
      },

      onCancel: () => {
        toast.info("Paiement PayPal annulé");
        callbacksRef.current.onCancel?.();
      },

      onError: (err: Error) => {
        console.error("PayPal error:", err);
        toast.error("Erreur PayPal. Veuillez réessayer.");
        callbacksRef.current.onError?.(err.message || "Unknown PayPal error");
      },
    }).render(`#${containerId}`);
  }, [sdkReady, containerId, disabled, renderKey, normalizedAmount, invoiceId, orderId, description, customer]);

  if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
    return (
      <div className="text-sm text-destructive">
        Configuration PayPal manquante
      </div>
    );
  }

  return (
    <div className={className}>
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">
            Traitement en cours...
          </span>
        </div>
      )}
      {/* Card-first button (Visa / Mastercard — no PayPal account) */}
      <div
        id={cardContainerId}
        className={isLoading ? "opacity-50 pointer-events-none mb-2" : "mb-2"}
      />
      {/* PayPal account button (fallback) */}
      <div
        id={containerId}
        className={isLoading ? "opacity-50 pointer-events-none" : ""}
      />
      {!sdkReady && !isLoading && (
        <Button disabled className="w-full">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Chargement PayPal...
        </Button>
      )}
    </div>
  );
};

export default PayPalButton;
