/**
 * Hook to fetch all data needed for the Order Workbench.
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

export function useWorkbenchData(orderId: string | undefined) {
  const order = useQuery({
    queryKey: ["workbench-order", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const profile = useQuery({
    queryKey: ["workbench-profile", order.data?.user_id],
    enabled: !!order.data?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", order.data!.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const orderItems = useQuery({
    queryKey: ["workbench-items", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const provisioningJobs = useQuery({
    queryKey: ["workbench-provisioning", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provisioning_jobs")
        .select("*")
        .eq("order_id", orderId!)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const shipments = useQuery({
    queryKey: ["workbench-shipments", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const inventoryAssignments = useQuery({
    queryKey: ["workbench-inventory", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_assignments")
        .select("*, inventory_stock(*)")
        .eq("order_id", orderId!);
      if (error) throw error;
      return data || [];
    },
  });

  const appointments = useQuery({
    queryKey: ["workbench-appointments", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, technicians(*)")
        .eq("order_id", orderId!)
        .order("scheduled_at");
      if (error) throw error;
      return data || [];
    },
  });

  const billing = useQuery({
    queryKey: ["workbench-billing", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const billingInvoices = useQuery({
    queryKey: ["workbench-invoices", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("*, billing_payments(*)")
        .eq("order_id", orderId!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const activityLogs = useQuery({
    queryKey: ["workbench-audit", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .or(`entity_id.eq.${orderId}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const nextActions = useQuery({
    queryKey: ["workbench-next-actions", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_next_actions")
        .select("*")
        .eq("order_id", orderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const kycSession = useQuery({
    queryKey: ["workbench-kyc", orderId, order.data?.user_id, order.data?.identity_verification_session_id],
    enabled: !!order.data?.user_id || !!order.data?.identity_verification_session_id,
    queryFn: async () => {
      // Prefer the session explicitly linked to this order
      const linkedSessionId = order.data?.identity_verification_session_id;
      if (linkedSessionId) {
        const { data, error } = await supabase
          .from("identity_verification_sessions")
          .select("*")
          .eq("id", linkedSessionId)
          .maybeSingle();
        if (!error && data) return data;
      }
      // Fallback: latest session for user
      if (order.data?.user_id) {
        const { data, error } = await supabase
          .from("identity_verification_sessions")
          .select("*")
          .eq("user_id", order.data!.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      return null;
    },
  });

  const isLoading = order.isLoading || profile.isLoading;

  return {
    order: order.data,
    profile: profile.data,
    orderItems: orderItems.data || [],
    provisioningJobs: provisioningJobs.data || [],
    shipments: shipments.data || [],
    inventoryAssignments: inventoryAssignments.data || [],
    appointments: appointments.data || [],
    billing: billing.data || [],
    billingInvoices: billingInvoices.data || [],
    activityLogs: activityLogs.data || [],
    nextActions: nextActions.data,
    kycSession: kycSession.data,
    isLoading,
    refetchAll: () => {
      order.refetch();
      orderItems.refetch();
      provisioningJobs.refetch();
      shipments.refetch();
      inventoryAssignments.refetch();
      appointments.refetch();
      billing.refetch();
      billingInvoices.refetch();
      activityLogs.refetch();
      nextActions.refetch();
      kycSession.refetch();
    },
  };
}
