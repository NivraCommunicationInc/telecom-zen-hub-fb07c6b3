/**
 * CrmScriptsAdmin — Manage A/B call scripts. Admin-only.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props { isDark?: boolean }
interface Script {
  id: string; name: string; variant: string; content: string; weight: number;
  is_active: boolean; served_count: number; conversion_count: number;
}

export function CrmScriptsAdmin({ isDark }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("A");
  const [content, setContent] = useState("");
  const [weight, setWeight] = useState(1);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-scripts"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("crm_scripts")
        .select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Script[];
    },
  });

  const cardCls = isDark ? "rounded-xl bg-gray-900/60 border border-gray-800" : "rounded-xl bg-card border border-border";
  const titleCls = isDark ? "text-white" : "text-foreground";
  const mutedCls = isDark ? "text-gray-400" : "text-muted-foreground";
  const inputCls = cn(
    "w-full rounded-md border px-2 py-1.5 text-xs",
    isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-background border-border text-foreground"
  );

  const create = async () => {
    if (!name.trim() || !content.trim()) { toast.error("Nom et contenu requis"); return; }
    setSaving(true);
    const { error } = await (supabase.from as any)("crm_scripts").insert({
      name: name.trim(), variant: variant.trim() || "A", content: content.trim(), weight: Math.max(1, weight),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Script ajouté");
    setName(""); setContent(""); setVariant("A"); setWeight(1);
    qc.invalidateQueries({ queryKey: ["crm-scripts"] });
  };

  const toggle = async (s: Script) => {
    const { error } = await (supabase.from as any)("crm_scripts")
      .update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["crm-scripts"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce script ?")) return;
    const { error } = await (supabase.from as any)("crm_scripts").delete().eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["crm-scripts"] });
  };

  return (
    <div className={cn(cardCls, "p-4")}>
      <h3 className={cn("text-sm font-bold flex items-center gap-2 mb-3", titleCls)}>
        <FileText className="h-4 w-4 text-violet-500" />
        Scripts A/B (admin)
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <input className={inputCls} placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Variante (A/B/C)" value={variant} onChange={(e) => setVariant(e.target.value)} />
      </div>
      <textarea
        className={cn(inputCls, "min-h-[70px] mb-2")}
        placeholder="Contenu du script…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex items-center gap-2 mb-3">
        <label className={cn("text-[11px]", mutedCls)}>Poids</label>
        <input type="number" min={1} className={cn(inputCls, "w-20")} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
        <button
          onClick={create} disabled={saving}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Ajouter
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-violet-500" /></div>
      ) : !data || data.length === 0 ? (
        <p className={cn("text-xs text-center py-3", mutedCls)}>Aucun script. Ajoutez la variante A en premier.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((s) => {
            const rate = s.served_count > 0 ? Math.round((s.conversion_count / s.served_count) * 100) : 0;
            return (
              <li key={s.id} className={cn("flex items-center gap-2 p-2 rounded-md border", isDark ? "border-gray-800" : "border-border")}>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", s.is_active ? "bg-emerald-500/20 text-emerald-500" : "bg-gray-500/20 text-gray-400")}>{s.variant}</span>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-xs font-semibold truncate", titleCls)}>{s.name}</div>
                  <div className={cn("text-[10px]", mutedCls)}>Poids {s.weight} · Servi {s.served_count}× · Conv. {rate}%</div>
                </div>
                <button onClick={() => toggle(s)} className={cn("text-[10px] px-2 py-1 rounded border", s.is_active ? "border-amber-500/40 text-amber-500" : "border-emerald-500/40 text-emerald-500")}>
                  {s.is_active ? "Pause" : "Activer"}
                </button>
                <button onClick={() => remove(s.id)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
