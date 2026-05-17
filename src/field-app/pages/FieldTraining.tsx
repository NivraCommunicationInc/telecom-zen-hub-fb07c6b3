/**
 * FieldTraining — "Ma Formation Nivra"
 * Page de formation officielle pour les agents Field Sales.
 * Affiche les modules obligatoires, le quiz, le classement, les certifications
 * et les sessions live à venir.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  GraduationCap, Trophy, Medal, Award, Star, Clock, Sparkles,
  CheckCircle2, XCircle, FileText, Calendar, Download, ChevronRight,
} from "lucide-react";

type ModuleRow = {
  id: string;
  title_fr: string;
  description_fr: string | null;
  content_fr: string | null;
  category: string;
  order_index: number;
  estimated_minutes: number;
  points_reward: number;
  passing_score: number;
  is_active: boolean;
};

type ProgressRow = {
  module_id: string;
  status: string;
  score: number;
  attempts: number;
  completed_at: string | null;
};

type QuestionRow = {
  id: string;
  module_id: string;
  question_fr: string;
  options_fr: any;
  correct_option: number;
  explanation_fr: string | null;
  points: number;
  order_index: number;
};

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  introduction:      { bg: "bg-blue-100 dark:bg-blue-950/40",   text: "text-blue-700 dark:text-blue-300",   label: "Introduction" },
  products:          { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", label: "Produits" },
  field_portal:      { bg: "bg-violet-100 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", label: "Portail Field" },
  sales_techniques:  { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", label: "Vente" },
  presentation:      { bg: "bg-pink-100 dark:bg-pink-950/40",   text: "text-pink-700 dark:text-pink-300",   label: "Présentation" },
  policies:          { bg: "bg-red-100 dark:bg-red-950/40",     text: "text-red-700 dark:text-red-300",     label: "Politiques" },
  regulations:       { bg: "bg-gray-200 dark:bg-gray-800",      text: "text-gray-700 dark:text-gray-300",   label: "Règlements" },
  billing_contracts: { bg: "bg-teal-100 dark:bg-teal-950/40",   text: "text-teal-700 dark:text-teal-300",   label: "Facturation" },
};

const BADGE_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  none:       { label: "Aucun badge",        emoji: "🎓", color: "text-gray-500" },
  certified:  { label: "Agent Certifié",     emoji: "🥉", color: "text-purple-600" },
  confirmed:  { label: "Agent Confirmé",     emoji: "🥈", color: "text-blue-600" },
  top_seller: { label: "Top Vendeur",        emoji: "🥇", color: "text-yellow-600" },
  elite:      { label: "Élite Nivra",        emoji: "💎", color: "text-cyan-500" },
};

function frDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  } catch { return "—"; }
}

export default function FieldTraining() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  usePortalRealtime(
    ["training_progress", "agent_points"],
    [["field-training"]],
  );

  const { data: modules = [] } = useQuery({
    queryKey: ["field-training", "modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as ModuleRow[];
    },
  });

  const { data: progress = [] } = useQuery({
    queryKey: ["field-training", "progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_progress")
        .select("*")
        .eq("agent_id", userId!);
      if (error) throw error;
      return (data || []) as ProgressRow[];
    },
  });

  const { data: points } = useQuery({
    queryKey: ["field-training", "points", userId],
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

  const { data: certifications = [] } = useQuery({
    queryKey: ["field-training", "certs", userId],
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

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["field-training", "leaderboard"],
    queryFn: async () => {
      const { data: pts } = await supabase
        .from("agent_points")
        .select("*")
        .order("total_points", { ascending: false })
        .limit(10);
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

  const { data: sessions = [] } = useQuery({
    queryKey: ["field-training", "sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_sessions")
        .select("*")
        .gt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(10);
      return data || [];
    },
  });

  const progressByModule = useMemo(() => {
    const m = new Map<string, ProgressRow>();
    for (const p of progress) m.set(p.module_id, p);
    return m;
  }, [progress]);

  const completedCount = useMemo(
    () => progress.filter((p) => p.status === "completed").length,
    [progress],
  );
  const totalModules = modules.length;
  const totalPoints = points?.total_points ?? 0;
  const badge = BADGE_INFO[points?.current_badge ?? "none"] ?? BADGE_INFO.none;

  return (
    <div className="space-y-6 pb-12 text-foreground">
      {/* SECTION 1 — Header */}
      <Card className="p-6 border-l-4" style={{ borderLeftColor: "hsl(258 90% 66%)" }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Ma Formation Nivra</h1>
              <p className="text-sm text-muted-foreground">
                Formation officielle Field Sales — 8 modules à compléter
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={`text-sm font-semibold ${badge.color}`}>
                <span className="mr-1">{badge.emoji}</span>{badge.label}
              </div>
              <div className="text-xs text-muted-foreground">{totalPoints} pts</div>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium">Progression</span>
            <span className="text-muted-foreground">{completedCount}/{totalModules} modules complétés</span>
          </div>
          <Progress value={totalModules ? (completedCount / totalModules) * 100 : 0} />
        </div>
      </Card>

      {/* SECTION 2 — Modules */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Modules de formation
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((m, idx) => {
            const cat = CATEGORY_STYLE[m.category] ?? CATEGORY_STYLE.introduction;
            const p = progressByModule.get(m.id);
            const status = p?.status ?? "not_started";
            return (
              <Card key={m.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center font-bold text-violet-700 dark:text-violet-300 shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge className={`${cat.bg} ${cat.text} border-0`}>{cat.label}</Badge>
                      {status === "completed" && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 border-0">
                          ✓ Complété — {p?.score ?? 0}%
                        </Badge>
                      )}
                      {status === "in_progress" && (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-0">
                          En cours
                        </Badge>
                      )}
                      {status === "failed" && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-0">
                          Échoué — Réessayer
                        </Badge>
                      )}
                      {status === "not_started" && (
                        <Badge variant="outline">À commencer</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold leading-snug">{m.title_fr}</h3>
                    {m.description_fr && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description_fr}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />~{m.estimated_minutes} min</span>
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" />{m.points_reward} pts</span>
                    </div>
                    <Button
                      size="sm"
                      className="mt-3 bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => setOpenModuleId(m.id)}
                    >
                      {status === "completed" ? "Revoir" : status === "in_progress" ? "Continuer" : "Commencer"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* SECTION 4 — Leaderboard */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Classement des agents
        </h2>
        <div className="space-y-1.5">
          {leaderboard.map((row: any, i: number) => {
            const isMe = row.agent_id === userId;
            const b = BADGE_INFO[row.current_badge ?? "none"] ?? BADGE_INFO.none;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return (
              <div
                key={row.agent_id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${isMe ? "bg-violet-100 dark:bg-violet-950/30 font-semibold" : "bg-muted/40"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 text-center">{medal}</span>
                  <span className="truncate">
                    {row.profile?.full_name ?? "Agent"}{row.profile?.agent_number ? ` · ${row.profile.agent_number}` : ""}
                  </span>
                  <span className={`text-xs ${b.color}`}>{b.emoji}</span>
                </div>
                <div className="text-sm font-semibold">{row.total_points} pts</div>
              </div>
            );
          })}
          {leaderboard.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun agent classé pour le moment.</p>
          )}
        </div>
      </Card>

      {/* SECTION 5 — Certifications */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-purple-500" />
          Mes certifications
        </h2>
        {certifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune certification émise pour le moment. Complétez tous les modules obligatoires pour recevoir votre certificat officiel.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {certifications.map((c: any) => (
              <div key={c.id} className="border rounded-lg p-4 flex items-start gap-3">
                <Medal className="h-8 w-8 text-purple-500 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold">{c.certification_name}</div>
                  <div className="text-xs text-muted-foreground">Émis le {frDate(c.issued_at)}</div>
                </div>
                {c.pdf_url && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={c.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3 mr-1" />PDF
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* SECTION 6 — Sessions live */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          Sessions en direct
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune session planifiée pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="font-semibold text-sm">{s.title_fr}</div>
                  <div className="text-xs text-muted-foreground">
                    {frDate(s.scheduled_at)} · {s.duration_minutes} min
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast({ title: "Inscription enregistrée", description: s.title_fr })}>
                  S'inscrire
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* SECTION 3 — Module dialog (Contenu + Quiz) */}
      {openModuleId && userId && (
        <ModuleDialog
          moduleId={openModuleId}
          userId={userId}
          modules={modules}
          currentProgress={progressByModule.get(openModuleId) ?? null}
          onClose={() => setOpenModuleId(null)}
          onCompleted={() => {
            qc.invalidateQueries({ queryKey: ["field-training"] });
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  MODULE DIALOG — contenu + quiz                                            */
/* -------------------------------------------------------------------------- */

function ModuleDialog({
  moduleId,
  userId,
  modules,
  currentProgress,
  onClose,
  onCompleted,
}: {
  moduleId: string;
  userId: string;
  modules: ModuleRow[];
  currentProgress: ProgressRow | null;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { toast } = useToast();
  const mod = modules.find((m) => m.id === moduleId);
  const [tab, setTab] = useState<"content" | "quiz">("content");
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const { data: questions = [] } = useQuery({
    queryKey: ["field-training", "questions", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_questions")
        .select("*")
        .eq("module_id", moduleId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as QuestionRow[];
    },
  });

  if (!mod) return null;

  const totalQ = questions.length;
  const current = questions[qIdx];
  const optionsArr: string[] = Array.isArray(current?.options_fr) ? current!.options_fr : [];

  async function startQuiz() {
    // mark in_progress
    await supabase.from("training_progress").upsert({
      agent_id: userId,
      module_id: moduleId,
      status: "in_progress",
      started_at: new Date().toISOString(),
      attempts: (currentProgress?.attempts ?? 0),
    }, { onConflict: "agent_id,module_id" });
    setTab("quiz");
    setQIdx(0);
    setSelected(null);
    setAnswered(false);
    setCorrectCount(0);
    setFinalScore(null);
  }

  async function answer() {
    if (selected === null || !current) return;
    const isCorrect = selected === current.correct_option;
    setAnswered(true);
    if (isCorrect) setCorrectCount((c) => c + 1);
    // Log answer
    await supabase.from("training_answers").insert({
      agent_id: userId,
      module_id: moduleId,
      question_id: current.id,
      selected_option: selected,
      is_correct: isCorrect,
      points_earned: isCorrect ? current.points : 0,
    } as any);
  }

  async function next() {
    if (qIdx + 1 < totalQ) {
      setQIdx((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      return;
    }
    // Compute final score
    const finalCorrect = correctCount;
    const scorePct = Math.round((finalCorrect / Math.max(totalQ, 1)) * 100);
    setFinalScore(scorePct);
    const passing = mod?.passing_score ?? 80;
    const passed = scorePct >= passing;
    await supabase.from("training_progress").upsert({
      agent_id: userId,
      module_id: moduleId,
      status: passed ? "completed" : "failed",
      score: scorePct,
      attempts: (currentProgress?.attempts ?? 0) + 1,
      completed_at: passed ? new Date().toISOString() : null,
    } as any, { onConflict: "agent_id,module_id" });
    toast({
      title: passed ? "Module complété!" : "Score insuffisant",
      description: passed ? `Bravo, score ${scorePct}%` : `${scorePct}% (${passing}% requis)`,
    });
    onCompleted();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mod.title_fr}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="quiz">Quiz</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground italic">
              Lire le contenu avant de commencer le quiz.
            </p>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {mod.content_fr || mod.description_fr || "Contenu en préparation."}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={startQuiz} className="bg-violet-600 hover:bg-violet-700 text-white">
                Commencer le quiz <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="pt-4">
            {totalQ === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune question disponible.</p>
            ) : finalScore !== null ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-4xl font-bold">{finalScore}%</div>
                {finalScore >= (mod.passing_score ?? 80) ? (
                  <p className="text-green-600 font-semibold">✅ Module complété!</p>
                ) : (
                  <p className="text-red-600 font-semibold">❌ Score insuffisant ({mod.passing_score ?? 80}% requis)</p>
                )}
                <Button onClick={onClose} variant="outline">Fermer</Button>
              </div>
            ) : current ? (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">Question {qIdx + 1} / {totalQ}</div>
                <div className="font-semibold">{current.question_fr}</div>
                <RadioGroup value={selected?.toString() ?? ""} onValueChange={(v) => !answered && setSelected(parseInt(v))}>
                  {optionsArr.map((opt, i) => {
                    const isCorrect = i === current.correct_option;
                    const isSel = i === selected;
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 border rounded-lg p-3 ${
                          answered && isCorrect ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
                          answered && isSel && !isCorrect ? "border-red-500 bg-red-50 dark:bg-red-950/20" :
                          ""
                        }`}
                      >
                        <RadioGroupItem value={i.toString()} id={`q-${i}`} disabled={answered} />
                        <Label htmlFor={`q-${i}`} className="cursor-pointer flex-1">{opt}</Label>
                        {answered && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {answered && isSel && !isCorrect && <XCircle className="h-4 w-4 text-red-600" />}
                      </div>
                    );
                  })}
                </RadioGroup>
                {answered && current.explanation_fr && (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded p-3">
                    💡 {current.explanation_fr}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  {!answered ? (
                    <Button onClick={answer} disabled={selected === null} className="bg-violet-600 hover:bg-violet-700 text-white">
                      Répondre
                    </Button>
                  ) : (
                    <Button onClick={next} className="bg-violet-600 hover:bg-violet-700 text-white">
                      {qIdx + 1 < totalQ ? "Question suivante" : "Voir mon score"}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
