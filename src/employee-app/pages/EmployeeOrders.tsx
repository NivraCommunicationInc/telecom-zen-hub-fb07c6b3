/**
 * EmployeeOrders — Orders list and entry to detail.
 * Read-only canonical financials. Operational actions only.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Loader2, Search, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";

const STATUS_FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "submitted", label: "Soumises" },
  { key: "processing", label: "En traitement" },
  { key: "completed", label: "Complétées" },
  { key: "cancelled", label: "Annulées" },
];

function useEmployeeOrders(statusFilter: string) {
  return useQuery({
    queryKey: ["employee-orders", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, order_number, user_id, account_id, status, payment_status, service_type, total_amount, created_at, assigned_to")
        .eq("environment", "live")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: orders, error } = await query;
      if (error) throw error;
      if (!orders?.length) return [];

      const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      return orders.map(o => ({
        ...o,
        clientName: profileMap.get(o.user_id)?.full_name ?? null,
        clientEmail: profileMap.get(o.user_id)?.email ?? null,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}

export default function EmployeeOrders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [search, setSearch] = useState("");
  const { data: orders = [], isLoading } = useEmployeeOrders(statusFilter);

  const filtered = search.trim()
    ? orders.filter(o =>
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        o.clientEmail?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "text-amber-400 bg-amber-500/10",
      submitted: "text-blue-400 bg-blue-500/10",
      processing: "text-indigo-400 bg-indigo-500/10",
      completed: "text-emerald-400 bg-emerald-500/10",
      cancelled: "text-red-400 bg-red-500/10",
    };
    return map[s] ?? "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,15%)]";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Commandes</h1>
          <p className="text-sm text-[hsl(220,10%,45%)]">{filtered.length} commande{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220,10%,35%)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[hsl(220,15%,15%)] bg-[hsl(220,20%,8%)] text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === f.key
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-[hsl(220,10%,45%)] hover:text-white hover:bg-[hsl(220,15%,12%)] border border-transparent"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucune commande trouvée.</p>
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
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Paiement</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(employeePath(`/orders/${o.id}`))}
                    className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white">{o.order_number ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,55%)]">{o.clientName ?? o.clientEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{o.service_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(o.status))}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium",
                        o.payment_status === "paid" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                      )}>
                        {o.payment_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">
                      {format(new Date(o.created_at), "d MMM yyyy", { locale: fr })}
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
