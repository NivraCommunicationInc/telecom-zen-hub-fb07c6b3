/**
 * EquipmentStep — Step 6: Assign equipment to the order
 * Dynamically adapts fields based on ordered service type and items.
 * Includes an inline stock picker (equipment_inventory in_stock rows).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { EquipmentStockPicker, type StockItem, type StockUnitType } from "../EquipmentStockPicker";

interface Props { proc: any; }

type EquipmentType = "sim" | "esim" | "router" | "modem" | "borne_wifi" | "tv_box" | "device" | "other";

interface EquipmentUnit {
  id: string;
  type: EquipmentType;
  label: string;
  serial_number: string;
  mac_address: string;
  iccid: string;
  imei: string;
  esim_ref: string;
  status: string;
}

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  sim: "Carte SIM physique",
  esim: "eSIM",
  router: "Routeur WiFi",
  modem: "Modem",
  borne_wifi: "Borne WiFi",
  tv_box: "Terminal TV / Box",
  device: "Appareil mobile",
  other: "Autre",
};

function detectItemType(name: string, category: string): EquipmentType | null {
  const n = (name + " " + category).toLowerCase();
  if (n.includes("esim")) return "esim";
  if (n.includes("sim")) return "sim";
  if (n.includes("borne") || n.includes("born_wifi") || n.includes("borne_wifi")) return "borne_wifi";
  if (n.includes("routeur") || n.includes("router") || n.includes("modem")) return "router";
  if (n.includes("tv") || n.includes("box") || n.includes("terminal") || n.includes("télé") || n.includes("iptv")) return "tv_box";
  if (n.includes("mobile") || n.includes("cellulaire") || n.includes("device")) return "device";
  return null;
}

function getEquipmentTypesForOrder(order: any, items: any[]): EquipmentType[] {
  const serviceType = (order?.service_type || "").toLowerCase();

  // 1) Priority: checkout snapshot in order.equipment_details.line_items
  //    (contains equipment lines with name + qty as they were sold)
  const snapshot = order?.equipment_details;
  const snapshotLines: any[] =
    snapshot && !Array.isArray(snapshot) && Array.isArray(snapshot.line_items)
      ? snapshot.line_items
      : [];

  const fromSnapshot: EquipmentType[] = [];
  for (const line of snapshotLines) {
    const cat = String(line?.category || "").toLowerCase();
    const type = String(line?.type || "").toLowerCase();
    if (cat !== "equipment" && type !== "equipment") continue;
    const name = String(line?.name || "");
    const qty = Math.max(1, Number(line?.qty || line?.quantity || 1));
    const detected = detectItemType(name, cat);
    if (detected) {
      for (let i = 0; i < qty; i++) fromSnapshot.push(detected);
    }
  }
  if (fromSnapshot.length > 0) return fromSnapshot;

  // 2) Build list from order_items with quantities
  const fromItems: EquipmentType[] = [];
  for (const item of items) {
    const name = item.product_name || item.plan_name || item.item_name || "";
    const cat = item.category || item.item_category || item.service_type || "";
    const qty = Math.max(1, Number(item.quantity || item.qty || 1));
    const detected = detectItemType(name, cat);
    if (detected) {
      for (let i = 0; i < qty; i++) fromItems.push(detected);
    }
  }
  if (fromItems.length > 0) return fromItems;

  // 3) Fallback: infer from service_type string + item plan names
  //    Business rules (canonical):
  //      Internet plan → 1× Borne WiFi
  //      TV plan       → 1× Borne WiFi + 1× Terminal TV (per TV plan)
  //      Mobile plan   → 1× SIM (or eSIM)
  const combined = serviceType + " " + items.map(i => String(i.plan_name || i.product_name || "").toLowerCase()).join(" ");
  const snapshotServiceNames = snapshotLines
    .filter((l) => {
      const c = String(l?.category || "").toLowerCase();
      const t = String(l?.type || "").toLowerCase();
      return c === "service" || ["internet", "tv", "mobile"].includes(t);
    })
    .map((l) => `${String(l?.type || "")} ${String(l?.name || "")}`.toLowerCase())
    .join(" ");
  const haystack = (combined + " " + snapshotServiceNames).toLowerCase();

  const hasInternet = /internet|fibre|giga|mbps/.test(haystack);
  const hasTv = /\btv\b|iptv|télé|tele|terminal|chaîne|chaine/.test(haystack);
  const hasMobile = /mobile|cellulaire|forfait\s*mobile|\bsim\b|esim/.test(haystack);

  const types: EquipmentType[] = [];
  // Internet OR TV both require the Borne WiFi Nivra
  if (hasInternet || hasTv) types.push("borne_wifi");
  if (hasTv) {
    // Count TV plans if present in snapshot, otherwise assume 1
    const tvCount = snapshotLines.filter((l) => String(l?.type || "").toLowerCase() === "tv").length || 1;
    for (let i = 0; i < tvCount; i++) types.push("tv_box");
  }
  if (hasMobile) types.push(/esim/.test(haystack) ? "esim" : "sim");

  if (types.length === 0) {
    if (serviceType.includes("internet")) types.push("borne_wifi");
    else if (serviceType.includes("mobile")) types.push("sim");
    else if (serviceType.includes("tv")) { types.push("borne_wifi"); types.push("tv_box"); }
    else types.push("other");
  }

  return types;
}

function createEmptyUnit(type: EquipmentType): EquipmentUnit {
  return {
    id: crypto.randomUUID(),
    type,
    label: EQUIPMENT_LABELS[type],
    serial_number: "",
    mac_address: "",
    iccid: "",
    imei: "",
    esim_ref: "",
    status: "assigned",
  };
}

function isMobileType(type: EquipmentType): boolean {
  return type === "sim" || type === "esim" || type === "device";
}

function isNetworkType(type: EquipmentType): boolean {
  return type === "router" || type === "modem" || type === "borne_wifi" || type === "tv_box";
}

export function EquipmentStep({ proc }: Props) {
  const { order, items } = proc;
  const queryClient = useQueryClient();
  const suggestedTypes = getEquipmentTypesForOrder(order, items);

  // Initialize units from existing equipment data
  const initialUnits: EquipmentUnit[] = [];
  if (order.equipment_details && Array.isArray(order.equipment_details)) {
    for (const eq of order.equipment_details) {
      initialUnits.push({
        id: eq.id || crypto.randomUUID(),
        type: eq.type || "other",
        label: eq.label || EQUIPMENT_LABELS[eq.type as EquipmentType] || "Équipement",
        serial_number: eq.serial_number || "",
        mac_address: eq.mac_address || "",
        iccid: eq.iccid || "",
        imei: eq.imei || "",
        esim_ref: eq.esim_ref || "",
        status: eq.status || "assigned",
      });
    }
  }

  if (initialUnits.length === 0) {
    // Pre-populate from order fields if equipment_details is empty
    if (order.sim_number || order.imei_number) {
      initialUnits.push({
        id: crypto.randomUUID(),
        type: "sim",
        label: "Carte SIM",
        serial_number: "",
        mac_address: "",
        iccid: order.sim_number || "",
        imei: order.imei_number || "",
        esim_ref: "",
        status: "assigned",
      });
    }
    if (order.serial_number) {
      initialUnits.push({
        id: crypto.randomUUID(),
        type: suggestedTypes.find(t => isNetworkType(t)) || "router",
        label: EQUIPMENT_LABELS[suggestedTypes.find(t => isNetworkType(t)) || "router"],
        serial_number: order.serial_number || "",
        mac_address: "",
        iccid: "",
        imei: "",
        esim_ref: "",
        status: "assigned",
      });
    }
    // If still empty, create one unit per suggested type (respects quantities from order items)
    if (initialUnits.length === 0) {
      const typeCounts = new Map<EquipmentType, number>();
      const typeTotals = new Map<EquipmentType, number>();
      for (const t of suggestedTypes) typeTotals.set(t, (typeTotals.get(t) || 0) + 1);
      for (const t of suggestedTypes) {
        const idx = (typeCounts.get(t) || 0) + 1;
        typeCounts.set(t, idx);
        const total = typeTotals.get(t) || 1;
        const unit = createEmptyUnit(t);
        if (total > 1) unit.label = `${EQUIPMENT_LABELS[t]} #${idx}`;
        initialUnits.push(unit);
      }
    }
  }

  const [units, setUnits] = useState<EquipmentUnit[]>(initialUnits);

  const addUnit = (type: EquipmentType) => {
    setUnits([...units, createEmptyUnit(type)]);
  };

  const removeUnit = (id: string) => {
    setUnits(units.filter(u => u.id !== id));
  };

  const updateUnit = (id: string, field: keyof EquipmentUnit, value: string) => {
    setUnits(units.map(u => u.id === id ? { ...u, [field]: value } : u));
  };

  const unitTypeToStockType = (t: string): StockUnitType => {
    if (t === "sim") return "sim";
    if (t === "esim") return "esim";
    if (t === "router" || t === "modem") return "router";
    if (t === "borne_wifi") return "borne_wifi";
    if (t === "tv_box") return "tv_box";
    if (t === "device") return "device";
    return "other";
  };

  const assignFromStock = async (unitId: string, item: StockItem) => {
    // Reserve the inventory row for this order (best-effort; ignore if RLS blocks it)
    try {
      const { error } = await supabase
        .from("equipment_inventory")
        .update({
          status: "reserved",
          order_id: order.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("status", "in_stock");
      if (error) {
        console.warn("[EquipmentStep] Reserve stock failed:", error.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["equipment-stock-in_stock"] });
      }
    } catch (e: any) {
      console.warn("[EquipmentStep] Reserve stock exception:", e?.message);
    }

    setUnits((prev) => prev.map((u) => {
      if (u.id !== unitId) return u;
      return {
        ...u,
        serial_number: item.serial_number || u.serial_number,
        mac_address: item.mac_address || u.mac_address,
        iccid: (u.type === "sim" || u.type === "esim") ? (item.imei ? u.iccid : (item.serial_number && item.serial_number.startsWith("89") ? item.serial_number : u.iccid)) : u.iccid,
        imei: item.imei || u.imei,
        status: "assigned",
      };
    }));

    toast.success(`Équipement ${item.catalog_name || item.sku || ""} pré-rempli`);
  };

  // ── Serial uniqueness validation (intra-order) ──
  function validateSerialUniqueness(): string | null {
    // Collect all non-empty identifiers that must be unique
    const serials: { value: string; unitLabel: string; field: string }[] = [];
    for (const u of units) {
      if (u.serial_number.trim()) {
        serials.push({ value: u.serial_number.trim(), unitLabel: u.label, field: "Numéro de série" });
      }
      if (u.iccid.trim()) {
        serials.push({ value: u.iccid.trim(), unitLabel: u.label, field: "ICCID" });
      }
      if (u.imei.trim()) {
        serials.push({ value: u.imei.trim(), unitLabel: u.label, field: "IMEI" });
      }
      if (u.mac_address.trim()) {
        serials.push({ value: u.mac_address.trim().toUpperCase(), unitLabel: u.label, field: "MAC" });
      }
    }

    // Check for duplicates within this order
    const seen = new Map<string, string>();
    for (const s of serials) {
      const key = `${s.field}:${s.value}`;
      if (seen.has(key)) {
        return `Doublon détecté : ${s.field} "${s.value}" est utilisé par "${seen.get(key)}" et "${s.unitLabel}". Chaque équipement doit avoir un identifiant unique.`;
      }
      seen.set(key, s.unitLabel);
    }
    return null;
  }

  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = async () => {
    // Client-side uniqueness check (intra-order)
    const dupError = validateSerialUniqueness();
    if (dupError) {
      setValidationError(dupError);
      toast.error(dupError);
      return;
    }
    setValidationError(null);
    setSaving(true);

    try {
      // Save equipment_details as JSON array
      const equipmentDetails = units.map(u => ({
        id: u.id,
        type: u.type,
        label: u.label,
        serial_number: u.serial_number,
        mac_address: u.mac_address,
        iccid: u.iccid,
        imei: u.imei,
        esim_ref: u.esim_ref,
        status: u.status,
      }));

      // Also update legacy flat fields from the first relevant unit
      const simUnit = units.find(u => isMobileType(u.type));
      const hwUnit = units.find(u => isNetworkType(u.type));

      const fields: Record<string, any> = {
        equipment_details: equipmentDetails,
      };

      if (simUnit) {
        if (simUnit.iccid) fields.sim_number = simUnit.iccid;
        if (simUnit.imei) fields.imei_number = simUnit.imei;
      }
      if (hwUnit) {
        if (hwUnit.serial_number) fields.serial_number = hwUnit.serial_number;
      }
      if (units.length > 0 && !fields.equipment_id) {
        fields.equipment_id = units[0].type.toUpperCase();
      }

      await proc.assignEquipment(fields);
    } catch (err: any) {
      // Catch DB-level uniqueness violations
      if (err?.message?.includes("equipment_serial_unique") || err?.code === "23505") {
        const msg = "Ce numéro de série est déjà assigné à une autre commande.";
        setValidationError(msg);
        toast.error(msg);
      } else {
        throw err;
      }
    } finally {
      setSaving(false);
    }
  };

  const hasExisting = order.sim_number || order.imei_number || order.serial_number || order.equipment_id;

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Équipement</h3>

      {hasExisting && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Équipement déjà assigné
          </p>
        </div>
      )}

      {/* Equipment units */}
      <div className="space-y-4 mb-4">
        {units.map((unit, idx) => (
          <div key={unit.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                {unit.label} {units.filter(u => u.type === unit.type).length > 1 ? `#${idx + 1}` : ""}
              </h4>
              {units.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => removeUnit(unit.id)} className="text-xs h-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Type selector */}
              <div>
                <Label className="text-xs text-gray-500">Type d'équipement</Label>
                <Select value={unit.type} onValueChange={(v) => {
                  updateUnit(unit.id, "type", v);
                  updateUnit(unit.id, "label", EQUIPMENT_LABELS[v as EquipmentType] || v);
                }}>
                  <SelectTrigger className="h-9 text-sm border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EQUIPMENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <Label className="text-xs text-gray-500">Statut</Label>
                <Select value={unit.status} onValueChange={(v) => updateUnit(unit.id, "status", v)}>
                  <SelectTrigger className="h-9 text-sm border-gray-300 text-gray-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigné</SelectItem>
                    <SelectItem value="shipped">Expédié</SelectItem>
                    <SelectItem value="delivered">Livré</SelectItem>
                    <SelectItem value="activated">Activé</SelectItem>
                    <SelectItem value="returned">Retourné</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional fields based on equipment type */}
              {isMobileType(unit.type) && (
                <>
                  <div>
                    <Label className="text-xs text-gray-500">ICCID / Numéro SIM</Label>
                    <Input value={unit.iccid} onChange={(e) => updateUnit(unit.id, "iccid", e.target.value)} placeholder="89332..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">IMEI</Label>
                    <Input value={unit.imei} onChange={(e) => updateUnit(unit.id, "imei", e.target.value)} placeholder="IMEI..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
                  </div>
                  {unit.type === "esim" && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-gray-500">Référence eSIM</Label>
                      <Input value={unit.esim_ref} onChange={(e) => updateUnit(unit.id, "esim_ref", e.target.value)} placeholder="Référence eSIM…" className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
                    </div>
                  )}
                </>
              )}

              {isNetworkType(unit.type) && (
                <>
                  <div>
                    <Label className="text-xs text-gray-500">Numéro de série</Label>
                    <Input value={unit.serial_number} onChange={(e) => updateUnit(unit.id, "serial_number", e.target.value)} placeholder="S/N..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Adresse MAC</Label>
                    <Input value={unit.mac_address} onChange={(e) => updateUnit(unit.id, "mac_address", e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
                  </div>
                </>
              )}

              {unit.type === "other" && (
                <>
                  <div>
                    <Label className="text-xs text-gray-500">Numéro de série</Label>
                    <Input value={unit.serial_number} onChange={(e) => updateUnit(unit.id, "serial_number", e.target.value)} placeholder="S/N..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
                  </div>
                </>
              )}
            </div>

            {/* Inline stock picker */}
            <EquipmentStockPicker
              unitType={unitTypeToStockType(unit.type)}
              onSelect={(item) => assignFromStock(unit.id, item)}
            />
          </div>
        ))}
      </div>

      {/* Add equipment button */}
      <div className="flex flex-wrap gap-2 mb-6">
        {suggestedTypes.map(t => (
          <Button key={t} size="sm" variant="outline" onClick={() => addUnit(t)} className="text-xs h-8 border-gray-300 text-gray-700">
            <Plus className="w-3 h-3 mr-1" /> {EQUIPMENT_LABELS[t]}
          </Button>
        ))}
        {!suggestedTypes.includes("other") && (
          <Button size="sm" variant="outline" onClick={() => addUnit("other")} className="text-xs h-8 border-gray-300 text-gray-700">
            <Plus className="w-3 h-3 mr-1" /> Autre
          </Button>
        )}
      </div>

      {/* Validation error banner */}
      {validationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700 font-medium">⚠ {validationError}</p>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <Button size="sm" onClick={handleSave} disabled={saving || proc.isUpdating} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
          <Save className="w-3 h-3 mr-1" /> Assigner l'équipement
        </Button>
        <Button size="sm" variant="outline" onClick={() => proc.setActiveStep("activation")} className="text-xs h-8 border-gray-300 text-gray-700">
          Continuer →
        </Button>
      </div>
    </div>
  );
}
