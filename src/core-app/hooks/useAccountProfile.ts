/**
 * useAccountProfile — Core-local fork
 * Exact copy of @/components/admin/account-profile/useAccountProfile
 * Fetches all account-related data in parallel
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

export function useAccountProfile(accountId: string | undefined) {
  const account = useQuery({
    queryKey: ["account-profile", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const clientId = account.data?.client_id;

  const profile = useQuery({
    queryKey: ["account-profile-client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const locations = useQuery({
    queryKey: ["account-profile-locations", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("account_service_locations")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const orders = useQuery({
    queryKey: ["account-profile-orders", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const billingCustomer = useQuery({
    queryKey: ["account-profile-billing-customer", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("user_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const customerId = billingCustomer.data?.id;

  const invoices = useQuery({
    queryKey: ["account-profile-invoices", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  const payments = useQuery({
    queryKey: ["account-profile-payments", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("billing_payments")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  const subscriptions = useQuery({
    queryKey: ["account-profile-subscriptions", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("*, billing_subscription_services(*)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  const tickets = useQuery({
    queryKey: ["account-profile-tickets", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const appointments = useQuery({
    queryKey: ["account-profile-appointments", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const authorizedUsers = useQuery({
    queryKey: ["account-profile-authorized-users", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("authorized_users")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const legacyBilling = useQuery({
    queryKey: ["account-profile-legacy-billing", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const serviceAddresses = useQuery({
    queryKey: ["account-profile-service-addresses", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data: subs } = await supabase
        .from("billing_subscriptions")
        .select("address_id")
        .eq("customer_id", customerId)
        .not("address_id", "is", null);
      
      const addressIds = [...new Set(subs?.map(s => s.address_id).filter(Boolean))] as string[];
      if (addressIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("service_addresses")
        .select("*")
        .in("id", addressIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  const isLoading = account.isLoading || profile.isLoading;

  return {
    account: account.data,
    profile: profile.data,
    locations: locations.data || [],
    orders: orders.data || [],
    billingCustomer: billingCustomer.data,
    invoices: invoices.data || [],
    payments: payments.data || [],
    subscriptions: subscriptions.data || [],
    tickets: tickets.data || [],
    appointments: appointments.data || [],
    authorizedUsers: authorizedUsers.data || [],
    legacyBilling: legacyBilling.data || [],
    serviceAddresses: serviceAddresses.data || [],
    customerId,
    clientId,
    isLoading,
    refetch: () => {
      account.refetch();
      profile.refetch();
      locations.refetch();
      orders.refetch();
      invoices.refetch();
      payments.refetch();
      subscriptions.refetch();
      tickets.refetch();
    },
  };
}
