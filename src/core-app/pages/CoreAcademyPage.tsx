/**
 * CoreAcademyPage — Admin overview of Nivra Academy training across all agents.
 * Shows progress, scores, certifications per agent. Read-focused; content edits
 * happen via future inline editor.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Trophy, Users, BookOpen, Loader2 } from "lucide-react";

export default function CoreAcademyPage() {
  const { data: modules } = useQuery({
    queryKey: ["core-academy-modules"],
    queryFn: async () => {
      const { data } = await supabase.from("training_modules").select("id, slug, title_fr, portal, is_mandatory, passing_score").eq("is_active", true).order("order_index");
      return data || [];
    },
  });

  const { data: agents, isLoading } = useQuery({
    queryKey: ["core-academy-agents"],
    queryFn: async () => {
      const { data: progress } = await supabase.from("training_progress").select("agent_id, module_id, status, score");
      const { data: certs } = await supabase.from("training_certifications").select("agent_id, certification_level, is_active, issued_at").eq("is_active", true);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
      const map = new Map<string, any>();
      (progress || []).forEach((p: any) => {
        const a = map.get(p.agent_id) || { id: p.agent_id, progress: [], certified: false };
        a.progress.push(p);
        map.set(p.agent_id, a);
      });
      (certs || []).forEach((c: any) => {
        const a = map.get(c.agent_id) || { id: c.agent_id, progress: [] };
        a.certified = true; a.cert_level = c.certification_level; a.cert_date = c.issued_at;
        map.set(c.agent_id, a);
      });
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return Array.from(map.values()).map((a) => ({
        ...a,
        profile: profileMap.get(a.id) || null,
      }));
    },
  });

  const totalAgents = agents?.length || 0;
  const certifiedAgents = agents?.filter((a) => a.certified).length || 0;
  const avgProgress = agents?.length
    ? Math.round(agents.reduce((sum, a) => {
        const done = a.progress.filter((p: any) => p.status === "completed").length;
        return sum + (modules?.length ? (done / modules.length) * 100 : 0);
      }, 0) / agents.length)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5"><GraduationCap className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Nivra Academy — Admin</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble formation Field + OneView CS</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Agents en formation" value={totalAgents} />
        <StatCard icon={Trophy} label="Agents certifiés" value={certifiedAgents} accent />
        <StatCard icon={BookOpen} label="Progression moyenne" value={`${avgProgress}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modules actifs ({modules?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {modules?.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-2 rounded border">
              <div>
                <p className="text-sm font-medium">{m.title_fr}</p>
                <p className="text-xs text-muted-foreground">{m.slug} • Portail: {m.portal} • Note min: {m.passing_score}%</p>
              </div>
              {m.is_mandatory && <Badge variant="outline">Obligatoire</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suivi par agent</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {agents?.map((a: any) => {
                const done = a.progress.filter((p: any) => p.status === "completed").length;
                const total = modules?.length || 0;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={a.id} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg border">
                    <div className="col-span-4">
                      <p className="text-sm font-medium truncate">{a.profile?.full_name || a.profile?.email || a.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.profile?.email}</p>
                    </div>
                    <div className="col-span-5">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs tabular-nums w-10 text-right">{pct}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{done}/{total} modules</p>
                    </div>
                    <div className="col-span-3 text-right">
                      {a.certified ? (
                        <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">
                          <Trophy className="h-3 w-3 mr-1" /> Certifié
                        </Badge>
                      ) : (
                        <Badge variant="outline">En cours</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {agents?.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Aucun agent encore inscrit en formation.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className={accent ? "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${accent ? "bg-amber-500/15" : "bg-primary/10"}`}>
          <Icon className={`h-5 w-5 ${accent ? "text-amber-600" : "text-primary"}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
