/**
 * usePunch — Hook for technician punch-in / punch-out flow.
 * Uses public.attendance_records (RLS scoped to current user).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PunchRecord {
  id: string;
  user_id: string;
  punch_in_at: string;
  punch_out_at: string | null;
  total_minutes: number | null;
}

export function useOpenPunch() {
  return useQuery({
    queryKey: ["tech-open-punch"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<PunchRecord | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .is("punch_out_at", null)
        .order("punch_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as PunchRecord) ?? null;
    },
  });
}

export function usePunchHistory(days = 7) {
  return useQuery({
    queryKey: ["tech-punch-history", days],
    queryFn: async (): Promise<PunchRecord[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .gte("punch_in_at", since)
        .order("punch_in_at", { ascending: false });
      return (data as PunchRecord[]) ?? [];
    },
  });
}

export function usePunchIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase
        .from("attendance_records")
        .insert({ user_id: user.id, punch_in_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pointage enregistré — bonne journée !");
      qc.invalidateQueries({ queryKey: ["tech-open-punch"] });
      qc.invalidateQueries({ queryKey: ["tech-punch-history"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur de pointage"),
  });
}

export function usePunchOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (punchId: string) => {
      const out = new Date();
      const { data: existing } = await supabase
        .from("attendance_records")
        .select("punch_in_at")
        .eq("id", punchId)
        .maybeSingle();
      const inAt = existing ? new Date(existing.punch_in_at) : out;
      const total = Math.max(0, Math.round((out.getTime() - inAt.getTime()) / 60000));
      const { error } = await supabase
        .from("attendance_records")
        .update({ punch_out_at: out.toISOString(), total_minutes: total })
        .eq("id", punchId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fin de journée enregistrée");
      qc.invalidateQueries({ queryKey: ["tech-open-punch"] });
      qc.invalidateQueries({ queryKey: ["tech-punch-history"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });
}
