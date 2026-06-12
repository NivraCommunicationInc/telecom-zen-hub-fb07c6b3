/**
 * VoiceConversation — real-time voice + text conversation with Nivra AI.
 * - Push-to-talk recording via ElevenLabs realtime STT (scribe_v2_realtime, VAD)
 * - Streaming text response from core-ai-converse (Gemini)
 * - Premium French TTS playback via elevenlabs-tts (Charlotte)
 * - Manual text input fallback
 * - No intro / "how it works" — direct conversation
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Send, Loader2, Volume2, VolumeX, Square, User as UserIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PickedClient } from "./ClientPicker";

interface Msg { id: string; role: "user" | "assistant"; content: string; ts: number }

interface Props { client: PickedClient | null }

export default function VoiceConversation({ client }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [muteVoice, setMuteVoice] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onCommittedTranscript: (data: any) => {
      const text = String(data?.text ?? "").trim();
      if (text) handleSend(text);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const playTTS = useCallback(async (text: string) => {
    if (muteVoice || !text.trim()) return;
    setTtsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`TTS ${res.status}: ${txt}`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      stopAudio();
      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(objectUrl); };
      await audio.play();
    } catch (e: any) {
      toast.error("Voix indisponible", { description: e?.message ?? "Erreur TTS" });
    } finally {
      setTtsLoading(false);
    }
  }, [muteVoice, stopAudio]);

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: trimmed, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    setStreaming("");
    stopAudio();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/core-ai-converse`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: client?.id ?? null,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error("Limite atteinte. Réessayez dans quelques instants.");
        if (res.status === 402) throw new Error("Crédits IA épuisés. Ajoutez des crédits.");
        const txt = await res.text();
        throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j?.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              setStreaming(full);
            }
          } catch { /* ignore */ }
        }
      }

      const aiMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: full, ts: Date.now() };
      setMessages((m) => [...m, aiMsg]);
      setStreaming("");
      if (full) playTTS(full);
    } catch (e: any) {
      toast.error("Erreur conversation", { description: e?.message ?? "Erreur" });
      setStreaming("");
    } finally {
      setSending(false);
    }
  }, [client?.id, messages, playTTS, sending, stopAudio]);

  const toggleRecord = useCallback(async () => {
    try {
      if (recording) {
        await scribe.disconnect();
        setRecording(false);
        return;
      }
      stopAudio();
      // elevenlabs-stt-token deploys with Pro upgrade (2026-06-14)
      throw new Error("Reconnaissance vocale disponible après mise à niveau Pro (14 juin)");
      await scribe.connect({
        token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setRecording(true);
    } catch (e: any) {
      toast.error("Micro indisponible", { description: e?.message ?? "Erreur" });
      setRecording(false);
    }
  }, [recording, scribe, stopAudio]);

  useEffect(() => () => { try { scribe.disconnect(); } catch {} stopAudio(); }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[480px] rounded-2xl border border-core-border bg-core-card overflow-hidden">
      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-md">
              <Sparkles className="w-8 h-8 text-core-accent mx-auto mb-3" />
              <p className="text-core-text-primary font-medium">Parlez ou écrivez à Nivra AI.</p>
              <p className="text-sm text-core-text-secondary mt-1">
                {client ? `Contexte chargé : ${client.email ?? client.id.slice(0,8)}` : "Sélectionnez un client pour une réponse contextuelle."}
              </p>
            </div>
          </div>
        )}

        {messages.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)}
        {streaming && <Bubble role="assistant" content={streaming} streaming />}
      </div>

      {/* Composer */}
      <div className="border-t border-core-border bg-core-card-raised p-3 md:p-4 space-y-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder={recording ? "Écoute… parlez maintenant" : "Posez votre question (ou appuyez sur le micro)…"}
            disabled={sending}
            className="flex-1 min-h-[48px] max-h-[140px] resize-none bg-core-card border-core-border-strong text-core-text-primary"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={toggleRecord}
              disabled={sending}
              size="icon"
              className={`h-12 w-12 rounded-full ${recording ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-core-accent hover:bg-core-accent/90"} text-white`}
              aria-label={recording ? "Arrêter le micro" : "Activer le micro"}
            >
              {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              type="button"
              onClick={() => handleSend(input)}
              disabled={sending || !input.trim()}
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-full"
              aria-label="Envoyer"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-core-text-label">
          <div className="flex items-center gap-3">
            {recording && (
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Enregistrement…
              </span>
            )}
            {scribe.partialTranscript && (
              <span className="italic truncate max-w-[300px]">"{scribe.partialTranscript}"</span>
            )}
            {ttsLoading && (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Voix…</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {audioRef.current && (
              <button onClick={stopAudio} className="flex items-center gap-1 hover:text-core-text-primary" aria-label="Arrêter la voix">
                <Square className="w-3 h-3" /> Stop
              </button>
            )}
            <button
              onClick={() => { setMuteVoice((v) => !v); if (!muteVoice) stopAudio(); }}
              className="flex items-center gap-1 hover:text-core-text-primary"
              aria-label={muteVoice ? "Activer la voix" : "Couper la voix"}
            >
              {muteVoice ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              {muteVoice ? "Voix off" : "Voix on"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content, streaming }: { role: "user" | "assistant"; content: string; streaming?: boolean }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] flex items-start gap-2">
          <div className="rounded-2xl rounded-tr-sm bg-core-accent text-white px-4 py-2.5 shadow-sm">
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-core-card-raised border border-core-border flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 text-core-text-secondary" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-core-accent/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-core-accent" />
        </div>
        <div className="px-1 py-1">
          <p className="text-sm text-core-text-primary whitespace-pre-wrap leading-relaxed">
            {content}
            {streaming && <span className="inline-block w-2 h-4 ml-1 bg-core-accent animate-pulse align-middle" />}
          </p>
        </div>
      </div>
    </div>
  );
}
