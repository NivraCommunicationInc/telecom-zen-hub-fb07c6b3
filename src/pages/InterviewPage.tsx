/**
 * /entrevue/:token — Public AI interview page (video + voice edition).
 *
 * Flow: welcome → "how it works" instructions → camera/mic permission &
 * test → per-question video recording (Nova asks via ElevenLabs TTS,
 * candidate answers on webcam) → auto transcription → submit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Sparkles,
  Mic,
  Video,
  Camera,
  RotateCcw,
  Square,
  Play,
  Clock,
  ShieldCheck,
  PhoneCall,
} from "lucide-react";

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

type RecordedAnswer = {
  blob: Blob;
  url: string;
  durationSeconds: number;
  uploadedPath?: string;
  transcript?: string;
};

const EDGE_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const MIN_SECONDS = 15;
const MAX_SECONDS = 180;
const VIDEO_MIME =
  typeof MediaRecorder !== "undefined"
    ? (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm")
    : "video/webm";

const T = {
  fr: {
    loading: "Chargement…",
    invalid: "Lien invalide ou expiré.",
    alreadyDone: "Vous avez déjà complété cette entrevue. Merci!",
    novaTitle: "Nova — Assistante RH Nivra Telecom",
    novaSubtitle: "Entrevue virtuelle vidéo assistée par IA",
    welcomeTitle: "Bienvenue chez Nivra Telecom",
    welcomeBody: (n: string) =>
      `Bonjour ${n}. Je suis Nova, votre interlocutrice virtuelle. Nous allons faire ensemble une courte entrevue vidéo pour mieux vous connaître. Préparez‑vous, prenez une grande respiration, et cliquez sur « Voir comment ça fonctionne » lorsque vous êtes prêt.`,
    nextHow: "Voir comment ça fonctionne",
    howTitle: "Comment fonctionne votre entrevue",
    howIntro:
      "Voici exactement ce qui va se passer. Lisez attentivement avant de commencer — vous serez ensuite prêt à répondre avec confiance.",
    howSteps: [
      {
        icon: "speaker",
        title: "Nova vous parle",
        body:
          "À chaque étape, Nova lit la question à voix haute avec une voix naturelle. Vous pouvez la réécouter autant de fois que nécessaire.",
      },
      {
        icon: "video",
        title: "Vous répondez par vidéo",
        body:
          "Votre caméra et votre micro sont utilisés pour enregistrer votre réponse. C'est comme un appel vidéo — regardez la caméra, parlez naturellement.",
      },
      {
        icon: "scenario",
        title: "Mises en situation télécom",
        body:
          "Plusieurs questions sont des mises en situation réelles de porte-à-porte (ex.: un client refuse, un client est satisfait avec Bell, etc.). Répondez comme si vous étiez devant la porte.",
      },
      {
        icon: "rec",
        title: "15 à 180 secondes par réponse",
        body:
          "Prenez au moins 15 secondes pour développer. Vous pouvez réécouter et refaire votre vidéo avant de la valider. Une fois validée, on passe à la suivante.",
      },
      {
        icon: "shield",
        title: "Confidentiel et sécurisé",
        body:
          "Vos vidéos sont stockées de façon chiffrée et accessibles uniquement à l'équipe RH de Nivra Telecom. Elles ne seront jamais partagées.",
      },
    ],
    tipsTitle: "Conseils pour réussir",
    tips: [
      "Trouvez un endroit calme, bien éclairé (lumière en face de vous).",
      "Tenez votre téléphone ou ordinateur stable, à hauteur du visage.",
      "Parlez clairement, naturellement, comme dans une vraie conversation.",
      "Soyez honnête : Nova évalue l'authenticité, pas la perfection.",
    ],
    duration: "Durée totale estimée : 15 à 20 minutes",
    nextSetup: "Continuer — autoriser caméra et micro",
    setupTitle: "Test de votre caméra et de votre micro",
    setupBody:
      "Cliquez sur le bouton ci-dessous pour autoriser l'accès. Vous verrez ensuite votre image et un niveau audio. Vérifiez que tout fonctionne avant de commencer.",
    askPerm: "Autoriser caméra et micro",
    permDeniedTitle: "Accès refusé",
    permDeniedBody:
      "Nous n'avons pas pu accéder à votre caméra ou votre micro. Vérifiez les permissions de votre navigateur puis recliquez sur le bouton.",
    retryPerm: "Réessayer",
    audioLevel: "Niveau audio",
    audioHint:
      "Parlez normalement. La barre verte doit bouger lorsque vous parlez.",
    cameraOk: "Caméra et micro prêts.",
    startInterview: "Je suis prêt — commencer l'entrevue",
    progress: "Question",
    of: "sur",
    novaSpeaking: "Nova parle…",
    novaPreparing: "Nova prépare la mise en situation…",
    listenFirst: "Écoutez Nova avant de répondre.",
    listenAgain: "Réécouter la question",
    notReadyYet: "Préparation de votre réponse…",
    record: "Démarrer l'enregistrement",
    stop: "Arrêter",
    redo: "Refaire",
    review: "Revoir ma vidéo",
    validate: "Valider et continuer",
    submitInterview: "Terminer et soumettre",
    submitting: "Envoi et analyse en cours…",
    transcribing: "Transcription de votre réponse…",
    uploading: "Téléversement…",
    minSec: (s: number) =>
      `Minimum ${MIN_SECONDS} secondes (actuellement ${s}s).`,
    maxSec: `Limite ${MAX_SECONDS} secondes atteinte — arrêt automatique.`,
    elapsed: "Temps écoulé",
    doneTitle: "Entrevue complétée — Merci!",
    doneText:
      "Votre entrevue vidéo a été envoyée et analysée. Notre équipe RH la révisera et vous reviendra sous 24 à 48 heures ouvrables.",
    errorTitle: "Erreur",
    needRecord: "Veuillez enregistrer une vidéo de réponse pour continuer.",
    muteOn: "Activer la voix de Nova",
    muteOff: "Couper la voix de Nova",
    cancelRetake: "Annuler",
  },
  en: {
    loading: "Loading…",
    invalid: "Invalid or expired link.",
    alreadyDone: "You have already completed this interview. Thank you!",
    novaTitle: "Nova — HR Assistant at Nivra Telecom",
    novaSubtitle: "AI-assisted virtual video interview",
    welcomeTitle: "Welcome to Nivra Telecom",
    welcomeBody: (n: string) =>
      `Hello ${n}. I am Nova, your virtual interviewer. We will do a short video interview together to get to know you. Take a deep breath, then click "See how it works" when you are ready.`,
    nextHow: "See how it works",
    howTitle: "How your interview works",
    howIntro:
      "Here is exactly what is going to happen. Read carefully before starting — you will then be ready to answer with confidence.",
    howSteps: [
      {
        icon: "speaker",
        title: "Nova speaks to you",
        body:
          "At each step, Nova reads the question aloud with a natural voice. You can replay it as many times as you need.",
      },
      {
        icon: "video",
        title: "You answer on video",
        body:
          "Your camera and microphone are used to record your answer. It is like a video call — look at the camera and speak naturally.",
      },
      {
        icon: "scenario",
        title: "Real telecom scenarios",
        body:
          "Several questions are real door-to-door scenarios (e.g. a customer refuses, a customer is happy with Bell, etc.). Answer as if you were standing at the door.",
      },
      {
        icon: "rec",
        title: "15 to 180 seconds per answer",
        body:
          "Take at least 15 seconds to develop your answer. You can replay and re-record before validating. Once validated, we move to the next.",
      },
      {
        icon: "shield",
        title: "Confidential and secure",
        body:
          "Your videos are stored securely and accessible only to the Nivra Telecom HR team. They will never be shared.",
      },
    ],
    tipsTitle: "Tips to succeed",
    tips: [
      "Find a quiet, well-lit spot (light facing you).",
      "Hold your phone or laptop steady, at face height.",
      "Speak clearly and naturally, like a real conversation.",
      "Be honest — Nova evaluates authenticity, not perfection.",
    ],
    duration: "Estimated total duration: 15 to 20 minutes",
    nextSetup: "Continue — allow camera and microphone",
    setupTitle: "Test your camera and microphone",
    setupBody:
      "Click the button below to allow access. You will then see your image and an audio level. Check that everything works before starting.",
    askPerm: "Allow camera and microphone",
    permDeniedTitle: "Access denied",
    permDeniedBody:
      "We could not access your camera or microphone. Check your browser permissions and try again.",
    retryPerm: "Retry",
    audioLevel: "Audio level",
    audioHint:
      "Speak normally. The green bar should move when you talk.",
    cameraOk: "Camera and microphone ready.",
    startInterview: "I'm ready — start the interview",
    progress: "Question",
    of: "of",
    novaSpeaking: "Nova is speaking…",
    novaPreparing: "Nova is preparing the scenario…",
    listenFirst: "Listen to Nova before answering.",
    listenAgain: "Replay the question",
    notReadyYet: "Preparing your answer…",
    record: "Start recording",
    stop: "Stop",
    redo: "Re-record",
    review: "Review my video",
    validate: "Validate and continue",
    submitInterview: "Finish and submit",
    submitting: "Sending and analyzing…",
    transcribing: "Transcribing your answer…",
    uploading: "Uploading…",
    minSec: (s: number) => `Minimum ${MIN_SECONDS} seconds (currently ${s}s).`,
    maxSec: `Limit of ${MAX_SECONDS} seconds reached — stopping automatically.`,
    elapsed: "Elapsed",
    doneTitle: "Interview completed — Thank you!",
    doneText:
      "Your video interview has been submitted and analyzed. Our HR team will review it and get back to you within 24 to 48 business hours.",
    errorTitle: "Error",
    needRecord: "Please record a video answer to continue.",
    muteOn: "Turn on Nova's voice",
    muteOff: "Mute Nova's voice",
    cancelRetake: "Cancel",
  },
};

type Phase = "welcome" | "how" | "setup" | "interview";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, RecordedAnswer>>({});
  const [phase, setPhase] = useState<Phase>("welcome");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [questionSpoken, setQuestionSpoken] = useState(false);
  const [permState, setPermState] = useState<"idle" | "asking" | "granted" | "denied">("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [processing, setProcessing] = useState<null | "uploading" | "transcribing">(null);

  const mutedRef = useRef(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speakSeqRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);

  const lang = (applicant?.interview_language || "fr") as "fr" | "en";
  const t = T[lang];

  // ---------- Load applicant + questions ----------
  useEffect(() => {
    (async () => {
      if (!token) { setError("invalid"); setLoading(false); return; }
      try {
        const { data: appRes, error: appErr } = await supabase.rpc(
          "get_applicant_by_token",
          { _token: token },
        );
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

  // ---------- Cleanup on unmount ----------
  useEffect(() => {
    return () => {
      stopTts();
      stopStream();
      stopAudioMeter();
      Object.values(answers).forEach(a => {
        if (a.url) URL.revokeObjectURL(a.url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- ElevenLabs TTS ----------
  const stopTts = useCallback(() => {
    speakSeqRef.current += 1;
    if (audioElRef.current) {
      try { audioElRef.current.pause(); } catch { /* noop */ }
    }
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setTtsLoading(false);
    setSpeaking(false);
  }, []);

  const speakWithBrowserFallback = useCallback((text: string, onFinished?: () => void) => {
    if (!text.trim() || !("speechSynthesis" in window)) {
      onFinished?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "fr" ? "fr-CA" : "en-CA";
      utterance.rate = 0.82;
      utterance.pitch = 0.95;
      utterance.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.toLowerCase() === utterance.lang.toLowerCase())
        || voices.find(v => v.lang.toLowerCase().startsWith(lang));
      if (preferred) utterance.voice = preferred;
      setSpeaking(true);
      utterance.onend = () => { setSpeaking(false); onFinished?.(); };
      utterance.onerror = () => { setSpeaking(false); onFinished?.(); };
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeaking(false);
      onFinished?.();
    }
  }, [lang]);

  const speak = useCallback(async (text: string, onFinished?: () => void) => {
    if (!token || mutedRef.current || !text.trim()) {
      onFinished?.();
      return;
    }
    const seq = speakSeqRef.current + 1;
    speakSeqRef.current = seq;
    stopTts();
    try {
      speakSeqRef.current = seq;
      setTtsLoading(true);
      const url = `${EDGE_BASE_URL}/interview-tts`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, text, lang }),
      });
      if (!res.ok) {
        setTtsLoading(false);
        speakWithBrowserFallback(text, onFinished);
        return;
      }
      const blob = await res.blob();
      if (speakSeqRef.current !== seq) return;
      const blobUrl = URL.createObjectURL(blob);
      audioUrlRef.current = blobUrl;
      const audio = new Audio(blobUrl);
      audioElRef.current = audio;
      audio.onended = () => {
        if (speakSeqRef.current === seq) {
          setSpeaking(false);
          onFinished?.();
        }
      };
      audio.onerror = () => {
        if (speakSeqRef.current === seq) {
          setSpeaking(false);
          onFinished?.();
        }
      };
      setTtsLoading(false);
      setSpeaking(true);
      await audio.play().catch(() => {
        if (speakSeqRef.current === seq) {
          setSpeaking(false);
          speakWithBrowserFallback(text, onFinished);
        }
      });
    } catch {
      setTtsLoading(false);
      setSpeaking(false);
      speakWithBrowserFallback(text, onFinished);
    }
  }, [token, lang, stopTts, speakWithBrowserFallback]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) stopTts();
  };

  // ---------- Camera / Mic ----------
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const stopAudioMeter = () => {
    if (meterRafRef.current) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* noop */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const startAudioMeter = (stream: MediaStream) => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx: AudioContext = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* noop */ }
  };

  const askPermission = async () => {
    setPermState("asking");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        videoPreviewRef.current.play().catch(() => { /* noop */ });
      }
      startAudioMeter(stream);
      setPermState("granted");
    } catch (e) {
      console.warn("getUserMedia failed", e);
      setPermState("denied");
    }
  };

  // Re-bind preview when phase or step changes if we already have a stream
  useEffect(() => {
    if (streamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
      videoPreviewRef.current.muted = true;
      videoPreviewRef.current.play().catch(() => { /* noop */ });
    }
  }, [phase, step]);

  // ---------- Recording ----------
  const currentQuestion = phase === "interview" ? questions[step] : null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const buildQuestionNarration = useCallback((question: Question) => {
    const questionText = lang === "fr" ? question.question_fr : question.question_en;
    if (lang === "fr") {
      return `Question ${step + 1}. Mise en situation Nivra Telecom. ${questionText} Prenez quelques secondes pour structurer votre réponse. Quand vous êtes prêt, répondez comme si j'étais le client devant vous.`;
    }
    return `Question ${step + 1}. Nivra Telecom scenario. ${questionText} Take a few seconds to structure your answer. When you are ready, answer as if I were the customer in front of you.`;
  }, [lang, step]);

  const startRecording = () => {
    if (!streamRef.current || recording || speaking || ttsLoading || !questionSpoken) return;
    recordedChunksRef.current = [];
    try {
      const rec = new MediaRecorder(streamRef.current, { mimeType: VIDEO_MIME });
      recorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: VIDEO_MIME });
        const url = URL.createObjectURL(blob);
        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        if (currentQuestion) {
          setAnswers(prev => {
            const old = prev[currentQuestion.id];
            if (old?.url) URL.revokeObjectURL(old.url);
            return {
              ...prev,
              [currentQuestion.id]: { blob, url, durationSeconds: duration },
            };
          });
        }
        setRecording(false);
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };
      stopTts();
      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      rec.start();
      setRecording(true);
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartRef.current) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) {
          stopRecording();
        }
      }, 250);
    } catch (e) {
      console.warn("MediaRecorder failed", e);
      setError(String((e as Error)?.message || e));
    }
  };

  const stopRecording = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch { /* noop */ }
  };

  const redoCurrent = () => {
    if (!currentQuestion) return;
    const old = answers[currentQuestion.id];
    if (old?.url) URL.revokeObjectURL(old.url);
    setAnswers(prev => {
      const copy = { ...prev };
      delete copy[currentQuestion.id];
      return copy;
    });
    setRecordSeconds(0);
  };

  // ---------- Validate (advance immediately; upload + transcribe in background, in parallel) ----------
  const validateAndNext = async () => {
    if (!currentQuestion || !currentAnswer || !token) return;
    if (currentAnswer.durationSeconds < MIN_SECONDS) {
      setError(t.minSec(currentAnswer.durationSeconds));
      return;
    }
    setError(null);

    const q = currentQuestion;
    const ans = currentAnswer;
    const isLast = step >= questions.length - 1;

    // Kick off upload + transcription in parallel (don't await before advancing)
    const path = ans.uploadedPath || `${token}/${q.id}.webm`;
    const uploadPromise: Promise<string> = ans.uploadedPath
      ? Promise.resolve(ans.uploadedPath)
      : supabase.storage
          .from("interview-videos")
          .upload(path, ans.blob, { contentType: VIDEO_MIME, upsert: true })
          .then(({ error: upErr }) => {
            if (upErr) throw upErr;
            return path;
          });

    const transcribePromise: Promise<string> = ans.transcript
      ? Promise.resolve(ans.transcript)
      : fetch(
          `https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/interview-transcribe?token=${encodeURIComponent(token)}&lang=${lang}`,
          { method: "POST", headers: { "Content-Type": VIDEO_MIME }, body: ans.blob },
        )
          .then(async (res) => {
            if (!res.ok) return "";
            const j = await res.json().catch(() => ({}));
            return String(j?.transcript || "").trim();
          })
          .catch(() => "");

    const finalize = Promise.all([uploadPromise, transcribePromise])
      .then(([uploadedPath, transcript]) => {
        setAnswers((prev) => ({
          ...prev,
          [q.id]: { ...ans, uploadedPath, transcript: transcript || "" },
        }));
        return { uploadedPath, transcript: transcript || "" };
      });

    if (!isLast) {
      // Advance immediately for snappy UX
      stopTts();
      setQuestionSpoken(false);
      setStep((s) => s + 1);
      setRecordSeconds(0);
      // Surface background errors if upload fails
      finalize.catch((e: any) => setError(e?.message || "upload_failed"));
    } else {
      // Last question: wait for upload+transcript then submit
      setProcessing("uploading");
      try {
        const { uploadedPath, transcript } = await finalize;
        setProcessing(null);
        await submitAll({
          ...answers,
          [q.id]: { ...ans, uploadedPath, transcript },
        });
      } catch (e: any) {
        setProcessing(null);
        setError(e?.message || "upload_failed");
      }
    }
  };

  const submitAll = async (finalAnswers: Record<string, RecordedAnswer>) => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    stopTts();
    try {
      const payload = {
        token,
        answers: questions.map(q => {
          const a = finalAnswers[q.id];
          return {
            question_id: q.id,
            answer_text: a?.transcript || "",
            transcript: a?.transcript || "",
            transcript_lang: lang,
            video_url: a?.uploadedPath || null,
            video_duration_seconds: a?.durationSeconds || 0,
          };
        }),
      };
      const { data, error: fnErr } = await supabase.functions.invoke(
        "interview-submit",
        { body: payload },
      );
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      stopStream();
      stopAudioMeter();
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "submit_failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Speak welcome / question text ----------
  useEffect(() => {
    if (!applicant) return;
    if (phase === "welcome") {
      const id = setTimeout(() => speak(t.welcomeBody(applicant.first_name)), 400);
      return () => clearTimeout(id);
    }
  }, [applicant, phase, speak, t]);

  useEffect(() => {
    if (phase !== "interview" || !currentQuestion) return;
    setQuestionSpoken(false);
    const text = buildQuestionNarration(currentQuestion);
    const id = setTimeout(() => speak(text, () => setQuestionSpoken(true)), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step, currentQuestion?.id, lang, buildQuestionNarration]);

  const progress = useMemo(() => {
    if (phase !== "interview" || questions.length === 0) return 0;
    return Math.round(((step + 1) / questions.length) * 100);
  }, [phase, step, questions.length]);

  // ---------- Render ----------

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
            {ttsLoading ? (
              <span className="inline-flex items-center gap-1 text-primary font-medium">
                <Loader2 className="h-3 w-3 animate-spin" /> {t.novaPreparing}
              </span>
            ) : speaking ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <Mic className="h-3 w-3" /> {t.novaSpeaking}
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

  const StepIcon = ({ icon }: { icon: string }) => {
    const cls = "h-5 w-5 text-primary";
    if (icon === "speaker") return <Volume2 className={cls} />;
    if (icon === "video") return <Video className={cls} />;
    if (icon === "scenario") return <PhoneCall className={cls} />;
    if (icon === "rec") return <Clock className={cls} />;
    if (icon === "shield") return <ShieldCheck className={cls} />;
    return <Sparkles className={cls} />;
  };

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold tracking-tight text-primary">NIVRA</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
            Telecom — Recrutement
          </div>
        </div>

        {/* ---------- WELCOME ---------- */}
        {phase === "welcome" && (
          <Card className="p-8">
            <NovaHeader />
            <h1 className="text-2xl font-bold mb-3">{t.welcomeTitle}</h1>
            <p className="text-muted-foreground leading-relaxed mb-6 whitespace-pre-line">
              {t.welcomeBody(applicant.first_name)}
            </p>
            <Button size="lg" className="w-full" onClick={() => { stopTts(); setPhase("how"); }}>
              {t.nextHow}
            </Button>
          </Card>
        )}

        {/* ---------- HOW IT WORKS ---------- */}
        {phase === "how" && (
          <Card className="p-8">
            <NovaHeader />
            <h1 className="text-2xl font-bold mb-2">{t.howTitle}</h1>
            <p className="text-muted-foreground mb-6">{t.howIntro}</p>

            <div className="space-y-4 mb-6">
              {t.howSteps.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <StepIcon icon={s.icon} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-1">{s.title}</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-6">
              <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> {t.tipsTitle}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                {t.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>

            <div className="text-xs text-muted-foreground text-center mb-4">{t.duration}</div>
            <Button size="lg" className="w-full" onClick={() => { stopTts(); setPhase("setup"); }}>
              {t.nextSetup}
            </Button>
          </Card>
        )}

        {/* ---------- SETUP / PERMISSION ---------- */}
        {phase === "setup" && (
          <Card className="p-8">
            <NovaHeader />
            <h1 className="text-2xl font-bold mb-2">{t.setupTitle}</h1>
            <p className="text-muted-foreground mb-5">{t.setupBody}</p>

            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-4 flex items-center justify-center">
              {permState === "granted" ? (
                <video
                  ref={videoPreviewRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              ) : (
                <Camera className="h-16 w-16 text-white/30" />
              )}
            </div>

            {permState === "granted" && (
              <>
                <div className="text-xs font-medium mb-1 flex justify-between">
                  <span>{t.audioLevel}</span>
                  <span className="text-muted-foreground">{audioLevel}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-100"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-5">{t.audioHint}</p>

                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium p-3 mb-5 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> {t.cameraOk}
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  onClick={async () => {
                    stopTts();
                    try { await supabase.rpc("mark_interview_started", { _token: token! }); } catch { /* noop */ }
                    setPhase("interview");
                    setStep(0);
                  }}
                >
                  {t.startInterview}
                </Button>
              </>
            )}

            {permState !== "granted" && (
              <>
                {permState === "denied" && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 mb-4">
                    <div className="font-semibold mb-1">{t.permDeniedTitle}</div>
                    <div>{t.permDeniedBody}</div>
                  </div>
                )}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={askPermission}
                  disabled={permState === "asking"}
                >
                  {permState === "asking" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.askPerm}</>
                  ) : permState === "denied" ? t.retryPerm : t.askPerm}
                </Button>
              </>
            )}
          </Card>
        )}

        {/* ---------- INTERVIEW (PER QUESTION) ---------- */}
        {phase === "interview" && currentQuestion && (
          <Card className="p-8">
            <NovaHeader />

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t.progress} {step + 1} {t.of} {questions.length}</span>
                <span className="uppercase tracking-wide">{currentQuestion.category}</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="flex items-start gap-2 mb-5">
              <h2 className="text-xl font-semibold leading-snug flex-1">
                {lang === "fr" ? currentQuestion.question_fr : currentQuestion.question_en}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title={t.listenAgain}
                aria-label={t.listenAgain}
                onClick={() =>
                  speak(buildQuestionNarration(currentQuestion), () => setQuestionSpoken(true))
                }
                disabled={muted || speaking || ttsLoading}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>

            {!questionSpoken && !currentAnswer && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary p-3 mb-4 flex items-center gap-2">
                {ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                {ttsLoading || speaking ? t.novaSpeaking : t.listenFirst}
              </div>
            )}

            {/* Video stage */}
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-3 relative">
              {currentAnswer ? (
                <video
                  src={currentAnswer.url}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                />
              ) : (
                <video
                  ref={videoPreviewRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              )}
              {recording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  REC {String(Math.floor(recordSeconds / 60)).padStart(1, "0")}:
                  {String(recordSeconds % 60).padStart(2, "0")}
                </div>
              )}
              {!recording && currentAnswer && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-emerald-600/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {String(Math.floor(currentAnswer.durationSeconds / 60)).padStart(1, "0")}:
                  {String(currentAnswer.durationSeconds % 60).padStart(2, "0")}
                </div>
              )}
            </div>

            {recording && (
              <div className="text-xs text-muted-foreground mb-3">
                {t.elapsed}: {recordSeconds}s • Max {MAX_SECONDS}s
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive mb-3">{t.errorTitle}: {error}</div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap gap-3 justify-end">
              {!currentAnswer && !recording && (
                <Button onClick={startRecording} disabled={!!processing || speaking || ttsLoading || !questionSpoken} size="lg">
                  <Video className="h-4 w-4 mr-2" /> {questionSpoken ? t.record : t.notReadyYet}
                </Button>
              )}
              {recording && (
                <Button onClick={stopRecording} variant="destructive" size="lg">
                  <Square className="h-4 w-4 mr-2" /> {t.stop}
                </Button>
              )}
              {currentAnswer && !recording && (
                <>
                  <Button variant="outline" onClick={redoCurrent} disabled={!!processing || submitting}>
                    <RotateCcw className="h-4 w-4 mr-2" /> {t.redo}
                  </Button>
                  <Button
                    onClick={validateAndNext}
                    disabled={!!processing || submitting}
                    size="lg"
                  >
                    {processing === "uploading" && (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.uploading}</>
                    )}
                    {processing === "transcribing" && (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.transcribing}</>
                    )}
                    {!processing && submitting && (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.submitting}</>
                    )}
                    {!processing && !submitting && (
                      step < questions.length - 1
                        ? <><Play className="h-4 w-4 mr-2" /> {t.validate}</>
                        : <><CheckCircle2 className="h-4 w-4 mr-2" /> {t.submitInterview}</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
