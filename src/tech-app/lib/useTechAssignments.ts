/**
 * useTechAssignments — Hook fetching the logged-in technician's assignments.
 * Joins order + client info via separate lookups (RLS safe).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TechAssignment {
  id: string;
  order_id: string | null;
  technician_id: string | null;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end: string;
  status: string;
  technician_notes: string | null;
  coaxial_status: string | null;
  coaxial_notes: string | null;
  installation_steps: any[];
  equipment_scanned: any[];
  network_test_results: Record<string, any>;
  download_speed: number | null;
  upload_speed: number | null;
  ping_ms: number | null;
  signal_strength: number | null;
  completed_at: string | null;
  missed_at: string | null;
  // joined fields
  order_number?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  service_type?: string | null;
  category?: string | null;
  fulfillment_type?: string | null;
  equipment_details?: any;
  selected_channels?: any[];
  order_items?: any[];
  appointment_id?: string | null;
  appointment_number?: string | null;
  appointment_status?: string | null;
  appointment_title?: string | null;
  appointment_notes?: string | null;
  appointment_address?: string | null;
}

function normalizeServiceType(serviceType: string | undefined | null): string {
  const st = (serviceType || "internet").toLowerCase();
  const hasInternet = st.includes("internet") || st.includes("giga") || st.includes("wifi");
  const hasTv = st.includes("tv") || st.includes("télé") || st.includes("tele");
  if (hasInternet && hasTv) return "bundle";
  if (hasTv) return "tv";
  if (st.includes("mobile") || st.includes("sim")) return "mobile";
  if (st.includes("equipment") || st.includes("équipement") || st.includes("equipement")) return "equipment_only";
  return "internet";
}

function buildAddress(order: any, appointment?: any) {
  const appointmentAddress = [appointment?.service_address, appointment?.service_city, appointment?.service_postal_code]
    .filter(Boolean)
    .join(", ");
  return appointmentAddress || order?.client_full_address || [order?.shipping_address, order?.shipping_city, order?.shipping_postal_code]
    .filter(Boolean)
    .join(", ") || null;
}

function mapAssignment(row: any, order: any, appointment?: any, items: any[] = []): TechAssignment {
  return {
    ...row,
    order_number: order?.order_number ?? null,
    client_name: order
      ? [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") || "Client"
      : null,
    client_phone: appointment?.client_phone || order?.client_phone || null,
    client_email: appointment?.client_email || order?.client_email || null,
    client_address: buildAddress(order, appointment),
    service_type: appointment?.service_type || order?.service_type || null,
    category: order?.category ?? null,
    fulfillment_type: order?.fulfillment_type ?? null,
    equipment_details: appointment?.equipment_details || order?.equipment_details || null,
    selected_channels: Array.isArray(order?.selected_channels) ? order.selected_channels : [],
    order_items: items,
    appointment_id: appointment?.id ?? null,
    appointment_number: appointment?.appointment_number ?? null,
    appointment_status: appointment?.status ?? null,
    appointment_title: appointment?.title ?? null,
    appointment_notes: appointment?.internal_notes ?? null,
    appointment_address: buildAddress(order, appointment),
  } as TechAssignment;
}

export function useTechAssignments() {
  return useQuery({
    queryKey: ["tech-assignments-all"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<TechAssignment[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch all assignments: assigned to me OR unassigned (available to claim)
      const { data, error } = await supabase
        .from("technician_assignments")
        .select("*")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });

      if (error) throw error;
      const rows = (data ?? []) as any[];
      const orderIds = Array.from(new Set(rows.map((r) => r.order_id).filter(Boolean))) as string[];
      if (orderIds.length === 0) return rows as TechAssignment[];

      const [{ data: orders }, { data: appointments }, { data: orderItems }] = await Promise.all([
        supabase
        .from("orders")
        .select("id, order_number, service_type, category, client_first_name, client_last_name, client_email, client_phone, client_full_address, shipping_address, shipping_city, shipping_postal_code, user_id, fulfillment_type, equipment_details, selected_channels")
        .in("id", orderIds),
        supabase
          .from("appointments")
          .select("id, order_id, appointment_number, title, status, service_type, service_address, service_city, service_postal_code, client_email, client_phone, internal_notes, equipment_details")
          .in("order_id", orderIds),
        supabase
          .from("order_items")
          .select("id, order_id, item_number, service_type, plan_code, plan_name, description, quantity, is_recurring, fulfillment_type, metadata")
          .in("order_id", orderIds)
          .order("item_number", { ascending: true }),
      ]);

      const map = new Map((orders ?? []).map((o: any) => [o.id, o]));
      const appointmentMap = new Map((appointments ?? []).map((a: any) => [a.order_id, a]));
      const itemsByOrder = new Map<string, any[]>();
      (orderItems ?? []).forEach((item: any) => {
        const list = itemsByOrder.get(item.order_id) ?? [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      });
      return rows.map((r) => mapAssignment(r, map.get(r.order_id), appointmentMap.get(r.order_id), itemsByOrder.get(r.order_id) ?? []));
    },
  });
}


export function useTechAssignment(id: string | undefined) {
  return useQuery({
    queryKey: ["tech-assignment", id],
    enabled: !!id,
    queryFn: async (): Promise<TechAssignment | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("technician_assignments")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      const r = data as any;
      if (!r?.order_id) return r as TechAssignment;

      const [{ data: o }, { data: appointment }, { data: orderItems }] = await Promise.all([
        supabase
        .from("orders")
        .select("id, order_number, service_type, category, client_first_name, client_last_name, client_email, client_phone, client_full_address, shipping_address, shipping_city, shipping_postal_code, total_amount, fulfillment_type, equipment_details, selected_channels")
        .eq("id", r.order_id)
        .maybeSingle(),
        supabase
          .from("appointments")
          .select("id, order_id, appointment_number, title, status, service_type, service_address, service_city, service_postal_code, client_email, client_phone, internal_notes, equipment_details")
          .eq("order_id", r.order_id)
          .order("scheduled_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("order_items")
          .select("id, order_id, item_number, service_type, plan_code, plan_name, description, quantity, is_recurring, fulfillment_type, metadata")
          .eq("order_id", r.order_id)
          .order("item_number", { ascending: true }),
      ]);

      return mapAssignment(r, o, appointment, orderItems ?? []);
    },
  });
}

export function useInstallationSteps(serviceType: string | undefined | null) {
  return useQuery({
    queryKey: ["installation-steps", serviceType],
    enabled: !!serviceType,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const normalized = normalizeServiceType(serviceType);
      const { data, error } = await supabase
        .from("installation_steps_template")
        .select("*")
        .eq("service_type", normalized)
        .order("step_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
