/**
 * EmployeeClients — Client list with 360° profile view.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Loader2, Search, ArrowUpRight, UserPlus } from "lucide-react";
import { useState } from "react";
import { employeePath } from "@/employee-app/lib/employeePaths";
import CreateClientDialog from "@/employee-app/components/CreateClientDialog";

function useEmployeeClients(search: string) {
  return useQuery({
    queryKey: ["employee-clients", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get accounts for these users
      const userIds = (data ?? []).map(p => p.user_id).filter(Boolean);
      const { data: accounts } = userIds.length
        ? await supabase.from("accounts").select("client_id, account_number, status").in("client_id", userIds)
        : { data: [] };
      const accountMap = new Map((accounts ?? []).map(a => [a.client_id, a]));

      return (data ?? []).map(p => ({
        ...p,
        accountNumber: accountMap.get(p.user_id)?.account_number ?? null,
        accountStatus: accountMap.get(p.user_id)?.status ?? null,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default function EmployeeClients() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [showCreate, setShowCreate] = useState(false);
  const { data: clients = [], isLoading } = useEmployeeClients(search);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-[hsl(220,10%,45%)]">{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors min-h-[44px]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Nouveau client
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,35%)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email, téléphone…"
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucun client trouvé.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Compte</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Nom</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Téléphone</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr
                    key={c.user_id}
                    onClick={() => navigate(employeePath(`/clients/${c.user_id}`))}
                    className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white">{c.accountNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-white">{c.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[hsl(220,15%,15%)] text-[hsl(220,10%,55%)]">
                        {c.accountStatus ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(220,10%,35%)]" />
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
