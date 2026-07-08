/**
 * Parrainage — Public landing page for the Nivra referral program
 * Premium "Bold CTA violet" redesign — Xfinity aesthetic locked (dark #020209, purple #7C3AED).
 * Business rules: 25 $ + 300 pts après 3 factures consécutives payées, versement 7-14 j,
 * Interac recommandé ou carte prépayée Visa/Mastercard, sans limite.
 */
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import {
  Gift, Users, CreditCard, CheckCircle, ArrowRight, ShieldCheck, Clock,
  Sparkles, Copy, Share2, Zap, TrendingUp, Star, ChevronDown, Ban, Infinity as InfinityIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

const REWARD_CASH = 25;
const REWARD_POINTS = 300;
const REQUIRED_INVOICES = 3;

const steps = [
  {
    icon: Share2,
    title: "Copiez votre code",
    desc: "Récupérez votre code unique dans votre portail Nivra, section Parrainage.",
  },
  {
    icon: Users,
    title: "Partagez-le",
    desc: "Envoyez-le à vos proches par texto, courriel ou sur les réseaux sociaux.",
  },
  {
    icon: Clock,
    title: "3 factures payées",
    desc: "Votre filleul règle 3 factures mensuelles consécutives en gardant son compte actif.",
  },
  {
    icon: Gift,
    title: "Recevez votre récompense",
    desc: "25 $ + 300 points de fidélité versés dans les 7 à 14 jours après validation.",
  },
];

const faq = [
  {
    q: "Combien de personnes puis-je parrainer ?",
    a: "Aucune limite. Chaque parrainage qualifié vous rapporte 25 $ + 300 points. Plus vous parrainez, plus vous gagnez.",
  },
  {
    q: "Quand est-ce que je reçois ma récompense ?",
    a: "La récompense est validée une fois que la personne parrainée a complété 3 factures mensuelles consécutives entièrement payées, avec un compte toujours actif. Le versement est ensuite effectué dans un délai de 7 à 14 jours (validations administratives).",
  },
  {
    q: "Quel rabais reçoit la personne que je parraine ?",
    a: "Votre filleul reçoit automatiquement un rabais de 5 $/mois pendant 10 mois, soit 50 $ d'économies au total sur son forfait Nivra.",
  },
  {
    q: "Sous quelle forme est ma récompense ?",
    a: "Le versement recommandé est l'Interac e-Transfer. Vous pouvez aussi choisir une carte-cadeau Visa/Mastercard prépayée. Le choix se fait dans votre portail dès qu'un parrainage est qualifié. Vous recevez également 300 points de fidélité.",
  },
  {
    q: "Puis-je me parrainer moi-même ?",
    a: "Non. L'auto-parrainage est interdit et détecté automatiquement par notre système anti-fraude (même adresse, même courriel ou même mode de paiement).",
  },
  {
    q: "Que se passe-t-il si le client annule avant les 3 factures payées ?",
    a: "Le parrainage est annulé et la récompense n'est pas émise. Le compte doit être actif au moment de la validation et aucun remboursement ne doit être en cours. Le statut est visible dans votre portail en temps réel.",
  },
  {
    q: "Mon code est-il permanent ?",
    a: "Oui. Votre code de parrainage est lié à votre compte Nivra et ne change jamais.",
  },
];

// Small primitive: glow-y stat card
const StatCard = ({ value, label, accent = "#A78BFA" }: { value: string; label: string; accent?: string }) => (
  <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 800, color: accent, letterSpacing: "-1px" }}>{value}</div>
    <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>{label}</div>
  </div>
);

const Parrainage = () => {
  const [invited, setInvited] = useState(5);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const cashTotal = invited * REWARD_CASH;
  const pointsTotal = invited * REWARD_POINTS;

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden text-white">
      <SEOHead
        title="Programme de parrainage | Nivra Telecom — 25 $ + 300 points par parrainage"
        description="Parrainez vos proches chez Nivra Telecom : 25 $ + 300 points de fidélité après 3 factures mensuelles consécutives payées. Versement Interac ou carte prépayée en 7 à 14 jours. Sans limite."
      />
      <Header />

      <main>
        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden" style={{ paddingTop: 120, paddingBottom: 100 }}>
          <div aria-hidden style={{ position: "absolute", top: "-15%", left: "50%", transform: "translateX(-50%)", width: 900, height: 500, background: "radial-gradient(ellipse, rgba(124,58,237,0.28) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none" }} />
          <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "80px 80px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)", pointerEvents: "none" }} />

          <div className="container mx-auto px-4 max-w-5xl text-center relative z-10">
            <div className="inline-flex items-center gap-2 mb-8 backdrop-blur-sm" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 999, padding: "8px 18px" }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C3AED] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]" />
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#C4B5FD", letterSpacing: "0.1em" }}>PROGRAMME DE PARRAINAGE</span>
            </div>

            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(40px, 6vw, 76px)", letterSpacing: "-3px", lineHeight: 1.02, marginBottom: 24 }}>
              Partagez Nivra,
              <br />
              <span style={{ background: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 40%, #06B6D4 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                soyez récompensé.
              </span>
            </h1>

            <p className="mx-auto" style={{ fontSize: 19, color: "rgba(255,255,255,0.6)", maxWidth: 680, lineHeight: 1.6, marginBottom: 40 }}>
              Recevez <strong className="text-white">25 $</strong> + <strong className="text-white">300 points de fidélité</strong> pour chaque proche qui règle 3 factures mensuelles consécutives. Votre filleul économise <strong className="text-white">50 $</strong>. Sans limite.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
              <Link
                to="/portal/referrals"
                className="w-full sm:w-auto transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_-10px_rgba(124,58,237,0.7)]"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#7C3AED", color: "#fff", borderRadius: 999, padding: "16px 32px", fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", textDecoration: "none", boxShadow: "0 10px 40px -10px rgba(124,58,237,0.6)" }}
              >
                <Gift style={{ width: 18, height: 18 }} />
                Commencer à parrainer
              </Link>
              <Link
                to="/commander"
                className="w-full sm:w-auto transition-all hover:bg-white/10"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: 999, padding: "16px 32px", fontSize: 15, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", textDecoration: "none" }}
              >
                Commander avec un code
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>
            </div>

            {/* Hero stat row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              <StatCard value="25 $" label="Par parrainage" />
              <StatCard value="300" label="Points fidélité" accent="#06B6D4" />
              <StatCard value="7-14 j" label="Versement" />
              <StatCard value="∞" label="Sans limite" accent="#06B6D4" />
            </div>
          </div>
        </section>

        {/* ═══ EARNINGS CALCULATOR ═══ */}
        <section className="py-20 relative">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 mb-3" style={{ color: "#A78BFA" }}>
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider font-semibold">Calculatrice de gains</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>
                Combien pouvez-vous gagner ?
              </h2>
              <p className="mt-3" style={{ color: "rgba(255,255,255,0.55)" }}>Ajustez le curseur pour visualiser vos récompenses.</p>
            </div>

            <div
              className="rounded-3xl p-8 md:p-12"
              style={{ background: "linear-gradient(180deg, rgba(124,58,237,0.08) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                {/* Slider */}
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-4">Nombre de filleuls qualifiés</label>
                  <div className="flex items-baseline gap-3 mb-6">
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 72, fontWeight: 800, color: "#fff", letterSpacing: "-3px", lineHeight: 1 }}>{invited}</span>
                    <span className="text-white/50 text-lg">{invited > 1 ? "filleuls" : "filleul"}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={invited}
                    onChange={(e) => setInvited(Number(e.target.value))}
                    className="w-full accent-[#7C3AED] cursor-pointer"
                    style={{ height: 6 }}
                    aria-label="Nombre de filleuls"
                  />
                  <div className="flex justify-between text-xs text-white/40 mt-2">
                    <span>1</span>
                    <span>10</span>
                    <span>25</span>
                    <span>50+</span>
                  </div>
                </div>

                {/* Results */}
                <div className="space-y-4">
                  <div className="rounded-2xl p-6 flex items-center justify-between" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "#7C3AED" }}>
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs text-white/60 uppercase tracking-wider">Cash</div>
                        <div className="text-sm text-white/80">Interac ou carte prépayée</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 800, color: "#fff", letterSpacing: "-1.5px" }}>
                      {cashTotal.toLocaleString("fr-CA")} $
                    </div>
                  </div>

                  <div className="rounded-2xl p-6 flex items-center justify-between" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "#06B6D4" }}>
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs text-white/60 uppercase tracking-wider">Points fidélité</div>
                        <div className="text-sm text-white/80">Utilisables en crédits ou récompenses</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 800, color: "#fff", letterSpacing: "-1.5px" }}>
                      {pointsTotal.toLocaleString("fr-CA")}
                    </div>
                  </div>

                  <p className="text-xs text-white/40 text-center pt-2">
                    Estimation. Récompense versée après validation des 3 factures consécutives payées.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS — 4 STEPS ═══ */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>
                Comment ça fonctionne
              </h2>
              <p className="text-lg" style={{ color: "rgba(255,255,255,0.55)" }}>Un parcours simple, transparent et automatisé.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div
                    key={i}
                    className="relative p-8 rounded-3xl transition-all hover:-translate-y-1"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.5)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl mb-6 text-white"
                      style={{ background: "#7C3AED", boxShadow: "0 8px 24px -8px rgba(124,58,237,0.6)" }}
                    >
                      {i + 1}
                    </div>
                    <Icon className="w-5 h-5 mb-3" style={{ color: "#A78BFA" }} />
                    <h3 className="text-lg font-bold mb-2 text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ TIMELINE — 3 MONTHS TO PAYOUT ═══ */}
        <section className="py-20 relative">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>
                Le parcours vers votre récompense
              </h2>
              <p style={{ color: "rgba(255,255,255,0.55)" }}>{REQUIRED_INVOICES} factures mensuelles consécutives payées, puis versement en 7 à 14 jours.</p>
            </div>

            <div className="relative">
              {/* Rail */}
              <div className="hidden md:block absolute left-0 right-0 top-6 h-0.5" style={{ background: "linear-gradient(90deg, #7C3AED 0%, #7C3AED 75%, #06B6D4 100%)" }} />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
                {[
                  { label: "Mois 1", desc: "1ʳᵉ facture payée", accent: "#7C3AED" },
                  { label: "Mois 2", desc: "2ᵉ facture payée", accent: "#7C3AED" },
                  { label: "Mois 3", desc: "3ᵉ facture payée — validation", accent: "#7C3AED", pulse: true },
                  { label: "7 à 14 j", desc: "Versement 25 $ + 300 pts", accent: "#06B6D4" },
                ].map((node, i) => (
                  <div key={i} className="text-center">
                    <div className="relative w-fit mx-auto mb-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center relative z-10"
                        style={{ background: node.accent, boxShadow: `0 0 30px -5px ${node.accent}` }}
                      >
                        {i === 3 ? <Gift className="w-5 h-5 text-white" /> : <CheckCircle className="w-5 h-5 text-white" />}
                      </div>
                      {node.pulse && (
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ background: node.accent, opacity: 0.4 }}
                        />
                      )}
                    </div>
                    <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: node.accent }}>{node.label}</div>
                    <div className="text-sm text-white/70">{node.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ PAYOUT METHOD COMPARISON ═══ */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>
                Choisissez votre mode de versement
              </h2>
              <p style={{ color: "rgba(255,255,255,0.55)" }}>Deux options, aucune complication.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Interac — recommended */}
              <div
                className="relative p-8 rounded-3xl overflow-hidden"
                style={{ background: "linear-gradient(180deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.02) 100%)", border: "1px solid rgba(124,58,237,0.4)" }}
              >
                <div className="absolute top-5 right-5 inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1" style={{ background: "#7C3AED", color: "#fff" }}>
                  <Star className="w-3 h-3 fill-white" /> Recommandé
                </div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(124,58,237,0.25)" }}>
                  <Zap className="w-7 h-7" style={{ color: "#A78BFA" }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Interac e-Transfer</h3>
                <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Directement dans votre compte bancaire. Rapide, sécurisé, sans frais.
                </p>
                <ul className="space-y-2.5 text-sm">
                  {["Dépôt direct au compte", "Aucun frais", "Traitement prioritaire", "Compatible avec toutes les banques canadiennes"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#A78BFA" }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prepaid card */}
              <div
                className="p-8 rounded-3xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(6,182,212,0.15)" }}>
                  <CreditCard className="w-7 h-7" style={{ color: "#06B6D4" }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Carte Visa/Mastercard prépayée</h3>
                <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Une carte physique ou virtuelle utilisable partout où Visa/Mastercard est accepté.
                </p>
                <ul className="space-y-2.5 text-sm">
                  {["Utilisable en ligne et en magasin", "Sans compte bancaire requis", "Idéale comme cadeau", "Livrée par courriel ou par la poste"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#06B6D4" }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ TRUST / KEY POINTS ═══ */}
        <section className="py-20" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { Icon: InfinityIcon, title: "Aucune limite", desc: "Parrainez autant de personnes que vous voulez, sans plafond." },
                { Icon: ShieldCheck, title: "Anti-fraude", desc: "Système automatisé de détection, traçabilité complète." },
                { Icon: Ban, title: "Auto-parrainage interdit", desc: "Un seul parrain par nouveau client. Compte distinct requis." },
                { Icon: Clock, title: "Versement 7 à 14 j", desc: "Après validation des 3 factures consécutives payées." },
              ].map(({ Icon, title, desc }, i) => (
                <div key={i} className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(124,58,237,0.15)" }}>
                    <Icon className="w-5 h-5" style={{ color: "#A78BFA" }} />
                  </div>
                  <h3 className="font-bold text-white mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FAQ ACCORDION ═══ */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>
                Questions fréquentes
              </h2>
              <p style={{ color: "rgba(255,255,255,0.55)" }}>Tout ce qu'il faut savoir avant de parrainer.</p>
            </div>

            <div className="space-y-3">
              {faq.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${open ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}` }}
                  >
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
                      aria-expanded={open}
                    >
                      <span className="font-semibold text-white text-[15px]">{item.q}</span>
                      <ChevronDown
                        className="w-5 h-5 shrink-0 transition-transform"
                        style={{ color: open ? "#A78BFA" : "rgba(255,255,255,0.4)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
                    {open && (
                      <div className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA — bold violet block ═══ */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <div
              className="relative overflow-hidden rounded-[40px] p-10 md:p-16"
              style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 45%, #7C3AED 100%)" }}
            >
              <div aria-hidden style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.15)", filter: "blur(80px)" }} />
              <div aria-hidden style={{ position: "absolute", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(6,182,212,0.25)", filter: "blur(70px)" }} />

              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="text-center md:text-left max-w-xl">
                  <h2 className="text-3xl md:text-5xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1.5px", lineHeight: 1.05 }}>
                    Prêt à parrainer ?
                  </h2>
                  <p className="text-white/80 text-lg">
                    Connectez-vous à votre portail pour récupérer votre code et commencer dès aujourd'hui.
                  </p>
                </div>
                <Link
                  to="/portal/referrals"
                  className="shrink-0 inline-flex items-center gap-2 hover:scale-[1.02] transition-transform"
                  style={{ background: "#fff", color: "#5B21B6", borderRadius: 999, padding: "18px 36px", fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", textDecoration: "none", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.4)" }}
                >
                  <Gift className="w-5 h-5" />
                  Accéder à mon code
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ TERMS ═══ */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Conditions du programme</h3>
            <ul className="text-xs space-y-1.5 list-disc list-inside" style={{ color: "rgba(255,255,255,0.45)" }}>
              <li>25 $ versés une seule fois pour chaque client référé admissible, plus 300 points de fidélité au parrain</li>
              <li>Le client référé doit compléter <strong className="text-white/70">3 factures mensuelles consécutives entièrement payées</strong></li>
              <li>Le compte doit être actif au moment de la validation, sans remboursement ni annulation en cours</li>
              <li>Le versement est effectué dans un délai de <strong className="text-white/70">7 à 14 jours</strong> suivant la validation</li>
              <li>Modes de versement : Interac e-Transfer (recommandé) ou carte-cadeau Visa/Mastercard prépayée</li>
              <li>Aucun plafond de références — plus vous parrainez, plus vous gagnez</li>
              <li>L'auto-parrainage est interdit et détecté automatiquement (même adresse, même courriel ou même mode de paiement)</li>
              <li>Un seul parrain par nouveau client</li>
              <li>Nivra Telecom se réserve le droit de refuser tout parrainage frauduleux</li>
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Parrainage;
