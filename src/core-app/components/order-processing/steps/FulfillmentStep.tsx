/**
 * FulfillmentStep — Step 5: Choose fulfillment routing + dynamic detail forms
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Wrench, Download, Wifi, CheckCircle2, Save, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { proc: any; }

const FULFILLMENT_OPTIONS = [
  { value: "shipping", label: "Expédition / Livraison", icon: Truck, desc: "Envoi par transporteur" },
  { value: "technician", label: "Installation technicien", icon: Wrench, desc: "Technicien sur place" },
  { value: "self_install", label: "Auto-installation", icon: Download, desc: "Client installe lui-même" },
  { value: "digital", label: "Numérique seulement", icon: Wifi, desc: "Activation à distance" },
];

const CARRIERS = ["Purolator", "Postes Canada", "UPS", "FedEx", "Canpar", "Autre"];
const TIME_WINDOWS = ["08:00–10:00", "10:00–12:00", "12:00–14:00", "14:00–16:00", "16:00–18:00"];

const inputClass = "h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg";
const labelClass = "text-[10px] uppercase tracking-wider text-slate-500 mb-1 block";

function ShippingForm({ order, onSave, isUpdating }: { order: any; onSave: (f: Record<string, any>) => void; isUpdating: boolean }) {
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");
  const [trackingUrl, setTrackingUrl] = useState(order.tracking_url || "");
  const [shippedAt, setShippedAt] = useState(order.shipped_at?.slice(0, 10) || "");

  const equipDetails = order.equipment_details;
  const equipSummary = equipDetails ? (typeof equipDetails === "string" ? equipDetails : JSON.stringify(equipDetails)) : "—";

  const handleSave = () => {
    onSave({
      carrier,
      tracking_number: trackingNumber || null,
      tracking_url: trackingUrl || null,
      shipped_at: shippedAt ? new Date(shippedAt).toISOString() : null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className={labelClass}>Transporteur</Label>
          <Select value={carrier} onValueChange={setCarrier}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>{CARRIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className={labelClass}>Date d'expédition</Label>
          <Input type="date" value={shippedAt} onChange={e => setShippedAt(e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>Nº de suivi</Label>
          <Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="EX123456789CA" className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>URL de suivi</Label>
          <div className="flex gap-1.5">
            <Input value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="https://…" className={inputClass} />
            {trackingUrl && (
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center justify-center h-9 w-9 rounded-md border border-slate-700 hover:bg-slate-800">
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#0d1421] rounded-lg p-3 border border-slate-700/50">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Équipement expédié</p>
        <p className="text-sm text-slate-100">{equipSummary}</p>
      </div>

      <Button size="sm" onClick={handleSave} disabled={isUpdating} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
        <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer expédition
      </Button>
    </div>
  );
}

function TechnicianForm({ order, onSave, isUpdating }: { order: any; onSave: (f: Record<string, any>) => void; isUpdating: boolean }) {
  const [techId, setTechId] = useState(order.technician_id || "");
  const [installDate, setInstallDate] = useState(order.appointment_date?.slice(0, 10) || "");
  const [timeWindow, setTimeWindow] = useState("");
  const [notes, setNotes] = useState(order.appointment_notes || "");

  useEffect(() => {
    try {
      const parsed = JSON.parse(order.fulfillment_notes || "{}");
      if (parsed.time_window) setTimeWindow(parsed.time_window);
    } catch { /* ignore */ }
  }, [order.fulfillment_notes]);

  const handleSave = () => {
    const fulfillmentMeta = JSON.stringify({ time_window: timeWindow });
    onSave({
      technician_id: techId || null,
      appointment_date: installDate ? new Date(installDate).toISOString() : null,
      appointment_notes: notes || null,
      fulfillment_notes: fulfillmentMeta,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className={labelClass}>ID Technicien</Label>
          <Input value={techId} onChange={e => setTechId(e.target.value)} placeholder="tech-001" className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>Date d'installation</Label>
          <Input type="date" value={installDate} onChange={e => setInstallDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label className={labelClass}>Fenêtre horaire</Label>
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>{TIME_WINDOWS.map(tw => <SelectItem key={tw} value={tw}>{tw}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className={labelClass}>Notes technicien</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="flex w-full rounded-lg bg-[#0d1421] border border-slate-700 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Instructions spéciales, accès au bâtiment…" />
      </div>
      <Button size="sm" onClick={handleSave} disabled={isUpdating} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
        <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer installation
      </Button>
    </div>
  );
}

function SelfInstallForm({ order, onSave, isUpdating }: { order: any; onSave: (f: Record<string, any>) => void; isUpdating: boolean }) {
  const [equipShipped, setEquipShipped] = useState(false);
  const [sendInstructions, setSendInstructions] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(order.fulfillment_notes || "{}");
      if (parsed.equipment_shipped) setEquipShipped(true);
      if (parsed.instructions_sent) setSendInstructions(true);
    } catch { /* ignore */ }
  }, [order.fulfillment_notes]);

  const handleSave = () => {
    onSave({
      fulfillment_notes: JSON.stringify({
        equipment_shipped: equipShipped, instructions_sent: sendInstructions, updated_at: new Date().toISOString(),
      }),
      ...(equipShipped && !order.shipped_at ? { shipped_at: new Date().toISOString() } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1421] border border-slate-700 cursor-pointer hover:bg-slate-800/50">
        <input type="checkbox" checked={equipShipped} onChange={e => setEquipShipped(e.target.checked)} className="h-4 w-4 rounded" />
        <div>
          <p className="text-sm font-medium text-slate-100">Équipement expédié au client</p>
          <p className="text-xs text-slate-400">Confirmer que le matériel a été envoyé</p>
        </div>
      </label>
      <label className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1421] border border-slate-700 cursor-pointer hover:bg-slate-800/50">
        <input type="checkbox" checked={sendInstructions} onChange={e => setSendInstructions(e.target.checked)} className="h-4 w-4 rounded" />
        <div>
          <p className="text-sm font-medium text-slate-100">Envoyer instructions d'installation</p>
          <p className="text-xs text-slate-400">Le client recevra un courriel avec le guide</p>
        </div>
      </label>
      <Button size="sm" onClick={handleSave} disabled={isUpdating} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
        <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer
      </Button>
    </div>
  );
}

function DigitalForm({ order, onSave, isUpdating }: { order: any; onSave: (f: Record<string, any>) => void; isUpdating: boolean }) {
  const [activationDate, setActivationDate] = useState("");
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(order.fulfillment_notes || "{}");
      if (parsed.activation_date) setActivationDate(parsed.activation_date);
      if (parsed.activated) setActivated(true);
    } catch { /* ignore */ }
  }, [order.fulfillment_notes]);

  const handleSave = () => {
    onSave({
      fulfillment_notes: JSON.stringify({
        activation_date: activationDate, activated, updated_at: new Date().toISOString(),
      }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className={labelClass}>Date d'activation</Label>
          <Input type="date" value={activationDate} onChange={e => setActivationDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <label className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1421] border border-slate-700 cursor-pointer hover:bg-slate-800/50">
        <input type="checkbox" checked={activated} onChange={e => setActivated(e.target.checked)} className="h-4 w-4 rounded" />
        <div>
          <p className="text-sm font-medium text-slate-100">Activation confirmée</p>
          <p className="text-xs text-slate-400">Le service est actif à distance</p>
        </div>
      </label>
      <Button size="sm" onClick={handleSave} disabled={isUpdating} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
        <Save className="h-3.5 w-3.5 mr-1" /> Enregistrer activation
      </Button>
    </div>
  );
}

export function FulfillmentStep({ proc }: Props) {
  const { order } = proc;
  const current = order.fulfillment_type;

  const handleSelect = async (type: string) => { await proc.setFulfillmentType(type); };
  const handleSaveDetails = async (fields: Record<string, any>) => { await proc.updateFulfillmentDetails(fields); };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Fulfillment / Routing</div>
      <p className="text-sm text-slate-400 mb-4">Sélectionnez le mode de livraison et renseignez les détails opérationnels.</p>

      {/* 2x2 mode cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {FULFILLMENT_OPTIONS.map((opt) => {
          const isSelected = current === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={proc.isUpdating}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all bg-[#111827]",
                isSelected ? "border-blue-500 bg-blue-950/30" : "border-slate-700/50 hover:border-slate-600"
              )}
            >
              <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", isSelected ? "text-blue-300" : "text-slate-500")} />
              <div className="flex-1">
                <p className={cn("text-sm font-medium", isSelected ? "text-slate-100" : "text-slate-300")}>{opt.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
              </div>
              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-300 mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Zone & SLA selects placeholder area: dynamic detail form */}
      {current && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Détails — {FULFILLMENT_OPTIONS.find(o => o.value === current)?.label}
            </h4>
          </div>
          <div className="p-4">
            {current === "shipping" && <ShippingForm order={order} onSave={handleSaveDetails} isUpdating={proc.isUpdating} />}
            {current === "technician" && <TechnicianForm order={order} onSave={handleSaveDetails} isUpdating={proc.isUpdating} />}
            {current === "self_install" && <SelfInstallForm order={order} onSave={handleSaveDetails} isUpdating={proc.isUpdating} />}
            {current === "digital" && <DigitalForm order={order} onSave={handleSaveDetails} isUpdating={proc.isUpdating} />}
          </div>
        </div>
      )}

      {current && (
        <div className="bg-green-950/50 border border-green-700/50 text-green-300 rounded-lg px-3 py-2 text-sm mb-4">
          <CheckCircle2 className="w-4 h-4 inline mr-1" />
          Mode sélectionné: <span className="font-semibold">{FULFILLMENT_OPTIONS.find(o => o.value === current)?.label || current}</span>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-slate-700/50">
        <Button size="sm" onClick={() => proc.setActiveStep("equipment")} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
          Continuer →
        </Button>
      </div>
    </div>
  );
}
