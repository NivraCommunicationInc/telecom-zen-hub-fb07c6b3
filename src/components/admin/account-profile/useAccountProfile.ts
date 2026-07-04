/**
 * useAccountProfile — Central data hook for the Account Profile CRM page
 * Fetches all account-related data in parallel
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

export function useAccountProfile(accountId: string | undefined) {
  // Core account data
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

  // Client profile
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

  // Service locations
  const locations = useQuery({
    queryKey: ["account-profile-locations", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      // R1 canonical read: service_addresses (aliased to legacy shape used by AccountAddressesTab)
      const { data, error } = await supabase
        .from("service_addresses")
        .select("id, account_id, label, is_active, created_at, service_address:address_line, service_city:city, service_province:province, service_postal_code:postal_code, created_via")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  // Orders
  const orders = useQuery({
    queryKey: ["account-profile-orders", accountId, clientId],
    queryFn: async () => {
      if (!accountId && !clientId) return [];

      const [byAccount, byUser] = await Promise.all([
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
      if (byUser.error) throw byUser.error;

      const merged = [...(byAccount.data || []), ...(byUser.data || [])];
      const unique = new Map(merged.map((o: any) => [o.id, o]));

      return Array.from(unique.values()).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!accountId || !!clientId,
  });

  // Billing invoices (from billing_invoices via billing_customers).
  // Resolves customer first by user_id, then by profile email as fallback,
  // so admin always sees the client's invoices/payments even if the link is partial.
  const billingCustomer = useQuery({
    queryKey: ["account-profile-billing-customer", clientId, profile.data?.email],
    queryFn: async () => {
      if (!clientId) return null;
      const { data: byUser, error: byUserErr } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("user_id", clientId)
        .maybeSingle();
      if (byUserErr) throw byUserErr;
      if (byUser) return byUser;

      const email = (profile.data as any)?.email;
      if (!email) return null;
      const { data: byEmail, error: byEmailErr } = await supabase
        .from("billing_customers")
        .select("*")
        .ilike("email", String(email).trim())
        .maybeSingle();
      if (byEmailErr) throw byEmailErr;
      return byEmail || null;
    },
    enabled: !!clientId,
  });

  const customerId = billingCustomer.data?.id;

  const invoices = useQuery({
    queryKey: ["account-profile-invoices", customerId],
    queryFn: async () => {
      const orderIds = (orders.data || []).map((order: any) => order.id).filter(Boolean);

      const [byCustomer, byOrders] = await Promise.all([
        customerId
          ? supabase
              .from("billing_invoices")
              .select("*")
              .eq("customer_id", customerId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length > 0
          ? supabase
              .from("billing_invoices")
              .select("*")
              .in("order_id", orderIds)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (byCustomer.error) throw byCustomer.error;
      if (byOrders.error) throw byOrders.error;

      const merged = [...(byCustomer.data || []), ...(byOrders.data || [])];
      const unique = new Map(merged.map((invoice: any) => [invoice.id, invoice]));
      return Array.from(unique.values()).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!customerId || !!accountId,
  });

  const payments = useQuery({
    queryKey: ["account-profile-payments", customerId],
    queryFn: async () => {
      const invoiceIds = (invoices.data || []).map((invoice: any) => invoice.id).filter(Boolean);

      const [byCustomer, byInvoices] = await Promise.all([
        customerId
          ? supabase
              .from("billing_payments")
              .select("*")
              .eq("customer_id", customerId)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null } as any),
        invoiceIds.length > 0
          ? supabase
              .from("billing_payments")
              .select("*")
              .in("invoice_id", invoiceIds)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (byCustomer.error) throw byCustomer.error;
      if (byInvoices.error) throw byInvoices.error;

      const merged = [...(byCustomer.data || []), ...(byInvoices.data || [])];
      const unique = new Map(merged.map((payment: any) => [payment.id, payment]));
      return Array.from(unique.values()).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!customerId || !!accountId,
  });

  // Subscriptions (services)
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

  // Support tickets
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

  // Appointments
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

  // Authorized users
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

  // Legacy billing — DEPRECATED: kept as empty stub for backward compat
  // All canonical reads now come from billing_invoices/billing_payments above
  const legacyBilling = useQuery({
    queryKey: ["account-profile-legacy-billing", clientId],
    queryFn: async () => [] as any[],
    enabled: false,
  });

  // Service addresses (from billing system)
  const serviceAddresses = useQuery({
    queryKey: ["account-profile-service-addresses", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      // Get addresses linked to subscriptions
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
