/**
 * /entrevue/:token — Public AI interview page for job applicants.
 * Token-gated via RPC get_applicant_by_token. Submits to edge function interview-submit.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  interview_language: "fr" | "en";
  status: string;
  interview_completed_at: string | null;
};

type Question = {
  id: string;
  question_fr: string;
  question_en: string;
  category: string;
  order_index: number;
};

const T = {
  fr: {
    loading: "Chargement…",
    invalid: "Lien invalide ou expiré.",
    alreadyDone: "Vous avez déjà complété cette entrevue. Merci!",
    welcomeTitle: "Bienvenue chez Nivra Telecom",
    welcomeIntro: (n: string) => `Bonjour ${n}, voici votre entrevue automatisée. Prenez votre temps, répondez avec honnêteté et soyez précis. Vos réponses seront analysées par notre IA et un recruteur humain.`,
    start: "Commencer l'entrevue",
    progress: "Question",
    of: "sur",
    placeholder: "Votre réponse (soyez précis et honnête)…",
    minChars: "Minimum 30 caractères pour passer à la suivante.",
    next: "Suivante",
    previous: "Précédente",
    submit: "Soumettre l'entrevue",
    submitting: "Analyse en cours…",
    doneTitle: "Entrevue complétée — Merci!",
    doneText: "Votre entrevue a été soumise et analysée. Notre équipe vous contactera sous 24-48h ouvrables.",
    errorTitle: "Erreur",
  },
  en: {
    loading: "Loading…",
    invalid: "Invalid or expired link.",
    alreadyDone: "You have already completed this interview. Thank you!",
    welcomeTitle: "Welcome to Nivra Telecom",
    welcomeIntro: (n: string) => `Hi ${n}, here is your automated interview. Take your time, answer honestly and be specific. Your answers will be analyzed by our AI and a human recruiter.`,
    start: "Start interview",
    progress: "Question",
    of: "of",
    placeholder: "Your answer (be specific and honest)…",
    minChars: "Minimum 30 characters to continue.",
    next: "Next",
    previous: "Previous",
    submit: "Submit interview",
    submitting: "Analyzing…",
    doneTitle: "Interview completed — Thank you!",
    doneText: "Your interview has been submitted and analyzed. Our team will contact you within 24-48 business hours.",
    errorTitle: "Error",
  },
};

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(-1); // -1 = welcome, 0..n-1 = questions
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = (applicant?.interview_language || "fr") as "fr" | "en";
  const t = T[lang];

  useEffect(() => {
    (async () => {
      if (!token) { setError("invalid"); setLoading(false); return; }
      try {
        const { data: appRes, error: appErr } = await supabase.rpc("get_applicant_by_token", { _token: token });
        if (appErr || !appRes || (Array.isArray(appRes) && appRes.length === 0)) {
          setError("invalid"); setLoading(false); return;
        }
        const a = Array.isArray(appRes) ? appRes[0] : appRes;
        setApplicant(a as Applicant);
        if ((a as Applicant).interview_completed_at) {
          setDone(true); setLoading(false); return;
        }
        const { data: qs } = await supabase
          .from("interview_questions")
          .select("id, question_fr, question_en, category, order_index")
          .eq("is_active", true)
          .order("order_index");
        setQuestions((qs || []) as Question[]);
      } catch (e: any) {
        setError(e?.message || "invalid");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const startInterview = async () => {
    setStep(0);
    if (applicant) {
      await supabase.rpc("mark_interview_started", { _token: token! }).catch(() => {});
    }
  };

  const current = step >= 0 ? questions[step] : null;
  const currentAnswer = current ? (answers[current.id] || "") : "";
  const canAdvance = currentAnswer.trim().length >= 30;

  const submit = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        token,
        answers: questions.map(q => ({ question_id: q.id, answer_text: answers[q.id] || "" })),
      };
      const { data, error: fnErr } = await supabase.functions.invoke("interview-submit", { body: payload });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "submit_failed");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = useMemo(() => {
    if (step < 0 || questions.length === 0) return 0;
    return Math.round(((step + 1) / questions.length) * 100);
  }, [step, questions.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === "invalid" || !applicant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-3" />
          <p className="text-lg font-medium">{t.invalid}</p>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-lg p-10 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t.doneTitle}</h1>
          <p className="text-muted-foreground">{t.doneText}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold tracking-tight text-primary">NIVRA</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Telecom — Recrutement</div>
        </div>

        {step === -1 && (
          <Card className="p-8 space-y-5">
            <h1 className="text-2xl font-bold">{t.welcomeTitle}</h1>
            <p className="text-muted-foreground leading-relaxed">{t.welcomeIntro(applicant.first_name)}</p>
            <p className="text-sm text-muted-foreground">
              {questions.length} {lang === "fr" ? "questions" : "questions"} • ~15 min
            </p>
            <Button size="lg" className="w-full" onClick={startInterview}>{t.start}</Button>
          </Card>
        )}

        {current && (
          <Card className="p-8 space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t.progress} {step + 1} {t.of} {questions.length}</span>
                <span className="uppercase tracking-wide">{current.category}</span>
              </div>
              <Progress value={progress} />
            </div>

            <h2 className="text-xl font-semibold leading-snug">
              {lang === "fr" ? current.question_fr : current.question_en}
            </h2>

            <Textarea
              rows={6}
              placeholder={t.placeholder}
              value={currentAnswer}
              onChange={(e) => setAnswers(prev => ({ ...prev, [current.id]: e.target.value }))}
              maxLength={4000}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{currentAnswer.trim().length} / 4000</span>
              {!canAdvance && <span>{t.minChars}</span>}
            </div>

            {error && error !== "invalid" && (
              <div className="text-sm text-destructive">{t.errorTitle}: {error}</div>
            )}

            <div className="flex gap-3 justify-between">
              <Button
                variant="outline"
                disabled={step === 0 || submitting}
                onClick={() => setStep(s => Math.max(0, s - 1))}
              >
                {t.previous}
              </Button>
              {step < questions.length - 1 ? (
                <Button disabled={!canAdvance} onClick={() => setStep(s => s + 1)}>{t.next}</Button>
              ) : (
                <Button disabled={!canAdvance || submitting} onClick={submit}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.submitting}</> : t.submit}
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
