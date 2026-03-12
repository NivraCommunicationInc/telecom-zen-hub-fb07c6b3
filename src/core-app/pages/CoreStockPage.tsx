/**
 * CoreStockPage — Equipment Stock & Warehouse Console
 * Enhanced with category tabs (All, Terminals, Routers, SIM, Accessories)
 * Full detail drawer with warehouse location, assignment history
 * Status lifecycle management
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Search, BarChart3, AlertTriangle, Wifi, Smartphone, CreditCard, Cpu, Plus, XCircle, Edit } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  in_stock: { label: "En stock", color: "bg-emerald-500/15 text-emerald-400" },
  reserved: { label: "Réservé", color: "bg-amber-500/15 text-amber-400" },
  assigned: { label: "Assigné", color: "bg-blue-500/15 text-blue-400" },
  returned: { label: "Retourné", color: "bg-purple-500/15 text-purple-400" },
  defective: { label: "Défectueux", color: "bg-red-500/15 text-red-400" },
};

const CATEGORIES = [
  { id: "all", label: "Tout", icon: Package },
  { id: "terminal", label: "Terminaux", icon: Smartphone },
  { id: "router", label: "Routeurs WiFi", icon: Wifi },
  { id: "sim", label: "Cartes SIM", icon: CreditCard },
  { id: "accessory", label: "Accessoires", icon: Cpu },
];

export default function CoreStockPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [statusChangeDialog, setStatusChangeDialog] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["core-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // Status change mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("equipment_inventory").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-stock"] });
      toast.success("Statut mis à jour");
      setStatusChangeDialog(null);
    },
    onError: () => toast.error("Erreur"),
  });

  // Categorize items based on product_name / sku
  const categorize = (item: any): string => {
    const name = (item.product_name || "").toLowerCase();
    const sku = (item.sku || "").toLowerCase();
    if (name.includes("sim") || sku.includes("sim")) return "sim";
    if (name.includes("rout") || name.includes("wifi") || name.includes("modem") || sku.includes("rout")) return "router";
    if (name.includes("terminal") || name.includes("phone") || name.includes("handset") || name.includes("appareil") || sku.includes("term")) return "terminal";
    return "accessory";
  };

  const filtered = useMemo(() => {
    return inventory.filter((item: any) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter !== "all" && categorize(item) !== categoryFilter) return false;
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
  }, [inventory, search, statusFilter, categoryFilter]);

  const counts = Object.keys(STATUS_MAP).reduce((acc, key) => {
    acc[key] = inventory.filter((i: any) => i.status === key).length;
    return acc;
  }, {} as Record<string, number>);

  const catCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cat.id === "all" ? inventory.length : inventory.filter((i: any) => categorize(i) === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Gestion des stocks</h1>
          <p className="text-xs text-[#94A3B8]">{inventory.length} unités • {counts.in_stock || 0} en stock • {counts.defective || 0} défectueux</p>
        </div>
        <Package className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Status KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Object.entries(STATUS_MAP).map(([key, { label }]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            className={`rounded-lg border p-2.5 text-left transition-colors ${statusFilter === key ? "border-emerald-500/30 bg-emerald-600/10" : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]"}`}>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{label}</span>
            <p className="text-lg font-bold text-[#F8FAFC] mt-0.5">{counts[key] || 0}</p>
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0">
        {CATEGORIES.map((cat) => (
          <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors ${
              categoryFilter === cat.id
                ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px"
                : "text-[#94A3B8] hover:text-[#CBD5E1]"
            }`}>
            <cat.icon className="h-3.5 w-3.5" />
            {cat.label}
            <span className="text-[10px] text-[#64748B] ml-1">({catCounts[cat.id] || 0})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Produit, SKU, SN, IMEI, MAC…"
          className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Produit", "SKU", "N° Série", "IMEI", "MAC", "Emplacement", "Statut", "Coût", "Prix client", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={10} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-[#64748B]">Aucun équipement trouvé</td></tr>
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
                      <td className="px-3 py-2.5 text-[#94A3B8]">{item.warehouse_location || "—"}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{item.internal_cost != null ? `${Number(item.internal_cost).toFixed(2)} $` : "—"}</td>
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{item.customer_price != null ? `${Number(item.customer_price).toFixed(2)} $` : "—"}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={(e) => { e.stopPropagation(); setStatusChangeDialog(item); setNewStatus(item.status || "in_stock"); }}
                          className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Changer statut">
                          <Edit className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selected && !statusChangeDialog} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-[#F8FAFC]">Fiche équipement</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[
                  ["Produit", selected.product_name],
                  ["Catégorie", { terminal: "Terminal", router: "Routeur WiFi", sim: "Carte SIM", accessory: "Accessoire" }[categorize(selected)] || "—"],
                  ["SKU", selected.sku],
                  ["N° Série", selected.serial_number],
                  ["IMEI", selected.imei],
                  ["MAC", selected.mac_address],
                  ["Statut", STATUS_MAP[selected.status]?.label || selected.status],
                  ["Emplacement", selected.warehouse_location],
                  ["Coût interne", selected.internal_cost != null ? `${Number(selected.internal_cost).toFixed(2)} $` : "—"],
                  ["Prix client", selected.customer_price != null ? `${Number(selected.customer_price).toFixed(2)} $` : "—"],
                  ["Assigné à", selected.assigned_to_user_id || "—"],
                  ["Commande liée", selected.order_id || "—"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]"><span className="text-[#94A3B8]">{l}</span><span className="text-[#F8FAFC] font-medium text-right max-w-[200px] break-all">{v || "—"}</span></div>
                ))}
              </div>
              {/* Status change */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Changer le statut</h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STATUS_MAP).map(([k, v]) => (
                    <button key={k} onClick={() => updateStatusMutation.mutate({ id: selected.id, status: k })}
                      disabled={selected.status === k}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        selected.status === k ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1] disabled:opacity-30"
                      }`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Quick status change dialog */}
      {statusChangeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4">
            <h2 className="text-[14px] font-semibold text-[#F8FAFC]">Changer le statut: {statusChangeDialog.product_name}</h2>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStatusChangeDialog(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] text-[12px] font-medium">Annuler</button>
              <button onClick={() => updateStatusMutation.mutate({ id: statusChangeDialog.id, status: newStatus })}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
