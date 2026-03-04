import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";

interface PayPalCheckoutButtonProps {
  invoiceId: string;
  amount: number;
  description?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

/**
 * PayPal Checkout via redirect (no Hosted Fields).
 * Creates a PayPal order server-side, opens the approval URL,
 * then polls the invoice status until it flips to "paid".
 */
export const PayPalCheckoutButton = ({
  invoiceId,
  amount,
  description,
  onSuccess,
  onError,
  disabled = false,
}: PayPalCheckoutButtonProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onSuccess, onError });
  const queryClient = useQueryClient();

  useEffect(() => {
    callbacksRef.current = { onSuccess, onError };
  }, [onSuccess, onError]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll invoice status to detect cross-tab payment
  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setIsPolling(true);

    let attempts = 0;
    const maxAttempts = 120; // 10 min at 5s interval

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current);
        if (mountedRef.current) {
          setIsPolling(false);
          toast.info("Délai d'attente dépassé. Actualisez la page pour vérifier le statut.");
        }
        return;
      }

      try {
        const { data } = await supabase
          .from("billing_invoices")
          .select("status, amount_paid, balance_due")
          .eq("id", invoiceId)
          .maybeSingle();

        if (data?.status === "paid") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (mountedRef.current) {
            setIsPolling(false);
            toast.success("Paiement PayPal confirmé!");
            // Invalidate all billing queries
            queryClient.invalidateQueries({ queryKey: ["ledger-balance"] });
            queryClient.invalidateQueries({ queryKey: ["overdue-count-unified"] });
            queryClient.invalidateQueries({ queryKey: ["ledger-history-v2"] });
            queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
            queryClient.invalidateQueries({ queryKey: ["client-subscriptions"] });
            queryClient.invalidateQueries({ queryKey: ["client-profile-dashboard"] });
            callbacksRef.current.onSuccess?.();
          }
        }
      } catch {
        // Silently continue polling
      }
    }, 5000);
  }, [invoiceId]);

  const handleClick = async () => {
    if (isCreating || disabled) return;
    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke("paypal-create-order", {
        body: {
          invoice_id: invoiceId,
          amount,
          description: description || "Paiement Nivra Telecom",
        },
      });

      if (error) throw error;

      // Find the approval URL from PayPal links
      const approvalLink = data?.links?.find(
        (l: { rel: string; href: string }) => l.rel === "payer-action" || l.rel === "approve"
      );

      if (!approvalLink?.href) {
        throw new Error("Aucun lien de paiement PayPal retourné");
      }

      // Open PayPal in new tab
      window.open(approvalLink.href, "_blank", "noopener,noreferrer");

      // Start polling for payment completion
      startPolling();

      toast.info("Complétez votre paiement dans l'onglet PayPal ouvert.");
    } catch (err) {
      console.error("[PayPal Checkout] Create order error:", err);
      const msg = await getInvokeErrorMessage(err);
      toast.error(msg);
      callbacksRef.current.onError?.(msg);
    } finally {
      if (mountedRef.current) setIsCreating(false);
    }
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setIsPolling(false);
  };

  if (isPolling) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 py-4 px-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-foreground font-medium">
            En attente de votre paiement PayPal…
          </span>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Complétez le paiement dans l'onglet PayPal. Cette page se mettra à jour automatiquement.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={stopPolling}
          className="w-full text-muted-foreground"
        >
          Annuler l'attente
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isCreating || disabled}
      className="w-full h-12 text-base font-semibold gap-2"
      size="lg"
    >
      {isCreating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Préparation du paiement…
        </>
      ) : (
        <>
          <CreditCard className="w-5 h-5" />
          Payer {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} avec PayPal
          <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-60" />
        </>
      )}
    </Button>
  );
};

export default PayPalCheckoutButton;
