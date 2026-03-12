/**
 * CoreStockPage — Equipment Stock & Warehouse Console
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Search, BarChart3, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_stock: { label: "En stock", color: "bg-emerald-500/15 text-emerald-400" },
  reserved: { label: "Réservé", color: "bg-amber-500/15 text-amber-400" },
  assigned: { label: "Assigné", color: "bg-blue-500/15 text-blue-400" },
  returned: { label: "Retourné", color: "bg-purple-500/15 text-purple-400" },
  defective: { label: "Défectueux", color: "bg-red-500/15 text-red-400" },
};

export default function CoreStockPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["core-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = inventory.filter((item: any) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.product_name?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.serial_number?.toLowerCase().includes(q) ||
        item.imei?.toLowerCase().includes(q) ||
        item.mac_address?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = Object.keys(STATUS_MAP).reduce((acc, key) => {
    acc[key] = inventory.filter((i: any) => i.status === key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Gestion des stocks</h1>
          <p className="text-xs text-[#94A3B8]">{inventory.length} unités totales • {counts.in_stock || 0} en stock</p>
        </div>
        <Package className="h-5 w-5 text-emerald-400" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(STATUS_MAP).map(([key, { label, color }]) => (
          <div key={key} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <span className="text-[11px] text-[#94A3B8] uppercase tracking-wider">{label}</span>
            <p className="text-xl font-bold text-[#F8FAFC] mt-1">{counts[key] || 0}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produit, SKU, SN, IMEI, MAC…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setStatusFilter("all")} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${statusFilter === "all" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"}`}>
            Tous
          </button>
          {Object.entries(STATUS_MAP).map(([key, { label }]) => (
            <button key={key} onClick={() => setStatusFilter(key)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${statusFilter === key ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Produit", "SKU", "N° Série", "IMEI", "MAC", "Statut", "Coût", "Prix client"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#64748B]">Aucun équipement trouvé</td></tr>
              ) : (
                filtered.map((item: any) => {
                  const st = STATUS_MAP[item.status] || { label: item.status, color: "text-[#94A3B8]" };
                  return (
                    <tr key={item.id} onClick={() => setSelected(item)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{item.product_name || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#CBD5E1]">{item.sku || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#CBD5E1]">{item.serial_number || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#CBD5E1]">{item.imei || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#CBD5E1]">{item.mac_address || "—"}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{item.internal_cost != null ? `${Number(item.internal_cost).toFixed(2)} $` : "—"}</td>
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{item.customer_price != null ? `${Number(item.customer_price).toFixed(2)} $` : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-[#F8FAFC]">Fiche équipement</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[
                  ["Produit", selected.product_name],
                  ["SKU", selected.sku],
                  ["N° Série", selected.serial_number],
                  ["IMEI", selected.imei],
                  ["MAC", selected.mac_address],
                  ["Statut", STATUS_MAP[selected.status]?.label || selected.status],
                  ["Coût interne", selected.internal_cost != null ? `${Number(selected.internal_cost).toFixed(2)} $` : "—"],
                  ["Prix client", selected.customer_price != null ? `${Number(selected.customer_price).toFixed(2)} $` : "—"],
                  ["Emplacement", selected.warehouse_location],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-[#94A3B8]">{l}</span>
                    <span className="text-[#F8FAFC] font-medium">{v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
