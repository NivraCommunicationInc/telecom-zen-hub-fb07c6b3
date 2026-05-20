/**
 * ComplaintTrackingPage — public read-only tracking view for a complaint.
 * Route: /plainte/suivi/:token (anonymous, no auth required)
 *
 * Looks up complaint via secure SECURITY DEFINER RPC `get_complaint_by_public_token`.
 * Shows status, details, and non-internal responses from Nivra staff.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, MessageSquare, CheckCircle2, Clock } from "lucide-react";

const C = {
  bg: "#0A0A0F",
  card: "#111118",
  border: "#1E1E2E",
  accent: "#8B5CF6",
  accentHover: "#7C3AED",
  textPrimary: "#F8F8FF",
  textSecondary: "#A0A0B0",
  inputBg: "#1A1A28",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Reçue",
  in_progress: "En traitement",
  awaiting_client: "En attente de votre réponse",
  resolved: "Résolue",
  closed: "Fermée",
  escalated: "Escaladée",
};

const STATUS_COLORS: Record<string, string> = {
  new: C.accent,
  in_progress: "#3B82F6",
  awaiting_client: C.warning,
  resolved: C.success,
  closed: C.textSecondary,
  escalated: C.error,
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
    <div className="min-h-screen" style={{ background: C.bg, color: C.textPrimary }}>
      <Helmet>
        <title>Suivi de plainte — Nivra Telecom</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
              style={{ background: C.accent, color: "#FFFFFF" }}
            >
              N
            </div>
            <span className="text-xl font-bold tracking-tight">Nivra Telecom</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Suivi de votre plainte</h1>
          <p style={{ color: C.textSecondary }}>État et réponses de notre équipe</p>
        </header>

        {loading && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: C.accent }} />
            <p className="mt-4" style={{ color: C.textSecondary }}>Chargement…</p>
          </div>
        )}

        {!loading && error && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: C.error }} />
            <h2 className="text-xl font-semibold mb-2">{error}</h2>
            <p className="text-sm mb-6" style={{ color: C.textSecondary }}>
              Le lien de suivi est unique et personnel. Si le problème persiste,
              écrivez-nous à support@nivra-telecom.ca.
            </p>
            <Link
              to="/plainte"
              className="inline-flex items-center justify-center h-11 px-5 rounded-lg font-semibold"
              style={{ background: C.accent, color: "#FFFFFF" }}
            >
              Soumettre une nouvelle plainte
            </Link>
          </div>
        )}

        {!loading && complaint && (
          <div className="space-y-6">
            {/* Status card */}
            <section
              className="rounded-2xl p-6"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.textSecondary }}>
                    Numéro de ticket
                  </div>
                  <div className="text-2xl font-mono font-bold">{complaint.ticket_number}</div>
                </div>
                <div
                  className="px-4 py-2 rounded-full text-sm font-semibold"
                  style={{
                    background: `${STATUS_COLORS[complaint.status] ?? C.accent}20`,
                    color: STATUS_COLORS[complaint.status] ?? C.accent,
                    border: `1px solid ${STATUS_COLORS[complaint.status] ?? C.accent}`,
                  }}
                >
                  {STATUS_LABELS[complaint.status] ?? complaint.status}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div style={{ color: C.textSecondary }}>Catégorie</div>
                  <div>{CATEGORY_LABELS[complaint.category] ?? complaint.category}</div>
                </div>
                <div>
                  <div style={{ color: C.textSecondary }}>Soumise le</div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" style={{ color: C.textSecondary }} />
                    {formatDate(complaint.created_at)}
                  </div>
                </div>
                {complaint.resolved_at && (
                  <div>
                    <div style={{ color: C.textSecondary }}>Résolue le</div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" style={{ color: C.success }} />
                      {formatDate(complaint.resolved_at)}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Original complaint */}
            <section
              className="rounded-2xl p-6"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <h2 className="text-lg font-semibold mb-3">Votre plainte</h2>
              <div className="text-xs mb-2" style={{ color: C.textSecondary }}>
                {complaint.submitted_by_name} · {formatDate(complaint.created_at)}
              </div>
              <div className="font-medium mb-2">{complaint.subject}</div>
              <div
                className="text-sm whitespace-pre-wrap rounded-lg p-4"
                style={{ background: C.inputBg, color: C.textPrimary }}
              >
                {complaint.description}
              </div>
            </section>

            {/* Responses */}
            <section
              className="rounded-2xl p-6"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" style={{ color: C.accent }} />
                Réponses de Nivra ({complaint.responses?.length ?? 0})
              </h2>

              {(!complaint.responses || complaint.responses.length === 0) ? (
                <div
                  className="rounded-lg p-5 text-sm text-center"
                  style={{ background: C.inputBg, color: C.textSecondary }}
                >
                  Notre équipe n'a pas encore publié de réponse.
                  Vous recevrez un courriel dès qu'une réponse sera disponible.
                </div>
              ) : (
                <div className="space-y-3">
                  {complaint.responses.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg p-4"
                      style={{ background: C.inputBg, border: `1px solid ${C.border}` }}
                    >
                      <div className="text-xs mb-2 flex items-center gap-2" style={{ color: C.textSecondary }}>
                        <span style={{ color: C.accent }} className="font-medium">{r.author_name}</span>
                        <span>· {formatDate(r.created_at)}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{r.response_text}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="text-center text-sm" style={{ color: C.textSecondary }}>
              Une question ? Écrivez-nous à{" "}
              <a href="mailto:support@nivra-telecom.ca" style={{ color: C.accent }}>
                support@nivra-telecom.ca
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
