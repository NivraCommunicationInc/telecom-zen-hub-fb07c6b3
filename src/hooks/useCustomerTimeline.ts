/**
 * useCustomerTimeline — Read the unified customer timeline.
 *
 * Backed by the SQL view `public.v_customer_timeline` which UNIONs 6 sources:
 *   activity_logs, billing_subscription_trace_audit, cancellation_runs,
 *   billing_payments, support_tickets, client_referral_events.
 *
 *   const { events, isLoading } = useCustomerTimeline(clientId);
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TimelineEventType =
  | "billing"
  | "payment"
  | "support"
  | "cancellation"
  | "audit"
  | "system";

export type TimelineSeverity = "info" | "success" | "warning" | "error";

export interface TimelineEvent {
  event_id: string;
  client_id: string;
  account_id: string | null;
  occurred_at: string;
  event_type: TimelineEventType;
  severity: TimelineSeverity;
  summary: string;
  actor_name: string;
  actor_role: string;
  source_table: string;
  source_id: string;
  details: Record<string, unknown>;
}

interface Options {
  /** Max rows to return (default 100). */
  limit?: number;
  /** Filter by event_type (multi). */
  types?: TimelineEventType[];
}

export function useCustomerTimeline(clientId: string | null | undefined, options: Options = {}) {
  const limit = options.limit ?? 100;
  const types = options.types ?? [];

  const query = useQuery({
    queryKey: ["customer-timeline", clientId, limit, types.sort().join(",")],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!clientId) return [];
      let q = supabase
        .from("v_customer_timeline")
        .select("*")
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (types.length > 0) q = q.in("event_type", types);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
