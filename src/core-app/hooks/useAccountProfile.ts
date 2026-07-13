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
      // R1 canonical read: service_addresses (aliased to legacy shape)
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

  const incidents = useQuery({
    queryKey: ["account-profile-incidents", clientId, accountId],
    queryFn: async () => {
      if (!clientId && !accountId) return [];
      const filters = [
        clientId ? `client_user_id.eq.${clientId}` : null,
        accountId ? `client_account_id.eq.${accountId}` : null,
      ].filter(Boolean).join(",");
      const { data, error } = await supabase
        .from("service_incidents")
        .select("*")
        .or(filters)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId || !!accountId,
  });

  const appointments = useQuery({
    queryKey: ["account-profile-appointments", accountId, clientId, profile.data?.email, (orders.data || []).map((o: any) => o.id).join("|")],
    queryFn: async () => {
      const orderIds = (orders.data || []).map((order: any) => order.id).filter(Boolean);
      const filters = [
        clientId ? `client_id.eq.${clientId}` : null,
        ...orderIds.slice(0, 80).map((id: string) => `order_id.eq.${id}`),
        profile.data?.email ? `client_email.ilike.${String(profile.data.email).trim()}` : null,
      ].filter(Boolean);
      if (filters.length === 0) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .or(filters.join(","))
        .order("scheduled_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const unique = new Map((data || []).map((appointment: any) => [appointment.id, appointment]));
      return Array.from(unique.values());
    },
    enabled: !!clientId || !!accountId || !!profile.data?.email,
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
      // Read from both canonical KYC tables and identity_verification_sessions
      const [verifs, sessions, requests] = await Promise.all([
        supabase
          .from("kyc_verifications")
          .select("id, status, reason, requested_id_type, reviewed_at, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("identity_verification_sessions")
          .select("id, status, document_type, id_type, id_province, document_front_path, document_back_path, selfie_path, review_reason, reviewed_by, result_payload, reviewed_at, created_at, submitted_at, order_id, case_number")
          .eq("user_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("kyc_requests")
          .select("id, status, document_path, approved_at, completed_at, created_at, order_id")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const merged: any[] = [];
      (verifs.data || []).forEach((r: any) => merged.push({
        id: `verif-${r.id}`,
        case_number: r.id.slice(0, 8),
        status: r.status,
        document_type: r.requested_id_type || "—",
        submitted_at: r.created_at,
        reviewed_at: r.reviewed_at,
        review_reason: r.reason,
      }));
      (sessions.data || []).forEach((r: any) => merged.push({
        id: `sess-${r.id}`,
        case_number: r.case_number || r.id.slice(0, 8),
        status: r.status,
        document_type: r.document_type,
        id_type: r.id_type,
        id_province: r.id_province,
        document_front_path: r.document_front_path,
        document_back_path: r.document_back_path,
        selfie_path: r.selfie_path,
        review_reason: r.review_reason,
        reviewed_by: r.reviewed_by,
        result_payload: r.result_payload,
        submitted_at: r.submitted_at || r.created_at,
        reviewed_at: r.reviewed_at,
      }));
      (requests.data || []).forEach((r: any) => merged.push({
        id: `req-${r.id}`,
        case_number: r.id.slice(0, 8),
        status: r.status,
        document_type: r.document_path ? "Document" : "—",
        submitted_at: r.completed_at || r.created_at,
        reviewed_at: r.approved_at,
      }));
      return merged.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    },
    enabled: !!clientId,
  });

  const contracts = useQuery({
    queryKey: ["account-profile-contracts", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .or(`user_id.eq.${clientId},owner_user_id.eq.${clientId}`)
        .order("created_at", { ascending: false });
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
    queryKey: ["account-profile-equipment", accountId, clientId, equipmentOrderIds.join("|")],
    queryFn: async () => {
      // 0) Real inventory rows assigned to this account/orders — authoritative for status mgmt
      const invFilters: string[] = [];
      if (accountId) invFilters.push(`account_id.eq.${accountId}`);
      if (equipmentOrderIds.length > 0) invFilters.push(`order_id.in.(${equipmentOrderIds.slice(0, 100).join(",")})`);
      const inv = invFilters.length > 0
        ? await supabase.from("equipment_inventory").select("*").or(invFilters.join(","))
        : { data: [], error: null } as any;
      if (inv.error) throw inv.error;
      const inventoryRows = inv.data || [];

      // 1) Snapshot from equipment_order_lines for orders that don't have inventory yet
      const ordersWithInv = new Set(inventoryRows.map((r: any) => r.order_id).filter(Boolean));
      const snapshotOrderIds = equipmentOrderIds.filter((id) => !ordersWithInv.has(id));
      const lines = snapshotOrderIds.length > 0
        ? await supabase
            .from("equipment_order_lines")
            .select("*")
            .in("order_id", snapshotOrderIds.slice(0, 100))
        : { data: [], error: null } as any;
      if (lines.error) throw lines.error;

      const result: any[] = [...inventoryRows, ...(lines.data || [])];

      // 2) Fallback: legacy orders.equipment_details JSON when no lines or inventory exist for that order
      const orderHasData = new Set([
        ...inventoryRows.map((r: any) => r.order_id).filter(Boolean),
        ...(lines.data || []).map((l: any) => l.order_id),
      ]);
      for (const o of orders.data || []) {
        if (orderHasData.has(o.id)) continue;
        const det = Array.isArray(o.equipment_details) ? o.equipment_details : [];
        det.forEach((eq: any, idx: number) => {
          result.push({
            id: `${o.id}-jsoneq-${idx}`,
            order_id: o.id,
            item_name: eq.label || eq.type || eq.name || "Équipement",
            item_sku: eq.type || eq.sku || o.equipment_id || "—",
            quantity: eq.quantity || 1,
            unit_price: eq.unit_price ?? null,
            line_total: eq.line_total ?? null,
            serial_numbers: eq.serial_number ? [eq.serial_number] : (eq.serial_numbers || null),
          });
        });
      }
      return result;
    },
    enabled: !!orders.data,
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
    queryKey: ["account-profile-documents", clientId, accountId],
    queryFn: async () => {
      if (!clientId) return [];
      const uploaded = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
      if (uploaded.error) throw uploaded.error;

      const autoFilters = [`client_id.eq.${clientId}`];
      if (accountId) autoFilters.push(`account_id.eq.${accountId}`);
      const auto = await supabase
        .from("client_auto_documents")
        .select("id, doc_type, doc_number, storage_path, created_at, event_type, email_sent")
        .or(autoFilters.join(","))
        .order("created_at", { ascending: false });
      if (auto.error) throw auto.error;

      const autoDocs = (auto.data || []).map((doc: any) => ({
        id: `auto-${doc.id}`,
        document_name: doc.doc_type === "order_shipping_slip"
          ? `Bordereau de livraison${doc.doc_number ? ` ${doc.doc_number}` : ""}`
          : `${doc.doc_type || "Document"}${doc.doc_number ? ` ${doc.doc_number}` : ""}`,
        document_type: doc.doc_type,
        document_url: doc.storage_path ? `client-documents/${doc.storage_path}` : null,
        storage_path: doc.storage_path,
        created_at: doc.created_at,
        source: "auto",
      }));

      return [...autoDocs, ...(uploaded.data || [])]
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    },
    enabled: !!clientId,
  });

  const creditScore = useQuery({
    queryKey: ["account-credit-score", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase
        .from("account_credit_scores")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!clientId,
  });

  const serviceAddresses = useQuery({
    queryKey: ["account-profile-service-addresses", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("service_addresses")
        .select("*")
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
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
    incidents.refetch();
    appointments.refetch();
    kycSessions.refetch();
    equipment.refetch();
    activityLogs.refetch();
    authorizedUsers.refetch();
    serviceAddresses.refetch();
    documents.refetch();
    contracts.refetch();
    creditScore.refetch();
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
    incidents: incidents.data || [],
    appointments: appointments.data || [],
    authorizedUsers: authorizedUsers.data || [],
    kycSessions: kycSessions.data || [],
    equipment: equipment.data || [],
    activityLogs: activityLogs.data || [],
    serviceAddresses: serviceAddresses.data || [],
    documents: documents.data || [],
    contracts: contracts.data || [],
    creditScore: creditScore.data ?? null,
    customerId,
    clientId,
    isLoading,
    accountError,
    refetch,
  };
}
