/**
 * EquipmentStep — Step 6: Assign equipment from inventory
 * 
 * Features:
 * - Full inventory visibility with status indicators
 * - Clear assigned vs available state per item
 * - Duplicate assignment prevention (server-side check)
 * - Post-assignment management panel
 * 
 * LOCKED RULE: Equipment must be selected from inventory, not typed manually.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  in_stock:  { label: "En stock",   color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  reserved:  { label: "Réservé",    color: "bg-amber-100 text-amber-800 border-amber-200",       icon: ShoppingCart },
  assigned:  { label: "Assigné",    color: "bg-blue-100 text-blue-800 border-blue-200",          icon: User },
  deployed:  { label: "Déployé",    color: "bg-purple-100 text-purple-800 border-purple-200",    icon: Package },
  defective: { label: "Défectueux", color: "bg-red-100 text-red-800 border-red-200",             icon: XCircle },
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
  const [manualType, setManualType] = useState("router");
  const [saving, setSaving] = useState(false);
  const [showAssignedDetails, setShowAssignedDetails] = useState(true);

  // ─── ALL inventory with status + assignment info ───
  const { data: inventoryItems, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ["equipment-inventory-full", selectedCategory, statusFilter, searchTerm],
    queryFn: async () => {
      let q = supabase
        .from("equipment_inventory")
        .select("id, catalog_name, category, serial_number, imei, mac_address, sku, status, condition, warehouse_location, price_client, order_id, account_id, assigned_at, assigned_by")
        .order("status", { ascending: true })
        .order("catalog_name", { ascending: true })
        .limit(100);

      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      } else {
        // Exclude defective from "all" view
        q = q.neq("status", "defective");
      }

      if (selectedCategory !== "all") {
        q = q.eq("category", selectedCategory);
      }

      if (searchTerm.trim()) {
        q = q.or(
          `serial_number.ilike.%${searchTerm}%,mac_address.ilike.%${searchTerm}%,catalog_name.ilike.%${searchTerm}%,imei.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
  });

  // ─── Already assigned to THIS order ───
  const { data: assignedItems, refetch: refetchAssigned } = useQuery({
    queryKey: ["equipment-assigned-order", order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, category, serial_number, imei, mac_address, sku, status, condition, warehouse_location, price_client, order_id, account_id, assigned_at, assigned_by")
        .eq("order_id", order.id);
      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
  });

  // ─── Stock counts for summary bar ───
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
        in_stock: inStock.count || 0,
        reserved: reserved.count || 0,
        assigned: assigned.count || 0,
        deployed: deployed.count || 0,
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
    if (exists) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleAssignFromInventory = async () => {
    if (selectedItems.length === 0) {
      toast.error("Sélectionnez au moins un article de l'inventaire");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();

      // ─── DUPLICATE PREVENTION: Re-check each item is still in_stock ───
      const ids = selectedItems.map(i => i.id);
      const { data: freshCheck, error: checkErr } = await supabase
        .from("equipment_inventory")
        .select("id, status, order_id")
        .in("id", ids);
      if (checkErr) throw checkErr;

      const conflicts = (freshCheck || []).filter(
        (r: any) => r.status !== "in_stock" && r.order_id !== order.id
      );
      if (conflicts.length > 0) {
        toast.error(
          `${conflicts.length} article(s) déjà assigné(s) entre-temps. Rafraîchissez l'inventaire.`
        );
        refetchInventory();
        setSaving(false);
        return;
      }

      // Assign each item
      for (const item of selectedItems) {
        const { error } = await supabase
          .from("equipment_inventory")
          .update({
            status: "assigned",
            order_id: order.id,
            account_id: proc.account?.id || null,
            assigned_at: now,
            assigned_by: proc.currentUserId || null,
          } as any)
          .eq("id", item.id)
          .eq("status", "in_stock"); // Atomic guard
        if (error) throw error;
      }

      // Build equipment_details JSON for order record
      const equipmentDetails = selectedItems.map(item => ({
        id: item.id,
        inventory_id: item.id,
        type: item.category,
        label: item.catalog_name,
        serial_number: item.serial_number || "",
        mac_address: item.mac_address || "",
        imei: item.imei || "",
        iccid: "",
        esim_ref: "",
        status: "assigned",
        source: "inventory",
      }));

      const firstHw = selectedItems.find(i =>
        ["router", "modem", "borne_wifi", "tv_box", "terminal"].includes(i.category)
      );
      const firstSim = selectedItems.find(i => ["sim", "esim"].includes(i.category));

      const fields: Record<string, any> = {
        equipment_details: equipmentDetails,
        equipment_id: selectedItems[0]?.id,
      };
      if (firstHw?.serial_number) fields.serial_number = firstHw.serial_number;
      if (firstSim?.imei) fields.imei_number = firstSim.imei;

      await proc.assignEquipment(fields);
      setSelectedItems([]);
      refetchAssigned();
      refetchInventory();
      queryClient.invalidateQueries({ queryKey: ["equipment-stock-counts"] });
      toast.success(`${selectedItems.length} équipement(s) assigné(s)`);
    } catch (err: any) {
      console.error("[EquipmentStep] Assign failed:", err);
      toast.error(err?.message || "Erreur lors de l'assignation");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (item: InventoryItem) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("equipment_inventory")
        .update({
          status: "in_stock",
          order_id: null,
          account_id: null,
          assigned_at: null,
          assigned_by: null,
        } as any)
        .eq("id", item.id);
      if (error) throw error;

      // Remove from order equipment_details
      const currentDetails = Array.isArray(order.equipment_details) ? order.equipment_details : [];
      const updatedDetails = currentDetails.filter((d: any) => d.inventory_id !== item.id && d.id !== item.id);
      await proc.assignEquipment({ equipment_details: updatedDetails });

      refetchAssigned();
      refetchInventory();
      queryClient.invalidateQueries({ queryKey: ["equipment-stock-counts"] });
      toast.success(`${item.catalog_name} désassigné`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la désassignation");
    } finally {
      setSaving(false);
    }
  };

  const handleManualAssign = async () => {
    if (!manualSerial && !manualMac) {
      toast.error("Entrez au minimum un numéro de série ou une adresse MAC");
      return;
    }
    setSaving(true);
    try {
      const equipmentDetails = [{
        id: crypto.randomUUID(),
        type: manualType,
        label: `Manuel — ${manualType}`,
        serial_number: manualSerial,
        mac_address: manualMac,
        iccid: "",
        imei: "",
        esim_ref: "",
        status: "assigned",
        source: "manual",
      }];
      const fields: Record<string, any> = {
        equipment_details: equipmentDetails,
        equipment_id: manualType.toUpperCase(),
      };
      if (manualSerial) fields.serial_number = manualSerial;
      await proc.assignEquipment(fields);
      toast.success("Équipement assigné manuellement");
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = (item: InventoryItem) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.in_stock;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 gap-1 border", cfg.color)}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-gray-900">Équipement</h3>

      {/* ─── STOCK SUMMARY BAR ─── */}
      {stockCounts && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            En stock: <strong>{stockCounts.in_stock}</strong>
          </span>
          <span className="flex items-center gap-1 text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Réservés: <strong>{stockCounts.reserved}</strong>
          </span>
          <span className="flex items-center gap-1 text-blue-700">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Assignés: <strong>{stockCounts.assigned}</strong>
          </span>
          <span className="flex items-center gap-1 text-purple-700">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Déployés: <strong>{stockCounts.deployed}</strong>
          </span>
        </div>
      )}

      {/* ─── ASSIGNED TO THIS ORDER ─── */}
      {hasExistingAssignment && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <button
            onClick={() => setShowAssignedDetails(!showAssignedDetails)}
            className="w-full flex items-center justify-between"
          >
            <p className="text-sm text-emerald-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {assignedItems!.length} équipement(s) assigné(s) à cette commande
            </p>
            {showAssignedDetails ? <ChevronUp className="w-4 h-4 text-emerald-600" /> : <ChevronDown className="w-4 h-4 text-emerald-600" />}
          </button>

          {showAssignedDetails && (
            <div className="mt-3 space-y-2">
              {assignedItems!.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-white rounded-md border border-emerald-100 px-3 py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      {item.catalog_name}
                      {renderStatusBadge(item)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-[11px] text-gray-500">
                      {item.serial_number && <span className="font-mono">S/N: {item.serial_number}</span>}
                      {item.mac_address && <span className="font-mono">MAC: {item.mac_address}</span>}
                      {item.imei && <span className="font-mono">IMEI: {item.imei}</span>}
                      {item.category && <span>Cat: {item.category}</span>}
                      {item.assigned_at && (
                        <span>Assigné: {new Date(item.assigned_at).toLocaleDateString("fr-CA")}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnassign(item)}
                    disabled={saving}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                  >
                    <Unlink className="w-3 h-3 mr-1" /> Désassigner
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODE TOGGLE ─── */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={!manualMode ? "default" : "outline"}
          onClick={() => setManualMode(false)}
          className={cn("text-xs h-8", !manualMode ? "bg-gray-900 text-white" : "border-gray-300 text-gray-700")}
        >
          <Package className="w-3 h-3 mr-1" /> Depuis l'inventaire
        </Button>
        <Button
          size="sm"
          variant={manualMode ? "default" : "outline"}
          onClick={() => setManualMode(true)}
          className={cn("text-xs h-8", manualMode ? "bg-gray-900 text-white" : "border-gray-300 text-gray-700")}
        >
          <Keyboard className="w-3 h-3 mr-1" /> Saisie manuelle
        </Button>
      </div>

      {!manualMode ? (
        <>
          {/* ─── SEARCH + FILTERS ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Rechercher</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="S/N, MAC, nom, SKU…"
                  className="h-9 text-sm border-gray-300 text-gray-900 pl-8"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Catégorie</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9 text-sm border-gray-300 text-gray-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm border-gray-300 text-gray-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ─── INVENTORY TABLE ─── */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {inventoryItems?.length ?? 0} article(s) affichés
            </p>
            <Button variant="ghost" size="sm" onClick={() => refetchInventory()} className="text-xs h-7 text-gray-500">
              <RefreshCw className="w-3 h-3 mr-1" /> Rafraîchir
            </Button>
          </div>

          {inventoryLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Chargement de l'inventaire…</p>
          ) : !inventoryItems?.length ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Aucun article trouvé avec ces filtres.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              {/* Header */}
              <div className="grid grid-cols-[1fr_100px_120px_100px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[11px] font-medium text-gray-500 uppercase tracking-wider sticky top-0 z-10">
                <span>Article</span>
                <span>Catégorie</span>
                <span>Statut</span>
                <span>Emplacement</span>
              </div>
              {/* Rows */}
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
                      "w-full text-left grid grid-cols-[1fr_100px_120px_100px] gap-2 px-3 py-2.5 border-b border-gray-50 transition-colors",
                      isSelected && "bg-emerald-50 border-l-2 border-l-emerald-500",
                      thisOrder && !isSelected && "bg-blue-50/50",
                      !selectable && "opacity-50 cursor-not-allowed",
                      selectable && !isSelected && "hover:bg-gray-50 cursor-pointer"
                    )}
                  >
                    {/* Article info */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.catalog_name}</p>
                      <div className="flex flex-wrap gap-x-2 text-[10px] text-gray-500 mt-0.5">
                        {item.serial_number && <span className="font-mono">S/N: {item.serial_number}</span>}
                        {item.mac_address && <span className="font-mono">MAC: {item.mac_address}</span>}
                        {item.imei && <span className="font-mono">IMEI: {item.imei}</span>}
                        {item.sku && <span>SKU: {item.sku}</span>}
                      </div>
                      {/* Show who it's assigned to if not available */}
                      {!available && item.order_id && !thisOrder && (
                        <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Assigné à commande: {item.order_id.slice(0, 8)}…
                        </p>
                      )}
                      {thisOrder && (
                        <p className="text-[10px] text-blue-600 mt-0.5 font-medium">
                          ✓ Assigné à cette commande
                        </p>
                      )}
                    </div>

                    {/* Category */}
                    <div className="flex items-start">
                      <span className="text-xs text-gray-600">{item.category}</span>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-start">
                      {renderStatusBadge(item)}
                    </div>

                    {/* Location */}
                    <div className="flex items-start">
                      {item.warehouse_location ? (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {item.warehouse_location}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ─── SELECTION SUMMARY ─── */}
          {selectedItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800 font-medium">{selectedItems.length} article(s) sélectionné(s) pour assignation</p>
              <div className="mt-1 space-y-0.5">
                {selectedItems.map(item => (
                  <p key={item.id} className="text-xs text-blue-700">
                    • {item.catalog_name} {item.serial_number ? `(S/N: ${item.serial_number})` : ""}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ─── ACTIONS ─── */}
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button
              size="sm"
              onClick={handleAssignFromInventory}
              disabled={saving || proc.isUpdating || selectedItems.length === 0}
              className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800"
            >
              <Save className="w-3 h-3 mr-1" /> Assigner ({selectedItems.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => proc.setActiveStep("activation")} className="text-xs h-8 border-gray-300 text-gray-700">
              Continuer →
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* ─── MANUAL FALLBACK ─── */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Saisie manuelle — uniquement si l'article n'est pas dans l'inventaire.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Type</Label>
              <Select value={manualType} onValueChange={setManualType}>
                <SelectTrigger className="h-9 text-sm border-gray-300 text-gray-900"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs text-gray-500">Numéro de série</Label>
              <Input value={manualSerial} onChange={(e) => setManualSerial(e.target.value)} placeholder="S/N…" className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Adresse MAC</Label>
              <Input value={manualMac} onChange={(e) => setManualMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button size="sm" onClick={handleManualAssign} disabled={saving || proc.isUpdating} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
              <Save className="w-3 h-3 mr-1" /> Assigner manuellement
            </Button>
            <Button size="sm" variant="outline" onClick={() => proc.setActiveStep("activation")} className="text-xs h-8 border-gray-300 text-gray-700">
              Continuer →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
