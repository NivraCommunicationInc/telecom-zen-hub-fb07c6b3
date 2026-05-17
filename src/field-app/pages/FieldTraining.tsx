/**
 * FieldTraining — Nivra Field training portal.
 * Wired to canonical tables: training_modules, training_questions,
 * training_progress, training_answers, agent_points, training_certifications.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2, GraduationCap, BookOpen, CheckCircle2, Clock, Lock,
  Trophy, Medal, Award, PlayCircle, Star, ChevronRight,
} from "lucide-react";

type Module = {
  id: string;
  title_fr: string;
  description_fr: string | null;
  category: string | null;
  order_index: number;
  is_mandatory: boolean;
  passing_score: number;
  points_reward: number;
  estimated_minutes: number | null;
  content_type: string | null;
  video_url: string | null;
  content_fr: string | null;
};

type Question = {
  id: string;
  module_id: string;
  question_fr: string;
  options_fr: string[];
  correct_option: number;
  explanation_fr: string | null;
  points: number;
  order_index: number;
};

type ProgressRow = {
  id: string;
  agent_id: string;
  module_id: string;
  status: string;
  score: number | null;
  attempts: number | null;
  completed_at: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  introduction: "Introduction",
  products: "Produits",
  field_portal: "Portail Field",
  sales_techniques: "Techniques de vente",
  presentation: "Présentation",
  policies: "Politiques",
  regulations: "Loi & règlements",
  billing_contracts: "Facturation",
};

const BADGE_COLORS: Record<string, string> = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-slate-400 to-slate-200",
  gold: "from-yellow-500 to-yellow-300",
  platinum: "from-cyan-400 to-violet-400",
  diamond: "from-violet-500 to-fuchsia-400",
};

export default function FieldTraining() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finalScore, setFinalScore] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Modules catalog
  const { data: modules, isLoading } = useQuery({
    queryKey: ["field-training-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return (data || []) as Module[];
    },
  });

  // Progress per module for current agent
  const { data: progressMap } = useQuery({
    queryKey: ["field-training-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("training_progress")
        .select("*")
        .eq("agent_id", userId!);
      const map: Record<string, ProgressRow> = {};
      (data || []).forEach((p: any) => (map[p.module_id] = p));
      return map;
    },
  });

  // Questions for active module
  const { data: questions } = useQuery({
    queryKey: ["field-training-questions", activeModule?.id],
    enabled: !!activeModule && quizMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_questions")
        .select("*")
        .eq("module_id", activeModule!.id)
        .order("order_index");
      if (error) throw error;
      return (data || []).map((q: any) => ({
        ...q,
        options_fr: Array.isArray(q.options_fr) ? q.options_fr : (q.options_fr?.options ?? []),
      })) as Question[];
    },
  });

  // Agent points + leaderboard
  const { data: myPoints } = useQuery({
    queryKey: ["field-agent-points", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_points")
        .select("*")
        .eq("agent_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["field-training-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_points")
        .select("agent_id, training_points, total_points, current_badge")
        .order("training_points", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = data || [];
      const ids = rows.map((r: any) => r.agent_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const names: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        const parts = (p.full_name || "").trim().split(/\s+/);
        names[p.user_id] = parts[0]
          ? parts[0] + (parts[1] ? " " + parts[1][0] + "." : "")
          : "Agent";
      });
      return rows.map((r: any) => ({ ...r, display_name: names[r.agent_id] || "Agent" }));
    },
  });

  const { data: certifications } = useQuery({
    queryKey: ["field-training-certs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("training_certifications")
        .select("*")
        .eq("agent_id", userId!)
        .eq("is_active", true)
        .order("issued_at", { ascending: false });
      return data || [];
    },
  });

  // Start module → ensure in_progress row exists
  const startModule = useMutation({
    mutationFn: async (moduleId: string) => {
      if (!userId) throw new Error("Non authentifié");
      const existing = progressMap?.[moduleId];
      if (existing) return existing;
      const { data, error } = await supabase
        .from("training_progress")
        .insert({
          agent_id: userId,
          module_id: moduleId,
          status: "in_progress",
          started_at: new Date().toISOString(),
          attempts: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field-training-progress", userId] }),
  });

  // Submit quiz
  const submitQuiz = useMutation({
    mutationFn: async () => {
      if (!userId || !activeModule || !questions) throw new Error("Données manquantes");
      let earned = 0;
      const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
      const correctCount = questions.filter((q) => answers[q.id] === q.correct_option).length;

      // Ensure progress row
      let progress = progressMap?.[activeModule.id];
      if (!progress) {
        const { data, error } = await supabase
          .from("training_progress")
          .insert({
            agent_id: userId,
            module_id: activeModule.id,
            status: "in_progress",
            started_at: new Date().toISOString(),
            attempts: 0,
          })
          .select()
          .single();
        if (error) throw error;
        progress = data as ProgressRow;
      }

      // Persist each answer
      const answerRows = questions.map((q) => {
        const sel = answers[q.id] ?? -1;
        const ok = sel === q.correct_option;
        const pts = ok ? (q.points || 0) : 0;
        if (ok) earned += pts;
        return {
          progress_id: progress!.id,
          question_id: q.id,
          selected_option: sel,
          is_correct: ok,
          points_earned: pts,
        };
      });
      await supabase.from("training_answers").insert(answerRows);

      const scorePct = Math.round((correctCount / questions.length) * 100);
      const passed = scorePct >= activeModule.passing_score;

      await supabase
        .from("training_progress")
        .update({
          status: passed ? "completed" : "in_progress",
          score: scorePct,
          attempts: (progress.attempts || 0) + 1,
          completed_at: passed ? new Date().toISOString() : null,
        })
        .eq("id", progress.id);

      return { scorePct, passed, earned, totalPoints };
    },
    onSuccess: (r) => {
      setFinalScore(r.scorePct);
      if (r.passed) toast.success(`Réussi ! ${r.earned}/${r.totalPoints} pts`);
      else toast.error(`Échec — score ${r.scorePct}% (requis ${activeModule?.passing_score}%)`);
      qc.invalidateQueries({ queryKey: ["field-training-progress", userId] });
      qc.invalidateQueries({ queryKey: ["field-agent-points", userId] });
      qc.invalidateQueries({ queryKey: ["field-training-leaderboard"] });
      qc.invalidateQueries({ queryKey: ["field-training-certs", userId] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const stats = useMemo(() => {
    const total = modules?.length || 0;
    const done = modules?.filter((m) => progressMap?.[m.id]?.status === "completed").length || 0;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [modules, progressMap]);

  function closeDialog() {
    setActiveModule(null);
    setQuizMode(false);
    setAnswers({});
    setFinalScore(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const badgeGradient = BADGE_COLORS[myPoints?.current_badge || ""] || "from-slate-600 to-slate-400";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 text-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Ma Formation</h1>
              <p className="text-xs text-white/80 mt-0.5">Modules, quiz et certifications Nivra</p>
            </div>
          </div>
          {myPoints?.current_badge && (
            <div className={cn("rounded-full px-3 py-1.5 bg-gradient-to-r text-[11px] font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5", badgeGradient)}>
              <Award className="h-3.5 w-3.5" />
              {myPoints.current_badge}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/70">Modules</div>
            <div className="text-xl font-bold mt-1">{stats.done}/{stats.total}</div>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/70">Points formation</div>
            <div className="text-xl font-bold mt-1">{myPoints?.training_points ?? 0}</div>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/70">Certifications</div>
            <div className="text-xl font-bold mt-1">{certifications?.length ?? 0}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-[11px] text-white/80 mb-1.5">
            <span>Progression globale</span><span>{stats.pct}%</span>
          </div>
          <Progress value={stats.pct} className="h-2 bg-white/20" indicatorClassName="bg-white" />
        </div>
      </div>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Modules</TabsTrigger>
          <TabsTrigger value="leaderboard"><Trophy className="h-3.5 w-3.5 mr-1.5" />Classement</TabsTrigger>
          <TabsTrigger value="certs"><Award className="h-3.5 w-3.5 mr-1.5" />Certifications</TabsTrigger>
        </TabsList>

        {/* MODULES */}
        <TabsContent value="modules" className="mt-4 space-y-2.5">
          {!modules?.length ? (
            <div className="text-center py-16">
              <GraduationCap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucun module disponible.</p>
            </div>
          ) : (
            modules.map((m, idx) => {
              const p = progressMap?.[m.id];
              const status = p?.status || "not_started";
              const prevDone = idx === 0 || (progressMap?.[modules[idx - 1].id]?.status === "completed");
              const locked = m.is_mandatory && !prevDone && status !== "completed";
              const Icon = status === "completed" ? CheckCircle2 : locked ? Lock : status === "in_progress" ? Clock : PlayCircle;
              const iconColor = status === "completed" ? "text-emerald-600" : locked ? "text-muted-foreground" : status === "in_progress" ? "text-amber-600" : "text-violet-600";
              return (
                <button
                  key={m.id}
                  disabled={locked}
                  onClick={() => { setActiveModule(m); setQuizMode(false); setFinalScore(null); setAnswers({}); }}
                  className={cn(
                    "w-full text-left rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all flex items-center gap-3 min-h-[64px]",
                    locked && "opacity-60 cursor-not-allowed",
                    status === "completed" && "border-emerald-500/40 bg-emerald-500/5"
                  )}
                >
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className={cn("h-4.5 w-4.5", iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                        Module {m.order_index}
                      </span>
                      {m.category && (
                        <span className="text-[10px] text-muted-foreground">
                          · {CATEGORY_LABELS[m.category] || m.category}
                        </span>
                      )}
                      {m.is_mandatory && (
                        <span className="text-[9px] font-bold uppercase bg-amber-500/15 text-amber-700 px-1.5 py-0.5 rounded">
                          Obligatoire
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mt-0.5 truncate">{m.title_fr}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {m.estimated_minutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.estimated_minutes} min</span>}
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" />{m.points_reward} pts</span>
                      {p?.score !== null && p?.score !== undefined && (
                        <span className={cn("font-semibold", (p.score ?? 0) >= m.passing_score ? "text-emerald-600" : "text-destructive")}>
                          {p.score}%
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })
          )}
        </TabsContent>

        {/* LEADERBOARD */}
        <TabsContent value="leaderboard" className="mt-4">
          {!leaderboard?.length ? (
            <div className="text-center py-16">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucun score enregistré. Soyez le premier !</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Agent</div>
                <div className="col-span-3 text-center">Badge</div>
                <div className="col-span-3 text-right">Points</div>
              </div>
              {leaderboard.map((row: any, idx: number) => {
                const isMe = row.agent_id === userId;
                const medal = idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-700" : "";
                return (
                  <div
                    key={row.agent_id}
                    className={cn(
                      "grid grid-cols-12 items-center px-4 py-2.5 text-sm border-b border-border/60 last:border-0",
                      isMe && "bg-violet-500/10"
                    )}
                  >
                    <div className="col-span-1 flex items-center">
                      {idx < 3 ? <Medal className={cn("h-4 w-4", medal)} /> : <span className="text-muted-foreground text-xs">{idx + 1}</span>}
                    </div>
                    <div className="col-span-5 font-medium truncate">
                      {row.display_name}
                      {isMe && <span className="ml-1.5 text-[10px] text-violet-600 font-semibold">(vous)</span>}
                    </div>
                    <div className="col-span-3 text-center text-[11px] text-muted-foreground uppercase">
                      {row.current_badge || "—"}
                    </div>
                    <div className="col-span-3 text-right font-semibold">{row.training_points || 0}</div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* CERTIFICATIONS */}
        <TabsContent value="certs" className="mt-4">
          {!certifications?.length ? (
            <div className="text-center py-16">
              <Award className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucune certification pour l'instant.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {certifications.map((c: any) => {
                const grad = BADGE_COLORS[c.certification_level] || "from-violet-500 to-purple-500";
                return (
                  <div key={c.id} className="rounded-xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                    <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-gradient-to-r text-white text-[10px] font-bold uppercase mb-2", grad)}>
                      <Award className="h-3 w-3" />
                      {c.certification_level}
                    </div>
                    <div className="text-sm font-semibold">{c.certification_name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Émise le {new Date(c.issued_at).toLocaleDateString("fr-CA")}
                      {c.expires_at && ` · Expire le ${new Date(c.expires_at).toLocaleDateString("fr-CA")}`}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{c.total_points} pts</div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODULE DIALOG */}
      <Dialog open={!!activeModule} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {activeModule && (
            <>
              <DialogHeader>
                <DialogTitle>{activeModule.title_fr}</DialogTitle>
              </DialogHeader>

              {/* CONTENT VIEW */}
              {!quizMode && finalScore === null && (
                <div className="space-y-4">
                  {activeModule.description_fr && (
                    <p className="text-sm text-muted-foreground">{activeModule.description_fr}</p>
                  )}
                  {activeModule.video_url && (
                    <video src={activeModule.video_url} controls className="w-full rounded-lg" />
                  )}
                  {activeModule.content_fr && (
                    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                      {activeModule.content_fr}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                    <div className="text-[11px] text-muted-foreground">
                      Score requis : <span className="font-semibold text-foreground">{activeModule.passing_score}%</span>
                      {" · "}Récompense : <span className="font-semibold text-foreground">{activeModule.points_reward} pts</span>
                    </div>
                    <Button
                      onClick={async () => {
                        await startModule.mutateAsync(activeModule.id);
                        setQuizMode(true);
                      }}
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      Commencer le quiz
                    </Button>
                  </div>
                </div>
              )}

              {/* QUIZ */}
              {quizMode && finalScore === null && (
                <div className="space-y-5">
                  {!questions ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : !questions.length ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucune question pour ce module.</p>
                  ) : (
                    <>
                      {questions.map((q, qi) => (
                        <div key={q.id} className="space-y-2">
                          <div className="text-sm font-semibold text-foreground">
                            {qi + 1}. {q.question_fr}
                          </div>
                          <div className="space-y-1.5">
                            {q.options_fr.map((opt, oi) => {
                              const selected = answers[q.id] === oi;
                              return (
                                <button
                                  key={oi}
                                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                                  className={cn(
                                    "w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors min-h-[44px]",
                                    selected
                                      ? "border-violet-500 bg-violet-500/10 text-foreground"
                                      : "border-border bg-card hover:bg-muted"
                                  )}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end gap-2 pt-3 border-t border-border">
                        <Button variant="ghost" onClick={() => setQuizMode(false)}>Retour</Button>
                        <Button
                          disabled={Object.keys(answers).length !== questions.length || submitQuiz.isPending}
                          onClick={() => submitQuiz.mutate()}
                          className="bg-violet-600 hover:bg-violet-700 text-white"
                        >
                          {submitQuiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Soumettre le quiz"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* RESULT */}
              {finalScore !== null && (
                <div className="text-center py-6 space-y-4">
                  {finalScore >= activeModule.passing_score ? (
                    <>
                      <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-emerald-600">{finalScore}%</div>
                        <p className="text-sm text-muted-foreground mt-1">Module réussi — points créditer.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-16 w-16 mx-auto rounded-full bg-destructive/15 flex items-center justify-center">
                        <Clock className="h-8 w-8 text-destructive" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-destructive">{finalScore}%</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Score insuffisant (requis {activeModule.passing_score}%). Vous pouvez retenter.
                        </p>
                      </div>
                    </>
                  )}
                  <Button onClick={closeDialog} className="bg-violet-600 hover:bg-violet-700 text-white">
                    Fermer
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
