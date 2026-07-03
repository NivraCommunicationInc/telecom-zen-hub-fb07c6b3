/**
 * CommandeConfirmee — Post-payment celebration page for field-sale clients.
 * URL: /commande/confirmee/:intentId
 *
 * Displays a warm thank-you, order number, install date and next steps,
 * plus actions to download the invoice or set up the client portal.
 * Read-only public page (uses the same public RPC as /payer).
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  CheckCircle2,
  CalendarClock,
  Phone,
  Wrench,
  Zap,
  Download,
  UserPlus,
  Mail,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhotoBg } from "@/components/PhotoBg";

const fmt = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "À confirmer avec votre technicien";
  try {
    return new Date(d).toLocaleDateString("fr-CA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
};

export default function CommandeConfirmee() {
  const { intentId } = useParams<{ intentId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!intentId) return setLoading(false);
      const { data: rpc } = await supabase.rpc(
        "get_field_payment_intent_public" as never,
        { p_id: intentId },
      );
      if (!cancelled) {
        setData(rpc);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  if (loading) {
    return (
      <div style={{ background: "#020209" }} className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const intent = data?.intent || {};
  const quote = data?.quote || null;
  const ci = quote?.client_info || {};
  const firstName = ci.first_name || intent.customer_name?.split(" ")[0] || "";
  const orderNumber = `NIV-${String(intentId || "").slice(0, 8).toUpperCase()}`;
  const installDate = quote?.install_date || null;
  const installMode = quote?.install_mode || "technician";
  const services = Array.isArray(quote?.services) ? quote.services : [];
  const total = Number(intent?.amount || quote?.total || 0);

  return (
    <div style={{ background: "#020209" }} className="relative min-h-screen overflow-hidden">
      <Helmet>
        <title>Commande confirmée — Nivra Telecom</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <PhotoBg
        url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=80"
        opacity={0.1}
        filter="saturate(0.6) brightness(0.65)"
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(16,185,129,0.18) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(2,2,9,0.85)",
          backdropFilter: "blur(12px)",
          position: "relative",
        }}
      >
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <a href="https://nivra-telecom.ca" className="flex items-center gap-2">
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px", color: "#A78BFA" }}>
              Nivra
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Telecom
            </span>
          </a>
          <span className="text-xs text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Commande confirmée
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6 relative">
        {/* Hero */}
        <section className="text-center py-6">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/30">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            🎉 Merci{firstName ? `, ${firstName}` : ""} !
          </h1>
          <p className="mt-2 text-lg text-white/70">
            Votre commande est confirmée et prise en charge.
          </p>
          <p className="mt-1 text-sm text-white/50">
            Un reçu vous a été envoyé par courriel à {ci.email || intent.customer_email || "votre adresse"}.
          </p>
        </section>

        {/* Order card */}
        <section
          className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Numéro de commande</p>
              <p className="mt-1 text-lg font-mono font-bold text-white">{orderNumber}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Total payé</p>
              <p className="mt-1 text-lg font-bold text-emerald-400">{fmt(total)}</p>
            </div>
          </div>
          {services.length > 0 && (
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Forfaits</p>
              <ul className="space-y-1.5">
                {services.map((s: any, i: number) => (
                  <li key={i} className="flex justify-between text-sm text-white/85">
                    <span>{s?.name}</span>
                    <span className="text-white/60">{fmt(s?.monthlyPrice || 0)}/mois</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-4 border-t border-white/10 flex items-start gap-3">
            <CalendarClock className="h-5 w-5 text-violet-300 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Date prévue d'installation</p>
              <p className="mt-0.5 text-sm text-white font-medium">{fmtDate(installDate)}</p>
              <p className="text-xs text-white/50 mt-0.5">
                {installMode === "self" ? "Auto-installation" : "Installation par un technicien Nivra"}
              </p>
            </div>
          </div>
        </section>

        {/* Next steps */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Prochaines étapes</h2>
          <ol className="space-y-4">
            <Step
              icon={<Wrench className="h-4 w-4" />}
              title="Traitement de votre commande"
              text="Notre équipe vérifie votre dossier et prépare votre équipement."
              eta="Sous 24 heures"
              done
            />
            <Step
              icon={<Phone className="h-4 w-4" />}
              title="Contact d'un technicien"
              text="Un technicien Nivra vous contactera pour confirmer les détails et l'horaire."
              eta="Sous 24-48 heures"
            />
            <Step
              icon={<CalendarClock className="h-4 w-4" />}
              title="Installation à votre domicile"
              text={
                installDate
                  ? `Installation prévue le ${fmtDate(installDate)}.`
                  : "Une date sera confirmée avec vous."
              }
              eta={installDate ? undefined : "À planifier"}
            />
            <Step
              icon={<Zap className="h-4 w-4" />}
              title="Activation du service"
              text="Vos services sont activés et vous pouvez commencer à en profiter."
            />
          </ol>
        </section>

        {/* Actions */}
        <section className="grid gap-3 sm:grid-cols-2">
          <a
            href={`https://nivra-telecom.ca/portal/facture/${orderNumber}`}
            className="h-14 rounded-xl border border-white/15 bg-white/[0.05] text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/[0.08] transition-colors"
          >
            <Download className="h-4 w-4" /> Télécharger ma facture
          </a>
          <Link
            to="/portal/creer-mot-de-passe"
            className="h-14 rounded-xl bg-violet-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/30"
          >
            <UserPlus className="h-4 w-4" /> Créer mon portail client
          </Link>
        </section>

        <section className="text-center pt-4">
          <p className="text-sm text-white/50">
            Une question ?{" "}
            <a href="mailto:support@nivra-telecom.ca" className="text-violet-400 underline inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> support@nivra-telecom.ca
            </a>
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-white/30">
        © {new Date().getFullYear()} Nivra Telecom — Merci de votre confiance.
      </footer>
    </div>
  );
}

function Step({
  icon,
  title,
  text,
  eta,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  eta?: string;
  done?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 ${
          done
            ? "bg-emerald-500/15 ring-emerald-500/40 text-emerald-300"
            : "bg-white/[0.04] ring-white/10 text-white/60"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-white">{title}</p>
          {eta && <span className="text-[11px] text-white/40 flex-shrink-0">{eta}</span>}
        </div>
        <p className="mt-0.5 text-xs text-white/60">{text}</p>
      </div>
    </li>
  );
}
