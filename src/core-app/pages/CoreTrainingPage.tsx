/**
 * CoreTrainingPage — Admin training management.
 * Vue d'ensemble, suivi des agents, gestion des modules, sessions live,
 * classement et override de formation.
 */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GraduationCap, Users, Award, Trophy, Settings as SettingsIcon,
  Calendar, Search, ShieldCheck,
} from "lucide-react";

const BADGE_EMOJI: Record<string, string> = {
  none: "🎓", certified: "🥉", confirmed: "🥈", top_seller: "🥇", elite: "💎",
};

function frDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return "—"; }
}

export default function CoreTrainingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [overrideSearch, setOverrideSearch] = useState("");

  // ── Modules ──────────────────────────────────────────────────────────────
  const { data: modules = [] } = useQuery({
    queryKey: ["core-training", "modules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_modules")
        .select("*")
        .order("order_index", { ascending: true });
      return data || [];
    },
  });

  // ── Field agents (with progress) ────────────────────────────────────────
  const { data: agents = [] } = useQuery({
    queryKey: ["core-training", "agents"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "field_sales")
        .eq("is_active", true);
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const [{ data: profs }, { data: progs }, { data: pts }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, agent_number").in("user_id", ids),
        supabase.from("training_progress").select("*").in("agent_id", ids),
        supabase.from("agent_points").select("*").in("agent_id", ids),
      ]);
      const ptsMap = new Map((pts || []).map((p: any) => [p.agent_id, p]));
      const progsMap = new Map<string, any[]>();
      for (const p of progs || []) {
        const arr = progsMap.get((p as any).agent_id) || [];
        arr.push(p);
        progsMap.set((p as any).agent_id, arr);
      }
      return (profs || []).map((p: any) => {
        const pr = progsMap.get(p.user_id) || [];
        const completed = pr.filter((x) => x.status === "completed");
        const avg = completed.length ? Math.round(completed.reduce((s, x) => s + (x.score || 0), 0) / completed.length) : 0;
        const last = pr.reduce((acc: string | null, x) => {
          const t = x.completed_at || x.started_at;
          if (!t) return acc;
          return !acc || t > acc ? t : acc;
        }, null);
        const points = ptsMap.get(p.user_id) as any;
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          agent_number: p.agent_number,
          completed: completed.length,
          avg_score: avg,
          total_points: points?.total_points ?? 0,
          badge: points?.current_badge ?? "none",
          last_activity: last,
          all_progress: pr,
        };
      });
    },
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = agents.length;
    const mandatoryCount = (modules as any[]).filter((m) => m.is_mandatory && m.is_active).length || 8;
    let certified = 0, inProgress = 0, notStarted = 0, sumScore = 0, scoreN = 0;
    for (const a of agents) {
      if (a.completed >= mandatoryCount && mandatoryCount > 0) certified++;
      else if (a.completed > 0) inProgress++;
      else notStarted++;
      if (a.avg_score > 0) { sumScore += a.avg_score; scoreN++; }
    }
    return { total, certified, inProgress, notStarted, avgScore: scoreN ? Math.round(sumScore / scoreN) : 0 };
  }, [agents, modules]);

  const { data: certCount = 0 } = useQuery({
    queryKey: ["core-training", "cert-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("training_certifications")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      return count ?? 0;
    },
  });

  // ── Sessions ─────────────────────────────────────────────────────────────
  const { data: sessions = [] } = useQuery({
    queryKey: ["core-training", "sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_sessions")
        .select("*")
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });
      return data || [];
    },
  });

  // ── Leaderboard ──────────────────────────────────────────────────────────
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["core-training", "leaderboard"],
    queryFn: async () => {
      const { data: pts } = await supabase
        .from("agent_points")
        .select("*")
        .order("total_points", { ascending: false })
        .limit(20);
      const ids = (pts || []).map((p: any) => p.agent_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, agent_number")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return (pts || []).map((p: any) => ({ ...p, profile: map.get(p.agent_id) }));
    },
  });

  // ── Override search ──────────────────────────────────────────────────────
  const { data: overrideResults = [] } = useQuery({
    queryKey: ["core-training", "override-search", overrideSearch],
    enabled: overrideSearch.trim().length >= 2,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "field_sales");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, agent_number, training_override")
        .in("user_id", ids)
        .ilike("full_name", `%${overrideSearch}%`)
        .limit(20);
      return data || [];
    },
  });

  async function toggleOverride(userId: string, value: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ training_override: value } as any)
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Override mis à jour", description: value ? "Agent autorisé sans formation" : "Formation requise" });
    qc.invalidateQueries({ queryKey: ["core-training", "override-search"] });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Formation & Développement</h1>
          <p className="text-sm text-muted-foreground">Gestion de la formation officielle Field Sales</p>
        </div>
      </div>

      {/* SECTION 1 — Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Agents inscrits" value={stats.total} color="text-blue-600" />
        <StatCard icon={ShieldCheck} label="Certifiés" value={stats.certified} color="text-green-600" />
        <StatCard icon={GraduationCap} label="En cours" value={stats.inProgress} color="text-blue-500" />
        <StatCard icon={Users} label="Non démarrés" value={stats.notStarted} color="text-gray-500" />
        <StatCard icon={Trophy} label="Score moyen" value={`${stats.avgScore}%`} color="text-yellow-600" />
        <StatCard icon={Award} label="Certificats émis" value={certCount} color="text-purple-600" />
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="sessions">Sessions live</TabsTrigger>
          <TabsTrigger value="leaderboard">Classement</TabsTrigger>
          <TabsTrigger value="override">Override</TabsTrigger>
        </TabsList>

        {/* SECTION 2 — Agents progress */}
        <TabsContent value="agents" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Badge</th>
                    <th className="px-4 py-3">Modules</th>
                    <th className="px-4 py-3">Score moy.</th>
                    <th className="px-4 py-3">Points</th>
                    <th className="px-4 py-3">Dernière activité</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a: any) => {
                    const mandatory = (modules as any[]).filter((m) => m.is_mandatory && m.is_active).length || 8;
                    const certified = a.completed >= mandatory;
                    const status = certified ? "Certifié" : a.completed > 0 ? "En cours" : "Non démarré";
                    return (
                      <tr key={a.user_id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedAgent(a.user_id)}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{a.full_name}</div>
                          <div className="text-xs text-muted-foreground">{a.agent_number || "—"}</div>
                        </td>
                        <td className="px-4 py-2.5">{BADGE_EMOJI[a.badge] || "🎓"}</td>
                        <td className="px-4 py-2.5">{a.completed}/{mandatory}</td>
                        <td className="px-4 py-2.5">{a.avg_score}%</td>
                        <td className="px-4 py-2.5 font-semibold">{a.total_points}</td>
                        <td className="px-4 py-2.5 text-xs">{frDate(a.last_activity)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={certified ? "default" : a.completed > 0 ? "secondary" : "outline"}>{status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {agents.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucun agent field_sales actif</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* SECTION 3 — Modules */}
        <TabsContent value="modules" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {(modules as any[]).map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{m.title_fr}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.category} · ~{m.estimated_minutes} min</div>
                    <div className="text-xs mt-1">Score requis: {m.passing_score}% · Récompense: {m.points_reward} pts</div>
                  </div>
                  <Badge variant={m.is_active ? "default" : "outline"}>{m.is_active ? "Actif" : "Inactif"}</Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => toast({ title: "Édition module", description: "Fonctionnalité à venir." })}>
                    <SettingsIcon className="h-3 w-3 mr-1" />Configurer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* SECTION 4 — Live sessions */}
        <TabsContent value="sessions" className="mt-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" />Sessions à venir</h3>
              <Button size="sm" onClick={() => toast({ title: "Création de session", description: "Formulaire à venir." })}>
                Nouvelle session
              </Button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune session planifiée.</p>
            ) : (
              <div className="space-y-2">
                {(sessions as any[]).map((s) => (
                  <div key={s.id} className="border rounded p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.title_fr}</div>
                      <div className="text-xs text-muted-foreground">{frDate(s.scheduled_at)} · {s.duration_minutes} min</div>
                    </div>
                    <Badge variant="outline">{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* SECTION 5 — Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card className="p-4">
            <div className="space-y-1.5">
              {(leaderboard as any[]).map((row, i) => (
                <div key={row.agent_id} className="flex items-center justify-between rounded px-3 py-2 bg-muted/30 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                    <span>{row.profile?.full_name ?? "Agent"}</span>
                    <span className="text-xs">{BADGE_EMOJI[row.current_badge] || "🎓"}</span>
                  </div>
                  <span className="font-semibold">{row.total_points} pts</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* SECTION 6 — Override */}
        <TabsContent value="override" className="mt-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un agent…"
                value={overrideSearch}
                onChange={(e) => setOverrideSearch(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Activer l'override permet à l'agent d'accéder au portail Field sans avoir complété la formation obligatoire.
            </p>
            <div className="space-y-2">
              {(overrideResults as any[]).map((a) => (
                <div key={a.user_id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{a.full_name}</div>
                    <div className="text-xs text-muted-foreground">{a.agent_number || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ov-${a.user_id}`} className="text-xs">Override</Label>
                    <Switch
                      id={`ov-${a.user_id}`}
                      checked={!!a.training_override}
                      onCheckedChange={(v) => toggleOverride(a.user_id, v)}
                    />
                  </div>
                </div>
              ))}
              {overrideSearch.length >= 2 && overrideResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun agent trouvé.</p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Agent detail dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={(o) => !o && setSelectedAgent(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Détail agent</DialogTitle></DialogHeader>
          {selectedAgent && (() => {
            const a = agents.find((x: any) => x.user_id === selectedAgent);
            if (!a) return null;
            return (
              <div className="space-y-3">
                <div className="font-semibold">{a.full_name} <span className="text-xs text-muted-foreground">{a.agent_number}</span></div>
                <div className="text-sm">Points: {a.total_points} · Badge: {BADGE_EMOJI[a.badge] || "🎓"}</div>
                <div className="space-y-1.5">
                  {(modules as any[]).map((m) => {
                    const p = a.all_progress.find((x: any) => x.module_id === m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                        <span>{m.title_fr}</span>
                        <Badge variant={p?.status === "completed" ? "default" : "outline"}>
                          {p?.status === "completed" ? `✓ ${p.score}%` : p?.status === "failed" ? "Échoué" : p?.status === "in_progress" ? "En cours" : "—"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}
