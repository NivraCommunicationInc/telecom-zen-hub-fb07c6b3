/**
 * /entrevue/:token — Public AI interview page for job applicants.
 * Token-gated via RPC get_applicant_by_token. Submits to edge function interview-submit.
 * Features: Nova AI voice (Web Speech API TTS), 100-char minimum answers, bilingual FR/EN.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertCircle, Volume2, VolumeX, Sparkles, Mic } from "lucide-react";

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

const MIN_CHARS = 100;

const T = {
  fr: {
    loading: "Chargement…",
    invalid: "Lien invalide ou expiré.",
    alreadyDone: "Vous avez déjà complété cette entrevue. Merci!",
    novaTitle: "Nova — Assistante RH Nivra Telecom",
    novaSubtitle: "Entrevue virtuelle assistée par IA",
    welcomeTitle: "Bienvenue chez Nivra Telecom",
    intro: (n: string) =>
      `Bonjour ${n}. Je suis Nova, l'assistante RH de Nivra Telecom. Je suis là pour apprendre à vous connaître. Cette entrevue dure environ 15 minutes. Prenez votre temps pour répondre. Êtes-vous prêt à commencer?`,
    start: "Je suis prêt — commencer",
    progress: "Question",
    of: "sur",
    placeholder: "Votre réponse (minimum 100 caractères, soyez précis et honnête)…",
    minChars: `Minimum ${MIN_CHARS} caractères pour passer à la suivante.`,
    charsCount: (n: number) => `${n} / ${MIN_CHARS} caractères minimum`,
    next: "Suivante",
    previous: "Précédente",
    submit: "Soumettre l'entrevue",
    submitting: "Analyse en cours…",
    doneTitle: "Entrevue complétée — Merci!",
    doneText: "Votre entrevue a été soumise et analysée. Notre équipe vous contactera sous 24-48h ouvrables.",
    errorTitle: "Erreur",
    speaking: "Nova parle…",
    muteOn: "Activer la voix de Nova",
    muteOff: "Couper la voix de Nova",
    listenAgain: "Réécouter la question",
  },
  en: {
    loading: "Loading…",
    invalid: "Invalid or expired link.",
    alreadyDone: "You have already completed this interview. Thank you!",
    novaTitle: "Nova — HR Assistant at Nivra Telecom",
    novaSubtitle: "AI-assisted virtual interview",
    welcomeTitle: "Welcome to Nivra Telecom",
    intro: (n: string) =>
      `Hello ${n}. I am Nova, the HR assistant at Nivra Telecom. I am here to learn about you. This interview takes about 15 minutes. Take your time to answer each question. Are you ready to begin?`,
    start: "I'm ready — start",
    progress: "Question",
    of: "of",
    placeholder: "Your answer (minimum 100 characters, be specific and honest)…",
    minChars: `Minimum ${MIN_CHARS} characters to continue.`,
    charsCount: (n: number) => `${n} / ${MIN_CHARS} characters minimum`,
    next: "Next",
    previous: "Previous",
    submit: "Submit interview",
    submitting: "Analyzing…",
    doneTitle: "Interview completed — Thank you!",
    doneText: "Your interview has been submitted and analyzed. Our team will contact you within 24-48 business hours.",
    errorTitle: "Error",
    speaking: "Nova is speaking…",
    muteOn: "Turn on Nova's voice",
    muteOff: "Mute Nova's voice",
    listenAgain: "Replay question",
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
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [tried, setTried] = useState(false);
  const mutedRef = useRef(false);

  const lang = (applicant?.interview_language || "fr") as "fr" | "en";
  const t = T[lang];

  // ---------- Nova TTS ----------
  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (mutedRef.current) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "fr" ? "fr-CA" : "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      // Prefer a female-sounding voice if available
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(lang === "fr" ? "fr" : "en") &&
          /female|femme|google|samantha|amelie|amélie|virginie|nathalie/i.test(v.name)
      ) || voices.find((v) => v.lang.toLowerCase().startsWith(lang === "fr" ? "fr" : "en"));
      if (pref) utterance.voice = pref;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch { setSpeaking(false); }
  };

  const stopSpeaking = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) stopSpeaking();
  };

  // Warm up voices on mount (some browsers lazy-load voices)
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const handler = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener?.("voiceschanged", handler);
      return () => {
        window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  // Speak the current question when it changes
  useEffect(() => {
    if (step < 0) return;
    const q = questions[step];
    if (!q) return;
    setTried(false);
    const text = lang === "fr" ? q.question_fr : q.question_en;
    // Slight delay so the UI mounts cleanly
    const id = setTimeout(() => speak(text), 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, questions, lang]);

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

  // Speak welcome intro once applicant is loaded (requires user gesture in some browsers,
  // but we attempt; the start button will also trigger it again indirectly).
  useEffect(() => {
    if (applicant && step === -1 && !done) {
      const id = setTimeout(() => speak(t.intro(applicant.first_name)), 400);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant, step, done]);

  const startInterview = async () => {
    stopSpeaking();
    setStep(0);
    if (applicant) {
      try { await supabase.rpc("mark_interview_started", { _token: token! }); } catch { /* noop */ }
    }
  };

  const current = step >= 0 ? questions[step] : null;
  const currentAnswer = current ? (answers[current.id] || "") : "";
  const charCount = currentAnswer.trim().length;
  const canAdvance = charCount >= MIN_CHARS;

  const submit = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    stopSpeaking();
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

  const NovaHeader = () => (
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {speaking && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
          )}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-foreground">{t.novaTitle}</div>
          <div className="text-[11px] text-muted-foreground">
            {speaking ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <Mic className="h-3 w-3" /> {t.speaking}
              </span>
            ) : t.novaSubtitle}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        title={muted ? t.muteOn : t.muteOff}
        aria-label={muted ? t.muteOn : t.muteOff}
        className="h-9 w-9"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold tracking-tight text-primary">NIVRA</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Telecom — Recrutement</div>
        </div>

        {step === -1 && (
          <Card className="p-8">
            <NovaHeader />
            <h1 className="text-2xl font-bold mb-3">{t.welcomeTitle}</h1>
            <p className="text-muted-foreground leading-relaxed mb-4 whitespace-pre-line">
              {t.intro(applicant.first_name)}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {questions.length} {lang === "fr" ? "questions" : "questions"} • ~15 min
            </p>
            <Button size="lg" className="w-full" onClick={startInterview}>{t.start}</Button>
          </Card>
        )}

        {current && (
          <Card className="p-8">
            <NovaHeader />
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t.progress} {step + 1} {t.of} {questions.length}</span>
                <span className="uppercase tracking-wide">{current.category}</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="flex items-start gap-2 mb-4">
              <h2 className="text-xl font-semibold leading-snug flex-1">
                {lang === "fr" ? current.question_fr : current.question_en}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title={t.listenAgain}
                aria-label={t.listenAgain}
                onClick={() => speak(lang === "fr" ? current.question_fr : current.question_en)}
                disabled={muted}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>

            <Textarea
              rows={6}
              placeholder={t.placeholder}
              value={currentAnswer}
              onChange={(e) => setAnswers(prev => ({ ...prev, [current.id]: e.target.value }))}
              maxLength={4000}
              className={tried && !canAdvance ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            <div className="flex justify-between items-center text-xs mt-2">
              <span className={canAdvance ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                {t.charsCount(charCount)}
              </span>
              {!canAdvance && tried && (
                <span className="text-destructive font-medium">{t.minChars}</span>
              )}
            </div>

            {error && error !== "invalid" && (
              <div className="text-sm text-destructive mt-3">{t.errorTitle}: {error}</div>
            )}

            <div className="flex gap-3 justify-between mt-5">
              <Button
                variant="outline"
                disabled={step === 0 || submitting}
                onClick={() => { stopSpeaking(); setStep(s => Math.max(0, s - 1)); }}
              >
                {t.previous}
              </Button>
              {step < questions.length - 1 ? (
                <Button
                  disabled={submitting}
                  onClick={() => {
                    if (!canAdvance) { setTried(true); return; }
                    stopSpeaking();
                    setStep(s => s + 1);
                  }}
                >
                  {t.next}
                </Button>
              ) : (
                <Button
                  disabled={submitting}
                  onClick={() => {
                    if (!canAdvance) { setTried(true); return; }
                    submit();
                  }}
                >
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
