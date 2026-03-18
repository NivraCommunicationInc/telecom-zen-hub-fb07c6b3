/**
 * Stripe Admin Actions hook — capture, cancel, refund from Core admin.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface StripeAdminActionResult {
  success: boolean;
  error?: string;
  data?: Record<string, any>;
}

export function useStripeAdminActions() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-payments-v2"] });
    queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const executeAction = async (
    action: "capture" | "cancel" | "refund" | "status",
    paymentIntentId: string,
    opts?: {
      payment_id?: string;
      invoice_id?: string;
      amount?: number;
      reason?: string;
    }
  ): Promise<StripeAdminActionResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-admin-actions", {
        body: {
          action,
          payment_intent_id: paymentIntentId,
          ...opts,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action !== "status") {
        invalidateAll();
      }

      return { success: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const capturePayment = async (
    paymentIntentId: string,
    opts?: { payment_id?: string; invoice_id?: string; amount?: number }
  ) => {
    const result = await executeAction("capture", paymentIntentId, opts);
    if (result.success) {
      toast.success(`Paiement capturé: ${result.data?.amount_captured} CAD`);
    } else {
      toast.error(`Erreur capture: ${result.error}`);
    }
    return result;
  };

  const cancelAuthorization = async (
    paymentIntentId: string,
    opts?: { payment_id?: string; invoice_id?: string; reason?: string }
  ) => {
    const result = await executeAction("cancel", paymentIntentId, opts);
    if (result.success) {
      toast.success("Autorisation annulée");
    } else {
      toast.error(`Erreur annulation: ${result.error}`);
    }
    return result;
  };

  const refundPayment = async (
    paymentIntentId: string,
    opts?: { payment_id?: string; invoice_id?: string; amount?: number; reason?: string }
  ) => {
    const result = await executeAction("refund", paymentIntentId, opts);
    if (result.success) {
      toast.success(`Remboursement effectué: ${result.data?.amount_refunded} CAD`);
    } else {
      toast.error(`Erreur remboursement: ${result.error}`);
    }
    return result;
  };

  const getPaymentIntentStatus = async (paymentIntentId: string) => {
    return executeAction("status", paymentIntentId);
  };

  return {
    loading,
    capturePayment,
    cancelAuthorization,
    refundPayment,
    getPaymentIntentStatus,
  };
}
