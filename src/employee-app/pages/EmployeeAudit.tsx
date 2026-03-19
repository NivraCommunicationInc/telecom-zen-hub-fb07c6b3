/**
 * EmployeeAudit — Read-only operational audit logs.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function EmployeeAudit() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["employee-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_audit_log")
        .select("id, user_id, action, category, portal, entity_type, entity_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Audit / Historique</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Journal des actions internes (lecture seule)</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <ScrollText className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucune entrée dans le journal.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Catégorie</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Portail</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Cible</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] transition-colors">
                    <td className="px-4 py-3 text-xs text-white">{log.action}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{log.category ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{log.portal ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)] font-mono">
                      {log.entity_type ? `${log.entity_type}:${log.entity_id?.slice(0, 8) ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">
                      {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
