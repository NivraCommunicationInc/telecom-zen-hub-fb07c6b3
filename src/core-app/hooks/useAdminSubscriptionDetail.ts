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

  const orderId = subscription.data?.order_id;
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

  const account = useQuery({
    queryKey: ["admin-subscription-account-detail", orderId, userId],
    queryFn: async () => {
      // Try via order first (most reliable)
      if (orderId) {
        const { data: order } = await supabase
          .from("orders")
          .select("account_id")
          .eq("id", orderId)
          .maybeSingle();
        if (order?.account_id) {
          const { data: acct } = await supabase
            .from("accounts")
            .select("billing_cycle_day, next_invoice_date, primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code, status")
            .eq("id", order.account_id)
            .maybeSingle();
          if (acct) return acct;
        }
      }
      // Fallback: via client_id
      if (userId) {
        const { data: acct } = await supabase
          .from("accounts")
          .select("billing_cycle_day, next_invoice_date, primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code, status")
          .eq("client_id", userId)
          .eq("status", "active")
          .maybeSingle();
        return acct ?? null;
      }
      return null;
    },
    enabled: !!(orderId || userId),
  });

  return {
    subscription: subscription.data,
    customer: customer.data,
    address: address.data,
    account: account.data ?? null,
    invoices: invoices.data || [],
    audit: audit.data || [],
    accountNumber: accountIdentity.data ?? null,
    isLoading: subscription.isLoading || accountIdentity.isLoading,
  };
}
