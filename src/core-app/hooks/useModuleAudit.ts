/**
 * useModuleAudit — Reads unified audit trail for a client + module scope.
 *
 * Canonical sources:
 *   - admin_audit_log : columns id, admin_user_id, admin_email, action,
 *                       details (jsonb), target_type, target_id, target_email,
 *                       ip_address, created_at
 *   - activity_logs   : legacy per-client trail (client_id, actor_name, action,
 *                       description, metadata, created_at)
 *
 * Filtering:
 *   - admin_audit_log: match on target_id = clientId OR details->>'client_id' = clientId
 *     plus, when a moduleTag is provided, either action LIKE '%<tag>%' or
 *     details->>'module_tag' = '<tag>'.
 *   - activity_logs: filter on client_id + action LIKE '%<tag>%'.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  occurred_at: string;
  actor_name: string;
  action: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  source: "admin_audit_log" | "activity_logs";
}

export function useModuleAudit(clientId?: string | null, moduleTag?: string, limit = 50) {
  return useQuery({
    queryKey: ["module-audit", clientId, moduleTag, limit],
    enabled: !!clientId,
    staleTime: 15_000,
    queryFn: async (): Promise<AuditEntry[]> => {
      if (!clientId) return [];

      // Match admin_audit_log rows where either target_id = clientId
      // OR the payload details.client_id equals clientId (safer for account-scoped actions).
      const adminOr = `target_id.eq.${clientId},details->>client_id.eq.${clientId}`;

      const adminQ = supabase
        .from("admin_audit_log")
        .select("id, created_at, admin_email, action, details, target_id, target_email")
        .or(adminOr)
        .order("created_at", { ascending: false })
        .limit(limit);

      const actQ = supabase
        .from("activity_logs")
        .select("id, created_at, actor_name, action, description, metadata")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(limit);

      const [adminRes, actRes] = await Promise.all([adminQ, actQ]);

      const rows: AuditEntry[] = [];

      for (const r of adminRes.data ?? []) {
        const anyR = r as Record<string, any>;
        const details = (anyR.details ?? {}) as Record<string, any>;
        if (moduleTag) {
          const inAction = String(anyR.action ?? "").includes(moduleTag);
          const inTag = details.module_tag === moduleTag;
          if (!inAction && !inTag) continue;
        }
        rows.push({
          id: `adm-${anyR.id}`,
          occurred_at: anyR.created_at,
          actor_name: anyR.admin_email ?? "system",
          action: anyR.action,
          reason: (details.reason as string) ?? null,
          before: (details.before_state ?? null) as Record<string, unknown> | null,
          after: (details.after_state ?? details.results ?? null) as Record<string, unknown> | null,
          source: "admin_audit_log",
        });
      }

      for (const r of actRes.data ?? []) {
        const anyR = r as Record<string, any>;
        if (moduleTag && !String(anyR.action ?? "").includes(moduleTag)) continue;
        rows.push({
          id: `act-${anyR.id}`,
          occurred_at: anyR.created_at,
          actor_name: anyR.actor_name ?? "system",
          action: anyR.action,
          reason: anyR.description ?? null,
          before: null,
          after: (anyR.metadata ?? null) as Record<string, unknown> | null,
          source: "activity_logs",
        });
      }

      rows.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
      return rows.slice(0, limit);
    },
  });
}
