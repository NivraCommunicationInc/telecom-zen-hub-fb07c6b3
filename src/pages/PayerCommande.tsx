/**
 * PayerCommande — Public payment page for Field-sale clients.
 * URL: /payer/:intentId
 *
 * Loads a field_payment_intents row + its quote via the public RPC
 * `get_field_payment_intent_public`, displays a Nivra-branded order summary,
 * and lets the client either pay via PayPal or request a fresh email link.
 *
 * No auth required — RPC enforces row-level scoping by id.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, Mail, Loader2, ShieldCheck } from "lucide-react";
import { Helmet } from "react-helmet-async";

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

interface IntentData {
  intent: {
    id: string;
    paypal_approval_url: string | null;
    amount: number;
    currency: string;
    status: string;
    customer_email: string | null;
    customer_name: string | null;
    paid_at: string | null;
    expires_at: string | null;
    created_at: string;
  };
  quote: null | {
    client_info: any;
    services: any[];
    equipment: any[];
    discount: any;
    activation_fee: number;
    subtotal: number;
    tps: number;
    tvq: number;
    total: number;
    valid_until: string | null;
  };
  agent_name: string;
}

export default function PayerCommande() {
  const { intentId } = useParams<{ intentId: string }>();
  const [data, setData] = useState<IntentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!intentId) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }
      const { data: rpc, error: rpcErr } = await supabase.rpc(
        "get_field_payment_intent_public" as any,
        { p_id: intentId },
      );
      if (cancelled) return;
      if (rpcErr || !rpc) {
        setError("Commande introuvable. Contactez votre représentant Nivra.");
      } else {
        setData(rpc as IntentData);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  const handleResend = async () => {
    if (!data || resending) return;
    setResending(true);
    try {
      const ci = data.quote?.client_info || {};
      const email = ci.email || data.intent.customer_email;
      if (!email) {
        setError("Aucune adresse courriel associée à cette commande.");
        setResending(false);
        return;
      }
      const services = (data.quote?.services || [])
        .map((s: any) => s?.name)
        .filter(Boolean)
        .join(", ") || "Services Nivra";
      const fullName =
        `${ci.first_name || ""} ${ci.last_name || ""}`.trim() ||
        data.intent.customer_name ||
        "Client";
      const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString(
        "fr-CA",
        { day: "numeric", month: "long", year: "numeric" },
      );
      await supabase.from("email_queue").insert({
        event_key: `payment_link_resend_${data.intent.id}_${Date.now()}`,
        to_email: email,
        template_key: "field_payment_link",
        template_vars: {
          client_name: fullName,
          first_name: ci.first_name || "Client",
          order_number: data.intent.id,
          total: Number(data.intent.amount).toFixed(2),
          payment_url: `https://nivra-telecom.ca/payer/${data.intent.id}`,
          approval_url: data.intent.paypal_approval_url || "#",
          summary: services,
          services,
          valid_until: validUntil,
          agent_name: data.agent_name,
        },
        status: "queued",
      } as any);
      setResendOk(true);
    } catch (e) {
      setError("Échec d'envoi du courriel. Réessayez plus tard.");
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-violet-50">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Page>
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Commande introuvable</h2>
              <p className="mt-2 text-sm text-slate-600">
                {error ||
                  "Ce lien n'est plus valide. Contactez votre représentant Nivra ou écrivez à"}{" "}
                <a className="text-violet-700 underline" href="mailto:support@nivra-telecom.ca">
                  support@nivra-telecom.ca
                </a>
                .
              </p>
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  const { intent, quote, agent_name } = data;
  const isCompleted = intent.status === "completed" || !!intent.paid_at;
  const isCancelled = intent.status === "cancelled";
  const isExpired =
    !isCompleted &&
    intent.expires_at &&
    new Date(intent.expires_at).getTime() < Date.now();

  return (
    <Page>
      <Helmet>
        <title>Compléter votre commande — Nivra Telecom</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {isCompleted ? (
        <Card>
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold text-slate-900">
              Cette commande a déjà été payée.
            </h2>
            <p className="text-sm text-slate-600">
              Merci ! Un reçu a été envoyé par courriel. Une question ?{" "}
              <a className="text-violet-700 underline" href="mailto:support@nivra-telecom.ca">
                support@nivra-telecom.ca
              </a>
            </p>
          </div>
        </Card>
      ) : isCancelled || isExpired ? (
        <Card>
          <div className="text-center space-y-3 py-4">
            <AlertCircle className="h-14 w-14 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold text-slate-900">Ce lien a expiré.</h2>
            <p className="text-sm text-slate-600">
              Contactez votre représentant Nivra ou écrivez à{" "}
              <a className="text-violet-700 underline" href="mailto:support@nivra-telecom.ca">
                support@nivra-telecom.ca
              </a>{" "}
              pour obtenir un nouveau lien.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="space-y-1 mb-4">
              <p className="text-xs uppercase tracking-wider text-violet-700 font-semibold">
                Commande en attente
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                Compléter votre commande
              </h2>
              <p className="text-sm text-slate-500">
                Présentée par <span className="font-medium text-slate-700">{agent_name}</span>
              </p>
            </div>

            {quote ? (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <SummaryRow label="Client" value={quote.client_info?.first_name || quote.client_info?.last_name
                  ? `${quote.client_info?.first_name || ""} ${quote.client_info?.last_name || ""}`.trim()
                  : intent.customer_name || "—"} />

                {(quote.services || []).map((s: any, i: number) => (
                  <SummaryRow
                    key={`s${i}`}
                    label={s?.name || "Service"}
                    value={fmt(s?.monthlyPrice ?? s?.price ?? 0) + "/mois"}
                  />
                ))}

                {(quote.equipment || []).map((e: any, i: number) => (
                  <SummaryRow
                    key={`e${i}`}
                    label={`${e?.name || "Équipement"}${e?.quantity > 1 ? ` ×${e.quantity}` : ""}`}
                    value={fmt((e?.price ?? 0) * (e?.quantity ?? 1))}
                  />
                ))}

                {Number(quote.activation_fee) > 0 && (
                  <SummaryRow label="Frais d'activation" value={fmt(quote.activation_fee)} />
                )}

                {quote.discount && (
                  <SummaryRow
                    label="Rabais appliqué"
                    value={`− ${fmt(quote.discount?.amount ?? 0)}`}
                    accent="text-emerald-600"
                  />
                )}

                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <SummaryRow label="Sous-total" value={fmt(quote.subtotal)} muted />
                  <SummaryRow label="TPS (5%)" value={fmt(quote.tps)} muted />
                  <SummaryRow label="TVQ (9,975%)" value={fmt(quote.tvq)} muted />
                </div>

                <div className="border-t border-slate-200 pt-3 flex items-baseline justify-between">
                  <span className="text-base font-semibold text-slate-900">Total à payer</span>
                  <span className="text-2xl font-bold text-violet-700">
                    {fmt(quote.total)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-200 pt-4">
                <SummaryRow label="Total à payer" value={fmt(intent.amount)} />
              </div>
            )}
          </Card>

          <Card>
            <div className="space-y-3">
              <button
                type="button"
                disabled={!intent.paypal_approval_url}
                onClick={() => {
                  if (intent.paypal_approval_url) {
                    window.location.href = intent.paypal_approval_url;
                  }
                }}
                className="w-full h-14 rounded-xl bg-violet-600 text-white font-bold text-base shadow-lg shadow-violet-600/30 hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                💳 Payer avec PayPal
              </button>

              <button
                type="button"
                disabled={resending || resendOk}
                onClick={handleResend}
                className="w-full h-12 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : resendOk ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {resendOk ? "Lien renvoyé ✓" : "📧 Recevoir un nouveau lien"}
              </button>

              <p className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Paiement sécurisé via PayPal — aucun compte requis
              </p>
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}

/* ── Layout helpers ───────────────────────────────────── */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <a href="https://nivra-telecom.ca" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-violet-700">
              Nivra
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Telecom
            </span>
          </a>
          <span className="text-xs text-slate-400">Paiement sécurisé</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Nivra Telecom — support@nivra-telecom.ca
      </footer>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm ${muted ? "text-slate-500" : "text-slate-700"}`}>
        {label}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          accent || (muted ? "text-slate-600" : "text-slate-900")
        }`}
      >
        {value}
      </span>
    </div>
  );
}
