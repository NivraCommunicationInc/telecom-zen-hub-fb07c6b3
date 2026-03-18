/**
 * useWorkQueue — Fetches operational queue data for the Work Queue page.
 * All data from authoritative DB tables, zero mock data.
 * account_number resolved via canonical accounts table (NOT profiles).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildCanonicalAccountMaps, resolveCanonicalAccountNumber } from "@/lib/canonicalAccountResolver";

export interface WorkQueueItem {
  id: string;
  order_number: string | null;
  client_name: string | null;
  client_email: string | null;
  account_number: string | null;
  account_id: string | null;
  status: string;
  payment_status: string | null;
  service_type: string | null;
  total_amount: number | null;
  created_at: string;
  invoice_number: string | null;
  invoice_id: string | null;
  failure_reason: string | null;
}

export interface AppointmentQueueItem {
  id: string;
  appointment_number: string | null;
  title: string;
  scheduled_at: string;
  status: string | null;
  service_type: string | null;
  client_name: string | null;
  client_email: string | null;
  service_address: string | null;
  service_city: string | null;
  order_id: string | null;
  technician_id: string | null;
}

async function fetchQueueOrders(statuses: string[], limit: number): Promise<WorkQueueItem[]> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, user_id, account_id, status, payment_status, service_type, total_amount, created_at, failure_reason")
    .in("status", statuses)
    .eq("environment", "live")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  if (!orders?.length) return [];

  const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
  const orderIds = orders.map(o => o.id);
  const accountIds = [...new Set(orders.map(o => o.account_id).filter(Boolean))];

  const [profilesRes, invoicesRes, maps] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
      : Promise.resolve({ data: [] }),
    supabase.from("billing_invoices").select("order_id, invoice_number, id").in("order_id", orderIds),
    buildCanonicalAccountMaps(supabase, { orderIds, userIds, accountIds }),
  ]);

  const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
  const invoiceMap = new Map((invoicesRes.data || []).map(i => [i.order_id, i]));

  return orders.map(o => {
    const profile = profileMap.get(o.user_id);
    const invoice = invoiceMap.get(o.id);
    const accountNumber = resolveCanonicalAccountNumber(maps, {
      orderId: o.id,
      accountId: o.account_id,
      userId: o.user_id,
    });
    return {
      id: o.id,
      order_number: o.order_number,
      client_name: profile?.full_name ?? null,
      client_email: profile?.email ?? null,
      account_number: accountNumber,
      account_id: o.account_id,
      status: o.status,
      payment_status: o.payment_status,
      service_type: o.service_type,
      total_amount: o.total_amount,
      created_at: o.created_at,
      invoice_number: invoice?.invoice_number ?? null,
      invoice_id: invoice?.id ?? null,
      failure_reason: (o as any).failure_reason ?? null,
    };
  });
}

export function useWorkQueue() {
  const newOrders = useQuery({
    queryKey: ["work-queue-new"],
    queryFn: () => fetchQueueOrders(["pending"], 20),
  });

  const paidOrders = useQuery({
    queryKey: ["work-queue-paid"],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_number, user_id, account_id, status, payment_status, service_type, total_amount, created_at")
        .eq("payment_status", "paid")
        .eq("environment", "live")
        .not("status", "in", '("completed","cancelled")')
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      if (!orders?.length) return [];

      const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
      const accountIds = [...new Set(orders.map(o => o.account_id).filter(Boolean))];

      const [profilesRes, maps] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        buildCanonicalAccountMaps(supabase, { userIds, accountIds }),
      ]);
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));

      return orders.map(o => {
        const profile = profileMap.get(o.user_id);
        const accountNumber = resolveCanonicalAccountNumber(maps, {
          accountId: o.account_id,
          userId: o.user_id,
        });
        return {
          id: o.id,
          order_number: o.order_number,
          client_name: profile?.full_name ?? null,
          client_email: profile?.email ?? null,
          account_number: accountNumber,
          account_id: o.account_id,
          status: o.status,
          payment_status: o.payment_status,
          service_type: o.service_type,
          total_amount: o.total_amount,
          created_at: o.created_at,
          invoice_number: null,
          invoice_id: null,
          failure_reason: null,
        };
      });
    },
  });

  const appointments = useQuery<AppointmentQueueItem[]>({
    queryKey: ["work-queue-appointments"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_number, title, scheduled_at, status, service_type, client_email, service_address, service_city, order_id, technician_id")
        .gte("scheduled_at", today.toISOString())
        .eq("environment", "live")
        .in("status", ["confirmed", "scheduled", "pending"])
        .order("scheduled_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      if (!data?.length) return [];

      return data.map(a => ({
        id: a.id,
        appointment_number: a.appointment_number,
        title: a.title,
        scheduled_at: a.scheduled_at,
        status: a.status,
        service_type: a.service_type,
        client_name: null,
        client_email: a.client_email,
        service_address: a.service_address,
        service_city: a.service_city,
        order_id: a.order_id,
        technician_id: a.technician_id,
      }));
    },
  });

  const activations = useQuery({
    queryKey: ["work-queue-activations"],
    queryFn: () => fetchQueueOrders(["delivered", "installed"], 20),
  });

  const onHold = useQuery({
    queryKey: ["work-queue-hold"],
    queryFn: () => fetchQueueOrders(["on_hold", "hold", "incomplete", "invalid_payment", "fraud", "provisioning_failed"], 20),
  });

  return {
    newOrders: newOrders.data || [],
    paidOrders: paidOrders.data || [],
    appointments: appointments.data || [],
    activations: activations.data || [],
    onHold: onHold.data || [],
    isLoading: newOrders.isLoading || paidOrders.isLoading || appointments.isLoading || activations.isLoading || onHold.isLoading,
  };
}
