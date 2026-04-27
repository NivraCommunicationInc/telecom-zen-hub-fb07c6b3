/**
 * usePortalRealtime — Subscribe to postgres_changes on a list of tables and
 * invalidate React Query keys whenever any of them changes.
 *
 * Lightweight, debounced (200 ms) to coalesce bursts and avoid query storms.
 * Tables MUST be present in the supabase_realtime publication, otherwise the
 * subscription will silently never fire.
 *
 * Usage:
 *   usePortalRealtime(
 *     ["orders", "billing_invoices"],
 *     [["client-orders"], ["client-invoices"]]
 *   );
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePortalRealtime(
  tables: string[],
  queryKeys: ReadonlyArray<ReadonlyArray<unknown>>,
) {
  const queryClient = useQueryClient();
  const tablesKey = tables.join(",");
  const keysRef = useRef(queryKeys);
  keysRef.current = queryKeys;

  useEffect(() => {
    if (!tables.length) return;

    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(() => {
        pending = false;
        for (const key of keysRef.current) {
          queryClient.invalidateQueries({ queryKey: key as unknown[] });
        }
      }, 200);
    };

    const channelName = `portal-realtime-${tablesKey}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName);

    for (const table of tables) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => invalidate(),
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, queryClient]);
}
