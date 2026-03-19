/**
 * EmployeeActivations — Activation queue for employees.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function EmployeeActivations() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["employee-activations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, user_id, status, service_type, created_at, assigned_to")
        .in("status", ["delivered", "installed", "ready", "provisioning"])
        .eq("environment", "live")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = [...new Set(data.map(o => o.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      return data.map(o => ({
        ...o,
        clientName: profileMap.get(o.user_id)?.full_name ?? null,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      delivered: "text-blue-400 bg-blue-500/10",
      installed: "text-indigo-400 bg-indigo-500/10",
      ready: "text-emerald-400 bg-emerald-500/10",
      provisioning: "text-amber-400 bg-amber-500/10",
    };
    return map[s] ?? "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,15%)]";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Activations</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Services en attente d'activation</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucune activation en attente.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Commande</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-white">{item.order_number ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,55%)]">{item.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{item.service_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(item.status))}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">
                      {format(new Date(item.created_at), "d MMM yyyy", { locale: fr })}
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
