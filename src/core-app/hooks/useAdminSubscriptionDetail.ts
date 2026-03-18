/**
 * useAdminSubscriptionDetail — Core-local copy for deployment decoupling.
 * Identical logic to @/hooks/admin/useAdminSubscriptionDetail.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  assertCanonicalAccountInvariant,
  buildCanonicalAccountMaps,
  resolveCanonicalAccountNumber,
} from "@/lib/canonicalAccountResolver";

export function useAdminSubscriptionDetail(subscriptionId: string | undefined) {
  const subscription = useQuery({
    queryKey: ["admin-subscription-detail", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return null;
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("*, billing_subscription_services(*)")
        .eq("id", subscriptionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!subscriptionId,
  });

  const customerId = subscription.data?.customer_id;
  const addressId = subscription.data?.address_id;

  const customer = useQuery({
    queryKey: ["admin-subscription-customer", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const address = useQuery({
    queryKey: ["admin-subscription-address", addressId],
    queryFn: async () => {
      if (!addressId) return null;
      const { data, error } = await supabase
        .from("service_addresses")
        .select("*")
        .eq("id", addressId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!addressId,
  });

  const invoices = useQuery({
    queryKey: ["admin-subscription-invoices", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, status, total, balance_due, created_at, due_date, type")
        .eq("subscription_id", subscriptionId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!subscriptionId,
  });

  const audit = useQuery({
    queryKey: ["admin-subscription-audit", subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return [];
      const { data, error } = await supabase
        .from("billing_subscription_trace_audit")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!subscriptionId,
  });

  const userId = customer.data?.user_id;
  const profile = useQuery({
    queryKey: ["admin-subscription-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("account_number, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  return {
    subscription: subscription.data,
    customer: customer.data,
    address: address.data,
    invoices: invoices.data || [],
    audit: audit.data || [],
    accountNumber: profile.data?.account_number ?? null,
    isLoading: subscription.isLoading,
  };
}
