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
   * Phase 3.B.3 — PayPal enrollment is decommissioned.
   * This function is retained only so existing imports keep compiling; it now
   * always fails fast with an explicit error. Autopay must be re-enrolled via
   * Square (see `SquareAutoPayEnrollment` — Phase 3.C).
   */
  const enrollInPayPal = async (
    _subscription?: ClientBillingSubscription | null,
    _attemptId?: string,
  ): Promise<boolean> => {
    const err: AutoPayEnrollError = {
      message:
        "Le paiement automatique par PayPal n'est plus disponible. Contactez le support pour activer l'autopay Square.",
      code: "PAYPAL_DECOMMISSIONED",
    };
    setLastError(err);
    setEnrollingSubscriptionId(null);
    return false;
  };

  // Suppress unused-variable warnings for identifiers retained for the hook's
  // read-side (subscriptions query above already uses them).
  void queryClient;
  void portalSupabase;
  void profile;
  void user;
  void eligibility;


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
