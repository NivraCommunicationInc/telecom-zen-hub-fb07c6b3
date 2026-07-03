/**
 * useInstallationSlots — fetches the real installation calendar via the
 * `get_available_installation_slots` RPC. Shared by every checkout tunnel
 * (Core, Field, OneView, public client).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstallationSlot {
  slot_date: string;   // ISO date "YYYY-MM-DD"
  time_slot: string;   // "09:00-12:00"
  capacity: number;
  booked: number;
  available: number;
  status: "open" | "full" | "closed";
}

interface Options {
  fromDate?: string;    // YYYY-MM-DD (defaults today)
  toDate?: string;      // YYYY-MM-DD (defaults today + 30 days)
  enabled?: boolean;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useInstallationSlots(opts: Options = {}) {
  const from = opts.fromDate ?? toIsoDate(new Date());
  const toDefault = new Date();
  toDefault.setDate(toDefault.getDate() + 30);
  const to = opts.toDate ?? toIsoDate(toDefault);

  return useQuery({
    queryKey: ["installation-slots", from, to],
    enabled: opts.enabled ?? true,
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
