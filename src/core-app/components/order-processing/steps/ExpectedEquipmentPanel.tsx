/**
 * ExpectedEquipmentPanel
 * Lists every expected equipment unit from the order (order_items where
 * service_type = 'equipment', expanded by quantity) and gives the agent
 * dedicated S/N + MAC inputs per unit. Saves per row into:
 *   - equipment_inventory (canonical, mirrored to client portal)
 *   - orders.equipment_details (workflow snapshot via proc.assignEquipment)
 *
 * Idempotent: a slot is matched to a prior save by (order_id, slot_index)
 * stored in equipment_details, so re-opening the page rehydrates values.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Package, CheckCircle2, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { proc: any; }

interface ExpectedSlot {
  slot_index: number;
  label: string;
  category: string; // borne_wifi | terminal | sim | other
}

const inputClass = "h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg font-mono";
const labelClass = "text-[10px] uppercase tracking-wider text-slate-500 mb-1 block";

function inferCategory(label: string): string {
  const s = (label || "").toLowerCase();
  if (s.includes("borne") || s.includes("wifi") || s.includes("router") || s.includes("routeur") || s.includes("modem")) return "borne_wifi";
  if (s.includes("terminal") || s.includes("tv") || s.includes("iptv") || s.includes("4k")) return "terminal";
  if (s.includes("sim") || s.includes("esim")) return "sim";
  return "other";
}

export function ExpectedEquipmentPanel({ proc }: Props) {
  const { order } = proc;
  const [values, setValues] = useState<Record<number, { serial: string; mac: string; label: string; category: string; saved: boolean; inventory_id?: string | null }>>({});
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const { data: expected, isLoading } = useQuery({
    queryKey: ["expected-equipment", order.id],
    queryFn: async (): Promise<ExpectedSlot[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select("plan_name, description, quantity, service_type")
        .eq("order_id", order.id);
      if (error) throw error;
      const slots: ExpectedSlot[] = [];
      let idx = 0;
      for (const row of (data || [])) {
        const st = String((row as any).service_type || "").toLowerCase();
        const label = String((row as any).plan_name || (row as any).description || "").trim();
        if (st !== "equipment" && !/borne|terminal|wifi|routeur|router|modem|sim|esim|iptv/i.test(label)) continue;
        const qty = Math.max(1, Number((row as any).quantity) || 1);
        const category = inferCategory(label);
        for (let i = 0; i < qty; i++) {
          slots.push({ slot_index: idx++, label: label || "Équipement", category });
        }
      }
      return slots;
    },
  });

  // Rehydrate saved values from order.equipment_details on load / when expected changes
  useEffect(() => {
    if (!expected) return;
    const existing = Array.isArray(order.equipment_details) ? order.equipment_details : [];
    const next: typeof values = {};
    expected.forEach((slot) => {
      const match = existing.find((d: any) => d?.slot_index === slot.slot_index)
        || existing.find((d: any) => (d?.label || "").toLowerCase() === slot.label.toLowerCase() && d?._used !== true);
      if (match) {
        (match as any)._used = true;
        next[slot.slot_index] = {
          serial: match.serial_number || "",
          mac: match.mac_address || "",
          label: slot.label,
          category: slot.category,
          saved: Boolean(match.serial_number),
          inventory_id: match.inventory_id || null,
        };
      } else {
        next[slot.slot_index] = { serial: "", mac: "", label: slot.label, category: slot.category, saved: false };
      }
    });
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expected?.length, order.id]);

  const totalCount = expected?.length ?? 0;
  const filledCount = useMemo(
    () => Object.values(values).filter((v) => v.saved && v.serial.trim()).length,
    [values]
  );

  const handleSaveRow = async (slot: ExpectedSlot) => {
    const v = values[slot.slot_index];
    if (!v?.serial.trim()) { toast.error("Numéro de série requis"); return; }
    setSavingIdx(slot.slot_index);
    try {
      const sn = v.serial.trim();
      const mac = (v.mac || "").trim();

      // 1) Mirror into equipment_inventory (idempotent by order_id + serial)
      let inventoryId: string | null = v.inventory_id || null;
      const { data: existing } = await supabase
        .from("equipment_inventory")
        .select("id")
        .eq("order_id", order.id)
        .eq("serial_number", sn)
        .maybeSingle();
      if (existing?.id) {
        inventoryId = existing.id;
        await supabase.from("equipment_inventory")
          .update({ mac_address: mac || null, catalog_name: slot.label, category: slot.category, status: "assigned" } as any)
          .eq("id", existing.id);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("equipment_inventory")
          .insert({
            catalog_name: slot.label,
            serial_number: sn,
            mac_address: mac || null,
            category: slot.category,
            status: "assigned",
            condition: "good",
            account_id: order.account_id || null,
            order_id: order.id,
            assigned_at: new Date().toISOString(),
            notes: "Saisie via panneau équipements attendus",
          } as any)
          .select("id")
          .single();
        if (insErr) throw insErr;
        inventoryId = inserted?.id ?? null;
      }

      // 2) Update orders.equipment_details snapshot
      const current: any[] = Array.isArray(order.equipment_details) ? order.equipment_details : [];
      const otherRows = current.filter((d: any) => d?.slot_index !== slot.slot_index);
      const newRow = {
        id: inventoryId || crypto.randomUUID(),
        inventory_id: inventoryId,
        slot_index: slot.slot_index,
        type: slot.category,
        label: slot.label,
        serial_number: sn,
        mac_address: mac,
        imei: "",
        iccid: "",
        esim_ref: "",
        status: "assigned",
        source: "expected_panel",
      };
      const merged = [...otherRows, newRow].sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
      const fields: Record<string, any> = { equipment_details: merged };
      if (slot.category === "borne_wifi") fields.serial_number = sn;
      await proc.assignEquipment(fields);

      setValues((prev) => ({ ...prev, [slot.slot_index]: { ...prev[slot.slot_index], saved: true, inventory_id: inventoryId } }));
      toast.success(`${slot.label} sauvegardé`);
    } catch (err: any) {
      console.error("[ExpectedEquipmentPanel] save failed:", err);
      toast.error(err?.message || "Erreur sauvegarde");
    } finally {
      setSavingIdx(null);
    }
  };

  const handleClearRow = async (slot: ExpectedSlot) => {
    setSavingIdx(slot.slot_index);
    try {
      const v = values[slot.slot_index];
      // Unassign inventory row if any
      if (v?.inventory_id) {
        await supabase.from("equipment_inventory")
          .update({ status: "in_stock", order_id: null, account_id: null, assigned_at: null } as any)
          .eq("id", v.inventory_id);
      }
      const current: any[] = Array.isArray(order.equipment_details) ? order.equipment_details : [];
      const otherRows = current.filter((d: any) => d?.slot_index !== slot.slot_index);
      await proc.assignEquipment({ equipment_details: otherRows });
      setValues((prev) => ({ ...prev, [slot.slot_index]: { serial: "", mac: "", label: slot.label, category: slot.category, saved: false, inventory_id: null } }));
      toast.success("Effacé");
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    } finally {
      setSavingIdx(null);
    }
  };

  if (isLoading) return null;
  if (!totalCount) return null;

  return (
    <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
      <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
        <h4 className="text-[11px] font-medium text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          Équipements de la commande — saisie S/N & MAC
        </h4>
        <span className={cn(
          "text-[10px] font-medium px-2 py-0.5 rounded-full",
          filledCount === totalCount ? "bg-green-900/50 text-green-300" : "bg-amber-900/50 text-amber-300"
        )}>
          {filledCount} / {totalCount} complété
        </span>
      </div>
      <div className="p-4 space-y-3">
        {expected!.map((slot) => {
          const v = values[slot.slot_index] || { serial: "", mac: "", saved: false } as any;
          const isSaving = savingIdx === slot.slot_index;
          return (
            <div
              key={slot.slot_index}
              className={cn(
                "bg-[#0d1421] rounded-lg border p-3",
                v.saved ? "border-green-700/50" : "border-slate-700/50"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500">#{slot.slot_index + 1}</span>
                  <p className="text-sm font-medium text-slate-100">{slot.label}</p>
                  {v.saved && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                </div>
                {v.saved && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleClearRow(slot)}
                    disabled={isSaving}
                    className="text-red-300 hover:text-red-200 hover:bg-red-950/50 h-7 px-2 text-xs"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Effacer
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div>
                  <Label className={labelClass}>Numéro de série <span className="text-red-400">*</span></Label>
                  <Input
                    value={v.serial}
                    onChange={(e) => setValues((prev) => ({ ...prev, [slot.slot_index]: { ...prev[slot.slot_index], serial: e.target.value, saved: false } }))}
                    placeholder="S/N…"
                    className={inputClass}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <Label className={labelClass}>Adresse MAC</Label>
                  <Input
                    value={v.mac}
                    onChange={(e) => setValues((prev) => ({ ...prev, [slot.slot_index]: { ...prev[slot.slot_index], mac: e.target.value, saved: false } }))}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className={inputClass}
                    disabled={isSaving}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSaveRow(slot)}
                  disabled={isSaving || !v.serial.trim() || proc.isUpdating}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white h-9"
                >
                  <Save className="w-3 h-3 mr-1" />
                  {v.saved ? "Mettre à jour" : "Sauvegarder"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
