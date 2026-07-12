/**
 * useInstallationSlots — fetches the real installation calendar via the
 * `get_available_installation_slots` RPC. Shared by every checkout tunnel
 * (Core, Field, OneView, public client).
 *
 * Lot 2 (Calendrier unifié) — abonnement Realtime sur les tables sources
 * (`appointments`, `appointment_slot_rules`, `appointment_slot_overrides`,
 * `appointment_blocked_dates`) pour invalider la query dès qu'un créneau
 * change côté Core, Field ou Portail client.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstallationSlot {
  slot_date: string;
  time_slot: string;
  capacity: number;
  booked: number;
  available: number;
  status: "open" | "full" | "closed";
}

interface Options {
  fromDate?: string;
  toDate?: string;
  enabled?: boolean;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const REALTIME_TABLES = [
  "appointments",
  "appointment_slot_rules",
  "appointment_slot_overrides",
  "appointment_blocked_dates",
] as const;

export function useInstallationSlots(opts: Options = {}) {
  const from = opts.fromDate ?? toIsoDate(new Date());
  const toDefault = new Date();
  toDefault.setDate(toDefault.getDate() + 30);
  const to = opts.toDate ?? toIsoDate(toDefault);
  const enabled = opts.enabled ?? true;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["installation-slots", from, to],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_installation_slots" as never, {
        p_from_date: from,
        p_to_date: to,
      } as never);
      if (error) throw error;
      return (data as unknown as InstallationSlot[]) ?? [];
    },
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(`installation-slots:${from}:${to}`);
    for (const table of REALTIME_TABLES) {
      (channel as unknown as {
        on: (t: string, f: Record<string, unknown>, cb: () => void) => typeof channel;
      }).on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries({ queryKey: ["installation-slots", from, to] });
        }
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, from, to, queryClient]);

  return query;
}

/** Group slots per day, sorted chronologically. */
export function groupSlotsByDay(slots: InstallationSlot[]): Array<{ date: string; slots: InstallationSlot[] }> {
  const map = new Map<string, InstallationSlot[]>();
  for (const s of slots) {
    if (!map.has(s.slot_date)) map.set(s.slot_date, []);
    map.get(s.slot_date)!.push(s);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, slots]) => ({ date, slots: slots.sort((a, b) => a.time_slot.localeCompare(b.time_slot)) }));
}
