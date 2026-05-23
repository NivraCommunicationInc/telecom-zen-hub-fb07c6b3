/**
 * NovaConversation — Streaming voice conversation with NOVA.
 *
 *   <NovaConversation agentId="<your-elevenlabs-agent-id>" />
 *
 * Uses ElevenLabs Conversational AI (@elevenlabs/react) for:
 *   - Real-time STT (no push-to-talk — just talk, VAD detects when you stop)
 *   - Streaming TTS (NOVA starts speaking before generation finishes)
 *   - Natural interruptions (you can cut NOVA off mid-sentence and it stops)
 *   - Low latency (<500 ms target)
 *
 * The agent itself runs on ElevenLabs servers. We tell it to use our
 * `nova-llm-openai-compat` endpoint as the Custom LLM — that way the
 * "brain" stays in Claude Sonnet 4.7 with all our tools.
 *
 * Frontend tool-call hooks: when NOVA returns a `frontend_action`
 * (navigate / open_client_360 / etc.), we execute it here so voice
 * commands can actually pilot the UI.
 *
 * Configuration:
 *   - Create an agent in ElevenLabs (see docs/NOVA_VOICE_SETUP.md)
 *   - Copy the agent_id and pass it as a prop OR set VITE_NOVA_AGENT_ID
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, PhoneOff, AlertCircle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TranscriptMessage {
  id: string;
  source: "user" | "ai";
  text: string;
  at: number;
}

interface Props {
  /** ElevenLabs agent ID. Defaults to VITE_NOVA_AGENT_ID env. */
  agentId?: string;
  /** Optional className for the container */
  className?: string;
}

export function NovaConversation({
  agentId = (import.meta.env.VITE_NOVA_AGENT_ID as string | undefined) ?? "",
  className,
}: Props) {
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Visual: live audio level for the animated ring
  const [audioLevel, setAudioLevel] = useState(0);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      toast.success("NOVA est à l'écoute");
    },
    onDisconnect: () => {
      // Quiet — handled in stop()
    },
    onMessage: (msg: { source: "user" | "ai"; message: string }) => {
      setTranscript((prev) => [
        ...prev,
        {
          id: `${msg.source}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: msg.source,
          text: msg.message,
          at: Date.now(),
        },
      ]);

      // If the AI message embeds a frontend action (from our nova-brain tools),
      // execute it locally. We use a sentinel marker in the text — the
      // OpenAI-compat wrapper currently strips _nova_metadata, so this is a
      // fallback. The more robust path is via the tool_result events below.
      if (msg.source === "ai") {
        executeFrontendCommandsFromText(msg.message, navigate);
      }
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err as Error)?.message ?? "Erreur inconnue";
      setError(msg);
      toast.error(`NOVA: ${msg}`);
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  // Poll the audio output level for the ring animation (poor man's visualiser)
  useEffect(() => {
    if (conversation.status !== "connected") {
      setAudioLevel(0);
      return;
    }
    const interval = setInterval(() => {
      try {
        const lvl = (conversation as { getOutputVolume?: () => number }).getOutputVolume?.() ?? 0;
        setAudioLevel(lvl);
      } catch {
        // ignore — older SDK versions don't expose this
      }
    }, 100);
    return () => clearInterval(interval);
  }, [conversation]);

  const start = useCallback(async () => {
    if (!agentId) {
      setError("Aucun agent ID configuré. Voir docs/NOVA_VOICE_SETUP.md.");
      return;
    }
    try {
      // Request mic permission explicitly so the error UX is good.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Microphone refusé";
      setError(msg);
      toast.error(msg);
    }
  }, [agentId, conversation]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
      toast.info("Conversation terminée");
    } catch {
      /* ignore */
    }
  }, [conversation]);

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className={cn("flex flex-col h-full max-h-[80vh] bg-card border border-border rounded-2xl overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center transition-all",
            isConnected ? "bg-primary text-primary-foreground" : "bg-muted",
          )}>
            <span className="text-sm font-bold">N</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">NOVA Conversation</h2>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? isSpeaking
                  ? "🔊 En train de parler…"
                  : "🎙️ À l'écoute"
                : "Déconnecté"}
            </p>
          </div>
        </div>
        {isConnected && (
          <Button size="sm" variant="destructive" onClick={stop}>
            <PhoneOff className="h-4 w-4 mr-2" />
            Terminer
          </Button>
        )}
      </div>

      {/* Center stage — big mic button + live ring */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <div className="relative">
          {/* Animated ring scales with audio level */}
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-primary/20 transition-transform duration-150",
              isConnected ? "" : "scale-0",
            )}
            style={{ transform: `scale(${1 + Math.min(audioLevel * 2, 0.8)})` }}
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-primary/10 transition-transform duration-300",
              isConnected ? "" : "scale-0",
            )}
            style={{ transform: `scale(${1.3 + Math.min(audioLevel * 1.5, 0.5)})` }}
            aria-hidden="true"
          />
          <Button
            size="lg"
            onClick={isConnected ? stop : start}
            className={cn(
              "relative h-28 w-28 rounded-full shadow-lg transition-all",
              isConnected
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-primary hover:bg-primary/90",
            )}
          >
            {isConnected ? (
              <MicOff className="h-10 w-10" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </Button>
        </div>
        <div className="text-center max-w-md">
          {!isConnected && !error && (
            <>
              <p className="font-medium text-foreground">Clique pour parler à NOVA</p>
              <p className="text-xs text-muted-foreground mt-1">
                NOVA t'écoute, te répond en temps réel et peut t'interrompre si tu veux interrompre.
              </p>
            </>
          )}
          {isConnected && (
            <p className="text-sm text-muted-foreground">
              {isSpeaking ? "NOVA parle… (parle pour interrompre)" : "Parle, NOVA t'écoute."}
            </p>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/30 text-sm text-red-500 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Transcript (collapsible) */}
      {transcript.length > 0 && (
        <details className="border-t border-border bg-muted/20">
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
            <Volume2 className="h-3 w-3" />
            Transcription ({transcript.length})
          </summary>
          <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-2 space-y-2">
            {transcript.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "text-sm",
                  t.source === "user" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="font-semibold mr-2">
                  {t.source === "user" ? "Toi:" : "NOVA:"}
                </span>
                {t.text}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Look for frontend command markers in NOVA's text reply. The conversational
 * tool path is preferred (ElevenLabs supports tool calls natively) but if the
 * agent isn't configured with tools yet, NOVA may embed a marker like:
 *   [[ui_navigate:/admin/clients/abc]]
 * This parser handles that gracefully.
 */
function executeFrontendCommandsFromText(
  text: string,
  navigate: ReturnType<typeof useNavigate>,
): void {
  const navigateMatch = text.match(/\[\[ui_navigate:([^\]]+)\]\]/);
  if (navigateMatch) {
    const path = navigateMatch[1].trim();
    if (path.startsWith("/")) {
      setTimeout(() => navigate(path), 100); // small delay so the user hears the sentence
    }
  }
  const clientMatch = text.match(/\[\[ui_open_client_360:([0-9a-f-]+)\]\]/i);
  if (clientMatch) {
    const id = clientMatch[1];
    setTimeout(() => navigate(`/employee/clients/${id}`), 100);
  }
}

export default NovaConversation;
