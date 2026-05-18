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
    const { error } = await supabase
      .from("nps_surveys")
      .update({ score, comment: comment || null, responded_at: new Date().toISOString() })
      .eq("public_token", token!);
    setLoading(false);
    if (error) setError(error.message);
    else setSubmitted(true);
  };

  if (valid === false) {
    return <div className="min-h-screen flex items-center justify-center p-6"><p>Lien invalide ou expiré.</p></div>;
  }
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <h1 className="text-3xl font-bold mb-3">Merci! 🙏</h1>
        <p className="text-muted-foreground text-center max-w-md">Votre avis nous aide à améliorer Nivra. Bonne journée!</p>
      </div>
    );
  }

  const colorFor = (n: number) => n <= 6 ? "bg-red-500 hover:bg-red-600" : n <= 8 ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary mb-1">NIVRA</div>
          <h1 className="text-2xl font-semibold mt-4">Comment évaluez-vous votre expérience Nivra?</h1>
          <p className="text-sm text-muted-foreground mt-2">0 = pas du tout probable, 10 = très probable</p>
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
