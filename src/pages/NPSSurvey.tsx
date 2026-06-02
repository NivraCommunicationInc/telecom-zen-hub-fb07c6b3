import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function NPSSurvey() {
  const { token } = useParams();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return setValid(false);
      const { data } = await supabase
        .from("nps_surveys")
        .select("id, responded_at")
        .eq("public_token", token)
        .maybeSingle();
      if (!data) setValid(false);
      else if (data.responded_at) { setValid(true); setSubmitted(true); }
      else setValid(true);
    })();
  }, [token]);

  const submit = async () => {
    if (score === null) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("submit-nps-survey", {
      body: { token, score, comment: comment || null },
    });
    setLoading(false);
    const errKey = (data as { error?: string } | null)?.error;
    if (error || errKey) setError(errKey || error?.message || "Erreur");
    else setSubmitted(true);
  };

  if (valid === false) {
    return <div style={{ background: '#020209' }} className="min-h-screen flex items-center justify-center p-6"><p className="text-foreground">Lien invalide ou expiré.</p></div>;
  }
  if (submitted) {
    return (
      <div style={{ background: '#020209' }} className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <svg className="w-8 h-8" style={{ color: '#6ee7b7' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: '-0.5px', color: '#fff' }}>Merci pour votre avis!</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 380 }}>Votre avis nous aide à améliorer Nivra. Bonne journée!</p>
        </div>
      </div>
    );
  }

  const colorFor = (n: number) => n <= 6 ? "bg-red-500 hover:bg-red-600" : n <= 8 ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600";

  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.09) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <div className="relative w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="inline-block mb-3 px-3 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#A78BFA' }}>NIVRA TELECOM</span>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(20px, 3.5vw, 28px)', letterSpacing: '-0.5px', color: '#fff', marginBottom: 8 }}>Comment évaluez-vous votre <span className="n-shimmer-text">expérience Nivra</span>?</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>0 = pas du tout probable, 10 = très probable</p>
        </div>
        <div className="grid grid-cols-11 gap-2">
          {Array.from({ length: 11 }).map((_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`h-12 rounded-md text-white font-semibold transition ${colorFor(n)} ${score === n ? "ring-4 ring-primary/40 scale-105" : "opacity-90"}`}
            >{n}</button>
          ))}
        </div>
        <Textarea
          placeholder="Un commentaire (optionnel)?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={submit} disabled={score === null || loading} className="w-full">
          {loading ? "Envoi…" : "Envoyer mon avis"}
        </Button>
      </div>
    </div>
  );
}
