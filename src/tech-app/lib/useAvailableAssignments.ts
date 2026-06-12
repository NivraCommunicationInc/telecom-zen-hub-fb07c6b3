/**
 * useAvailableAssignments — Orders marked ready_for_scheduling with no active technician.
 * Powers the Dispatch tab in TechAssignments.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DispatchJob {
  id: string;
  order_number: string | null;
  service_type: string | null;
  category: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  client_full_address: string | null;
  equipment_details: any;
  dispatch_priority: "normal" | "vip" | "enterprise" | "urgent";
  dispatch_notes: string | null;
  estimated_duration_minutes: number;
  created_at: string;
  // reservation state (injected client-side after fetch)
  reservation_expires_at?: string | null;
  reserved_by_me?: boolean;
}

const PRIORITY_ORDER = { urgent: 0, vip: 1, enterprise: 2, normal: 3 };

export function useAvailableAssignments() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["dispatch-available"],
    staleTime: 20_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<DispatchJob[]> => {
      const { data: { user } } = await supabase.auth.getUser();

      // Orders ready for scheduling
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          id, order_number, service_type, category,
          client_first_name, client_last_name, client_phone, client_full_address,
          equipment_details, dispatch_priority, dispatch_notes,
          estimated_duration_minutes, created_at
        `)
        .eq("scheduling_status", "ready_for_scheduling")
        .order("dispatch_priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!orders?.length) return [];

      const orderIds = orders.map((o: any) => o.id);

      // Active assignments (already claimed)
      const { data: assignments } = await supabase
        .from("technician_assignments")
        .select("order_id")
        .in("order_id", orderIds)
        .not("status", "in", '("cancelled","missed","completed")')
        .not("technician_id", "is", null);

      const claimedOrderIds = new Set((assignments ?? []).map((a: any) => a.order_id));

      // Active reservations
      const { data: reservations } = await supabase
        .from("dispatch_reservations")
        .select("order_id, technician_id, expires_at")
        .in("order_id", orderIds)
        .gt("expires_at", new Date().toISOString());

      const reservationMap = new Map((reservations ?? []).map((r: any) => [r.order_id, r]));

      return orders
        .filter((o: any) => !claimedOrderIds.has(o.id))
        .map((o: any) => {
          const res = reservationMap.get(o.id);
          return {
            ...o,
            dispatch_priority: o.dispatch_priority ?? "normal",
            estimated_duration_minutes: o.estimated_duration_minutes ?? 90,
            reservation_expires_at: res?.expires_at ?? null,
            reserved_by_me: res ? res.technician_id === user?.id : false,
          } as DispatchJob;
        })
        .sort((a, b) => (PRIORITY_ORDER[a.dispatch_priority] ?? 3) - (PRIORITY_ORDER[b.dispatch_priority] ?? 3));
    },
  });

  // Realtime: refresh when orders or reservations change
  useEffect(() => {
    const ch = supabase
      .channel("dispatch-realtime")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dispatch_reservations" }, () => {
        qc.invalidateQueries({ queryKey: ["dispatch-available"] });
      })
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "orders", filter: "scheduling_status=eq.ready_for_scheduling" }, () => {
        qc.invalidateQueries({ queryKey: ["dispatch-available"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return query;
}
