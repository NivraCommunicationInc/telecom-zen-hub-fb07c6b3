/**
 * ClientReviewPage — public review page accessed via secure token.
 * Route: /avis/:token (anonymous, no auth)
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Star, CheckCircle2, ThumbsUp, ThumbsDown, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ReviewRow = {
  id: string;
  trigger_type: "activation" | "deactivation";
  status: "pending" | "submitted" | "archived";
  token_expires_at: string;
  submitted_at: string | null;
  first_name: string;
  account_number: string;
};

const RATING_LABELS: Record<number, string> = {
  1: "Très insatisfait",
  2: "Insatisfait",
  3: "Neutre",
  4: "Satisfait",
  5: "Très satisfait",
};

function StarPicker({
  value,
  onChange,
  size = "lg",
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "lg";
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= display;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(n)}
            className={cn(
              "transition-all rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "text-yellow-500" : "text-border",
              size === "lg" ? "p-1 min-w-[44px] min-h-[44px]" : "p-0.5 min-w-[28px] min-h-[28px]"
            )}
          >
            <Star
              className={cn(size === "lg" ? "w-10 h-10 md:w-12 md:h-12" : "w-6 h-6")}
              fill={active ? "currentColor" : "none"}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}

function ShellCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen w-full text-foreground overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <div className="relative max-w-2xl mx-auto px-4 py-10 md:py-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-primary text-primary-foreground">
            N
          </div>
          <div className="text-lg font-semibold tracking-tight text-foreground">
            Nivra Telecom
          </div>
        </div>
        <Card className="rounded-2xl shadow-2xl">
          <CardContent className="p-6 md:p-10">{children}</CardContent>
        </Card>
        <p className="text-center text-xs mt-6 text-muted-foreground">
          © Nivra Telecom — Votre avis est confidentiel
        </p>
      </div>
    </div>
  );
}

export default function ClientReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReviewRow | null>(null);
  const [errorState, setErrorState] = useState<
    null | "invalid" | "expired" | "already_submitted"
  >(null);

  const [rating, setRating] = useState(0);
  const [service, setService] = useState(0);
  const [support, setSupport] = useState(0);
  const [value, setValue] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setErrorState("invalid");
        setLoading(false);
        return;
      }
      const { data: rows, error } = await supabase.rpc("get_client_review_by_token", {
        p_token: token,
      });
      if (error || !rows || (Array.isArray(rows) && rows.length === 0)) {
        setErrorState("invalid");
        setLoading(false);
        return;
      }
      const row = (Array.isArray(rows) ? rows[0] : rows) as ReviewRow;
      if (new Date(row.token_expires_at).getTime() < Date.now()) {
        setErrorState("expired");
        setLoading(false);
        return;
      }
      if (row.status === "submitted") {
        setErrorState("already_submitted");
        setData(row);
        setLoading(false);
        return;
      }
      setData(row);
      setLoading(false);
    })();
  }, [token]);

  const canSubmit = useMemo(
    () => rating > 0 && recommend !== null && !submitting,
    [rating, recommend, submitting]
  );

  const handleSubmit = async () => {
    if (!canSubmit || !token) return;
    setSubmitting(true);
    const { data: res, error } = await supabase.rpc("submit_client_review_by_token", {
      p_token: token,
      p_rating: rating,
      p_review_text: text || null,
      p_service_quality: service || null,
      p_support_quality: support || null,
      p_value_for_money: value || null,
      p_would_recommend: recommend,
    });
    setSubmitting(false);
    if (error) {
      setErrorState("invalid");
      return;
    }
    const r = res as { ok: boolean; error?: string; first_name?: string };
    if (!r?.ok) {
      if (r?.error === "expired") setErrorState("expired");
      else if (r?.error === "already_submitted") setErrorState("already_submitted");
      else setErrorState("invalid");
      return;
    }
    setSubmittedName(r.first_name || data?.first_name || null);
  };

  if (loading) {
    return (
      <ShellCard>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ShellCard>
    );
  }

  if (submittedName) {
    return (
      <>
        <Helmet>
          <title>Merci pour votre avis — Nivra Telecom</title>
        </Helmet>
        <ShellCard>
          <div className="text-center py-8">
            <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500 bg-green-500/15 border border-green-500">
              <CheckCircle2 className="w-12 h-12 text-green-500" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3 text-foreground">
              Merci {submittedName}!
            </h1>
            <p className="max-w-md mx-auto text-muted-foreground">
              Votre avis a été soumis avec succès. Toute notre équipe vous remercie de
              contribuer à améliorer Nivra Telecom.
            </p>
          </div>
        </ShellCard>
      </>
    );
  }

  if (errorState === "invalid") {
    return (
      <ShellCard>
        <div className="text-center py-10">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h1 className="text-2xl font-bold mb-2 text-foreground">Lien invalide</h1>
          <p className="text-muted-foreground">Ce lien d'avis n'est pas reconnu.</p>
        </div>
      </ShellCard>
    );
  }
  if (errorState === "expired") {
    return (
      <ShellCard>
        <div className="text-center py-10">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h1 className="text-2xl font-bold mb-2 text-foreground">Ce lien a expiré</h1>
          <p className="text-muted-foreground">Merci tout de même de votre intérêt pour Nivra Telecom!</p>
        </div>
      </ShellCard>
    );
  }
  if (errorState === "already_submitted") {
    return (
      <ShellCard>
        <div className="text-center py-10">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <h1 className="text-2xl font-bold mb-2 text-foreground">Merci!</h1>
          <p className="text-muted-foreground">Votre avis a déjà été soumis.</p>
        </div>
      </ShellCard>
    );
  }

  if (!data) return null;

  return (
    <>
      <Helmet>
        <title>Donner mon avis — Nivra Telecom</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ShellCard>
        <div className="mb-8">
          <Badge variant="secondary" className="mb-3 bg-primary/15 text-primary border border-border">
            VOTRE AVIS COMPTE
          </Badge>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">
            Bonjour {data.first_name}
          </h1>
          <p className="text-muted-foreground">
            {data.trigger_type === "activation"
              ? "Comment s'est passée votre installation? Cela prend moins de 2 minutes."
              : "Merci d'avoir été client. Votre feedback nous aide à nous améliorer."}
          </p>
        </div>

        {/* Section 1 — Overall rating */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-foreground">
            Note globale <span className="text-destructive">*</span>
          </h2>
          <div className="flex flex-col items-center gap-3 py-4">
            <StarPicker value={rating} onChange={setRating} ariaLabel="Note globale" />
            <div className="h-6 text-sm text-muted-foreground">
              {rating > 0 ? RATING_LABELS[rating] : "Sélectionnez une note"}
            </div>
          </div>
        </section>

        {/* Section 2 — Detailed ratings */}
        <section className="mb-8 space-y-4 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold text-foreground">Notes détaillées</h2>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-muted-foreground">Qualité du service Internet</span>
            <StarPicker value={service} onChange={setService} size="sm" ariaLabel="Qualité du service Internet" />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-muted-foreground">Qualité du support client</span>
            <StarPicker value={support} onChange={setSupport} size="sm" ariaLabel="Qualité du support client" />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-muted-foreground">Rapport qualité/prix</span>
            <StarPicker value={value} onChange={setValue} size="sm" ariaLabel="Rapport qualité/prix" />
          </div>
        </section>

        {/* Section 3 — Would recommend */}
        <section className="mb-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold mb-3 text-foreground">
            Recommanderiez-vous Nivra Telecom à vos proches? <span className="text-destructive">*</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRecommend(true)}
              className={cn(
                "min-h-[56px] rounded-xl px-4 py-3 flex items-center justify-center gap-3 font-semibold transition-all border-2",
                recommend === true
                  ? "bg-green-500/10 border-green-500 text-green-500"
                  : "bg-card border-border text-muted-foreground hover:border-muted-foreground"
              )}
            >
              <ThumbsUp className="w-5 h-5" />
              Oui, je recommande
            </button>
            <button
              type="button"
              onClick={() => setRecommend(false)}
              className={cn(
                "min-h-[56px] rounded-xl px-4 py-3 flex items-center justify-center gap-3 font-semibold transition-all border-2",
                recommend === false
                  ? "bg-destructive/10 border-destructive text-destructive"
                  : "bg-card border-border text-muted-foreground hover:border-muted-foreground"
              )}
            >
              <ThumbsDown className="w-5 h-5" />
              Non, pas pour l'instant
            </button>
          </div>
        </section>

        {/* Section 4 — Free comment */}
        <section className="mb-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold mb-3 text-foreground">Votre commentaire</h2>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            placeholder="Partagez votre expérience..."
            rows={5}
            maxLength={1000}
            className="resize-y"
          />
          <div className="text-right text-xs mt-1.5 text-muted-foreground">{text.length} / 1000</div>
        </section>

        {/* Section 5 — Submit */}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-12 text-base font-semibold"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
            </span>
          ) : (
            "Soumettre mon avis"
          )}
        </Button>
        {!canSubmit && !submitting && (
          <p className="text-center text-xs mt-3 text-muted-foreground">
            La note globale et votre recommandation sont requises.
          </p>
        )}
      </ShellCard>
    </>
  );
}
