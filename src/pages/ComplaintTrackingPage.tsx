/**
 * ComplaintTrackingPage — public read-only tracking view for a complaint.
 * Route: /plainte/suivi/:token (anonymous, no auth required)
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  new: "Reçue",
  in_progress: "En traitement",
  awaiting_client: "En attente de votre réponse",
  resolved: "Résolue",
  closed: "Fermée",
  escalated: "Escaladée",
};

const STATUS_CLASSES: Record<string, string> = {
  new: "bg-primary/15 text-primary border-primary",
  in_progress: "bg-blue-500/15 text-blue-500 border-blue-500",
  awaiting_client: "bg-yellow-500/15 text-yellow-500 border-yellow-500",
  resolved: "bg-green-500/15 text-green-500 border-green-500",
  closed: "bg-muted text-muted-foreground border-border",
  escalated: "bg-destructive/15 text-destructive border-destructive",
};

const CATEGORY_LABELS: Record<string, string> = {
  technique: "🔧 Problème technique",
  facturation: "💳 Facturation",
  service_client: "👤 Service client",
  installation: "🔌 Installation",
  equipement: "📦 Équipement",
  resiliation: "❌ Résiliation",
  autre: "📝 Autre",
};

interface ComplaintData {
  id: string;
  ticket_number: string;
  status: string;
  category: string;
  subject: string;
  description: string;
  submitted_by_name: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  responses: Array<{
    id: string;
    author_name: string;
    response_text: string;
    created_at: string;
  }>;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-CA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ComplaintTrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [complaint, setComplaint] = useState<ComplaintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Lien invalide.");
        setLoading(false);
        return;
      }
      try {
        const { data, error: rpcErr } = await supabase.rpc(
          "get_complaint_by_public_token" as any,
          { p_token: token }
        );
        if (cancelled) return;
        if (rpcErr) throw rpcErr;
        if (!data) {
          setError("Plainte introuvable. Vérifiez le lien reçu par courriel.");
        } else {
          setComplaint(data as ComplaintData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erreur lors du chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen text-foreground overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <Helmet>
        <title>Suivi de plainte — Nivra Telecom</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-primary text-primary-foreground">
              N
            </div>
            <span className="text-xl font-bold tracking-tight">Nivra Telecom</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Suivi de votre plainte</h1>
          <p className="text-muted-foreground">État et réponses de notre équipe</p>
        </header>

        {loading && (
          <Card className="rounded-2xl">
            <CardContent className="p-10 text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Chargement…</p>
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
              <h2 className="text-xl font-semibold mb-2">{error}</h2>
              <p className="text-sm mb-6 text-muted-foreground">
                Le lien de suivi est unique et personnel. Si le problème persiste,
                écrivez-nous à support@nivra-telecom.ca.
              </p>
              <Button asChild>
                <Link to="/plainte">Soumettre une nouvelle plainte</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && complaint && (
          <div className="space-y-6">
            {/* Status card */}
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                      Numéro de ticket
                    </div>
                    <div className="text-2xl font-mono font-bold">{complaint.ticket_number}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`px-4 py-2 rounded-full text-sm font-semibold border ${STATUS_CLASSES[complaint.status] ?? "bg-primary/15 text-primary border-primary"}`}
                  >
                    {STATUS_LABELS[complaint.status] ?? complaint.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Catégorie</div>
                    <div>{CATEGORY_LABELS[complaint.category] ?? complaint.category}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Soumise le</div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatDate(complaint.created_at)}
                    </div>
                  </div>
                  {complaint.resolved_at && (
                    <div>
                      <div className="text-muted-foreground">Résolue le</div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        {formatDate(complaint.resolved_at)}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Original complaint */}
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-3">Votre plainte</h2>
                <div className="text-xs mb-2 text-muted-foreground">
                  {complaint.submitted_by_name} · {formatDate(complaint.created_at)}
                </div>
                <div className="font-medium mb-2">{complaint.subject}</div>
                <div className="text-sm whitespace-pre-wrap rounded-lg p-4 bg-muted text-foreground">
                  {complaint.description}
                </div>
              </CardContent>
            </Card>

            {/* Responses */}
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Réponses de Nivra ({complaint.responses?.length ?? 0})
                </h2>

                {(!complaint.responses || complaint.responses.length === 0) ? (
                  <div className="rounded-lg p-5 text-sm text-center bg-muted text-muted-foreground">
                    Notre équipe n'a pas encore publié de réponse.
                    Vous recevrez un courriel dès qu'une réponse sera disponible.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {complaint.responses.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg p-4 bg-muted border border-border"
                      >
                        <div className="text-xs mb-2 flex items-center gap-2 text-muted-foreground">
                          <span className="text-primary font-medium">{r.author_name}</span>
                          <span>· {formatDate(r.created_at)}</span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{r.response_text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              Une question ? Écrivez-nous à{" "}
              <a href="mailto:support@nivra-telecom.ca" className="text-primary hover:underline">
                support@nivra-telecom.ca
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
