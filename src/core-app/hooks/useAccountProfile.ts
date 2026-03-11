/**
 * useAccountProfile — Core-local hook
 * Fetches all account-related data in parallel for the Customer 360 view.
 * Uses the canonical supabase client for RLS session alignment.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAccountProfile(accountId: string | undefined) {
  const queryClient = useQueryClient();

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

  const kycSessions = useQuery({
    queryKey: ["account-profile-kyc", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("id, status, document_type, reviewed_at, created_at, submitted_at, order_id, case_number")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Equipment via order lines from account orders
  const orderIds = orders.data?.map(o => o.id) || [];
  const equipment = useQuery({
    queryKey: ["account-profile-equipment", accountId, orderIds.length],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      const { data, error } = await supabase
        .from("equipment_order_lines")
        .select("*")
        .in("order_id", orderIds.slice(0, 50));
      if (error) throw error;
      return data || [];
    },
    enabled: orderIds.length > 0,
  });

  const activityLogs = useQuery({
    queryKey: ["account-profile-activity", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_activity_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
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

  const isLoading = account.isLoading || (!!account.data?.client_id && profile.isLoading);
  const accountError = account.error;

  const refetch = () => {
    account.refetch();
    profile.refetch();
    locations.refetch();
    orders.refetch();
    billingCustomer.refetch();
    invoices.refetch();
    payments.refetch();
    subscriptions.refetch();
    tickets.refetch();
    appointments.refetch();
    kycSessions.refetch();
    equipment.refetch();
    activityLogs.refetch();
    authorizedUsers.refetch();
    serviceAddresses.refetch();
  };

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
    kycSessions: kycSessions.data || [],
    equipment: equipment.data || [],
    activityLogs: activityLogs.data || [],
    serviceAddresses: serviceAddresses.data || [],
    customerId,
    clientId,
    isLoading,
    accountError,
    refetch,
  };
}
