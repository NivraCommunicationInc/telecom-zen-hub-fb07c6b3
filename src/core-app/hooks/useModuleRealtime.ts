/**
 * useModuleRealtime — Subscribe to a set of tables filtered by client_id or account_id
 * and invalidate canonical caches on any change.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAfterPayment } from "@/lib/queryInvalidation";

interface Opts {
  tables: string[];
  clientId?: string | null;
  accountId?: string | null;
}

export function useModuleRealtime({ tables, clientId, accountId }: Opts) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!clientId && !accountId) return;
    const channels = tables.map((table) => {
      const ch = supabase.channel(`module-rt-${table}-${clientId ?? accountId}`);
      const filter = clientId
        ? `client_id=eq.${clientId}`
        : `account_id=eq.${accountId}`;
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => invalidateAfterPayment(qc),
      );
      ch.subscribe();
      return ch;
    });
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [tables.join(","), clientId, accountId, qc]);
}
