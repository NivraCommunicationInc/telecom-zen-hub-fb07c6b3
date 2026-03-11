/**
 * EquipmentInventoryPage — Real equipment stock management for Nivra Core.
 * /core/equipment
 * Features: catalog items, stock levels, serial/IMEI/MAC, status tracking, add/assign/return.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package, Plus, Search, Filter, Wifi, Tv, Smartphone, Shield,
  Hash, ChevronDown, Loader2, X, CheckCircle, AlertTriangle,
  RotateCcw, UserCheck, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/core-app/components/ui/StatusBadge";

// ── Types ──
interface EquipmentRow {
  id: string;
  catalog_item_id: string | null;
  catalog_name: string;
  category: string;
  sku: string | null;
  serial_number: string | null;
  imei: string | null;
  mac_address: string | null;
  cost_internal: number;
  price_client: number;
  status: string;
  account_id: string | null;
  order_id: string | null;
  subscription_id: string | null;
  assigned_at: string | null;
  notes: string | null;
  condition: string | null;
  warehouse_location: string | null;
  created_at: string;
  updated_at: string;
}

interface CatalogOption {
  id: string;
  name: string;
  price: number;
}

const STATUS_OPTIONS = [
  { value: "in_stock", label: "En stock", color: "emerald" },
  { value: "reserved", label: "Réservé", color: "amber" },
  { value: "assigned", label: "Attribué", color: "blue" },
  { value: "returned", label: "Retourné", color: "purple" },
  { value: "defective", label: "Défectueux", color: "red" },
  { value: "lost", label: "Perdu", color: "slate" },
];

const statusVariant = (s: string) => {
  if (s === "in_stock") return "success" as const;
  if (s === "assigned") return "info" as const;
  if (s === "reserved") return "warning" as const;
  if (s === "defective" || s === "lost") return "danger" as const;
  return "neutral" as const;
};

export default function EquipmentInventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // ── Add form state ──
  const [addForm, setAddForm] = useState({
    catalog_item_id: "",
    catalog_name: "",
    sku: "",
    serial_number: "",
    imei: "",
    mac_address: "",
    cost_internal: "",
    price_client: "",
    condition: "new",
    warehouse_location: "",
    notes: "",
    quantity: "1",
  });

  // ── Fetch inventory ──
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["equipment-inventory", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("equipment_inventory")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as EquipmentRow[];
    },
  });

  // ── Fetch catalog options (equipment category from services) ──
  const { data: catalogOptions = [] } = useQuery({
    queryKey: ["equipment-catalog-options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("category", "Équipement")
        .eq("is_active", true)
        .order("name");
      return (data || []) as CatalogOption[];
    },
  });

  // ── Add mutation ──
  const addMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(addForm.quantity) || 1;
      const items = [];
      for (let i = 0; i < qty; i++) {
        items.push({
          catalog_item_id: addForm.catalog_item_id || null,
          catalog_name: addForm.catalog_name,
          category: "Équipement",
          sku: addForm.sku || null,
          serial_number: qty === 1 ? (addForm.serial_number || null) : null,
          imei: qty === 1 ? (addForm.imei || null) : null,
          mac_address: qty === 1 ? (addForm.mac_address || null) : null,
          cost_internal: parseFloat(addForm.cost_internal) || 0,
          price_client: parseFloat(addForm.price_client) || 0,
          condition: addForm.condition,
          warehouse_location: addForm.warehouse_location || null,
          notes: addForm.notes || null,
          status: "in_stock",
        });
      }
      const { error } = await supabase.from("equipment_inventory").insert(items as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-inventory"] });
      toast.success("Équipement ajouté au stock");
      setShowAddDialog(false);
      setAddForm({ catalog_item_id: "", catalog_name: "", sku: "", serial_number: "", imei: "", mac_address: "", cost_internal: "", price_client: "", condition: "new", warehouse_location: "", notes: "", quantity: "1" });
    },
    onError: (err: any) => toast.error("Erreur", { description: err.message }),
  });

  // ── Status change mutation ──
  const statusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from("equipment_inventory")
        .update({ status: newStatus, ...(newStatus === "in_stock" ? { account_id: null, order_id: null, subscription_id: null, assigned_at: null } : {}) } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-inventory"] });
      toast.success("Statut mis à jour");
    },
  });

  // ── Filter ──
  const filtered = inventory.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.catalog_name.toLowerCase().includes(q) ||
      (item.serial_number || "").toLowerCase().includes(q) ||
      (item.sku || "").toLowerCase().includes(q) ||
      (item.imei || "").toLowerCase().includes(q) ||
      (item.mac_address || "").toLowerCase().includes(q)
    );
  });

  // ── KPIs ──
  const inStock = inventory.filter(i => i.status === "in_stock").length;
  const assigned = inventory.filter(i => i.status === "assigned").length;
  const reserved = inventory.filter(i => i.status === "reserved").length;
  const defective = inventory.filter(i => i.status === "defective" || i.status === "lost").length;

  const handleCatalogSelect = (catalogId: string) => {
    const opt = catalogOptions.find(c => c.id === catalogId);
    if (opt) {
      setAddForm(prev => ({
        ...prev,
        catalog_item_id: opt.id,
        catalog_name: opt.name,
        price_client: String(opt.price || 0),
      }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Inventaire Équipements</h1>
          <p className="text-xs text-[#A1A1AA]">Stock, attribution et traçabilité des équipements</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Ajouter au stock
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "EN STOCK", value: inStock, color: "text-emerald-400" },
          { label: "ATTRIBUÉS", value: assigned, color: "text-blue-400" },
          { label: "RÉSERVÉS", value: reserved, color: "text-amber-400" },
          { label: "DÉFECTUEUX / PERDUS", value: defective, color: "text-red-400" },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA]">{k.label}</p>
            <p className={cn("text-lg font-bold mt-0.5", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A1A1AA]" />
          <Input
            placeholder="Rechercher par nom, N° série, SKU, IMEI, MAC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs placeholder:text-[hsl(220,10%,40%)]"
          />
        </div>
        <div className="flex gap-1.5">
          {[{ value: "all", label: "Tout" }, ...STATUS_OPTIONS].map(s => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                statusFilter === s.value ? "bg-emerald-600/20 text-emerald-400" : "text-[#A1A1AA] hover:text-white"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[#A1A1AA] text-sm">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Aucun équipement trouvé
        </div>
      ) : (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,14%)]">
                  {["Article", "SKU", "N° Série", "IMEI / MAC", "Coût", "Prix client", "Statut", "Condition", "Emplacement", "Actions"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                    <td className="px-3 py-2.5 text-white font-medium max-w-[180px] truncate">{item.catalog_name}</td>
                    <td className="px-3 py-2.5 text-[#A1A1AA] font-mono">{item.sku || "—"}</td>
                    <td className="px-3 py-2.5 text-[#A1A1AA] font-mono">{item.serial_number || "—"}</td>
                    <td className="px-3 py-2.5 text-[#A1A1AA] font-mono text-[10px]">
                      {item.imei || item.mac_address || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#A1A1AA]">{Number(item.cost_internal).toFixed(2)} $</td>
                    <td className="px-3 py-2.5 text-emerald-400 font-medium">{Number(item.price_client).toFixed(2)} $</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={STATUS_OPTIONS.find(s => s.value === item.status)?.label || item.status} variant={statusVariant(item.status)} size="sm" />
                    </td>
                    <td className="px-3 py-2.5 text-[#A1A1AA] capitalize">{item.condition || "—"}</td>
                    <td className="px-3 py-2.5 text-[#A1A1AA]">{item.warehouse_location || "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {item.status === "assigned" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: item.id, newStatus: "returned" })}
                            className="h-6 px-2 rounded border border-purple-500/30 text-[10px] text-purple-400 hover:bg-purple-500/10"
                            title="Marquer retourné"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                        {(item.status === "returned" || item.status === "defective") && (
                          <button
                            onClick={() => statusMutation.mutate({ id: item.id, newStatus: "in_stock" })}
                            className="h-6 px-2 rounded border border-emerald-500/30 text-[10px] text-emerald-400 hover:bg-emerald-500/10"
                            title="Remettre en stock"
                          >
                            <CheckCircle className="h-3 w-3" />
                          </button>
                        )}
                        {item.status === "in_stock" && (
                          <button
                            onClick={() => statusMutation.mutate({ id: item.id, newStatus: "defective" })}
                            className="h-6 px-2 rounded border border-red-500/30 text-[10px] text-red-400 hover:bg-red-500/10"
                            title="Marquer défectueux"
                          >
                            <AlertTriangle className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Equipment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,16%)] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Ajouter au stock</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">Sélectionnez un article du catalogue ou saisissez manuellement</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* Catalog picker */}
            <div>
              <Label className="text-[11px] text-[#A1A1AA] uppercase">Article du catalogue</Label>
              <Select value={addForm.catalog_item_id} onValueChange={handleCatalogSelect}>
                <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs">
                  <SelectValue placeholder="Choisir un article..." />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                  {catalogOptions.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-white text-xs">
                      {c.name} — {Number(c.price).toFixed(2)} $
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!addForm.catalog_item_id && (
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">Nom article (manuel) *</Label>
                <Input value={addForm.catalog_name} onChange={e => setAddForm(p => ({ ...p, catalog_name: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">SKU</Label>
                <Input value={addForm.sku} onChange={e => setAddForm(p => ({ ...p, sku: e.target.value }))}
                  placeholder="EQ-ROUTER" className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">Quantité</Label>
                <Input type="number" min="1" value={addForm.quantity} onChange={e => setAddForm(p => ({ ...p, quantity: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">N° Série</Label>
                <Input value={addForm.serial_number} onChange={e => setAddForm(p => ({ ...p, serial_number: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">IMEI</Label>
                <Input value={addForm.imei} onChange={e => setAddForm(p => ({ ...p, imei: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">MAC</Label>
                <Input value={addForm.mac_address} onChange={e => setAddForm(p => ({ ...p, mac_address: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">Coût interne ($)</Label>
                <Input type="number" step="0.01" value={addForm.cost_internal} onChange={e => setAddForm(p => ({ ...p, cost_internal: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">Prix client ($)</Label>
                <Input type="number" step="0.01" value={addForm.price_client} onChange={e => setAddForm(p => ({ ...p, price_client: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">Condition</Label>
                <Select value={addForm.condition} onValueChange={v => setAddForm(p => ({ ...p, condition: v }))}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    <SelectItem value="new" className="text-white text-xs">Neuf</SelectItem>
                    <SelectItem value="refurbished" className="text-white text-xs">Reconditionné</SelectItem>
                    <SelectItem value="used" className="text-white text-xs">Usagé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">Emplacement</Label>
                <Input value={addForm.warehouse_location} onChange={e => setAddForm(p => ({ ...p, warehouse_location: e.target.value }))}
                  placeholder="Entrepôt A" className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-[#A1A1AA] uppercase">Notes</Label>
              <Textarea value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} className="mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
            </div>

            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || (!addForm.catalog_name && !addForm.catalog_item_id)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Ajouter {parseInt(addForm.quantity) > 1 ? `${addForm.quantity} unités` : "au stock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
