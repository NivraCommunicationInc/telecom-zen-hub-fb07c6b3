/**
 * EquipmentStep — Step 6: Assign equipment from inventory
 * Primary flow: select from equipment_inventory stock.
 * Fallback: manual entry for exceptional cases.
 * 
 * LOCKED RULE: Equipment must be selected from inventory, not typed manually.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, CheckCircle2, Package, Search, AlertTriangle, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
}

function getCategoryForOrder(order: any, items: any[]): string[] {
  const svcType = (order?.service_type || "").toLowerCase();
  const itemNames = items.map(i => (i.product_name || i.plan_name || "").toLowerCase()).join(" ");
  const combined = `${svcType} ${itemNames}`;
  const cats: string[] = [];
  if (combined.includes("internet") || combined.includes("fibre") || combined.includes("routeur") || combined.includes("borne") || combined.includes("born")) cats.push("router", "modem", "borne_wifi");
  if (combined.includes("tv") || combined.includes("télé") || combined.includes("iptv") || combined.includes("box")) cats.push("tv_box", "terminal");
  if (combined.includes("mobile") || combined.includes("cellulaire") || combined.includes("sim")) cats.push("sim", "esim");
  if (cats.length === 0) cats.push("router", "sim", "tv_box");
  return cats;
}

export function EquipmentStep({ proc }: Props) {
  const { order, items } = proc;
  const suggestedCategories = getCategoryForOrder(order, items);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualSerial, setManualSerial] = useState("");
  const [manualMac, setManualMac] = useState("");
  const [manualType, setManualType] = useState("router");
  const [saving, setSaving] = useState(false);

  // Load available inventory items (in_stock)
  const { data: inventoryItems, isLoading: inventoryLoading } = useQuery({
    queryKey: ["equipment-inventory-available", selectedCategory, searchTerm],
    queryFn: async () => {
      let q = supabase
        .from("equipment_inventory")
        .select("id, catalog_name, category, serial_number, imei, mac_address, sku, status, condition, warehouse_location, price_client")
        .eq("status", "in_stock")
        .order("catalog_name", { ascending: true })
        .limit(50);

      if (selectedCategory !== "all") {
        q = q.eq("category", selectedCategory);
      }

      if (searchTerm.trim()) {
        q = q.or(`serial_number.ilike.%${searchTerm}%,mac_address.ilike.%${searchTerm}%,catalog_name.ilike.%${searchTerm}%,imei.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
  });

  // Load already assigned items for this order
  const { data: assignedItems } = useQuery({
    queryKey: ["equipment-assigned-order", order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, category, serial_number, imei, mac_address, sku, status, condition, warehouse_location, price_client")
        .eq("order_id", order.id);
      if (error) throw error;
      return (data || []) as InventoryItem[];
    },
  });

  const hasExistingAssignment = (assignedItems?.length ?? 0) > 0 || order.equipment_id || order.serial_number;

  const toggleItem = (item: InventoryItem) => {
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

      // Update each inventory item: assign to order + account
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
          .eq("id", item.id);
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

      // Update order with equipment info
      const firstHw = selectedItems.find(i => ["router", "modem", "borne_wifi", "tv_box", "terminal"].includes(i.category));
      const firstSim = selectedItems.find(i => ["sim", "esim"].includes(i.category));

      const fields: Record<string, any> = {
        equipment_details: equipmentDetails,
        equipment_id: selectedItems[0]?.id,
      };
      if (firstHw?.serial_number) fields.serial_number = firstHw.serial_number;
      if (firstSim?.imei) fields.imei_number = firstSim.imei;

      await proc.assignEquipment(fields);
      setSelectedItems([]);
      toast.success(`${selectedItems.length} équipement(s) assigné(s) depuis l'inventaire`);
    } catch (err: any) {
      console.error("[EquipmentStep] Assign failed:", err);
      toast.error(err?.message || "Erreur lors de l'assignation");
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

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Équipement</h3>

      {hasExistingAssignment && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Équipement déjà assigné
          </p>
          {(assignedItems?.length ?? 0) > 0 && (
            <div className="mt-2 space-y-1">
              {assignedItems!.map(item => (
                <div key={item.id} className="text-xs text-emerald-700 flex items-center gap-2">
                  <Package className="w-3 h-3" />
                  <span className="font-medium">{item.catalog_name}</span>
                  {item.serial_number && <span className="font-mono text-emerald-600">S/N: {item.serial_number}</span>}
                  {item.mac_address && <span className="font-mono text-emerald-600">MAC: {item.mac_address}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={!manualMode ? "default" : "outline"}
          onClick={() => setManualMode(false)}
          className={`text-xs h-8 ${!manualMode ? "bg-gray-900 text-white" : "border-gray-300 text-gray-700"}`}
        >
          <Package className="w-3 h-3 mr-1" /> Depuis l'inventaire
        </Button>
        <Button
          size="sm"
          variant={manualMode ? "default" : "outline"}
          onClick={() => setManualMode(true)}
          className={`text-xs h-8 ${manualMode ? "bg-gray-900 text-white" : "border-gray-300 text-gray-700"}`}
        >
          <Keyboard className="w-3 h-3 mr-1" /> Saisie manuelle (exception)
        </Button>
      </div>

      {!manualMode ? (
        <>
          {/* Search and filter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
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
                <SelectTrigger className="h-9 text-sm border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  <SelectItem value="router">Routeur</SelectItem>
                  <SelectItem value="modem">Modem</SelectItem>
                  <SelectItem value="borne_wifi">Borne WiFi</SelectItem>
                  <SelectItem value="tv_box">Terminal TV</SelectItem>
                  <SelectItem value="sim">Carte SIM</SelectItem>
                  <SelectItem value="esim">eSIM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inventory list */}
          {inventoryLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Chargement de l'inventaire…</p>
          ) : !inventoryItems?.length ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Aucun article en stock disponible.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4 max-h-[300px] overflow-y-auto">
              {inventoryItems.map(item => {
                const isSelected = selectedItems.some(s => s.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                      isSelected ? "bg-emerald-50 border-l-2 border-emerald-500" : "hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.catalog_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.category} · {item.sku || "—"}
                        {item.serial_number && <span className="ml-2 font-mono">S/N: {item.serial_number}</span>}
                        {item.mac_address && <span className="ml-2 font-mono">MAC: {item.mac_address}</span>}
                        {item.imei && <span className="ml-2 font-mono">IMEI: {item.imei}</span>}
                        {item.warehouse_location && <span className="ml-2">📍 {item.warehouse_location}</span>}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {selectedItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800 font-medium">{selectedItems.length} article(s) sélectionné(s)</p>
              <div className="mt-1 space-y-0.5">
                {selectedItems.map(item => (
                  <p key={item.id} className="text-xs text-blue-700">• {item.catalog_name} {item.serial_number ? `(${item.serial_number})` : ""}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button
              size="sm"
              onClick={handleAssignFromInventory}
              disabled={saving || proc.isUpdating || selectedItems.length === 0}
              className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800"
            >
              <Save className="w-3 h-3 mr-1" /> Assigner depuis l'inventaire
            </Button>
            <Button size="sm" variant="outline" onClick={() => proc.setActiveStep("activation")} className="text-xs h-8 border-gray-300 text-gray-700">
              Continuer →
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Manual fallback */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-amber-800">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Saisie manuelle — à utiliser uniquement si l'article n'est pas dans l'inventaire.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
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
