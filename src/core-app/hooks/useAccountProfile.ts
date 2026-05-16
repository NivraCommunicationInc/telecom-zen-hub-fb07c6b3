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
      console.log("[useAccountProfile] Fetching account:", accountId);
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .maybeSingle();
      if (error) {
        console.error("[useAccountProfile] Account query error:", error);
        throw error;
      }
      console.log("[useAccountProfile] Account result:", data ? "found" : "null");
      return data;
    },
    enabled: !!accountId,
    retry: 2,
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
    queryKey: ["account-profile-orders", accountId, clientId],
    queryFn: async () => {
      if (!accountId && !clientId) return [];

      const [byAccount, byClient] = await Promise.all([
        accountId
          ? supabase
              .from("orders")
              .select("*")
              .eq("account_id", accountId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),
        clientId
          ? supabase
              .from("orders")
              .select("*")
              .eq("user_id", clientId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (byAccount.error) throw byAccount.error;
      if (byClient.error) throw byClient.error;

      const merged = [...(byAccount.data || []), ...(byClient.data || [])];
      const unique = new Map(merged.map((o: any) => [o.id, o]));

      return Array.from(unique.values()).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!accountId || !!clientId,
  });

  const billingCustomer = useQuery({
    queryKey: ["account-profile-billing-customer", clientId, profile.data?.email],
    queryFn: async () => {
      const normalizedEmail = profile.data?.email?.trim().toLowerCase();

      if (clientId) {
        const { data, error } = await supabase
          .from("billing_customers")
          .select("*")
          .eq("user_id", clientId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      if (normalizedEmail) {
        const { data, error } = await supabase
          .from("billing_customers")
          .select("*")
          .eq("email", normalizedEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data;
      }

      return null;
    },
    enabled: !!clientId || !!profile.data?.email,
  });

  const customerId = billingCustomer.data?.id;

  const invoices = useQuery({
    queryKey: ["account-profile-invoices", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("*, customer:billing_customers(id, email, first_name, last_name, user_id)")
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
        .or(`user_id.eq.${clientId},owner_user_id.eq.${clientId}`)
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

  const equipmentOrderIds = Array.from(new Set([
    ...(orders.data?.map((o: any) => o.id) || []),
    ...(subscriptions.data?.map((s: any) => s.order_id).filter(Boolean) || []),
    ...(invoices.data?.map((inv: any) => inv.order_id).filter(Boolean) || []),
  ]));

  const equipment = useQuery({
    queryKey: ["account-profile-equipment", accountId, equipmentOrderIds.join("|")],
    queryFn: async () => {
      if (equipmentOrderIds.length === 0) return [];
      const { data, error } = await supabase
        .from("equipment_order_lines")
        .select("*")
        .in("order_id", equipmentOrderIds.slice(0, 100));
      if (error) throw error;
      return data || [];
    },
    enabled: equipmentOrderIds.length > 0,
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

  const documents = useQuery({
    queryKey: ["account-profile-documents", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
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
    documents.refetch();
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
    documents: documents.data || [],
    customerId,
    clientId,
    isLoading,
    accountError,
    refetch,
  };
}
