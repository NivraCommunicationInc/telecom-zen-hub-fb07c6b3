/**
 * useAdminSubscriptionDetail — Full subscription detail with services, invoices, audit.
 * Zero local financial math.
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
  const accountIdentity = useQuery({
    queryKey: ["admin-subscription-account", subscriptionId, userId, customerId],
    queryFn: async () => {
      const maps = await buildCanonicalAccountMaps(supabase, {
        customerIds: customerId ? [customerId] : [],
        userIds: userId ? [userId] : [],
      });
      const accountNumber = resolveCanonicalAccountNumber(maps, { customerId, userId });
      assertCanonicalAccountInvariant("subscription", subscriptionId || "unknown", { customerId, userId }, accountNumber);
      return accountNumber;
    },
    enabled: !!subscriptionId,
  });

  return {
    subscription: subscription.data,
    customer: customer.data,
    address: address.data,
    invoices: invoices.data || [],
    audit: audit.data || [],
    accountNumber: accountIdentity.data ?? null,
    isLoading: subscription.isLoading || accountIdentity.isLoading,
  };
}
