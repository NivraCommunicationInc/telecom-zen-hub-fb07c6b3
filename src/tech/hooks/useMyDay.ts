import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DayAssignment {
  assignment_id: string;
  order_id: string | null;
  scheduled_date: string;
  time_start: string;
  time_end: string;
  status: string;
  sequence_order: number | null;
  service_address_id: string | null;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  client_full_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  service_type: string | null;
  intervention_session_id: string | null;
  intervention_step: string | null;
  intervention_progress: number | null;
  intervention_status: string | null;
}

export function useMyDay(date?: string) {
  const _date = date ?? new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState<DayAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.rpc("fn_get_my_day", { _date });
    if (error) setError(error.message);
    setItems((data as DayAssignment[]) ?? []);
    setLoading(false);
  }, [_date]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: any change to my assignments or intervention sessions -> reload
  useEffect(() => {
    const ch = supabase
      .channel(`myday-${_date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "technician_assignments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "intervention_sessions" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [_date, load]);

  return { items, loading, error, reload: load };
}
