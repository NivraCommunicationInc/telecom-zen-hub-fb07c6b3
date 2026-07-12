/**
 * useCustomerTimeline — Read the canonical unified customer timeline.
 *
 * Backed by the SQL view `public.v_customer_timeline` (security_invoker=on).
 * Every timeline surface in the app MUST go through this hook — never read
 * source tables (activity_logs, client_profile_changes, order_status_history,
 * service_address_history, billing_payments, support_tickets, …) directly.
 *
 * The view carries first-class columns for correlation_id + visibility and
 * exposes semantic payload fields (before_data / after_data / reason /
 * changed_field / change_type) inside `details`. This hook lifts those onto
 * a flat `TimelineEvent` shape so the UI never has to reach into `details`.
 *
 *   const { events, isLoading } = useCustomerTimeline(clientId, {
 *     visibility: "client",      // "all" | "client" | "staff"
 *     types: ["billing"],
 *     limit: 200,
 *   });
 */
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type TimelineEventType =
  | "billing"
  | "payment"
  | "support"
  | "cancellation"
  | "audit"
  | "system";

export type TimelineSeverity = "info" | "success" | "warning" | "error";

export type TimelineVisibility = "client" | "staff" | "internal";

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
  correlation_id: string | null;
  visibility: TimelineVisibility;
  // Lifted from details
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  reason: string | null;
  changed_field: string | null;
  change_type: string | null;
}

interface Options {
  /** Max rows to return (default 200). */
  limit?: number;
  /** Filter by event_type (multi). */
  types?: TimelineEventType[];
  /** Restrict visibility. "all" = no filter (staff/core only). */
  visibility?: "all" | "client" | "staff";
  /** Optional actor role filter (multi). */
  actorRoles?: string[];
  /** Optional free-text search on summary/actor. */
  search?: string;
  /** Override the Supabase client (portal vs core vs admin). */
  client?: SupabaseClient<any, any, any>;
}

function pick<T = unknown>(obj: any, key: string): T | null {
  if (!obj || typeof obj !== "object") return null;
  const v = obj[key];
  return v === undefined ? null : (v as T);
}

export function useCustomerTimeline(
  clientId: string | null | undefined,
  options: Options = {},
) {
  const limit = options.limit ?? 200;
  const types = options.types ?? [];
  const visibility = options.visibility ?? "all";
  const actorRoles = options.actorRoles ?? [];
  const search = (options.search ?? "").trim().toLowerCase();
  const sb = options.client ?? supabase;

  const query = useQuery({
    queryKey: [
      "customer-timeline",
      clientId,
      limit,
      types.slice().sort().join(","),
      visibility,
      actorRoles.slice().sort().join(","),
      search,
    ],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!clientId) return [];
      let q = sb
        .from("v_customer_timeline" as any)
        .select(
          "event_id, client_id, account_id, occurred_at, event_type, severity, summary, actor_name, actor_role, source_table, source_id, details, correlation_id, visibility",
        )
        .eq("client_id", clientId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (types.length > 0) q = q.in("event_type", types);
      if (visibility !== "all") q = q.eq("visibility", visibility);
      if (actorRoles.length > 0) q = q.in("actor_role", actorRoles);

      const { data, error } = await q;
      if (error) throw error;

      const rows = ((data as any[]) ?? []).map((r): TimelineEvent => {
        const details = (r.details ?? {}) as Record<string, unknown>;
        return {
          event_id: r.event_id,
          client_id: r.client_id,
          account_id: r.account_id,
          occurred_at: r.occurred_at,
          event_type: r.event_type,
          severity: r.severity,
          summary: r.summary,
          actor_name: r.actor_name,
          actor_role: r.actor_role,
          source_table: r.source_table,
          source_id: r.source_id,
          details,
          correlation_id: r.correlation_id ?? null,
          visibility: (r.visibility ?? "staff") as TimelineVisibility,
          before_data:
            pick<Record<string, unknown>>(details, "before_data") ??
            pick<Record<string, unknown>>(details, "before") ??
            null,
          after_data:
            pick<Record<string, unknown>>(details, "after_data") ??
            pick<Record<string, unknown>>(details, "after") ??
            null,
          reason:
            (pick<string>(details, "reason") as string | null) ??
            (pick<string>(details, "reason_code") as string | null) ??
            null,
          changed_field: pick<string>(details, "changed_field") as string | null,
          change_type:
            (pick<string>(details, "change_type") as string | null) ??
            (pick<string>(details, "action") as string | null),
        };
      });

      if (!search) return rows;
      return rows.filter((e) => {
        return (
          e.summary?.toLowerCase().includes(search) ||
          e.actor_name?.toLowerCase().includes(search) ||
          e.source_table?.toLowerCase().includes(search) ||
          (e.reason ?? "").toLowerCase().includes(search)
        );
      });
    },
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
