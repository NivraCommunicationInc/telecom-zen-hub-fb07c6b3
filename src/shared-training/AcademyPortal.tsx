/**
 * AcademyPortal — Nivra Academy unified portal (Field + OneView CS).
 * Renders modules → lessons (text/quiz/simulation) → certification.
 * Backed by training_modules, training_lessons, training_questions,
 * training_progress, training_answers, training_certifications,
 * training_simulations, training_simulation_sessions.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2, GraduationCap, BookOpen, CheckCircle2, Lock, Trophy,
  PlayCircle, ChevronRight, Send, Bot, Award, Sparkles,
  Package, DoorOpen, PhoneCall, Smartphone, Headphones, UserCheck,
  ShieldCheck, Scale, Receipt, ArrowLeft,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Sparkles, Package, DoorOpen, PhoneCall, Smartphone, Headphones,
  UserCheck, ShieldCheck, Scale, Receipt, BookOpen, GraduationCap,
};

type Portal = "field" | "cs";

type Module = {
  id: string; slug: string | null; portal: string; icon: string | null;
  title_fr: string; subtitle_fr: string | null; description_fr: string | null;
  category: string; order_index: number; passing_score: number;
  points_reward: number; estimated_minutes: number;
};

type Lesson = {
  id: string; module_id: string; order_index: number;
  lesson_type: string; title_fr: string; content_fr: string | null;
  video_url: string | null; image_url: string | null; duration_minutes: number;
};

type Question = {
  id: string; module_id: string; question_fr: string;
  options_fr: any; correct_option: number;
  explanation_fr: string | null; points: number; order_index: number;
};

type ProgressRow = {
  id: string; module_id: string; status: string; score: number;
  attempts: number; completed_at: string | null;
};

type Simulation = {
  id: string; persona_key: string; persona_label_fr: string;
  scenario_fr: string; difficulty: string;
  system_prompt_fr: string; portal: string;
};

export interface AcademyPortalProps {
  portal: Portal;
}

export default function AcademyPortal({ portal }: AcademyPortalProps) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showSim, setShowSim] = useState<Simulation | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: modules, isLoading } = useQuery({
    queryKey: ["academy-modules", portal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .eq("is_active", true)
        .in("portal", [portal, "both"])
        .order("order_index");
      if (error) throw error;
      return (data || []) as Module[];
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["academy-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("training_progress").select("*").eq("agent_id", userId!);
      const map: Record<string, ProgressRow> = {};
      (data || []).forEach((p: any) => { map[p.module_id] = p; });
      return map;
    },
  });

  const { data: certs } = useQuery({
    queryKey: ["academy-certs", userId, portal],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("training_certifications")
        .select("*")
        .eq("agent_id", userId!)
        .eq("is_active", true);
      return data || [];
    },
  });

  const overallPct = useMemo(() => {
    if (!modules?.length) return 0;
    const done = modules.filter((m) => progress?.[m.id]?.status === "completed").length;
    return Math.round((done / modules.length) * 100);
  }, [modules, progress]);

  const isCertified = (certs?.length ?? 0) > 0 && overallPct === 100;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <AcademyHeader portal={portal} overallPct={overallPct} isCertified={isCertified} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules?.map((m) => (
          <ModuleCard
            key={m.id}
            module={m}
            progress={progress?.[m.id]}
            onOpen={() => { setActiveModule(m); setActiveLessonIdx(0); }}
          />
        ))}
      </div>

      {activeModule && (
        <ModuleDialog
          module={activeModule}
          userId={userId}
          portal={portal}
          activeLessonIdx={activeLessonIdx}
          setActiveLessonIdx={setActiveLessonIdx}
          showQuiz={showQuiz}
          setShowQuiz={setShowQuiz}
          showSim={showSim}
          setShowSim={setShowSim}
          progress={progress?.[activeModule.id]}
          onClose={() => { setActiveModule(null); setShowQuiz(false); setShowSim(null); }}
          onProgressUpdated={() => {
            qc.invalidateQueries({ queryKey: ["academy-progress"] });
            qc.invalidateQueries({ queryKey: ["academy-certs"] });
          }}
        />
      )}
    </div>
  );
}

function AcademyHeader({ portal, overallPct, isCertified }: { portal: Portal; overallPct: number; isCertified: boolean }) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3"><GraduationCap className="h-8 w-8 text-primary" /></div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Nivra Academy</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Formation officielle — Portail {portal === "field" ? "Nivra Field" : "OneView CS"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Réussis tous les modules pour devenir <strong>certifié Nivra</strong>.
              </p>
            </div>
          </div>
          <div className="text-right">
            {isCertified ? (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/40 px-3 py-1.5">
                <Trophy className="h-4 w-4 mr-1.5" /> Certifié Nivra
              </Badge>
            ) : (
              <Badge variant="outline" className="px-3 py-1.5">
                <Award className="h-4 w-4 mr-1.5" /> En formation
              </Badge>
            )}
            <div className="mt-3 w-44">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-semibold">{overallPct}%</span>
              </div>
              <Progress value={overallPct} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleCard({ module: m, progress, onOpen }: { module: Module; progress?: ProgressRow; onOpen: () => void }) {
  const Icon = ICON_MAP[m.icon ?? "BookOpen"] ?? BookOpen;
  const completed = progress?.status === "completed";
  const inProgress = progress?.status === "in_progress";
  return (
    <Card className={cn("transition-all hover:shadow-lg cursor-pointer group", completed && "border-emerald-500/40")} onClick={onOpen}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className={cn("rounded-lg p-2.5", completed ? "bg-emerald-500/10" : "bg-primary/10")}>
            <Icon className={cn("h-5 w-5", completed ? "text-emerald-600" : "text-primary")} />
          </div>
          {completed && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          {inProgress && <Badge variant="outline" className="text-xs">En cours</Badge>}
        </div>
        <CardTitle className="text-base mt-3">{m.title_fr}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{m.subtitle_fr || m.description_fr}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>~{m.estimated_minutes} min</span>
          <span className="flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform">
            {completed ? "Revoir" : inProgress ? "Reprendre" : "Commencer"} <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleDialog({
  module: m, userId, portal, activeLessonIdx, setActiveLessonIdx,
  showQuiz, setShowQuiz, showSim, setShowSim, progress, onClose, onProgressUpdated,
}: any) {
  const { data: lessons } = useQuery({
    queryKey: ["academy-lessons", m.id],
    queryFn: async () => {
      const { data } = await supabase.from("training_lessons").select("*")
        .eq("module_id", m.id).eq("is_published", true).order("order_index");
      return (data || []) as Lesson[];
    },
  });

  const { data: simulations } = useQuery({
    queryKey: ["academy-sims", portal],
    queryFn: async () => {
      const { data } = await supabase.from("training_simulations").select("*")
        .eq("is_active", true).in("portal", [portal, "both"]).order("difficulty");
      return (data || []) as Simulation[];
    },
  });

  const startProgress = async () => {
    if (!userId) return;
    await supabase.from("training_progress").upsert({
      agent_id: userId, module_id: m.id, status: "in_progress",
      started_at: new Date().toISOString(),
    }, { onConflict: "agent_id,module_id" });
    onProgressUpdated();
  };

  useEffect(() => { if (userId && !progress) startProgress(); /* eslint-disable-next-line */ }, [userId]);

  const lesson = lessons?.[activeLessonIdx];
  const isLast = lessons && activeLessonIdx === lessons.length - 1;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!w-[96vw] !max-w-[1200px] !h-[94vh] !max-h-[94vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-xl truncate">{m.title_fr}</DialogTitle>
            <Badge variant="outline" className="shrink-0">{(activeLessonIdx + 1)}/{lessons?.length || 0}</Badge>
          </div>
          {lessons && lessons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {lessons.map((l: Lesson, i: number) => (
                <button
                  key={l.id}
                  onClick={() => { setActiveLessonIdx(i); setShowQuiz(false); setShowSim(null); }}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                    i === activeLessonIdx && !showQuiz
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted border-border text-muted-foreground"
                  )}
                  title={l.title_fr}
                >
                  {i + 1}. {l.title_fr.length > 28 ? l.title_fr.slice(0, 28) + "…" : l.title_fr}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        {showQuiz ? (
          <QuizPlayer module={m} userId={userId} onDone={() => { setShowQuiz(false); onProgressUpdated(); }} onBack={() => setShowQuiz(false)} />
        ) : showSim ? (
          <SimulationChat sim={showSim} userId={userId} onBack={() => setShowSim(null)} />
        ) : !lessons || lessons.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">Aucune leçon disponible.</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
              <LessonView lesson={lesson!} sims={simulations || []} onStartSim={(s) => setShowSim(s)} />
            </div>
            <div className="border-t px-6 py-3 flex items-center justify-between bg-muted/30 shrink-0">
              <Button variant="ghost" size="sm" disabled={activeLessonIdx === 0}
                onClick={() => setActiveLessonIdx(activeLessonIdx - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Précédent
              </Button>
              <span className="text-xs text-muted-foreground hidden md:inline">
                Leçon {activeLessonIdx + 1} sur {lessons.length} · ~{lesson?.duration_minutes || 8} min
              </span>
              {isLast ? (
                <Button onClick={() => setShowQuiz(true)}>
                  <Sparkles className="h-4 w-4 mr-2" /> Passer le quiz
                </Button>
              ) : (
                <Button onClick={() => setActiveLessonIdx(activeLessonIdx + 1)}>
                  Leçon suivante <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LessonView({ lesson, sims, onStartSim }: { lesson: Lesson; sims: Simulation[]; onStartSim: (s: Simulation) => void }) {
  if (lesson.lesson_type === "simulation") {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> {lesson.title_fr}</h3>
        <p className="text-sm text-muted-foreground">{lesson.content_fr}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {sims.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => onStartSim(s)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{s.persona_label_fr}</span>
                  <Badge variant="outline" className="text-xs">{s.difficulty}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{s.scenario_fr}</p>
                <Button size="sm" className="mt-3 w-full" variant="outline">
                  <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Démarrer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lesson.video_url && (
        <div className="aspect-video rounded-lg overflow-hidden bg-black">
          <video src={lesson.video_url} controls className="w-full h-full" />
        </div>
      )}
      {lesson.image_url && (
        <img src={lesson.image_url} alt={lesson.title_fr} className="rounded-lg max-h-80 w-full object-cover" />
      )}
      <LessonVisualBrief lesson={lesson} />
      <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-mt-20">
        <ReactMarkdown>{lesson.content_fr || ""}</ReactMarkdown>
      </article>
    </div>
  );
}

function LessonVisualBrief({ lesson }: { lesson: Lesson }) {
  const text = `${lesson.title_fr} ${lesson.content_fr || ""}`.toLowerCase();
  const isField = text.includes("nivra field") || text.includes("vente terrain") || text.includes("porte-à-porte");
  const isCs = text.includes("oneview") || text.includes("téléphone") || text.includes("support");
  const isProduct = text.includes("borne wifi") || text.includes("terminal tv") || text.includes("produits");

  const steps = isField
    ? ["CRM", "Adresse", "Services", "Équipement", "Résumé", "Consentement", "Commande"]
    : isCs
      ? ["File", "Client 360", "Compte", "Ticket", "KYC", "Activation", "Note"]
      : isProduct
        ? ["Disponibilité", "Service", "Mensuel", "Frais requis", "Taxes", "Confirmation"]
        : ["Écouter", "Vérifier", "Expliquer", "Confirmer", "Documenter"];

  const metrics = isProduct
    ? ["Borne WiFi 60 $", "Terminal TV 50 $", "SIM/eSIM 30 $"]
    : isField
      ? ["1 adresse validée", "1 résumé relu", "0 promesse inventée"]
      : isCs
        ? ["1 dossier complet", "1 prochaine étape", "1 note factuelle"]
        : ["Clarté", "Confiance", "Conformité"];

  return (
    <section className="rounded-lg border border-border bg-muted/30 p-4 md:p-5 space-y-4" aria-label="Résumé visuel de la leçon">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Carte de formation</p>
          <h4 className="text-base font-bold">{lesson.title_fr}</h4>
        </div>
        <Badge variant="outline">~{lesson.duration_minutes || 8} min</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {steps.map((step, index) => (
          <div key={step} className="rounded-md border border-border bg-card p-3 min-h-[74px]">
            <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {index + 1}
            </div>
            <p className="text-xs font-semibold leading-snug">{step}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {metrics.map((item) => (
          <div key={item} className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function QuizPlayer({ module: m, userId, onDone, onBack }: any) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const { data: questions } = useQuery({
    queryKey: ["academy-questions", m.id],
    queryFn: async () => {
      const { data } = await supabase.from("training_questions").select("*").eq("module_id", m.id).order("order_index");
      return (data || []) as Question[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId || !questions?.length) return;
      const { data: existing } = await supabase.from("training_progress")
        .select("id, attempts").eq("agent_id", userId).eq("module_id", m.id).maybeSingle();

      let correctPoints = 0; let totalPoints = 0;
      questions.forEach((q) => {
        totalPoints += q.points;
        if (answers[q.id] === q.correct_option) correctPoints += q.points;
      });
      const score = Math.round((correctPoints / totalPoints) * 100);
      const passed = score >= m.passing_score;

      const { data: prog } = await supabase.from("training_progress").upsert({
        id: existing?.id, agent_id: userId, module_id: m.id,
        status: passed ? "completed" : "failed", score, attempts: (existing?.attempts || 0) + 1,
        started_at: new Date().toISOString(),
        completed_at: passed ? new Date().toISOString() : null,
      }, { onConflict: "agent_id,module_id" }).select().single();

      // Persist answers
      if (prog?.id) {
        const rows = questions.map((q) => ({
          progress_id: prog.id, question_id: q.id,
          selected_option: answers[q.id] ?? -1,
          is_correct: answers[q.id] === q.correct_option,
          points_earned: answers[q.id] === q.correct_option ? q.points : 0,
        }));
        await supabase.from("training_answers").insert(rows);
      }

      setFinalScore(score);
      setSubmitted(true);

      // Auto-grant certification if all mandatory modules completed
      if (passed) {
        const { data: allMods } = await supabase.from("training_modules")
          .select("id, passing_score").eq("is_active", true).eq("is_mandatory", true);
        const { data: allProg } = await supabase.from("training_progress")
          .select("module_id, status, score").eq("agent_id", userId);
        const allDone = (allMods || []).every((mod) =>
          (allProg || []).some((p: any) => p.module_id === mod.id && p.status === "completed" && p.score >= mod.passing_score),
        );
        if (allDone) {
          await supabase.from("training_certifications").upsert({
            agent_id: userId, certification_name: "Nivra Academy Certified",
            certification_level: "certified", total_points: 0, is_active: true,
            issued_at: new Date().toISOString(),
          }, { onConflict: "agent_id,certification_level", ignoreDuplicates: false });
          toast.success("🎉 Certification Nivra obtenue !");
        } else {
          toast.success(`Module complété ! Score : ${score}%`);
        }
      } else {
        toast.error(`Score ${score}% — minimum ${m.passing_score}% requis. Tu peux réessayer.`);
      }
      qc.invalidateQueries({ queryKey: ["academy-progress"] });
      qc.invalidateQueries({ queryKey: ["academy-certs"] });
    },
  });

  if (!questions) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  if (submitted) {
    const passed = finalScore >= m.passing_score;
    return (
      <div className="p-8 text-center space-y-4">
        {passed ? (
          <Trophy className="h-16 w-16 mx-auto text-amber-500" />
        ) : (
          <Lock className="h-16 w-16 mx-auto text-destructive" />
        )}
        <h3 className="text-2xl font-bold">{passed ? "Bravo !" : "Pas encore"}</h3>
        <div className="text-5xl font-extrabold text-primary">{finalScore}%</div>
        <p className="text-muted-foreground">Score minimum requis : {m.passing_score}%</p>
        <Button onClick={onDone}>Retour au module</Button>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Quiz — {m.title_fr}</h3>
          <Button variant="ghost" size="sm" onClick={onBack}>Annuler</Button>
        </div>
        {questions.map((q, i) => {
          const opts = Array.isArray(q.options_fr) ? q.options_fr : [];
          return (
            <Card key={q.id}>
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm"><span className="text-primary">Q{i + 1}.</span> {q.question_fr}</p>
                <div className="space-y-2">
                  {opts.map((opt: string, oi: number) => (
                    <button key={oi} type="button"
                      onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                      className={cn("w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors",
                        answers[q.id] === oi ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                      {opt}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Button onClick={() => submit.mutate()} disabled={submit.isPending || Object.keys(answers).length !== questions.length} className="w-full" size="lg">
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Soumettre le quiz
        </Button>
      </div>
    </ScrollArea>
  );
}

function SimulationChat({ sim, userId, onBack }: { sim: Simulation; userId: string | null; onBack: () => void }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Initial AI greeting
    if (messages.length === 0 && userId) {
      send("__START__", true);
    }
    // eslint-disable-next-line
  }, [userId]);

  const send = async (text: string, isStart = false) => {
    const newMessages = isStart
      ? [{ role: "user" as const, content: "Bonjour" }]
      : [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("training-ai-simulate", {
        body: {
          simulation_id: sim.id,
          system_prompt: sim.system_prompt_fr,
          persona_label: sim.persona_label_fr,
          messages: newMessages,
        },
      });
      if (error) throw error;
      const reply = data?.reply || "...";
      setMessages([...newMessages, { role: "assistant", content: reply }]);

      // Persist session
      if (!sessionId && userId) {
        const { data: s } = await supabase.from("training_simulation_sessions").insert({
          agent_id: userId, simulation_id: sim.id,
          messages: [...newMessages, { role: "assistant", content: reply }],
          status: "in_progress",
        }).select().single();
        if (s) setSessionId(s.id);
      } else if (sessionId) {
        await supabase.from("training_simulation_sessions").update({
          messages: [...newMessages, { role: "assistant", content: reply }],
        }).eq("id", sessionId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur IA");
    } finally {
      setLoading(false);
    }
  };

  const evaluate = async () => {
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke("training-ai-evaluate", {
        body: { messages, persona_label: sim.persona_label_fr, scenario: sim.scenario_fr },
      });
      if (error) throw error;
      setEvaluation(data);
      if (sessionId) {
        await supabase.from("training_simulation_sessions").update({
          status: "completed", score: data?.score ?? 0,
          feedback: data, completed_at: new Date().toISOString(),
        }).eq("id", sessionId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur d'évaluation");
    } finally {
      setEvaluating(false);
    }
  };

  if (evaluation) {
    return (
      <ScrollArea className="max-h-[70vh]">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Évaluation IA</h3>
            <Button variant="ghost" size="sm" onClick={onBack}>Retour</Button>
          </div>
          <div className="text-center py-6 bg-muted/30 rounded-xl">
            <div className="text-6xl font-extrabold text-primary">{evaluation.score}/100</div>
            <Badge variant="outline" className="mt-2">{evaluation.verdict}</Badge>
          </div>
          {evaluation.summary_fr && <p className="text-sm">{evaluation.summary_fr}</p>}
          {evaluation.strengths?.length > 0 && (
            <Card><CardContent className="p-4">
              <h4 className="font-semibold mb-2 text-emerald-600">Forces</h4>
              <ul className="text-sm space-y-1 list-disc pl-5">{evaluation.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </CardContent></Card>
          )}
          {evaluation.weaknesses?.length > 0 && (
            <Card><CardContent className="p-4">
              <h4 className="font-semibold mb-2 text-amber-600">À améliorer</h4>
              <ul className="text-sm space-y-1 list-disc pl-5">{evaluation.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </CardContent></Card>
          )}
          {evaluation.recommendations?.length > 0 && (
            <Card><CardContent className="p-4">
              <h4 className="font-semibold mb-2 text-primary">Recommandations</h4>
              <ul className="text-sm space-y-1 list-disc pl-5">{evaluation.recommendations.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
            </CardContent></Card>
          )}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="border-b px-4 py-3 flex items-center justify-between bg-muted/30">
        <div>
          <p className="font-semibold text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> {sim.persona_label_fr}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{sim.scenario_fr}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>Annuler</Button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.slice(1).map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-muted rounded-2xl px-4 py-2"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
        </div>
      </ScrollArea>
      <div className="border-t p-3 space-y-2">
        <div className="flex gap-2">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim()) send(input.trim()); } }}
            placeholder="Tape ta réponse..." rows={2} className="resize-none" />
          <Button onClick={() => input.trim() && send(input.trim())} disabled={!input.trim() || loading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={evaluate} disabled={messages.length < 4 || evaluating}>
          {evaluating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Award className="h-4 w-4 mr-2" />}
          Terminer & évaluer
        </Button>
      </div>
    </div>
  );
}
