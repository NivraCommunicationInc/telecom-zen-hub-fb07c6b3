import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend";

export interface LiveLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  updated_at: string;
}

export interface TechAssignmentLive {
  id: string;
  status: string;
  eta_text: string | null;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end: string;
  client_notified_en_route: boolean;
  technician_id: string | null;
  live_location: LiveLocation | null;
  nearby_notified_at: string | null;
  order_id: string | null;
}

export function useTechnicianAssignment(orderId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tech-assignment-live", orderId],
    enabled: !!orderId,
    staleTime: 15_000,
    queryFn: async (): Promise<TechAssignmentLive | null> => {
      if (!orderId) return null;
      const { data } = await portalClient
        .from("technician_assignments")
        .select("id, order_id, status, eta_text, scheduled_date, scheduled_time_start, scheduled_time_end, client_notified_en_route, technician_id, live_location, nearby_notified_at")
        .eq("order_id", orderId)
        .not("status", "in", '("missed","cancelled","rescheduled")')
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as TechAssignmentLive | null) ?? null;
    },
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = portalClient
      .channel(`tech-live-${orderId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "technician_assignments", filter: `order_id=eq.${orderId}` },
        () => { qc.invalidateQueries({ queryKey: ["tech-assignment-live", orderId] }); },
      )
      .subscribe();
    return () => { portalClient.removeChannel(channel); };
  }, [orderId, qc]);

  return query;
}
