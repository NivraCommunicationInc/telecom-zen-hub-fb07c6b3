import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Incident {
  id: string;
  service_name: string;
  service_display_name: string | null;
  incident_title: string;
  incident_message: string | null;
  status_at_incident: string;
  started_at: string;
  resolved_at: string | null;
  incident_type: string | null;
}

export function useServiceIncidents() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("service_incidents")
      .select("id, service_name, service_display_name, incident_title, incident_message, status_at_incident, started_at, resolved_at, incident_type")
      .is("resolved_at", null)
      .order("started_at", { ascending: false })
      .limit(20);
    setItems((data as Incident[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const ch = supabase
      .channel("noc-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_incidents" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { items, loading };
}
