/**
 * NovaVoiceChat — Jarvis-like voice + text chat for NOVA Digital Brain.
 *
 *   <NovaVoiceChat />
 *
 * Features:
 *  - Push-to-talk mic recording (browser MediaRecorder API)
 *  - Transcription via the elevenlabs-stt-token edge function
 *  - Sends transcript to nova-brain (Sonnet 4.7 + tool use)
 *  - Plays back NOVA's reply through elevenlabs-tts (Charlotte FR voice)
 *  - Visible transcript with tool-call breakdown for debugging
 *
 * Requires:
 *   - User must be authenticated as admin (TTS endpoint is admin-gated)
 *   - ELEVENLABS_API_KEY + ANTHROPIC_API_KEY must be set as edge secrets
 *
 * Place this in the Core admin somewhere accessible to the team.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Send, Volume2, VolumeX, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: Array<{ name: string; ok: boolean; output: unknown }>;
  duration_ms?: number;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function NovaVoiceChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Stop any in-flight TTS when the component unmounts.
  useEffect(() => () => {
    audioPlayerRef.current?.pause();
    audioPlayerRef.current = null;
  }, []);

  const playReply = useCallback(async (text: string) => {
    if (!voiceEnabled || !text) return;
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/elevenlabs-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.warn("[NovaVoice] TTS failed:", res.status);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioPlayerRef.current?.pause();
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      console.warn("[NovaVoice] TTS playback failed:", e);
    }
  }, [voiceEnabled]);

  const sendToNova = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    setError(null);

    try {
      // Build the message history (just role + content for the API)
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

      const res = await fetch(`${FUNCTIONS_BASE}/nova-brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ messages: history, enable_tools: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail ?? data?.error ?? `HTTP ${res.status}`);
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.content ?? "(réponse vide)",
        tool_calls: data.tool_calls,
        duration_ms: data.duration_ms,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Speak the reply.
      if (assistantMsg.content) {
        playReply(assistantMsg.content);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`NOVA: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  }, [messages, playReply]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAndSend(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Microphone access denied";
      setError(msg);
      toast.error(msg);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const transcribeAndSend = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // 1. Request a one-time STT token from our edge fn
      const tokenRes = await fetch(`${FUNCTIONS_BASE}/elevenlabs-stt-token`, {
        method: "POST",
        headers: await getAuthHeader(),
      });
      if (!tokenRes.ok) {
        throw new Error(`STT token failed: ${tokenRes.status}`);
      }
      const { token } = await tokenRes.json();
      if (!token) throw new Error("No STT token returned");

      // 2. POST the audio blob directly to ElevenLabs scribe endpoint.
      const formData = new FormData();
      formData.append("file", audioBlob, "voice.webm");
      formData.append("model_id", "scribe_v1");

      const transcribeRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": token },
        body: formData,
      });

      if (!transcribeRes.ok) {
        const errText = await transcribeRes.text();
        throw new Error(`Transcription failed: ${errText.slice(0, 200)}`);
      }
      const transcript = await transcribeRes.json();
      const text = (transcript.text ?? "").trim();

      if (!text) {
        toast.warning("Aucun texte détecté dans l'audio.");
        setIsProcessing(false);
        return;
      }

      // 3. Send to NOVA
      await sendToNova(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(`Transcription: ${msg}`);
      setIsProcessing(false);
    }
  }, [sendToNova]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      sendToNova(textInput);
      setTextInput("");
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh] bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">N</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">NOVA Digital Brain</h2>
            <p className="text-xs text-muted-foreground">
              Claude Sonnet 4.7 · {voiceEnabled ? "Voice ON" : "Voice OFF"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVoiceEnabled((v) => !v)}
            title={voiceEnabled ? "Désactiver la voix" : "Activer la voix"}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMessages([])}
            disabled={messages.length === 0}
            title="Effacer la conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <p>Commence par dire ou écrire quelque chose.</p>
            <p className="mt-1 text-xs">
              Essaie : <em>"Quel est l'état du compte NIV-ACCT-000123 ?"</em>
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col gap-1",
              m.role === "user" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {m.content}
            </div>
            {m.tool_calls && m.tool_calls.length > 0 && (
              <details className="text-[11px] text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  🔧 {m.tool_calls.length} outil(s) utilisé(s)
                </summary>
                <ul className="mt-1 space-y-1 ml-4">
                  {m.tool_calls.map((tc, i) => (
                    <li key={i} className={tc.ok ? "" : "text-red-500"}>
                      <code className="font-mono">{tc.name}</code> {tc.ok ? "✓" : "✗"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {m.duration_ms && (
              <p className="text-[10px] text-muted-foreground">{m.duration_ms} ms</p>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            NOVA réfléchit…
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/30 text-xs text-red-500 flex items-center gap-2">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Input row */}
      <form
        onSubmit={handleTextSubmit}
        className="flex items-center gap-2 px-3 py-3 border-t border-border bg-background"
      >
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing && !isRecording}
          title={isRecording ? "Arrêter l'enregistrement" : "Parler à NOVA"}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={isRecording ? "🔴 En écoute…" : "Pose ta question à NOVA…"}
          disabled={isRecording || isProcessing}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!textInput.trim() || isProcessing || isRecording}
        >
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

export default NovaVoiceChat;
