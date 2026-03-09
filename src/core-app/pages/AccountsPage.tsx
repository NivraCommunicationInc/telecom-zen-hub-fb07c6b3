/**
 * AccountsPage — Nivra Core accounts list (Customer 360 entry point).
 * Reuses the unified_clients view (same data source as /admin/accounts).
 * Dark ops-grade visual style, routed at /core/accounts.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Link } from "react-router-dom";
import { Search, ArrowRight, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface UnifiedClient {
  id: string | null;
  user_id: string | null;
  account_number: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_status: string | null;
  source: string | null;
  has_profile: boolean | null;
  has_billing_customer: boolean | null;
  service_address: string | null;
  service_city: string | null;
  created_at: string | null;
}

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Actif", value: "active" },
  { label: "Suspendu", value: "suspended" },
  { label: "Bloqué", value: "blocked" },
];

const AccountsPage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: clients, isLoading } = useQuery<UnifiedClient[]>({
    queryKey: ["core-accounts-unified"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as UnifiedClient[]) || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    let list = clients;
    if (statusFilter) {
      list = list.filter(c => (c.account_status || "active") === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.full_name?.toLowerCase().includes(q)) ||
        (c.email?.toLowerCase().includes(q)) ||
        (c.account_number?.toLowerCase().includes(q)) ||
        (c.phone?.toLowerCase().includes(q)) ||
        (c.service_city?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [clients, search, statusFilter]);

  const counts = useMemo(() => {
    if (!clients) return { total: 0, active: 0, suspended: 0, profiles: 0 };
    return {
      total: clients.length,
      active: clients.filter(c => !c.account_status || c.account_status === "active").length,
      suspended: clients.filter(c => c.account_status === "suspended").length,
      profiles: clients.filter(c => c.has_profile).length,
    };
  }, [clients]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Comptes</h1>
        <p className="text-[13px] text-[hsl(220,10%,50%)] mt-0.5">
          Gestion des comptes clients — {counts.total} compte{counts.total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total },
          { label: "Actifs", value: counts.active },
          { label: "Suspendus", value: counts.suspended },
          { label: "Avec portail", value: counts.profiles },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <p className="text-[11px] uppercase tracking-wider text-[hsl(220,10%,40%)]">{k.label}</p>
            <p className="text-xl font-bold tabular-nums text-white mt-1">{isLoading ? "—" : k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-3 py-2">
          <Search className="h-4 w-4 text-[hsl(220,10%,40%)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, courriel, numéro de compte, téléphone…"
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-1 py-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "text-[hsl(220,10%,45%)] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[hsl(220,15%,16%)]">
              {["N° compte", "Client", "Courriel", "Téléphone", "Statut", "Source", "Ville", "Créé le", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,10%,40%)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3.5 w-20 rounded bg-[hsl(220,15%,14%)] animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-[hsl(220,10%,35%)] text-[13px]">
                  {search || statusFilter ? "Aucun compte ne correspond aux filtres." : "Aucun compte trouvé."}
                </td>
              </tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id || c.user_id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,15%,13%)] transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-white">
                      {c.account_number || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white truncate max-w-[180px] text-[13px]">
                      {c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[hsl(220,10%,55%)] truncate max-w-[200px]">
                    {c.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-[hsl(220,10%,55%)] font-mono text-[12px]">
                    {c.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={c.account_status || "active"}
                      variant={statusToVariant(c.account_status || "active")}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                      c.has_profile
                        ? "bg-emerald-600/15 text-emerald-400"
                        : "bg-[hsl(220,15%,14%)] text-[hsl(220,10%,40%)]"
                    }`}>
                      {c.has_profile ? "Portail" : "Facturation"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[hsl(220,10%,50%)]">
                    {c.service_city || "—"}
                  </td>
                  <td className="px-4 py-3 text-[hsl(220,10%,45%)]">
                    {c.created_at ? format(new Date(c.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.id ? (
                      <Link to={`/core/accounts/${c.id}`}>
                        <button className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[hsl(220,10%,50%)] hover:text-white hover:border-[hsl(220,15%,30%)] transition-colors">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    ) : (
                      <span className="text-[hsl(220,10%,25%)]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-[11px] text-[hsl(220,10%,30%)] text-center">
          {filtered.length} compte{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
          {(search || statusFilter) && ` sur ${counts.total}`}
        </p>
      )}
    </div>
  );
};

export default AccountsPage;
