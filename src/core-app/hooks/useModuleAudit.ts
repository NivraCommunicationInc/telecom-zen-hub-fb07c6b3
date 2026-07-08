/**
 * useModuleAudit — Reads unified audit trail for a client + module scope.
 * Sources: admin_audit_log (canonical) + activity_logs (legacy).
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
      const [adminRes, actRes] = await Promise.all([
        supabase
          .from("admin_audit_log")
          .select("id, created_at, actor_email, action, reason, before_state, after_state")
          .eq("target_client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("activity_logs")
          .select("id, created_at, actor_name, action, description, metadata")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      const rows: AuditEntry[] = [];
      for (const r of adminRes.data ?? []) {
        if (moduleTag && !String((r as any).action ?? "").includes(moduleTag)) continue;
        rows.push({
          id: `adm-${(r as any).id}`,
          occurred_at: (r as any).created_at,
          actor_name: (r as any).actor_email ?? "system",
          action: (r as any).action,
          reason: (r as any).reason ?? null,
          before: (r as any).before_state ?? null,
          after: (r as any).after_state ?? null,
          source: "admin_audit_log",
        });
      }
      for (const r of actRes.data ?? []) {
        if (moduleTag && !String((r as any).action ?? "").includes(moduleTag)) continue;
        rows.push({
          id: `act-${(r as any).id}`,
          occurred_at: (r as any).created_at,
          actor_name: (r as any).actor_name ?? "system",
          action: (r as any).action,
          reason: (r as any).description ?? null,
          before: null,
          after: ((r as any).metadata ?? null) as Record<string, unknown> | null,
          source: "activity_logs",
        });
      }
      rows.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
      return rows.slice(0, limit);
    },
  });
}
