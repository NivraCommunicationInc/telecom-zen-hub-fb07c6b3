/**
 * FieldTerritory — Territory & Street management for door-to-door canvassing.
 * Street-by-street tracking with door counts, progress, notes, and completion status.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  MapPin, Loader2, Plus, Check, Clock, AlertCircle,
  ChevronRight, DoorOpen, Edit3, Trash2, X, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type StreetStatus = "todo" | "in_progress" | "completed";

const STATUS_CONFIG: Record<StreetStatus, { label: string; color: string; bg: string; icon: typeof Check }> = {
  completed: { label: "Complète", color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", icon: Check },
  in_progress: { label: "En cours", color: "text-[#D97706]", bg: "bg-[#FEF3C7]", icon: Clock },
  todo: { label: "À faire", color: "text-[#6B7280]", bg: "bg-[#F3F4F6]", icon: AlertCircle },
};

interface Street {
  id: string;
  street_name: string;
  city: string;
  postal_code: string | null;
  status: StreetStatus;
  total_doors: number;
  doors_knocked: number;
  doors_answered: number;
  doors_sold: number;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function FieldTerritory() {
  const { user } = useStaffUser();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StreetStatus | "all">("all");

  // Form state
  const [form, setForm] = useState({ street_name: "", city: "Montréal", postal_code: "", total_doors: 0, notes: "" });

  const { data: streets = [], isLoading } = useQuery({
    queryKey: ["field-territory", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_territory_streets")
        .select("*")
        .eq("agent_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Street[];
    },
    enabled: !!user?.id,
  });

  const addStreet = useMutation({
    mutationFn: async () => {
      if (!form.street_name.trim()) throw new Error("Nom de rue requis");
      const { error } = await supabase.from("field_territory_streets").insert({
        agent_id: user!.id,
        street_name: form.street_name.trim(),
        city: form.city.trim() || "Montréal",
        postal_code: form.postal_code.trim() || null,
        total_doors: form.total_doors || 0,
        notes: form.notes.trim() || null,
        status: "todo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rue ajoutée !");
      setForm({ street_name: "", city: "Montréal", postal_code: "", total_doors: 0, notes: "" });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["field-territory"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStreet = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Street> }) => {
      const finalUpdates: any = { ...updates, updated_at: new Date().toISOString() };
      if (updates.status === "completed") finalUpdates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("field_territory_streets").update(finalUpdates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field-territory"] });
      setEditingId(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteStreet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("field_territory_streets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rue supprimée");
      qc.invalidateQueries({ queryKey: ["field-territory"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = filter === "all" ? streets : streets.filter((s) => s.status === filter);

  // Stats
  const totalStreets = streets.length;
  const completedStreets = streets.filter((s) => s.status === "completed").length;
  const totalDoors = streets.reduce((s, st) => s + (st.total_doors || 0), 0);
  const totalKnocked = streets.reduce((s, st) => s + (st.doors_knocked || 0), 0);
  const totalSold = streets.reduce((s, st) => s + (st.doors_sold || 0), 0);
  const progress = totalStreets > 0 ? Math.round((completedStreets / totalStreets) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Territoire & Rues</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{totalStreets} rue{totalStreets !== 1 ? "s" : ""} • {completedStreets} complète{completedStreets !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] transition-all shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Ajouter une rue
        </button>
      </div>

      {/* Progress Overview */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-[#000000]">Progression du territoire</p>
          <p className="text-2xl font-bold text-[#000000]">{progress}%</p>
        </div>
        <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden mb-3">
          <div className="h-full rounded-full bg-[#22C55E] transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Rues", value: totalStreets, color: "text-[#000000]" },
            { label: "Portes", value: totalDoors, color: "text-[#3B82F6]" },
            { label: "Cognées", value: totalKnocked, color: "text-[#F59E0B]" },
            { label: "Vendues", value: totalSold, color: "text-[#22C55E]" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
              <p className="text-[10px] text-[#9CA3AF] font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Street Form */}
      {showAdd && (
        <div className="bg-white border-2 border-[#22C55E] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#000000]">Nouvelle rue</h3>
            <button onClick={() => setShowAdd(false)} className="text-[#6B7280] hover:text-[#000000]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.street_name} onChange={(e) => setForm({ ...form, street_name: e.target.value })} placeholder="Nom de la rue *" className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ville" className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
            <input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="Code postal" className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
            <input type="number" value={form.total_doors || ""} onChange={(e) => setForm({ ...form, total_doors: parseInt(e.target.value) || 0 })} placeholder="Nombre de portes" className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..." rows={2} className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30" />
          <button onClick={() => addStreet.mutate()} disabled={addStreet.isPending || !form.street_name.trim()} className="w-full py-2.5 rounded-xl bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] disabled:opacity-40 transition-colors">
            {addStreet.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Ajouter la rue"}
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "todo", "in_progress", "completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn(
            "text-xs px-3 py-1.5 rounded-lg border transition-colors",
            filter === f ? "bg-[#22C55E] text-white border-[#22C55E]" : "bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#000000]"
          )}>
            {f === "all" ? "Toutes" : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      {/* Street List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
          <p className="text-sm text-[#9CA3AF]">Aucune rue dans le territoire</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((street) => {
            const cfg = STATUS_CONFIG[street.status];
            const Icon = cfg.icon;
            const doorProgress = street.total_doors > 0 ? Math.round((street.doors_knocked / street.total_doors) * 100) : 0;
            const isEditing = editingId === street.id;

            return (
              <div key={street.id} className="bg-white border border-[#E5E7EB] rounded-2xl p-4 hover:border-[#D1D5DB] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full", cfg.bg, cfg.color)}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </span>
                      <h3 className="text-sm font-bold text-[#000000]">{street.street_name}</h3>
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{street.city}{street.postal_code ? ` • ${street.postal_code}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {street.status !== "completed" && (
                      <button
                        onClick={() => updateStreet.mutate({ id: street.id, updates: { status: street.status === "todo" ? "in_progress" : "completed" } })}
                        className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors", street.status === "todo" ? "bg-[#FEF3C7] text-[#D97706] hover:bg-[#FDE68A]" : "bg-[#DCFCE7] text-[#16A34A] hover:bg-[#BBF7D0]")}
                      >
                        {street.status === "todo" ? "Commencer" : "Marquer faite ✓"}
                      </button>
                    )}
                    <button onClick={() => setEditingId(isEditing ? null : street.id)} className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#000000] hover:bg-[#F3F4F6]">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Door Progress */}
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Portes", value: street.total_doors, color: "text-[#374151]" },
                    { label: "Cognées", value: street.doors_knocked, color: "text-[#F59E0B]" },
                    { label: "Réponses", value: street.doors_answered, color: "text-[#3B82F6]" },
                    { label: "Ventes", value: street.doors_sold, color: "text-[#22C55E]" },
                  ].map((d) => (
                    <div key={d.label}>
                      <p className={cn("text-lg font-bold", d.color)}>{d.value}</p>
                      <p className="text-[9px] text-[#9CA3AF] font-medium">{d.label}</p>
                    </div>
                  ))}
                </div>
                {street.total_doors > 0 && (
                  <div className="mt-2 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div className="h-full rounded-full bg-[#22C55E] transition-all" style={{ width: `${doorProgress}%` }} />
                  </div>
                )}
                {street.notes && <p className="text-[11px] text-[#6B7280] mt-2 italic">📝 {street.notes}</p>}

                {/* Inline Edit */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-[#F3F4F6] space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { key: "total_doors", label: "Portes", val: street.total_doors },
                        { key: "doors_knocked", label: "Cognées", val: street.doors_knocked },
                        { key: "doors_answered", label: "Réponses", val: street.doors_answered },
                        { key: "doors_sold", label: "Ventes", val: street.doors_sold },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="text-[9px] text-[#9CA3AF] block mb-0.5">{f.label}</label>
                          <input
                            type="number" min="0" defaultValue={f.val}
                            onBlur={(e) => updateStreet.mutate({ id: street.id, updates: { [f.key]: parseInt(e.target.value) || 0 } as any })}
                            className="w-full px-2 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-center"
                          />
                        </div>
                      ))}
                    </div>
                    <textarea
                      defaultValue={street.notes || ""} placeholder="Notes..."
                      onBlur={(e) => updateStreet.mutate({ id: street.id, updates: { notes: e.target.value.trim() || null } })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-xs" rows={2}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { if (confirm("Supprimer cette rue ?")) deleteStreet.mutate(street.id); }} className="text-[10px] text-[#DC2626] hover:underline flex items-center gap-1">
                        <Trash2 className="h-3 w-3" /> Supprimer
                      </button>
                    </div>
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