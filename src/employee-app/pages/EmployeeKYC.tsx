/**
 * EmployeeKYC — KYC / Identity verification queue for employees.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function EmployeeKYC() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["employee-kyc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_identity_data")
        .select("id, order_id, verification_status, risk_level, created_at, verified_by, verified_at")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "text-amber-400 bg-amber-500/10",
      approved: "text-emerald-400 bg-emerald-500/10",
      rejected: "text-red-400 bg-red-500/10",
    };
    return map[s] ?? "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,15%)]";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">KYC / Vérification</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">Vérifications d'identité en attente</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucune vérification en attente.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Commande</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Risque</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Soumis</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Vérifié par</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-white">{item.order_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(item.verification_status ?? ""))}>
                        {item.verification_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{item.risk_level ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">
                      {format(new Date(item.created_at), "d MMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">{item.verified_by ?? "—"}</td>
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
