import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Step } from "@/tech/lib/steps";

export type Session = {
  id: string;
  technician_id: string;
  assignment_id: string | null;
  order_id: string | null;
  service_kind: string;
  current_step: Step;
  status: "active" | "completed" | "cancelled";
  progress: number;
  arrival_gps_lat: number | null;
  arrival_gps_lng: number | null;
  arrival_accuracy_m: number | null;
  client_full_name: string | null;
  service_address: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
};

export type ChecklistItem = {
  id: string; session_id: string; position: number;
  code: string; label: string; required: boolean; checked: boolean;
  checked_at: string | null; note: string | null;
};

export type Equipment = {
  id: string; session_id: string; kind: string; serial: string; mac: string | null;
  verified: boolean; scanned_via: string | null;
};

export type TestResult = {
  id: string; session_id: string; kind: "internet" | "wifi" | "tv";
  payload: Record<string, unknown>; passed: boolean; ran_at: string;
};

export type WifiConfig = {
  session_id: string; ssid: string; password: string; band: string; security: string; hidden: boolean;
};

export type MediaRow = {
  id: string; session_id: string; kind: string; storage_path: string;
  bytes: number | null; content_type: string | null; created_at: string;
};

export function useInterventionSession(sessionId: string | undefined) {
  const [session, setSession] = useState<Session | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [wifi, setWifi] = useState<WifiConfig | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true); setError(null);
    const [s, c, e, t, w, m] = await Promise.all([
      supabase.from("intervention_sessions").select("*").eq("id", sessionId).maybeSingle(),
      supabase.from("intervention_checklist_items").select("*").eq("session_id", sessionId).order("position"),
      supabase.from("intervention_equipment").select("*").eq("session_id", sessionId).order("created_at"),
      supabase.from("intervention_tests").select("*").eq("session_id", sessionId),
      supabase.from("intervention_wifi_config").select("*").eq("session_id", sessionId).maybeSingle(),
      supabase.from("intervention_media").select("*").eq("session_id", sessionId).order("created_at"),
    ]);
    if (s.error) setError(s.error.message);
    setSession((s.data as Session) ?? null);
    setChecklist((c.data as ChecklistItem[]) ?? []);
    setEquipment((e.data as Equipment[]) ?? []);
    setTests((t.data as TestResult[]) ?? []);
    setWifi((w.data as WifiConfig) ?? null);
    setMedia((m.data as MediaRow[]) ?? []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { void refetch(); }, [refetch]);

  // Realtime — session row updates + child inserts
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`intervention-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "intervention_sessions", filter: `id=eq.${sessionId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "intervention_checklist_items", filter: `session_id=eq.${sessionId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "intervention_equipment", filter: `session_id=eq.${sessionId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "intervention_tests", filter: `session_id=eq.${sessionId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "intervention_media", filter: `session_id=eq.${sessionId}` }, () => refetch())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [sessionId, refetch]);

  const advance = useCallback(async (from: Step, to: Step, payload: Record<string, unknown> = {}) => {
    if (!sessionId) throw new Error("no_session");
    const { data, error } = await supabase.rpc("fn_advance_step", {
      p_session_id: sessionId, p_from_step: from, p_to_step: to, p_payload: payload,
    });
    if (error) throw error;
    setSession(data as Session);
    return data as Session;
  }, [sessionId]);

  const closeSession = useCallback(async () => {
    if (!sessionId) throw new Error("no_session");
    const { data, error } = await supabase.rpc("fn_close_intervention", { p_session_id: sessionId });
    if (error) throw error;
    setSession(data as Session);
    return data as Session;
  }, [sessionId]);

  const activateService = useCallback(async () => {
    if (!sessionId) throw new Error("no_session");
    const { data, error } = await supabase.rpc("fn_activate_service_for_intervention", { p_session_id: sessionId });
    if (error) throw error;
    return data as { ok: boolean };
  }, [sessionId]);

  const value = useMemo(() => ({
    session, checklist, equipment, tests, wifi, media, loading, error,
    refetch, advance, closeSession, activateService,
  }), [session, checklist, equipment, tests, wifi, media, loading, error, refetch, advance, closeSession, activateService]);

  return value;
}
