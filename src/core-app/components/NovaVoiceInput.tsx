import { useState, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

export function NovaVoiceInput({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Reconnaissance vocale non supportée — utilisez Chrome ou Edge."); return; }
    const r = new SR();
    r.lang = "fr-CA";
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onresult = (e: any) => { onTranscript(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start();
  };
  const stopListening = () => { recognitionRef.current?.stop(); setListening(false); };

  return (
    <button
      type="button"
      onClick={listening ? stopListening : startListening}
      disabled={disabled}
      className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${listening ? "bg-red-500 animate-pulse text-white" : "bg-primary/15 hover:bg-primary/25 text-primary"} disabled:opacity-50`}
      title={listening ? "Arrêter l'écoute" : "Parler à NOVA"}
      aria-label={listening ? "Arrêter l'écoute" : "Parler à NOVA"}
    >
      {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}
