import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { portalClient as portalSupabase } from "@/integrations/backend";

export interface ClientBillingSubscription {
  id: string;
  plan_name: string;
  plan_price: number;
  status: string;
  auto_billing_enabled: boolean | null;
  paypal_subscription_id: string | null;
  paypal_plan_id: string | null;
  created_at: string;
}

export interface AutoPayEligibility {
  eligible: boolean;
  reason: string;
  subscription_id: string | null;
  plan_name?: string;
  plan_price?: number;
  subscription_status?: string;
  paypal_subscription_id?: string;
}

export interface AutoPayEnrollError {
  message: string;
  code?: string;
  debug_id?: string | null;
  attempt_id?: string | null;
  http_status?: number;
}

const FLOW_FLAG_KEY = "nivra_paypal_flow_active";

export function setPayPalFlowActive(attemptId: string) {
  try {
    sessionStorage.setItem(FLOW_FLAG_KEY, attemptId);
  } catch {
    /* ignore */
  }
}

export function clearPayPalFlowActive() {
  try {
    sessionStorage.removeItem(FLOW_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export function isPayPalFlowActive(): string | null {
  try {
    return sessionStorage.getItem(FLOW_FLAG_KEY);
  } catch {
    return null;
  }
}

export const useClientAutoPayEnrollment = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const [enrollingSubscriptionId, setEnrollingSubscriptionId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<AutoPayEnrollError | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Server-side eligibility (Nivra Core RPC)
  const { data: eligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["client-autopay-eligibility", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AutoPayEligibility> => {
      const { data, error } = await portalSupabase.rpc("check_autopay_eligibility" as any, {
        target_user_id: user!.id,
      });
      if (error) throw error;
      return (data as unknown) as AutoPayEligibility;
    },
  });

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["client-billing-subscriptions", user?.id],
    queryFn: async (): Promise<ClientBillingSubscription[]> => {
      if (!user?.id) return [];
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!customer) return [];
      const { data, error } = await portalSupabase
        .from("billing_subscriptions")
        .select(
          "id, plan_name, plan_price, status, auto_billing_enabled, paypal_subscription_id, paypal_plan_id, created_at",
        )
        .eq("customer_id", customer.id)
        .in("status", ["active", "pending", "suspended"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ClientBillingSubscription[]) || [];
    },
    enabled: !!user?.id,
  });

  const activePayPalSubscription =
    subscriptions?.find((s) => s.status === "active" && !!s.paypal_subscription_id) ?? null;

  /**
   * Enroll/retry. Pass `attemptId` to retry an existing failed attempt.
   * Returns true on success (redirect happens), false on failure (error in `lastError`).
   */
  const enrollInPayPal = async (
    subscription?: ClientBillingSubscription | null,
    attemptId?: string,
  ): Promise<boolean> => {
    const subId = subscription?.id || eligibility?.subscription_id;
    if (!subId) {
      const err: AutoPayEnrollError = {
        message: "Aucun abonnement éligible. Contactez le support.",
        code: "NO_ELIGIBLE_SUBSCRIPTION",
      };
      setLastError(err);
      toast.error(err.message);
      return false;
    }

    try {
      setLastError(null);
      setEnrollingSubscriptionId(subId);

      const response = await portalSupabase.functions.invoke("paypal-create-subscription", {
        body: {
          billing_subscription_id: subId,
          customer_email: profile?.email || user?.email || "",
          customer_name: profile?.full_name || "Client",
          attempt_id: attemptId,
        },
      });

      if (response.error) {
        const err: AutoPayEnrollError = {
          message: response.error.message || "Erreur réseau",
          code: "NETWORK_ERROR",
          http_status: (response.error as any)?.status,
        };
        setLastError(err);
        return false;
      }

      const data = response.data as any;
      if (!data?.success) {
        const err: AutoPayEnrollError = {
          message: data?.error || "Erreur lors de la création de l'abonnement PayPal",
          code: data?.code,
          debug_id: data?.debug_id ?? null,
          attempt_id: data?.attempt_id ?? null,
        };
        setLastError(err);
        return false;
      }

      if (!data.approval_url) {
        const err: AutoPayEnrollError = {
          message: "URL d'approbation PayPal manquante",
          code: "MISSING_APPROVAL_URL",
          attempt_id: data?.attempt_id ?? null,
        };
        setLastError(err);
        return false;
      }

      // Mark flow active so ProtectedRoute / RootRedirect won't bounce us back.
      setPayPalFlowActive(data.attempt_id || "active");
      await queryClient.invalidateQueries({ queryKey: ["client-billing-subscriptions"] });

      // Direct redirect to PayPal approval page
      window.location.assign(data.approval_url);
      return true;
    } catch (error: any) {
      console.error("[AutoPay] Error:", error);
      const err: AutoPayEnrollError = {
        message: error?.message || "Erreur lors de l'inscription au paiement automatique",
        code: "EXCEPTION",
      };
      setLastError(err);
      return false;
    } finally {
      setEnrollingSubscriptionId(null);
    }
  };

  return {
    subscriptions: subscriptions || [],
    activePayPalSubscription,
    enrollInPayPal,
    enrollingSubscriptionId,
    isLoading,
    eligibility,
    eligibilityLoading,
    lastError,
    clearLastError: () => setLastError(null),
  };
};
