/**
 * EquipmentStep — Step 6: Assign equipment from inventory
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Save, CheckCircle2, Package, Search, AlertTriangle,
  Keyboard, XCircle, User, ShoppingCart, MapPin, RefreshCw,
  Unlink, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { StepCompletionCard } from "../StepCompletionCard";

interface Props { proc: any; }

interface InventoryItem {
  id: string;
  catalog_name: string;
  category: string;
  serial_number: string | null;
  imei: string | null;
  mac_address: string | null;
  sku: string | null;
  status: string;
  condition: string | null;
  warehouse_location: string | null;
  price_client: number | null;
  order_id: string | null;
  account_id: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  in_stock:  "bg-green-900/50 text-green-300",
  reserved:  "bg-amber-900/50 text-amber-300",
  assigned:  "bg-blue-900/50 text-blue-300",
  deployed:  "bg-purple-900/50 text-purple-300",
  defective: "bg-red-900/50 text-red-300",
};
const STATUS_LABEL: Record<string, string> = {
  in_stock: "En stock", reserved: "Réservé", assigned: "Assigné", deployed: "Déployé", defective: "Défectueux",
};

const CATEGORIES = [
  { value: "all", label: "Toutes catégories" },
  { value: "router", label: "Routeur" },
  { value: "modem", label: "Modem" },
  { value: "borne_wifi", label: "Borne WiFi" },
  { value: "tv_box", label: "Terminal TV" },
  { value: "terminal", label: "Terminal" },
  { value: "sim", label: "Carte SIM" },
  { value: "esim", label: "eSIM" },
];

const STATUS_FILTERS = [
  { value: "in_stock", label: "En stock uniquement" },
  { value: "all", label: "Tous les statuts" },
  { value: "assigned", label: "Assignés" },
  { value: "reserved", label: "Réservés" },
  { value: "deployed", label: "Déployés" },
];

const inputClass = "h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg";
const labelClass = "text-[10px] uppercase tracking-wider text-slate-500 mb-1 block";

export function EquipmentStep({ proc }: Props) {
  const { order } = proc;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("in_stock");
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualSerial, setManualSerial] = useState("");
  const [manualMac, setManualMac] = useState("");
  const [manualType, setManualType] = useState("borne_wifi");
  const [manualCatalogName, setManualCatalogName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAssignedDetails, setShowAssignedDetails] = useState(true);

  // Limites par commande
  const WIFI_CATS = ["borne_wifi", "router", "modem"];
  const TV_CATS = ["tv_box", "terminal"];
  const MAX_WIFI = 1;
  const MAX_TV = 4;
  const countCats = (items: { category: string }[], cats: string[]) =>
    items.filter(i => cats.includes(i.category)).length;

  const { data: inventoryItems, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ["equipment-inventory-full", selectedCategory, statusFilter, searchTerm],
    queryFn: async () => {
      let q = supabase.from("equipment_inventory")
        .select("id, catalog_name, category, serial_number, imei, mac_address, sku, status, condition, warehouse_location, price_client, order_id, account_id, assigned_at, assigned_by")
        .order("status", { ascending: true }).order("catalog_name", { ascending: true }).limit(100);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      else q = q.neq("status", "defective");
      if (selectedCategory !== "all") q = q.eq("category", selectedCategory);
      if (searchTerm.trim()) {
        q = q.or(`serial_number.ilike.%${searchTerm}%,mac_address.ilike.%${searchTerm}%,catalog_name.ilike.%${searchTerm}%,imei.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
  });

  const { data: assignedItems, refetch: refetchAssigned } = useQuery({
    queryKey: ["equipment-assigned-order", order.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment_inventory")
        .select("id, catalog_name, category, serial_number, imei, mac_address, sku, status, condition, warehouse_location, price_client, order_id, account_id, assigned_at, assigned_by")
        .eq("order_id", order.id);
      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
  });

  const { data: stockCounts } = useQuery({
    queryKey: ["equipment-stock-counts"],
    queryFn: async () => {
      const [inStock, reserved, assigned, deployed] = await Promise.all([
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "in_stock"),
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "reserved"),
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "assigned"),
        supabase.from("equipment_inventory").select("id", { count: "exact", head: true }).eq("status", "deployed"),
      ]);
      return {
        in_stock: inStock.count || 0, reserved: reserved.count || 0,
        assigned: assigned.count || 0, deployed: deployed.count || 0,
      };
    },
    staleTime: 30_000,
  });

  const hasExistingAssignment = (assignedItems?.length ?? 0) > 0;
  const isItemAvailable = (item: InventoryItem) => item.status === "in_stock";
  const isItemAssignedToThisOrder = (item: InventoryItem) => item.order_id === order.id;

  const toggleItem = (item: InventoryItem) => {
    if (!isItemAvailable(item) && !isItemAssignedToThisOrder(item)) {
      toast.error("Cet article n'est pas disponible — déjà assigné ou déployé");
      return;
    }
    const exists = selectedItems.find(i => i.id === item.id);
    if (exists) setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    else setSelectedItems([...selectedItems, item]);
  };

  const handleAssignFromInventory = async () => {
    if (selectedItems.length === 0) { toast.error("Sélectionnez au moins un article"); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const ids = selectedItems.map(i => i.id);
      const { data: freshCheck, error: checkErr } = await supabase.from("equipment_inventory")
        .select("id, status, order_id").in("id", ids);
      if (checkErr) throw checkErr;
      const conflicts = (freshCheck || []).filter((r: any) => r.status !== "in_stock" && r.order_id !== order.id);
      if (conflicts.length > 0) {
        toast.error(`${conflicts.length} article(s) déjà assigné(s) entre-temps. Rafraîchissez l'inventaire.`);
        refetchInventory(); setSaving(false); return;
      }
      for (const item of selectedItems) {
        const { error } = await supabase.from("equipment_inventory")
          .update({ status: "assigned", order_id: order.id, account_id: proc.account?.id || null, assigned_at: now, assigned_by: proc.currentUserId || null } as any)
          .eq("id", item.id).eq("status", "in_stock");
        if (error) throw error;
      }
      const equipmentDetails = selectedItems.map(item => ({
        id: item.id, inventory_id: item.id, type: item.category, label: item.catalog_name,
        serial_number: item.serial_number || "", mac_address: item.mac_address || "",
        imei: item.imei || "", iccid: "", esim_ref: "", status: "assigned", source: "inventory",
      }));
      const firstHw = selectedItems.find(i => ["router", "modem", "borne_wifi", "tv_box", "terminal"].includes(i.category));
      const firstSim = selectedItems.find(i => ["sim", "esim"].includes(i.category));
      const fields: Record<string, any> = { equipment_details: equipmentDetails, equipment_id: selectedItems[0]?.id };
      if (firstHw?.serial_number) fields.serial_number = firstHw.serial_number;
      if (firstSim?.imei) fields.imei_number = firstSim.imei;

      await proc.assignEquipment(fields);
      setSelectedItems([]);
      refetchAssigned(); refetchInventory();
      queryClient.invalidateQueries({ queryKey: ["equipment-stock-counts"] });
      toast.success(`${selectedItems.length} équipement(s) assigné(s)`);
    } catch (err: any) {
      console.error("[EquipmentStep] Assign failed:", err);
      toast.error(err?.message || "Erreur lors de l'assignation");
    } finally { setSaving(false); }
  };

  const handleUnassign = async (item: InventoryItem) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("equipment_inventory")
        .update({ status: "in_stock", order_id: null, account_id: null, assigned_at: null, assigned_by: null } as any)
        .eq("id", item.id);
      if (error) throw error;
      const currentDetails = Array.isArray(order.equipment_details) ? order.equipment_details : [];
      const updatedDetails = currentDetails.filter((d: any) => d.inventory_id !== item.id && d.id !== item.id);
      await proc.assignEquipment({ equipment_details: updatedDetails });
      refetchAssigned(); refetchInventory();
      queryClient.invalidateQueries({ queryKey: ["equipment-stock-counts"] });
      toast.success(`${item.catalog_name} désassigné`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la désassignation");
    } finally { setSaving(false); }
  };

  const handleManualAssign = async () => {
    if (!manualSerial && !manualMac) { toast.error("Entrez au minimum un numéro de série ou MAC"); return; }
    setSaving(true);
    try {
      const equipmentDetails = [{
        id: crypto.randomUUID(), type: manualType, label: `Manuel — ${manualType}`,
        serial_number: manualSerial, mac_address: manualMac, iccid: "", imei: "", esim_ref: "",
        status: "assigned", source: "manual",
      }];
      const fields: Record<string, any> = { equipment_details: equipmentDetails, equipment_id: manualType.toUpperCase() };
      if (manualSerial) fields.serial_number = manualSerial;
      await proc.assignEquipment(fields);
      toast.success("Équipement assigné manuellement");
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally { setSaving(false); }
  };

  const renderStatusBadge = (item: InventoryItem) => {
    const cls = STATUS_BADGE[item.status] || STATUS_BADGE.in_stock;
    return <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", cls)}>{STATUS_LABEL[item.status] || item.status}</span>;
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Équipement</div>

      {hasExistingAssignment && (
        <StepCompletionCard
          title={`${assignedItems!.length} équipement(s) assigné(s) à la commande`}
          at={assignedItems![0]?.assigned_at}
          details={assignedItems!.slice(0, 4).map((item) => ({
            label: item.catalog_name,
            value: item.serial_number || item.mac_address || item.imei || item.id.slice(0, 8),
            mono: true,
          }))}
        />
      )}

      {/* Metrics row */}
      {stockCounts && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-[#0d1421] rounded-lg p-3 text-center">
            <div className="text-lg font-medium text-green-300 tabular-nums">{stockCounts.in_stock}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">En stock</div>
          </div>
          <div className="bg-[#0d1421] rounded-lg p-3 text-center">
            <div className="text-lg font-medium text-amber-300 tabular-nums">{stockCounts.reserved}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Réservés</div>
          </div>
          <div className="bg-[#0d1421] rounded-lg p-3 text-center">
            <div className="text-lg font-medium text-blue-300 tabular-nums">{stockCounts.assigned}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Assignés</div>
          </div>
          <div className="bg-[#0d1421] rounded-lg p-3 text-center">
            <div className="text-lg font-medium text-purple-300 tabular-nums">{stockCounts.deployed}</div>
            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Déployés</div>
          </div>
        </div>
      )}

      {/* Assigned to this order */}
      {hasExistingAssignment && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <button onClick={() => setShowAssignedDetails(!showAssignedDetails)}
            className="w-full bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
            <p className="text-[11px] font-medium text-green-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {assignedItems!.length} équipement(s) assigné(s)
            </p>
            {showAssignedDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showAssignedDetails && (
            <div className="p-4 space-y-2">
              {assignedItems!.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-[#0d1421] rounded-lg border border-slate-700/50 px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-100 flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-green-400" />
                      {item.catalog_name}
                      {renderStatusBadge(item)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500">
                      {item.serial_number && <span className="font-mono">S/N: {item.serial_number}</span>}
                      {item.mac_address && <span className="font-mono">MAC: {item.mac_address}</span>}
                      {item.imei && <span className="font-mono">IMEI: {item.imei}</span>}
                      {item.category && <span>Cat: {item.category}</span>}
                      {item.assigned_at && <span>Assigné: {new Date(item.assigned_at).toLocaleDateString("fr-CA")}</span>}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleUnassign(item)} disabled={saving}
                    className="text-xs bg-red-700 hover:bg-red-800 text-white h-7 px-2">
                    <Unlink className="w-3 h-3 mr-1" /> Désassigner
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" onClick={() => setManualMode(false)}
          className={cn("text-sm", !manualMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800")}>
          <Package className="w-3 h-3 mr-1" /> Depuis l'inventaire
        </Button>
        <Button size="sm" onClick={() => setManualMode(true)}
          className={cn("text-sm", manualMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800")}>
          <Keyboard className="w-3 h-3 mr-1" /> Saisie manuelle
        </Button>
      </div>

      {!manualMode ? (
        <>
          <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
              <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Filtres</h4>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className={labelClass}>Rechercher</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="S/N, MAC, nom, SKU…" className={cn(inputClass, "pl-8")} />
                </div>
              </div>
              <div>
                <Label className={labelClass}>Catégorie</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelClass}>Statut</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_FILTERS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">{inventoryItems?.length ?? 0} article(s) affichés</p>
            <Button size="sm" onClick={() => refetchInventory()} className="text-xs bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800 h-7">
              <RefreshCw className="w-3 h-3 mr-1" /> Rafraîchir
            </Button>
          </div>

          {inventoryLoading ? (
            <p className="text-sm text-slate-500 py-4 text-center">Chargement de l'inventaire…</p>
          ) : !inventoryItems?.length ? (
            <div className="bg-amber-950/50 border border-amber-700/50 text-amber-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Aucun article trouvé avec ces filtres.
            </div>
          ) : (
            <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto mb-4">
              <div className="grid grid-cols-[1fr_100px_120px_100px] gap-2 px-3 py-2 bg-[#0d1421] border-b border-slate-700/50 text-[10px] font-medium text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                <span>Article</span><span>Catégorie</span><span>Statut</span><span>Emplacement</span>
              </div>
              {inventoryItems.map(item => {
                const available = isItemAvailable(item);
                const thisOrder = isItemAssignedToThisOrder(item);
                const isSelected = selectedItems.some(s => s.id === item.id);
                const selectable = available || thisOrder;
                return (
                  <button
                    key={item.id}
                    onClick={() => selectable && toggleItem(item)}
                    disabled={!selectable}
                    className={cn(
                      "w-full text-left grid grid-cols-[1fr_100px_120px_100px] gap-2 px-3 py-2.5 border-b border-slate-800 transition-colors",
                      isSelected && "bg-green-950/40 border-l-2 border-l-green-500",
                      thisOrder && !isSelected && "bg-blue-950/30",
                      !selectable && "opacity-50 cursor-not-allowed",
                      selectable && !isSelected && "hover:bg-slate-800/40 cursor-pointer"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{item.catalog_name}</p>
                      <div className="flex flex-wrap gap-x-2 text-[10px] text-slate-500 mt-0.5">
                        {item.serial_number && <span className="font-mono">S/N: {item.serial_number}</span>}
                        {item.mac_address && <span className="font-mono">MAC: {item.mac_address}</span>}
                        {item.imei && <span className="font-mono">IMEI: {item.imei}</span>}
                        {item.sku && <span>SKU: {item.sku}</span>}
                      </div>
                      {!available && item.order_id && !thisOrder && (
                        <p className="text-[10px] text-red-300 mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3" /> Assigné à: {item.order_id.slice(0, 8)}…
                        </p>
                      )}
                      {thisOrder && (<p className="text-[10px] text-blue-300 mt-0.5 font-medium">✓ Assigné à cette commande</p>)}
                    </div>
                    <div className="flex items-start"><span className="text-xs text-slate-400">{item.category}</span></div>
                    <div className="flex items-start">{renderStatusBadge(item)}</div>
                    <div className="flex items-start">
                      {item.warehouse_location ? (
                        <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.warehouse_location}</span>
                      ) : (<span className="text-xs text-slate-700">—</span>)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="bg-blue-950/50 border border-blue-700/50 text-blue-300 rounded-lg px-3 py-2 text-sm mb-4">
              <p className="font-medium">{selectedItems.length} article(s) sélectionné(s) pour assignation</p>
              <div className="mt-1 space-y-0.5 opacity-90">
                {selectedItems.map(item => (
                  <p key={item.id} className="text-xs">• {item.catalog_name} {item.serial_number ? `(S/N: ${item.serial_number})` : ""}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-slate-700/50">
            <Button size="sm" onClick={handleAssignFromInventory} disabled={saving || proc.isUpdating || selectedItems.length === 0}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-3 h-3 mr-1" /> Assigner ({selectedItems.length})
            </Button>
            <Button size="sm" onClick={() => proc.setActiveStep("activation")}
              className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
              Continuer →
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-amber-950/50 border border-amber-700/50 text-amber-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>Saisie manuelle — uniquement si l'article n'est pas dans l'inventaire.</span>
          </div>
          <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
              <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Saisie manuelle</h4>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className={labelClass}>Type</Label>
                <Select value={manualType} onValueChange={setManualType}>
                  <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="router">Routeur</SelectItem>
                    <SelectItem value="borne_wifi">Borne WiFi</SelectItem>
                    <SelectItem value="tv_box">Terminal TV</SelectItem>
                    <SelectItem value="sim">Carte SIM</SelectItem>
                    <SelectItem value="modem">Modem</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelClass}>Numéro de série</Label>
                <Input value={manualSerial} onChange={(e) => setManualSerial(e.target.value)} placeholder="S/N…" className={cn(inputClass, "font-mono")} />
              </div>
              <div>
                <Label className={labelClass}>Adresse MAC</Label>
                <Input value={manualMac} onChange={(e) => setManualMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" className={cn(inputClass, "font-mono")} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-700/50">
            <Button size="sm" onClick={handleManualAssign} disabled={saving || proc.isUpdating} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-3 h-3 mr-1" /> Assigner manuellement
            </Button>
            <Button size="sm" onClick={() => proc.setActiveStep("activation")} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
              Continuer →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
