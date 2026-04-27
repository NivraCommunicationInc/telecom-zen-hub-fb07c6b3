/**
 * EmployeeEquipment — Equipment visibility per client/order.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Loader2, Search, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

export default function EmployeeEquipment() {
  usePortalRealtime(["equipment_inventory"], [["employee-equipment"]]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["employee-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, serial_number, mac_address, status, category, sku, condition, order_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const orderIds = [...new Set((data ?? []).map(e => e.order_id).filter(Boolean))];
      const { data: orders } = orderIds.length
        ? await supabase.from("orders").select("id, order_number, user_id").in("id", orderIds)
        : { data: [] };

      const orderMap = new Map((orders ?? []).map(o => [o.id, o]));
      const userIds = [...new Set((orders ?? []).map(o => o.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      return (data ?? []).map(e => {
        const order = e.order_id ? orderMap.get(e.order_id) : null;
        return {
          ...e,
          orderNumber: order?.order_number ?? null,
          clientName: order?.user_id ? profileMap.get(order.user_id)?.full_name ?? null : null,
        };
      });
    },
    staleTime: 1000 * 60 * 3,
  });

  const filtered = search.trim()
    ? items.filter(e =>
        e.catalog_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
        e.mac_address?.toLowerCase().includes(search.toLowerCase()) ||
        e.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        e.clientName?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const statusCounts = {
    assigned: items.filter(e => e.status === "assigned").length,
    deployed: items.filter(e => e.status === "deployed").length,
    in_stock: items.filter(e => e.status === "in_stock" || e.status === "available").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Équipement</h1>
          <p className="text-xs text-muted-foreground">
            {statusCounts.assigned} assigné · {statusCounts.deployed} déployé · {statusCounts.in_stock} en stock
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par série, MAC, client…"
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aucun équipement trouvé.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Nom", "Série", "MAC", "Catégorie", "Statut", "Condition", "Commande", "Client"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-2 font-medium text-foreground">{e.catalog_name ?? e.sku ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{e.serial_number ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{e.mac_address ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.category ?? "—"}</td>
                    <td className="px-3 py-2"><StatusBadge status={e.status} /></td>
                    <td className="px-3 py-2 text-muted-foreground">{e.condition ?? "—"}</td>
                    <td className="px-3 py-2">
                      {e.orderNumber ? (
                        <button onClick={() => navigate(employeePath(`/orders/${e.orderNumber}`))} className="font-mono text-primary hover:underline">
                          {e.orderNumber}
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.clientName ?? "—"}</td>
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
