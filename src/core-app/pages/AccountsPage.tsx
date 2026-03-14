/**
 * AccountsPage — Nivra Core accounts list (Customer 360 entry point).
 * Queries the accounts table directly, joined with profiles for contact info.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { Search, ArrowRight, Users, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AccountRow {
  id: string;
  account_number: string;
  status: string | null;
  client_id: string;
  created_at: string;
  primary_service_address: string | null;
  primary_service_city: string | null;
  // joined profile fields (may be null if no profile)
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
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

  const { data: accounts, isLoading, refetch } = useQuery<AccountRow[]>({
    queryKey: ["core-accounts-direct"],
    queryFn: async () => {
      // Fetch accounts joined with profiles for contact info
      const { data: accts, error: acctErr } = await supabase
        .from("accounts")
        .select("id, account_number, status, client_id, created_at, primary_service_address, primary_service_city")
        .order("created_at", { ascending: false });
      if (acctErr) throw acctErr;
      if (!accts || accts.length === 0) return [];

      // Get unique client_ids and fetch profiles
      const clientIds = [...new Set(accts.map(a => a.client_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, first_name, last_name, email, phone")
        .in("user_id", clientIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      return accts.map(a => {
        const p = profileMap.get(a.client_id);
        return {
          ...a,
          full_name: p?.full_name || null,
          first_name: p?.first_name || null,
          last_name: p?.last_name || null,
          email: p?.email || null,
          phone: p?.phone || null,
        };
      });
    },
    staleTime: 2 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!accounts) return [];
    let list = accounts;
    if (statusFilter) list = list.filter(c => (c.status || "active") === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.full_name?.toLowerCase().includes(q)) ||
        (c.email?.toLowerCase().includes(q)) ||
        (c.account_number?.toLowerCase().includes(q)) ||
        (c.phone?.toLowerCase().includes(q)) ||
        (c.primary_service_city?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [accounts, search, statusFilter]);

  const counts = useMemo(() => {
    if (!accounts) return { total: 0, active: 0, suspended: 0 };
    return {
      total: accounts.length,
      active: accounts.filter(c => !c.status || c.status === "active").length,
      suspended: accounts.filter(c => c.status === "suspended").length,
    };
  }, [accounts]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Comptes</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] mt-0.5">
            Gestion des comptes clients · {counts.total} compte{counts.total !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-white" },
          { label: "Actifs", value: counts.active, color: "text-emerald-400" },
          { label: "Suspendus", value: counts.suspended, color: "text-red-400" },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{k.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-1 ${k.color}`}>{isLoading ? "—" : k.value}</p>
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
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] px-1 py-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["N° compte", "Client", "Courriel", "Téléphone", "Statut", "Ville", "Créé le", ""].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5"><div className="h-3.5 w-16 rounded bg-[hsl(220,15%,14%)] animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[hsl(220,10%,35%)]">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{search || statusFilter ? "Aucun compte ne correspond aux filtres." : "Aucun compte trouvé."}</p>
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors">
                    <td className="px-3 py-2.5"><span className="font-mono font-medium text-white">{c.account_number || "—"}</span></td>
                    <td className="px-3 py-2.5">
                      <p className="text-white truncate max-w-[160px]">{c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[hsl(220,10%,55%)] truncate max-w-[180px]">{c.email || "—"}</td>
                    <td className="px-3 py-2.5 text-[hsl(220,10%,55%)] font-mono text-[11px]">{c.phone || "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge label={c.status || "active"} variant={statusToVariant(c.status || "active")} size="sm" /></td>
                    <td className="px-3 py-2.5 text-[hsl(220,10%,50%)]">{c.primary_service_city || "—"}</td>
                    <td className="px-3 py-2.5 text-[hsl(220,10%,45%)] whitespace-nowrap">{c.created_at ? format(new Date(c.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                    <td className="px-3 py-2.5">
                      <Link to={corePath(`/accounts/${c.id}`)}>
                        <button className="h-7 w-7 flex items-center justify-center rounded-md border border-[hsl(220,15%,20%)] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/40 transition-colors">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
