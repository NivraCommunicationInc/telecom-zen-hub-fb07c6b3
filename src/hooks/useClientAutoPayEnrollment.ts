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

export const useClientAutoPayEnrollment = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const [enrollingSubscriptionId, setEnrollingSubscriptionId] = useState<string | null>(null);

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
        .select("id, plan_name, plan_price, status, auto_billing_enabled, paypal_subscription_id, paypal_plan_id, created_at")
        .eq("customer_id", customer.id)
        .in("status", ["active", "pending", "suspended"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as ClientBillingSubscription[]) || [];
    },
    enabled: !!user?.id,
  });

  const activePayPalSubscription =
    subscriptions?.find((subscription) => subscription.status === "active" && !!subscription.paypal_subscription_id) ?? null;

  const enrollInPayPal = async (subscription: ClientBillingSubscription) => {
    try {
      setEnrollingSubscriptionId(subscription.id);

      const response = await portalSupabase.functions.invoke("paypal-create-subscription", {
        body: {
          plan_name: subscription.plan_name,
          plan_price: subscription.plan_price,
          customer_email: profile?.email || user?.email || "",
          customer_name: profile?.full_name || "Client",
          billing_subscription_id: subscription.id,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      if (!data?.success || !data?.approval_url) {
        throw new Error(data?.error || "Erreur lors de la création de l'abonnement PayPal");
      }

      await portalSupabase
        .from("billing_subscriptions")
        .update({
          paypal_subscription_id: data.paypal_subscription_id,
          paypal_plan_id: data.paypal_plan_id,
        })
        .eq("id", subscription.id);

      await queryClient.invalidateQueries({ queryKey: ["client-billing-subscriptions"] });
      window.location.assign(data.approval_url);
    } catch (error: any) {
      console.error("[AutoPay] Error:", error);
      toast.error(error.message || "Erreur lors de l'inscription au paiement automatique");
      throw error;
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
  };
};