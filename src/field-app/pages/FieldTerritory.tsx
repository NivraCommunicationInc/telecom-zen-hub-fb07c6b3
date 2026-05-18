/**
 * FieldTerritory — Uses fetchTerritoryStreets, createTerritoryStreet, updateTerritoryStreet, deleteTerritoryStreet from service layer.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTerritoryStreets, createTerritoryStreet, updateTerritoryStreet, deleteTerritoryStreet } from "@/field-app/lib/fieldServices";
import { MapPin, Loader2, Plus, Check, Clock, AlertCircle, Edit3, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type StreetStatus = "todo" | "in_progress" | "completed";
const STATUS_CONFIG: Record<StreetStatus, { label: string; color: string; bg: string; icon: typeof Check }> = {
  completed: { label: "Complète", color: "text-emerald-400", bg: "bg-emerald-500/20", icon: Check },
  in_progress: { label: "En cours", color: "text-amber-300", bg: "bg-amber-500/20", icon: Clock },
  todo: { label: "À faire", color: "text-gray-400", bg: "bg-gray-700", icon: AlertCircle },
};

export default function FieldTerritory() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StreetStatus | "all">("all");
  const [form, setForm] = useState({ street_name: "", city: "Montréal", postal_code: "", total_doors: 0, notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["field-territory-streets", filter],
    queryFn: () => fetchTerritoryStreets({ status: filter !== "all" ? filter : undefined }),
  });

  const streets = data?.streets || [];
  const stats = data?.stats || { totalStreets: 0, completedStreets: 0, totalDoors: 0, totalKnocked: 0, totalSold: 0, progress: 0 };

  const addMutation = useMutation({
    mutationFn: () => createTerritoryStreet(form),
    onSuccess: () => { toast.success("Rue ajoutée !"); setForm({ street_name: "", city: "Montréal", postal_code: "", total_doors: 0, notes: "" }); setShowAdd(false); qc.invalidateQueries({ queryKey: ["field-territory-streets"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, any> }) => updateTerritoryStreet(id, updates),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["field-territory-streets"] }); setEditingId(null); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTerritoryStreet(id),
    onSuccess: () => { toast.success("Rue supprimée"); qc.invalidateQueries({ queryKey: ["field-territory-streets"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Territoire & Rues</h1>
          <p className="text-sm text-gray-400 mt-0.5">{stats.totalStreets} rue{stats.totalStreets !== 1 ? "s" : ""} • {stats.completedStreets} complète{stats.completedStreets !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] transition-all shadow-sm"><Plus className="h-4 w-4" />Ajouter une rue</button>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3"><p className="text-sm font-bold text-white">Progression du territoire</p><p className="text-2xl font-bold text-white">{stats.progress}%</p></div>
        <div className="h-3 rounded-full bg-gray-700 overflow-hidden"><div className="h-full rounded-full bg-[#22C55E] transition-all duration-700" style={{ width: `${stats.progress}%` }} /></div>
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[{ label: "Rues", value: stats.totalStreets, color: "text-white" }, { label: "Portes", value: stats.totalDoors, color: "text-[#3B82F6]" }, { label: "Cognées", value: stats.totalKnocked, color: "text-[#F59E0B]" }, { label: "Vendues", value: stats.totalSold, color: "text-emerald-400" }].map((s) => (
            <div key={s.label} className="text-center"><p className={cn("text-xl font-bold", s.color)}>{s.value}</p><p className="text-[10px] text-gray-500 font-medium">{s.label}</p></div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="bg-gray-800 border-2 border-[#22C55E] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white">Nouvelle rue</h3><button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-white"><X className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.street_name} onChange={(e) => setForm({ ...form, street_name: e.target.value })} placeholder="Nom de la rue *" className="px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ville" className="px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
            <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="Code postal" className="px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
            <input type="number" value={form.total_doors || ""} onChange={(e) => setForm({ ...form, total_doors: parseInt(e.target.value) || 0 })} placeholder="Nombre de portes" className="px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
          <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.street_name.trim()} className="w-full py-2.5 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] disabled:opacity-40 transition-colors">{addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Ajouter la rue"}</button>
        </div>
      )}

      <div className="flex gap-2">
        {(["all", "todo", "in_progress", "completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", filter === f ? "bg-[#22C55E] text-white border-[#22C55E]" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white")}>{f === "all" ? "Toutes" : STATUS_CONFIG[f].label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" /></div>
      ) : streets.length === 0 ? (
        <div className="text-center py-12"><MapPin className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" /><p className="text-sm text-gray-500">Aucune rue dans le territoire</p></div>
      ) : (
        <div className="space-y-2">
          {streets.map((street: any) => {
            const cfg = STATUS_CONFIG[street.status as StreetStatus] || STATUS_CONFIG.todo;
            const Icon = cfg.icon;
            const doorProgress = street.total_doors > 0 ? Math.round((street.doors_knocked / street.total_doors) * 100) : 0;
            const isEditing = editingId === street.id;
            return (
              <div key={street.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}><Icon className="h-3 w-3" /> {cfg.label}</span>
                      <h3 className="text-sm font-bold text-white">{street.street_name}</h3>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{street.city}{street.postal_code ? ` • ${street.postal_code}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {street.status !== "completed" && (
                      <button onClick={() => updateMutation.mutate({ id: street.id, updates: { status: street.status === "todo" ? "in_progress" : "completed" } })} className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors", street.status === "todo" ? "bg-amber-500/20 text-amber-300 hover:bg-[#FDE68A]" : "bg-emerald-500/20 text-emerald-400 hover:bg-[#BBF7D0]")}>{street.status === "todo" ? "Commencer" : "Marquer faite ✓"}</button>
                    )}
                    <button onClick={() => setEditingId(isEditing ? null : street.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700"><Edit3 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[{ label: "Portes", value: street.total_doors, color: "text-gray-300" }, { label: "Cognées", value: street.doors_knocked, color: "text-[#F59E0B]" }, { label: "Réponses", value: street.doors_answered, color: "text-[#3B82F6]" }, { label: "Ventes", value: street.doors_sold, color: "text-emerald-400" }].map((d) => (<div key={d.label}><p className={cn("text-lg font-bold", d.color)}>{d.value}</p><p className="text-[9px] text-gray-500 font-medium">{d.label}</p></div>))}
                </div>
                {street.total_doors > 0 && <div className="mt-2 h-1.5 rounded-full bg-gray-700 overflow-hidden"><div className="h-full rounded-full bg-[#22C55E] transition-all" style={{ width: `${doorProgress}%` }} /></div>}
                {street.notes && <p className="text-[11px] text-gray-400 mt-2 italic">📝 {street.notes}</p>}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-[#F3F4F6] space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[{ key: "total_doors", label: "Portes", val: street.total_doors }, { key: "doors_knocked", label: "Cognées", val: street.doors_knocked }, { key: "doors_answered", label: "Réponses", val: street.doors_answered }, { key: "doors_sold", label: "Ventes", val: street.doors_sold }].map((f) => (
                        <div key={f.key}><label className="text-[9px] text-gray-500 block mb-0.5">{f.label}</label><input type="number" min="0" defaultValue={f.val} onBlur={(e) => updateMutation.mutate({ id: street.id, updates: { [f.key]: parseInt(e.target.value) || 0 } })} className="w-full px-2 py-1.5 rounded-lg border border-gray-700 text-sm text-center" /></div>
                      ))}
                    </div>
                    <textarea defaultValue={street.notes || ""} placeholder="Notes..." onBlur={(e) => updateMutation.mutate({ id: street.id, updates: { notes: e.target.value.trim() || null } })} className="w-full px-3 py-2 rounded-lg border border-gray-700 text-xs" rows={2} />
                    <button onClick={() => { if (confirm("Supprimer cette rue ?")) deleteMutation.mutate(street.id); }} className="text-[10px] text-red-400 hover:underline flex items-center gap-1"><Trash2 className="h-3 w-3" /> Supprimer</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
