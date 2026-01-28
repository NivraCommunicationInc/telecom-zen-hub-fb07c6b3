import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";

interface PayPalButtonProps {
  amount: number;
  invoiceId?: string;
  orderId?: string;
  description?: string;
  onSuccess?: (captureId: string) => void;
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
      };
    };
  }
}

export const PayPalButton = ({
  amount,
  invoiceId,
  orderId,
  description,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  className = "",
}: PayPalButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const containerId = `paypal-button-container-${invoiceId || orderId || "main"}`;

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
      script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || ""}&currency=CAD&locale=fr_CA`;
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
          const { data, error } = await supabase.functions.invoke("paypal-create-order", {
            body: {
              amount,
              invoice_id: invoiceId,
              order_id: orderId,
              description: description || "Paiement Nivra Telecom",
            },
          });

          if (error) throw error;
          if (!data?.paypal_order_id) throw new Error("No order ID returned");

          return data.paypal_order_id;
        } catch (err) {
          console.error("PayPal create order error:", err);
          const errorMessage = await getInvokeErrorMessage(err);
          toast.error(errorMessage);
          onError?.(errorMessage);
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
              order_id: orderId, // Pass order_id to update orders table
            },
          });

          if (error) throw error;
          if (!captureData?.success) throw new Error(captureData?.error || "Capture failed");

          toast.success("Paiement réussi!");
          onSuccess?.(captureData.capture_id);
        } catch (err) {
          console.error("PayPal capture error:", err);
          const errorMessage = await getInvokeErrorMessage(err);
          toast.error(errorMessage);
          onError?.(errorMessage);
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {
        toast.info("Paiement annulé");
        onCancel?.();
      },
      onError: (err: unknown) => {
        console.error("PayPal error:", err);
        const errorMessage = err instanceof Error ? err.message : "Erreur PayPal";
        toast.error(errorMessage);
        onError?.(errorMessage);
      },
    }).render(`#${containerId}`);
  }, [sdkReady, amount, invoiceId, orderId, description, disabled, containerId, onSuccess, onError, onCancel]);

  if (!sdkReady) {
    return (
      <Button disabled className={className}>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Chargement PayPal...
      </Button>
    );
  }

  return (
    <div className={className}>
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Traitement en cours...</span>
        </div>
      )}
      <div id={containerId} className={isLoading ? "hidden" : ""} />
    </div>
  );
};

export default PayPalButton;
