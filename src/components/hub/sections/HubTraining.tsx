/**
 * HubTraining — Training videos/articles + quiz + certificates.
 * Quiz stored in hub_posts.rich_content as JSON: { quiz: [{ question, options:[], answer:number }] }
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, GraduationCap, PlayCircle, FileText, Award, CheckCircle2, X, BookOpen, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type QuizQ = { question: string; options: string[]; answer: number };

function readTime(text?: string) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function hasLessonContent(post: any) {
  return Boolean(
    (post?.content || "").trim() ||
    (post?.video_urls?.length ?? 0) > 0 ||
    (post?.document_urls?.length ?? 0) > 0 ||
    (post?.external_links?.length ?? 0) > 0
  );
}

export default function HubTraining({ search = "" }: { search?: string }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [active, setActive] = useState<any | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["hub-training"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_posts")
        .select("*")
        .eq("section", "training")
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["hub-training-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("hub_training_progress")
        .select("*")
        .eq("user_id", userId!);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => (map[p.post_id] = p));
      return map;
    },
  });

  const { data: certificates } = useQuery({
    queryKey: ["hub-certificates", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("hub_certificates")
        .select("*, hub_posts(title)")
        .eq("user_id", userId!)
        .order("issued_at", { ascending: false });
      return data || [];
    },
  });

  const markComplete = useMutation({
    mutationFn: async ({ postId, scoreValue }: { postId: string; scoreValue?: number }) => {
      if (!userId) throw new Error("Non connecté");
      const { error } = await supabase
        .from("hub_training_progress")
        .upsert(
          {
            user_id: userId,
            post_id: postId,
            completed: true,
            score: scoreValue ?? null,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,post_id" }
        );
      if (error) throw error;
      if (scoreValue !== undefined && scoreValue >= 70) {
        const { data: existing } = await supabase
          .from("hub_certificates")
          .select("id")
          .eq("user_id", userId)
          .eq("post_id", postId)
          .maybeSingle();
        if (!existing) {
          await supabase.from("hub_certificates").insert({ user_id: userId, post_id: postId });
        }
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["hub-training-progress", userId] });
      qc.invalidateQueries({ queryKey: ["hub-certificates", userId] });
      if (v.scoreValue !== undefined && v.scoreValue >= 70) {
        toast.success("Certificat émis 🎓");
      } else {
        toast.success("Marqué comme complété");
      }
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const filtered = (data || []).filter((p: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.title || "").toLowerCase().includes(s) || (p.content || "").toLowerCase().includes(s);
  });

  const quiz: QuizQ[] | null = useMemo(() => {
    const rc = active?.rich_content;
    if (!rc) return null;
    const q = Array.isArray(rc) ? rc : rc.quiz;
    return Array.isArray(q) && q.length > 0 ? q : null;
  }, [active]);

  function submitQuiz() {
    if (!quiz || !active) return;
    let correct = 0;
    quiz.forEach((q, i) => {
      if (answers[i] === q.answer) correct++;
    });
    const sc = Math.round((correct / quiz.length) * 100);
    setScore(sc);
    markComplete.mutate({ postId: active.id, scoreValue: sc });
  }

  const canStartActiveQuiz = active ? hasLessonContent(active) : false;

  function closeDialog() {
    setActive(null);
    setQuizMode(false);
    setAnswers({});
    setScore(null);
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalogue</TabsTrigger>
          <TabsTrigger value="certs">Mes certificats {certificates?.length ? `(${certificates.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {!filtered.length ? (
            <div className="text-center py-16">
              <GraduationCap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucune formation disponible.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl">
              {filtered.map((p: any) => {
                const hasVideo = (p.video_urls?.length ?? 0) > 0;
                const Icon = hasVideo ? PlayCircle : FileText;
                const done = progress?.[p.id]?.completed;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActive(p)}
                    className="text-left rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {p.media_urls?.[0] ? (
                      <div className="relative aspect-video bg-muted">
                        <img src={p.media_urls[0]} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                        {hasVideo && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <PlayCircle className="h-10 w-10 text-white drop-shadow-lg" />
                          </div>
                        )}
                        {done && (
                          <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted flex items-center justify-center">
                        <Icon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <Icon className="h-3 w-3" />
                        {hasVideo ? "Vidéo" : `Article · ${readTime(p.content)} min`}
                        {p.category && <><span>·</span><span>{p.category}</span></>}
                      </div>
                      <h4 className="text-sm font-semibold text-foreground line-clamp-2">{p.title}</h4>
                      {p.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.content}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certs" className="mt-4">
          {!certificates?.length ? (
            <div className="text-center py-16">
              <Award className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aucun certificat pour l'instant.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
              {certificates.map((c: any) => (
                <div key={c.id} className="rounded-xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                  <Award className="h-6 w-6 text-violet-600 mb-2" />
                  <div className="text-sm font-semibold">{c.hub_posts?.title || "Formation"}</div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">{c.certificate_number}</div>
                  <div className="text-[11px] text-muted-foreground">Émis le {new Date(c.issued_at).toLocaleDateString("fr-CA")}</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
              </DialogHeader>

              {!quizMode && score === null && (
                <div className="space-y-4">
                  {active.media_urls?.[0] && (
                    <img src={active.media_urls[0]} alt="" className="w-full rounded-lg" />
                  )}
                  {active.video_urls?.[0] && (
                    <a href={active.video_urls[0]} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-violet-600 hover:underline">
                      ▶ Ouvrir la vidéo
                    </a>
                  )}
                  <div className="text-sm whitespace-pre-line">{active.content}</div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {quiz ? (
                      <Button onClick={() => setQuizMode(true)} className="bg-violet-600 hover:bg-violet-700">
                        Passer le quiz ({quiz.length} questions)
                      </Button>
                    ) : (
                      <Button
                        onClick={() => markComplete.mutate({ postId: active.id })}
                        disabled={!userId || markComplete.isPending}
                        className="bg-violet-600 hover:bg-violet-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Marquer comme complété
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {quizMode && score === null && quiz && (
                <div className="space-y-4">
                  {quiz.map((q, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="text-sm font-semibold mb-2">{i + 1}. {q.question}</div>
                      <div className="space-y-1.5">
                        {q.options.map((opt, j) => (
                          <label key={j} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name={`q-${i}`}
                              checked={answers[i] === j}
                              onChange={() => setAnswers((a) => ({ ...a, [i]: j }))}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={submitQuiz}
                    disabled={Object.keys(answers).length < quiz.length}
                    className="bg-violet-600 hover:bg-violet-700 w-full"
                  >
                    Soumettre le quiz
                  </Button>
                </div>
              )}

              {score !== null && (
                <div className="text-center py-6 space-y-3">
                  <div className={cn("text-5xl font-bold", score >= 70 ? "text-emerald-500" : "text-red-500")}>
                    {score}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {score >= 70 ? "Bravo ! Certificat émis 🎓" : "Score insuffisant (70% requis). Réessayez !"}
                  </div>
                  <Button variant="outline" onClick={closeDialog}>
                    <X className="h-4 w-4 mr-2" /> Fermer
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
