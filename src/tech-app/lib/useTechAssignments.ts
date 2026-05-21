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
  client_address?: string | null;
  service_type?: string | null;
  category?: string | null;
}

export function useTechAssignments() {
  return useQuery({
    queryKey: ["tech-assignments-self"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<TechAssignment[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("technician_assignments")
        .select("*")
        .eq("technician_id", user.id)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time_start", { ascending: true });

      if (error) throw error;
      const rows = (data ?? []) as any[];
      const orderIds = Array.from(new Set(rows.map((r) => r.order_id).filter(Boolean))) as string[];
      if (orderIds.length === 0) return rows as TechAssignment[];

      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, service_type, category, client_first_name, client_last_name, client_phone, client_full_address, shipping_address, shipping_city, user_id")
        .in("id", orderIds);

      const map = new Map((orders ?? []).map((o: any) => [o.id, o]));
      return rows.map((r) => {
        const o = map.get(r.order_id);
        return {
          ...r,
          order_number: o?.order_number ?? null,
          client_name: o
            ? [o.client_first_name, o.client_last_name].filter(Boolean).join(" ") || "Client"
            : null,
          client_phone: o?.client_phone ?? null,
          client_address: o?.client_full_address || [o?.shipping_address, o?.shipping_city].filter(Boolean).join(", "),
          service_type: o?.service_type ?? null,
          category: o?.category ?? null,
        } as TechAssignment;
      });
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

      const { data: o } = await supabase
        .from("orders")
        .select("id, order_number, service_type, category, client_first_name, client_last_name, client_phone, client_full_address, shipping_address, shipping_city, total_amount")
        .eq("id", r.order_id)
        .maybeSingle();

      return {
        ...r,
        order_number: o?.order_number ?? null,
        client_name: o
          ? [o.client_first_name, o.client_last_name].filter(Boolean).join(" ") || "Client"
          : null,
        client_phone: o?.client_phone ?? null,
        client_address: o?.client_full_address || [o?.shipping_address, o?.shipping_city].filter(Boolean).join(", "),
        service_type: o?.service_type ?? null,
        category: o?.category ?? null,
      } as TechAssignment;
    },
  });
}

export function useInstallationSteps(serviceType: string | undefined | null) {
  return useQuery({
    queryKey: ["installation-steps", serviceType],
    enabled: !!serviceType,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const st = (serviceType || "internet").toLowerCase();
      const normalized = ["internet", "tv", "bundle", "mobile", "equipment_only"].includes(st)
        ? st
        : "internet";
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
