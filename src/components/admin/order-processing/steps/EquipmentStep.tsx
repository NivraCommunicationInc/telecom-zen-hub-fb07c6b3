/**
 * EquipmentStep — Step 6: Assign equipment to the order
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props { proc: any; }

export function EquipmentStep({ proc }: Props) {
  const { order } = proc;
  const [fields, setFields] = useState({
    sim_number: order.sim_number || "",
    sim_type: order.sim_type || "",
    imei_number: order.imei_number || "",
    serial_number: order.serial_number || "",
    equipment_id: order.equipment_id || "",
  });

  const handleSave = async () => {
    const nonEmpty: Record<string, any> = {};
    Object.entries(fields).forEach(([k, v]) => { if (v) nonEmpty[k] = v; });
    if (Object.keys(nonEmpty).length === 0) {
      toast.error("Aucun champ rempli");
      return;
    }
    await proc.assignEquipment(nonEmpty);
  };

  const hasEquipment = order.sim_number || order.imei_number || order.serial_number || order.equipment_id;

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Équipement</h3>

      {hasEquipment && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Équipement déjà assigné
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-emerald-700">
            {order.sim_number && <div>SIM: <span className="font-mono">{order.sim_number}</span></div>}
            {order.sim_type && <div>Type: {order.sim_type}</div>}
            {order.imei_number && <div>IMEI: <span className="font-mono">{order.imei_number}</span></div>}
            {order.serial_number && <div>Série: <span className="font-mono">{order.serial_number}</span></div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-gray-500">Numéro SIM / ICCID</Label>
          <Input value={fields.sim_number} onChange={(e) => setFields({ ...fields, sim_number: e.target.value })} placeholder="89332..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Type SIM</Label>
          <Input value={fields.sim_type} onChange={(e) => setFields({ ...fields, sim_type: e.target.value })} placeholder="nano / eSIM / micro" className="h-9 text-sm border-gray-300 text-gray-900" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">IMEI</Label>
          <Input value={fields.imei_number} onChange={(e) => setFields({ ...fields, imei_number: e.target.value })} placeholder="IMEI..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Numéro de série</Label>
          <Input value={fields.serial_number} onChange={(e) => setFields({ ...fields, serial_number: e.target.value })} placeholder="S/N..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-gray-500">ID Équipement (système)</Label>
          <Input value={fields.equipment_id} onChange={(e) => setFields({ ...fields, equipment_id: e.target.value })} placeholder="UUID ou référence..." className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
        </div>
      </div>

      <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
        <Button size="sm" onClick={handleSave} disabled={proc.isUpdating} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
          <Save className="w-3 h-3 mr-1" /> Assigner l'équipement
        </Button>
        <Button size="sm" variant="outline" onClick={() => proc.setActiveStep("activation")} className="text-xs h-8 border-gray-300 text-gray-700">
          Continuer →
        </Button>
      </div>
    </div>
  );
}
