/**
 * PayerCommande — Public payment page for field-sale clients.
 * URL: /payer/:intentId
 *
 * Loads a field_payment_intents row + its quote via the public RPC
 * `get_field_payment_intent_public`, displays a Nivra-branded order summary,
 * and lets the client pay via Square (card inline) or request a fresh email link.
 *
 * No auth required.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, Mail, Loader2, ShieldCheck, CreditCard, Lock, Send, Copy } from "lucide-react";
import { PhotoBg } from "@/components/PhotoBg";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const INTERAC_EMAIL = "support@nivra-telecom.ca";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

interface IntentData {
  intent: {
    id: string;
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
  const [paid, setPaid] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendOk, setResendOk] = useState(false);
  const [tab, setTab] = useState<"card" | "interac">("card");

  // Square widget state
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [sqLoading, setSqLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!intentId) { setError("Lien invalide"); setLoading(false); return; }
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
    return () => { cancelled = true; };
  }, [intentId]);

  // Load Square widget when card tab is active
  useEffect(() => {
    if (tab !== "card" || paid || !data) return;
    const intent = data.intent;
    if (intent.status === "completed" || intent.paid_at) return;

    let destroyed = false;
    setSqLoading(true);

    const init = async () => {
      try {
        if (!(window as any).Square) {
          await new Promise<void>((resolve, reject) => {
            if (document.querySelector('script[src*="web.squarecdn.com"]')) {
              const poll = setInterval(() => {
                if ((window as any).Square) { clearInterval(poll); resolve(); }
              }, 100);
              return;
            }
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Impossible de charger Square"));
            document.head.appendChild(s);
          });
        }
        if (destroyed) return;
        const payments = (window as any).Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach(containerRef.current!);
        if (destroyed) { card.destroy(); return; }
        cardRef.current = card;
        setSqLoading(false);
      } catch (e: any) {
        if (!destroyed) {
          toast.error("Erreur Square : " + (e?.message || String(e)));
          setSqLoading(false);
        }
      }
    };

    init();
    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, [tab, data, paid]);

  const handlePay = async () => {
    if (!cardRef.current || !intentId) return;
    setPaying(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations de carte invalides");
        return;
      }
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-charge-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${BACKEND_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: result.token, intent_id: intentId }),
      });
      const d = await res.json();
      if (!d?.ok) {
        toast.error(d?.error || "Paiement refusé");
        return;
      }
      setPaid(true);
      setReceiptUrl(d.receipt_url || null);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  const handleResend = async () => {
    if (!data || resending) return;
    setResending(true);
    try {
      const ci = data.quote?.client_info || {};
      const email = ci.email || data.intent.customer_email;
      if (!email) { setError("Aucune adresse courriel associée."); setResending(false); return; }
      const services = (data.quote?.services || []).map((s: any) => s?.name).filter(Boolean).join(", ") || "Services Nivra";
      const fullName = `${ci.first_name || ""} ${ci.last_name || ""}`.trim() || data.intent.customer_name || "Client";
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
          summary: services,
          services,
          agent_name: data.agent_name,
        },
        status: "queued",
      } as any);
      setResendOk(true);
    } catch {
      setError("Échec d'envoi. Réessayez plus tard.");
    } finally {
      setResending(false);
    }
  };

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  if (loading) {
    return (
      <div style={{ background: "#020209" }} className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
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
              <h2 className="text-lg font-bold text-white">Commande introuvable</h2>
              <p className="mt-2 text-sm text-white/60">
                {error || "Ce lien n'est plus valide."}{" "}
                <a className="text-violet-400 underline" href="mailto:support@nivra-telecom.ca">
                  support@nivra-telecom.ca
                </a>
              </p>
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  const { intent, quote, agent_name } = data;
  const isCompleted = paid || intent.status === "completed" || !!intent.paid_at;
  const isCancelled = intent.status === "cancelled";
  const isExpired = !isCompleted && intent.expires_at && new Date(intent.expires_at).getTime() < Date.now();
  const amount = Number(intent.amount);

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
            <h2 className="text-2xl font-bold text-white">
              {paid ? "Paiement accepté !" : "Cette commande a déjà été payée."}
            </h2>
            <p className="text-sm text-white/60">
              Merci ! Un reçu a été envoyé par courriel.
            </p>
            {receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                className="text-violet-400 underline text-sm">
                Voir le reçu Square
              </a>
            )}
          </div>
        </Card>
      ) : isCancelled || isExpired ? (
        <Card>
          <div className="text-center space-y-3 py-4">
            <AlertCircle className="h-14 w-14 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Ce lien a expiré.</h2>
            <p className="text-sm text-white/60">
              Contactez votre représentant ou écrivez à{" "}
              <a className="text-violet-400 underline" href="mailto:support@nivra-telecom.ca">
                support@nivra-telecom.ca
              </a>
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Order summary */}
          <Card>
            <div className="space-y-1 mb-4">
              <p className="text-xs uppercase tracking-wider text-violet-400 font-semibold">Commande en attente</p>
              <h2 className="text-2xl font-bold text-white">Compléter votre commande</h2>
              <p className="text-sm text-white/50">
                Présentée par <span className="font-medium text-white/75">{agent_name}</span>
              </p>
            </div>

            {quote ? (
              <div className="border-t border-white/10 pt-4 space-y-3">
                <SummaryRow label="Client" value={
                  quote.client_info?.first_name || quote.client_info?.last_name
                    ? `${quote.client_info?.first_name || ""} ${quote.client_info?.last_name || ""}`.trim()
                    : intent.customer_name || "—"
                } />
                {(quote.services || []).map((s: any, i: number) => (
                  <SummaryRow key={`s${i}`} label={s?.name || "Service"} value={fmt(s?.monthlyPrice ?? s?.price ?? 0) + "/mois"} />
                ))}
                {(quote.equipment || []).map((e: any, i: number) => (
                  <SummaryRow key={`e${i}`} label={`${e?.name || "Équipement"}${e?.quantity > 1 ? ` ×${e.quantity}` : ""}`} value={fmt((e?.price ?? 0) * (e?.quantity ?? 1))} />
                ))}
                {Number(quote.activation_fee) > 0 && (
                  <SummaryRow label="Frais d'activation" value={fmt(quote.activation_fee)} />
                )}
                {quote.discount && (
                  <SummaryRow label="Rabais appliqué" value={`− ${fmt(quote.discount?.amount ?? 0)}`} accent="text-emerald-400" />
                )}
                <div className="border-t border-white/10 pt-3 space-y-2">
                  <SummaryRow label="Sous-total" value={fmt(quote.subtotal)} muted />
                  <SummaryRow label="TPS (5%)" value={fmt(quote.tps)} muted />
                  <SummaryRow label="TVQ (9,975%)" value={fmt(quote.tvq)} muted />
                </div>
                <div className="border-t border-white/10 pt-3 flex items-baseline justify-between">
                  <span className="text-base font-semibold text-white">Total à payer</span>
                  <span className="text-2xl font-bold text-violet-400">{fmt(quote.total)}</span>
                </div>
              </div>
            ) : (
              <div className="border-t border-white/10 pt-4">
                <SummaryRow label="Total à payer" value={fmt(amount)} />
              </div>
            )}
          </Card>

          {/* Payment */}
          <Card>
            {/* Tab selector */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setTab("card")}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  tab === "card"
                    ? "border-violet-500 bg-violet-500/10 text-violet-300"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:border-violet-500/40"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Carte de crédit
              </button>
              <button
                onClick={() => setTab("interac")}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  tab === "interac"
                    ? "border-violet-500 bg-violet-500/10 text-violet-300"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:border-violet-500/40"
                }`}
              >
                <Send className="w-4 h-4" />
                Virement Interac
              </button>
            </div>

            {/* Card tab */}
            {tab === "card" && (
              <div className="space-y-3">
                <div ref={containerRef} id="sq-payer-card-container" className="min-h-[90px]" />
                {sqLoading && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Chargement du formulaire…
                  </div>
                )}
                <button
                  type="button"
                  disabled={sqLoading || paying}
                  onClick={handlePay}
                  className="w-full h-14 rounded-xl bg-violet-600 text-white font-bold text-base shadow-lg shadow-violet-600/30 hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paying
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Traitement…</>
                    : <><CreditCard className="h-4 w-4" />Payer {fmt(amount)} par carte</>}
                </button>
                <p className="flex items-center justify-center gap-2 text-xs text-white/40 pt-1">
                  <Lock className="h-3.5 w-3.5" />
                  Paiement sécurisé via Square — PCI-DSS
                </p>
              </div>
            )}

            {/* Interac tab */}
            {tab === "interac" && (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/10">
                  {[
                    { label: "Adresse courriel", value: INTERAC_EMAIL },
                    { label: "Montant", value: fmt(amount) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-xs text-white/40">{label}</p>
                        <p className="text-sm font-semibold text-white">{value}</p>
                      </div>
                      <button
                        onClick={() => copy(value, label)}
                        className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/40 text-center">
                  Traitement automatique dès réception.
                </p>

                <button
                  type="button"
                  disabled={resending || resendOk}
                  onClick={handleResend}
                  className="w-full h-12 rounded-xl border border-white/15 bg-white/[0.04] text-white font-semibold hover:bg-white/[0.08] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resending ? <Loader2 className="h-4 w-4 animate-spin" />
                    : resendOk ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : <Mail className="h-4 w-4" />}
                  {resendOk ? "Lien renvoyé ✓" : "Recevoir un nouveau lien par courriel"}
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}

/* ── Layout helpers ─────────────────────────────────────── */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#020209" }} className="relative min-h-screen overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=80" opacity={0.10} filter="saturate(0.6) brightness(0.65)" />
      <div aria-hidden style={{ position: "absolute", top: "-15%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(2,2,9,0.85)", backdropFilter: "blur(12px)", position: "relative" }}>
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <a href="https://nivra-telecom.ca" className="flex items-center gap-2">
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px", color: "#A78BFA", fontFamily: "'Space Grotesk', sans-serif" }}>Nivra</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono', monospace" }}>Telecom</span>
          </a>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#06B6D4" }} /> Paiement sécurisé
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">{children}</main>
      <footer className="mx-auto max-w-2xl px-4 py-8 text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        © {new Date().getFullYear()} Nivra Telecom — support@nivra-telecom.ca
      </footer>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", padding: 20 }}>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm ${muted ? "text-white/50" : "text-white/75"}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent || (muted ? "text-white/60" : "text-white")}`}>{value}</span>
    </div>
  );
}
