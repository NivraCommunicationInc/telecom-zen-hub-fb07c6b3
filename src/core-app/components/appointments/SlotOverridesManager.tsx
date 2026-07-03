/**
 * SlotOverridesManager — Manages `appointment_slot_overrides` (Option A).
 * Admin can close or reduce capacity for a specific date + time slot.
 * SmartSlotPicker reads the same table and excludes/reduces the slot publicly.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Ban, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Override {
  id: string;
  override_date: string;
  time_slot: string;
  status: "closed" | "reduced";
  capacity_override: number | null;
  reason: string | null;
  created_at: string;
}

const DEFAULT_SLOTS = ["09h - 12h", "12h - 15h", "15h - 18h", "18h - 20h"];

export function SlotOverridesManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    override_date: format(new Date(), "yyyy-MM-dd"),
    time_slot: DEFAULT_SLOTS[0],
    status: "closed" as "closed" | "reduced",
    capacity_override: 1,
    reason: "",
  });

  const { data: overrides = [], isLoading } = useQuery<Override[]>({
    queryKey: ["appointment-slot-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_slot_overrides")
        .select("*")
        .order("override_date", { ascending: true })
        .order("time_slot", { ascending: true });
      if (error) throw error;
      return (data || []) as Override[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["appointment-slot-overrides"] });
    qc.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
  };

  const handleSave = async () => {
    if (!form.override_date || !form.time_slot) return toast.error("Date et créneau requis");
    setSaving(true);
    try {
      const { error } = await supabase.from("appointment_slot_overrides").upsert({
        override_date: form.override_date,
        time_slot: form.time_slot,
        status: form.status,
        capacity_override: form.status === "reduced" ? Math.max(0, form.capacity_override) : null,
        reason: form.reason || null,
      }, { onConflict: "override_date,time_slot" });
      if (error) throw error;
      toast.success("Exception enregistrée");
      setOpen(false);
      setForm(f => ({ ...f, reason: "" }));
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette exception ?")) return;
    try {
      const { error } = await supabase.from("appointment_slot_overrides").delete().eq("id", id);
      if (error) throw error;
      toast.success("Exception supprimée");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Ban className="h-4 w-4 text-amber-400" />
            Exceptions ponctuelles (date + créneau)
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Fermeture d'un créneau précis ou réduction de capacité — le checkout public n'affiche jamais un créneau fermé.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="h-8 text-xs bg-amber-700 hover:bg-amber-800 text-white">
          <Plus className="h-3 w-3 mr-1" /> Ajouter une exception
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-400" /></div>
      ) : overrides.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">Aucune exception ponctuelle.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {overrides.map(o => (
            <div key={o.id} className="rounded border border-amber-900/40 bg-amber-950/20 p-2.5 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-200">
                  {format(new Date(o.override_date + "T12:00:00"), "EEE d MMM yyyy", { locale: fr })} · {o.time_slot}
                </p>
                <p className="text-[10px] mt-0.5">
                  <span className={o.status === "closed" ? "text-red-300" : "text-amber-300"}>
                    {o.status === "closed" ? "FERMÉ" : `Capacité réduite à ${o.capacity_override}`}
                  </span>
                </p>
                {o.reason && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{o.reason}</p>}
              </div>
              <button onClick={() => handleDelete(o.id)} className="text-slate-400 hover:text-red-400 p-1 shrink-0" title="Supprimer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Nouvelle exception de créneau</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-slate-400">Date</Label>
                <Input type="date" value={form.override_date}
                  onChange={(e) => setForm({ ...form, override_date: e.target.value })}
                  className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Créneau</Label>
                <select value={form.time_slot}
                  onChange={(e) => setForm({ ...form, time_slot: e.target.value })}
                  className="w-full mt-1 bg-[#0d1421] border border-slate-700 text-slate-100 text-sm rounded-md h-9 px-2">
                  {DEFAULT_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Action</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["closed", "reduced"] as const).map(s => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                    className={`px-3 py-2 rounded border text-xs font-medium transition ${
                      form.status === s
                        ? s === "closed" ? "border-red-500 bg-red-900/30 text-red-200" : "border-amber-500 bg-amber-900/30 text-amber-200"
                        : "border-slate-700 bg-slate-900/40 text-slate-400"
                    }`}>
                    {s === "closed" ? "Fermer" : "Réduire capacité"}
                  </button>
                ))}
              </div>
            </div>
            {form.status === "reduced" && (
              <div>
                <Label className="text-xs text-slate-400">Nouvelle capacité</Label>
                <Input type="number" min={0} max={20} value={form.capacity_override}
                  onChange={(e) => setForm({ ...form, capacity_override: parseInt(e.target.value, 10) || 0 })}
                  className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1" />
              </div>
            )}
            <div>
              <Label className="text-xs text-slate-400">Raison (optionnel)</Label>
              <Input value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Technicien indisponible, tempête, formation…"
                className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="h-9 text-xs">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="h-9 text-xs bg-amber-700 hover:bg-amber-800 text-white">
              {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
