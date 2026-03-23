/**
 * useAppointmentDetail — Shared canonical appointment loader.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppointmentDetailData {
  appointment: any;
  order: { id: string; order_number: string; status: string; service_type: string | null } | null;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  technician: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  logs: any[];
}

export function useAppointmentDetail(appointmentId: string | undefined) {
  return useQuery<AppointmentDetailData>({
    queryKey: ["shared-appointment-detail", appointmentId],
    enabled: !!appointmentId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!appointmentId) throw new Error("ID rendez-vous manquant");
      const { data: appointment, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .single();
      if (error) throw error;

      const [orderRes, profileRes, techRes, logsRes] = await Promise.all([
        appointment.order_id
          ? supabase.from("orders").select("id, order_number, status, service_type").eq("id", appointment.order_id).maybeSingle()
          : Promise.resolve({ data: null }),
        appointment.client_id
          ? supabase.from("profiles").select("full_name, email, phone").eq("user_id", appointment.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        appointment.technician_id
          ? supabase.from("technicians").select("id, full_name, email, phone").eq("id", appointment.technician_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("activity_logs")
          .select("action, created_at, actor_name, actor_role")
          .eq("entity_id", appointmentId).eq("entity_type", "appointment")
          .order("created_at", { ascending: false }).limit(20),
      ]);

      return {
        appointment,
        order: orderRes.data,
        profile: profileRes.data,
        technician: techRes.data,
        logs: logsRes.data ?? [],
      };
    },
  });
}

export function useAppointmentsList() {
  return useQuery({
    queryKey: ["shared-appointments-list"],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_number, title, scheduled_at, status, service_address, service_city, service_type, client_id, technician_id, order_id, installation_method")
        .eq("environment", "live")
        .order("scheduled_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      if (!data?.length) return [];

      const clientIds = [...new Set(data.map(a => a.client_id).filter(Boolean))];
      const { data: profiles } = clientIds.length
        ? await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", clientIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      return data.map(a => ({
        ...a,
        clientName: profileMap.get(a.client_id)?.full_name ?? null,
        clientPhone: profileMap.get(a.client_id)?.phone ?? null,
      }));
    },
  });
}
