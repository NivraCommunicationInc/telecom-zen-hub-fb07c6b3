/**
 * CoreAppointmentSlotsPage — Admin management of installation slot rules
 * and full-day blackouts. Mounted at /core/appointments/slots.
 *
 * - Weekly grid (Sun→Sat) shows recurring slot rules with capacity.
 * - Add / edit / activate / deactivate rules per weekday.
 * - Manage blocked dates (holidays, ops freezes) with reason.
 *
 * Backed by `appointment_slot_rules` and `appointment_blocked_dates`.
 * Write access is enforced via RLS (admin / supervisor only).
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar as CalendarIcon, Plus, Trash2, Loader2, Power,
  AlertTriangle, RefreshCw, CalendarOff, Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import { SlotOverridesManager } from "@/core-app/components/appointments/SlotOverridesManager";

interface SlotRule {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
  label: string | null;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  created_at: string;
}

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const WEEKDAYS_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const fmtT = (t: string) => t.slice(0, 5);

export default function CoreAppointmentSlotsPage() {
  const { isAdmin } = useIsCoreAdmin();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Partial<SlotRule> | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState<Date | undefined>();
  const [newBlockReason, setNewBlockReason] = useState("");

  const { data: rules = [], isLoading: rulesLoading, refetch: refetchRules } = useQuery<SlotRule[]>({
    queryKey: ["appointment-slot-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_slot_rules")
        .select("*")
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return (data || []) as SlotRule[];
    },
  });

  const { data: blocked = [], refetch: refetchBlocked } = useQuery<BlockedDate[]>({
    queryKey: ["appointment-blocked-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_blocked_dates")
        .select("*")
        .order("blocked_date", { ascending: true });
      if (error) throw error;
      return (data || []) as BlockedDate[];
    },
  });

  const grid = useMemo(() => {
    const g: Record<number, SlotRule[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    rules.forEach((r) => g[r.weekday]?.push(r));
    return g;
  }, [rules]);

  const handleSaveRule = async () => {
    if (!editing) return;
    const { weekday, start_time, end_time, capacity, label } = editing;
    if (weekday === undefined || !start_time || !end_time || !capacity) {
      toast.error("Tous les champs sont obligatoires");
      return;
    }
    if (start_time >= end_time) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    try {
      if (editing.id) {
        const { error } = await supabase
          .from("appointment_slot_rules")
          .update({ weekday, start_time, end_time, capacity, label: label || null })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Règle mise à jour");
      } else {
        const { error } = await supabase
          .from("appointment_slot_rules")
          .insert({ weekday, start_time, end_time, capacity, label: label || null, is_active: true });
        if (error) throw error;
        toast.success("Créneau ajouté");
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["appointment-slot-rules"] });
      qc.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const handleToggleRule = async (rule: SlotRule) => {
    try {
      const { error } = await supabase
        .from("appointment_slot_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["appointment-slot-rules"] });
      qc.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const handleDeleteRule = async (rule: SlotRule) => {
    if (!confirm(`Supprimer le créneau ${fmtT(rule.start_time)}–${fmtT(rule.end_time)} (${WEEKDAYS_FULL[rule.weekday]}) ?`)) return;
    try {
      const { error } = await supabase
        .from("appointment_slot_rules")
        .delete()
        .eq("id", rule.id);
      if (error) throw error;
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["appointment-slot-rules"] });
      qc.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const handleAddBlockedDate = async () => {
    if (!newBlockDate) {
      toast.error("Sélectionnez une date");
      return;
    }
    try {
      const dateStr = format(newBlockDate, "yyyy-MM-dd");
      const { error } = await supabase
        .from("appointment_blocked_dates")
        .insert({ blocked_date: dateStr, reason: newBlockReason || null });
      if (error) throw error;
      toast.success("Date bloquée");
      setBlockOpen(false);
      setNewBlockDate(undefined);
      setNewBlockReason("");
      refetchBlocked();
      qc.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const handleUnblock = async (id: string) => {
    if (!confirm("Débloquer cette date ?")) return;
    try {
      const { error } = await supabase
        .from("appointment_blocked_dates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Débloqué");
      refetchBlocked();
      qc.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-400">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
        <p className="text-sm">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-emerald-400" />
            Créneaux d'installation
          </h1>
          <p className="text-xs text-[hsl(220,10%,50%)]">
            Configuration des plages disponibles par jour de semaine et des dates bloquées
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchRules()}
            className="h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Actualiser
          </Button>
          <Button
            size="sm"
            onClick={() => setEditing({ weekday: 1, start_time: "08:00", end_time: "10:00", capacity: 2 })}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-3 w-3 mr-1" /> Ajouter un créneau
          </Button>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[hsl(220,15%,16%)]">
          {WEEKDAYS.map((d, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider border-r border-[hsl(220,15%,16%)] last:border-r-0",
                i === 0 ? "text-red-400" : "text-slate-300"
              )}
            >
              {d}
              <div className="text-[10px] text-slate-500 normal-case font-normal mt-0.5">
                {grid[i].length} créneau{grid[i].length > 1 ? "x" : ""}
              </div>
            </div>
          ))}
        </div>

        {rulesLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-7 min-h-[300px]">
            {WEEKDAYS.map((_, weekday) => (
              <div
                key={weekday}
                className="border-r border-[hsl(220,15%,16%)] last:border-r-0 p-2 space-y-1.5"
              >
                {grid[weekday].length === 0 ? (
                  <button
                    onClick={() => setEditing({ weekday, start_time: "08:00", end_time: "10:00", capacity: 2 })}
                    className="w-full text-[10px] text-slate-600 hover:text-emerald-400 py-2 rounded border border-dashed border-slate-700/50 hover:border-emerald-700/50 transition"
                  >
                    + Aucun
                  </button>
                ) : (
                  grid[weekday].map((rule) => (
                    <div
                      key={rule.id}
                      className={cn(
                        "rounded border p-1.5 group transition",
                        rule.is_active
                          ? "bg-emerald-950/30 border-emerald-700/40"
                          : "bg-slate-900/50 border-slate-700/40 opacity-60"
                      )}
                    >
                      <div className="text-[11px] font-mono font-semibold text-emerald-300 leading-tight">
                        {fmtT(rule.start_time)}–{fmtT(rule.end_time)}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        Cap. {rule.capacity}
                      </div>
                      <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => setEditing(rule)}
                          className="text-[9px] text-blue-300 hover:text-blue-200 px-1"
                          title="Éditer"
                        >
                          Éditer
                        </button>
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className="text-slate-400 hover:text-amber-300 p-0.5"
                          title={rule.is_active ? "Désactiver" : "Activer"}
                        >
                          <Power className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule)}
                          className="text-slate-400 hover:text-red-400 p-0.5"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocked dates */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CalendarOff className="h-4 w-4 text-red-400" />
              Journées bloquées
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aucune installation possible ces jours (jours fériés, gel opérationnel, etc.)
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setBlockOpen(true)}
            className="h-8 text-xs bg-red-700 hover:bg-red-800 text-white"
          >
            <Plus className="h-3 w-3 mr-1" /> Bloquer une date
          </Button>
        </div>

        {blocked.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Aucune date bloquée.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {blocked.map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between rounded border border-red-900/40 bg-red-950/20 p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-red-200">
                    {format(new Date(b.blocked_date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                  {b.reason && (
                    <p className="text-[11px] text-red-300/80 mt-0.5 truncate">{b.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => handleUnblock(b.id)}
                  className="text-red-400 hover:text-red-200 p-1 shrink-0"
                  title="Débloquer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slot overrides — specific date+time closures / reduced capacity */}
      <SlotOverridesManager />

      {/* Edit rule dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing?.id ? "Modifier le créneau" : "Nouveau créneau"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Jour de la semaine</Label>
                <select
                  value={editing.weekday}
                  onChange={(e) => setEditing({ ...editing, weekday: parseInt(e.target.value, 10) })}
                  className="w-full mt-1 bg-[#0d1421] border border-slate-700 text-slate-100 text-sm rounded-md h-9 px-2"
                >
                  {WEEKDAYS_FULL.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-400">Début</Label>
                  <Input
                    type="time"
                    value={(editing.start_time || "08:00").slice(0, 5)}
                    onChange={(e) => setEditing({ ...editing, start_time: e.target.value + ":00" })}
                    className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Fin</Label>
                  <Input
                    type="time"
                    value={(editing.end_time || "10:00").slice(0, 5)}
                    onChange={(e) => setEditing({ ...editing, end_time: e.target.value + ":00" })}
                    className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Capacité (rendez-vous max simultanés)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={editing.capacity ?? 2}
                  onChange={(e) => setEditing({ ...editing, capacity: parseInt(e.target.value, 10) || 0 })}
                  className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Étiquette (optionnel)</Label>
                <Input
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Matin, Après-midi…"
                  className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="h-9 text-xs">
              Annuler
            </Button>
            <Button onClick={handleSaveRule} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Save className="h-3 w-3 mr-1" /> Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block date dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CalendarOff className="h-4 w-4 text-red-400" /> Bloquer une journée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newBlockDate
                      ? format(newBlockDate, "EEEE d MMMM yyyy", { locale: fr })
                      : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newBlockDate}
                    onSelect={setNewBlockDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    locale={fr}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Raison (optionnel)</Label>
              <Input
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="Jour férié, fermeture, gel opérationnel…"
                className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)} className="h-9 text-xs">
              Annuler
            </Button>
            <Button
              onClick={handleAddBlockedDate}
              className="h-9 text-xs bg-red-700 hover:bg-red-800 text-white"
            >
              <CalendarOff className="h-3 w-3 mr-1" /> Bloquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
