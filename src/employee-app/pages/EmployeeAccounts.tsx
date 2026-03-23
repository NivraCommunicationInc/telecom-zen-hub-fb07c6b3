/**
 * EmployeeAccounts — Account list for customer-service agents.
 * Read-only list with search, status filter, click-to-detail.
 * Uses canonical accounts + profiles data.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { Search, Loader2, Building2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AccountRow {
  id: string;
  account_number: string;
  status: string | null;
  client_id: string;
  created_at: string;
  primary_service_address: string | null;
  primary_service_city: string | null;
  credit_class: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Actif", value: "active" },
  { label: "Suspendu", value: "suspended" },
  { label: "Bloqué", value: "blocked" },
];

export default function EmployeeAccounts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: accounts, isLoading } = useQuery<AccountRow[]>({
    queryKey: ["employee-accounts"],
    queryFn: async () => {
      const { data: accts, error } = await supabase
        .from("accounts")
        .select("id, account_number, status, client_id, created_at, primary_service_address, primary_service_city, credit_class")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!accts?.length) return [];

      const clientIds = [...new Set(accts.map(a => a.client_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .in("user_id", clientIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      return accts.map(a => {
        const p = profileMap.get(a.client_id);
        return {
          ...a,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          phone: p?.phone ?? null,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    let list = accounts ?? [];
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.account_number?.toLowerCase().includes(q) ||
        a.full_name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phone?.includes(q) ||
        a.primary_service_city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [accounts, statusFilter, search]);

  const statusBadge = (s: string | null) => {
    const colors: Record<string, string> = {
      active: "text-emerald-400 bg-emerald-500/10",
      suspended: "text-red-400 bg-red-500/10",
      blocked: "text-red-400 bg-red-500/10",
      pending: "text-amber-400 bg-amber-500/10",
    };
    return (
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", colors[s ?? ""] ?? "text-muted-foreground bg-muted")}>
        {s ?? "—"}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Comptes
        </h1>
        <span className="text-xs text-muted-foreground">{filtered.length} compte{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, nom, email, téléphone…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun compte trouvé</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-card border-b border-border">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Numéro</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ville</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Créé</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(a => (
                <tr
                  key={a.id}
                  onClick={() => navigate(employeePath(`/accounts/${a.id}`))}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link to={employeePath(`/accounts/${a.id}`)} className="font-mono text-xs text-foreground hover:text-primary transition-colors">
                      {a.account_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs text-foreground">{a.full_name ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{a.email ?? ""}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.primary_service_city ?? "—"}</td>
                  <td className="px-4 py-3">{statusBadge(a.status)}</td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">
                    {format(new Date(a.created_at), "d MMM yyyy", { locale: fr })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={employeePath(`/accounts/${a.id}`)}
                      onClick={e => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
