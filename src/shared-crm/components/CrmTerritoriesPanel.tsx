/**
 * CrmTerritoriesPanel — Admin UI to map cities to agents (territories).
 * Renders above CrmCenter for admins only.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TerritoryRow {
  id: string;
  city: string;
  agent_id: string;
  notes: string | null;
  created_at: string;
  agent_name?: string | null;
  agent_email?: string | null;
}

interface AgentOpt { user_id: string; full_name: string | null; email: string | null }

interface Props { variant?: "light" | "dark" }

export function CrmTerritoriesPanel({ variant = "light" }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [agentId, setAgentId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: territories = [], isLoading } = useQuery<TerritoryRow[]>({
    queryKey: ["crm-territories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_territories")
        .select("id, city, agent_id, notes, created_at, profiles:agent_id(full_name, email)")
        .order("city");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        city: r.city,
        agent_id: r.agent_id,
        notes: r.notes,
        created_at: r.created_at,
        agent_name: r.profiles?.full_name ?? null,
        agent_email: r.profiles?.email ?? null,
      }));
    },
    enabled: open,
  });

  const { data: agents = [] } = useQuery<AgentOpt[]>({
    queryKey: ["crm-territory-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(full_name, email)")
        .in("role", ["employee", "field_sales", "admin"])
        .eq("is_active", true);
      const seen = new Set<string>();
      const list: AgentOpt[] = [];
      for (const r of (data ?? []) as any[]) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        list.push({ user_id: r.user_id, full_name: r.profiles?.full_name ?? null, email: r.profiles?.email ?? null });
      }
      return list.sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
    },
    enabled: open,
  });

  const handleAdd = async () => {
    if (!city.trim() || !agentId) {
      toast.error("Ville et agent requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("crm_territories").insert({
      city: city.trim(),
      agent_id: agentId,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success("Territoire ajouté");
    setCity(""); setAgentId(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["crm-territories"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("crm_territories").delete().eq("id", id);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["crm-territories"] });
  };

  const isDark = variant === "dark";
  const containerCls = isDark
    ? "border-white/10 bg-white/5"
    : "border-border bg-card";

  return (
    <div className={cn("rounded-lg border", containerCls)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold hover:bg-violet-500/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-violet-500" />
          Territoires (ville → agent assigné)
          {territories.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30">
              {territories.length}
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          {/* Add form */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1.5fr_auto] gap-2">
            <Input
              placeholder="Ville (ex: Montréal)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Choisir un agent —</option>
              {agents.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.full_name ?? a.email} ({a.email})
                </option>
              ))}
            </select>
            <Input
              placeholder="Notes (optionnel)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={saving} className="bg-violet-600 hover:bg-violet-500">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter
            </Button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : territories.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-3">
              Aucun territoire défini. Assignez une ville à un agent pour router automatiquement les contacts.
            </div>
          ) : (
            <div className="rounded-md border border-border divide-y divide-border max-h-72 overflow-y-auto">
              {territories.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="font-semibold text-violet-600 dark:text-violet-300 min-w-32">{t.city}</div>
                  <div className="flex-1">
                    <div className="font-medium">{t.agent_name ?? t.agent_email ?? t.agent_id}</div>
                    {t.notes && <div className="text-[11px] text-muted-foreground">{t.notes}</div>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(t.id)}
                    className="text-rose-600 hover:text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
