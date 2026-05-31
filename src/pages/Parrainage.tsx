import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Gift, Users, CreditCard, ShieldCheck, Clock, HelpCircle, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const P = "#7C3AED";
const PL = "#8B5CF6";
const PE = "#A78BFA";
const BG = "#0A0A0F";
const CARD = "#1A1A2E";
const BORDER = "rgba(124,58,237,0.18)";
const MUTED = "rgba(255,255,255,0.55)";

const steps = [
  {
    icon: Users,
    num: "1",
    title: "Partagez votre code",
    desc: "Connectez-vous à votre compte Nivra et trouvez votre code de parrainage unique dans la section Parrainage. Partagez-le par texto, courriel ou réseaux sociaux.",
  },
  {
    icon: Gift,
    num: "2",
    title: "Votre proche s'abonne",
    desc: "Le nouveau client entre votre code lors de sa commande Nivra. Il obtient automatiquement un rabais de 5$/mois pendant 10 mois (50$ d'économies au total).",
  },
  {
    icon: Clock,
    num: "3",
    title: "2 cycles mensuels payés",
    desc: "Le nouveau client doit maintenir son service actif et payer 2 cycles de facturation mensuels consécutifs. Vous suivez la progression en temps réel dans votre portail.",
  },
  {
    icon: CreditCard,
    num: "4",
    title: "Recevez votre 25$",
    desc: "Une fois les 2 cycles payés, votre récompense de 25$ est mise en file d'attente. Choisissez votre mode de versement : PayPal, carte-cadeau Visa/Mastercard prépayée ou Interac.",
  },
];

const faq = [
  {
    q: "Combien de personnes puis-je parrainer ?",
    a: "Il n'y a aucune limite. Chaque parrainage qualifié vous rapporte 25$. Plus vous parrainez, plus vous gagnez.",
  },
  {
    q: "Quand est-ce que je reçois ma récompense ?",
    a: "La récompense est émise après que la personne parrainée ait payé 2 cycles de facturation mensuels. Vous pouvez suivre la progression dans votre portail.",
  },
  {
    q: "Quel rabais reçoit la personne que je parraine ?",
    a: "Votre filleul reçoit automatiquement un rabais de 5$/mois pendant 10 mois, soit 50$ d'économies au total sur son forfait Nivra.",
  },
  {
    q: "Sous quelle forme est ma récompense ?",
    a: "Vous choisissez : versement PayPal, carte-cadeau Visa/Mastercard prépayée, ou virement Interac. Le choix se fait dans votre portail dès qu'un parrainage est qualifié.",
  },
  {
    q: "Puis-je me parrainer moi-même ?",
    a: "Non. L'auto-parrainage est interdit et détecté automatiquement par notre système anti-fraude.",
  },
  {
    q: "Que se passe-t-il si le client annule avant 2 mois ?",
    a: "Le parrainage est annulé et la récompense n'est pas émise. Le statut est visible dans votre portail en temps réel.",
  },
  {
    q: "Mon code est-il permanent ?",
    a: "Oui. Votre code de parrainage est lié à votre compte Nivra et ne change jamais.",
  },
];

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as const } } };

const Parrainage = () => {
  return (
    <div style={{ minHeight: "100vh", background: BG }}>
      <SEOHead
        title="Programme de parrainage | Nivra Telecom — 25$ pour vous, 50$ pour votre proche"
        description="Parrainez vos proches chez Nivra Telecom : 25$ pour vous après 2 mois, 5$/mois pendant 10 mois (50$) pour votre proche. Sans limite, transparent et simple."
      />
      <Header />

      <main>
        {/* ── Hero ── */}
        <section
          style={{
            background: "linear-gradient(160deg, #0A0A0F 0%, #14082E 50%, #0A0A0F 100%)",
            position: "relative",
            overflow: "hidden",
            paddingTop: 140,
            paddingBottom: 96,
          }}
        >
          {/* Animated orbs */}
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div className="nv-orb-1" style={{ position: "absolute", top: "10%", left: "5%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 65%)", filter: "blur(60px)" }} />
            <div className="nv-orb-2" style={{ position: "absolute", bottom: "-10%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)", filter: "blur(60px)" }} />
          </div>
          {/* Grid overlay */}
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />

          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", position: "relative", textAlign: "center" }}>
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
              <motion.div variants={fadeUp}>
                <span className="nv-badge" style={{ marginBottom: 24, display: "inline-flex" }}>
                  <Gift style={{ width: 14, height: 14 }} />
                  Programme de parrainage Nivra
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: 20 }}
              >
                Vous recevez{" "}
                <span style={{ background: `linear-gradient(90deg, ${PE}, ${P})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  25$
                </span>
                ,{" "}votre proche économise{" "}
                <span style={{ background: `linear-gradient(90deg, ${PE}, ${P})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  50$
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                style={{ fontSize: 18, color: MUTED, lineHeight: 1.7, maxWidth: 600, margin: "0 auto 36px" }}
              >
                Partagez votre code de parrainage. Après 2 mois de service payé, vous recevez 25$. Votre filleul économise 5$ par mois pendant 10 mois (50$ au total). Sans limite de parrainages.
              </motion.p>

              <motion.div variants={fadeUp} style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                <Link
                  to="/portal/referrals"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    height: 52, padding: "0 28px", borderRadius: 999,
                    background: `linear-gradient(135deg, ${P}, ${PL})`,
                    color: "#fff", fontWeight: 700, fontSize: 15,
                    textDecoration: "none",
                    boxShadow: "0 8px 24px rgba(124,58,237,0.45)",
                  }}
                >
                  <Gift style={{ width: 18, height: 18 }} />
                  Voir mon code de parrainage
                </Link>
                <Link
                  to="/commander"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    height: 52, padding: "0 28px", borderRadius: 999,
                    background: "rgba(124,58,237,0.1)",
                    border: "1px solid rgba(124,58,237,0.4)",
                    color: "#fff", fontWeight: 700, fontSize: 15,
                    textDecoration: "none",
                  }}
                >
                  Commander avec un code
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Steps ── */}
        <section style={{ padding: "96px 24px", background: BG }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }}
              variants={{ show: { transition: { staggerChildren: 0.1 } } }}
            >
              <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 56 }}>
                <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: 12, letterSpacing: "-0.5px" }}>
                  Comment ça fonctionne
                </h2>
                <p style={{ color: MUTED, fontSize: 16 }}>Un processus simple et transparent en 4 étapes</p>
              </motion.div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20 }}>
                {steps.map((step, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    style={{
                      display: "flex", gap: 20,
                      padding: 28,
                      background: CARD,
                      border: BORDER + " solid 1px",
                      borderRadius: 20,
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    whileHover={{ borderColor: "rgba(124,58,237,0.4)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
                  >
                    <div style={{
                      flexShrink: 0, width: 52, height: 52, borderRadius: 14,
                      background: `linear-gradient(135deg, ${P}, ${PL})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 20, fontWeight: 800,
                      boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
                    }}>
                      {step.num}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <step.icon style={{ width: 16, height: 16, color: PE }} />
                        <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{step.title}</h3>
                      </div>
                      <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.65 }}>{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Trust signals ── */}
        <section style={{ padding: "72px 24px", background: "#0D0B1A", borderTop: "1px solid rgba(124,58,237,0.1)", borderBottom: "1px solid rgba(124,58,237,0.1)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <motion.div
              initial="hidden" whileInView="show" viewport={{ once: true }}
              variants={{ show: { transition: { staggerChildren: 0.1 } } }}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32, textAlign: "center" }}
            >
              {[
                { Icon: ShieldCheck, title: "Système sécurisé", desc: "Suivi automatique, anti-fraude intégré, traçabilité complète de chaque parrainage." },
                { Icon: CheckCircle, title: "Transparent", desc: "Suivez la progression de vos parrainages en temps réel depuis votre portail client." },
                { Icon: CreditCard, title: "Récompense au choix", desc: "PayPal, carte-cadeau Visa/Mastercard prépayée ou Interac : 25$ versés à votre convenance." },
              ].map(({ Icon, title, desc }, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px",
                  }}>
                    <Icon style={{ width: 26, height: 26, color: PE }} />
                  </div>
                  <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</h3>
                  <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.6 }}>{desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ padding: "96px 24px", background: BG }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
              <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 48 }}>
                <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
                  Questions fréquentes
                </h2>
              </motion.div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {faq.map((item, i) => (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    style={{
                      padding: "20px 24px",
                      background: CARD,
                      border: "1px solid " + BORDER,
                      borderRadius: 16,
                    }}
                  >
                    <div style={{ display: "flex", gap: 14 }}>
                      <HelpCircle style={{ width: 18, height: 18, color: PE, flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <h3 style={{ color: "#fff", fontWeight: 600, fontSize: 14.5, marginBottom: 6 }}>{item.q}</h3>
                        <p style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.65 }}>{item.a}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ padding: "0 24px 96px" }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}
            style={{ maxWidth: 720, margin: "0 auto", position: "relative", overflow: "hidden" }}
          >
            <div style={{
              background: "linear-gradient(135deg, #14082E 0%, #1A1A2E 60%, #0A0A0F 100%)",
              border: "1px solid rgba(124,58,237,0.3)",
              borderRadius: 28,
              padding: "64px 40px",
              textAlign: "center",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.1)",
            }}>
              <div aria-hidden style={{ position: "absolute", top: "20%", left: "50%", transform: "translate(-50%,-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 65%)", pointerEvents: "none" }} />
              <h2 style={{ fontSize: "clamp(1.8rem, 3vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: 14, letterSpacing: "-0.5px", position: "relative" }}>
                Prêt à parrainer ?
              </h2>
              <p style={{ color: MUTED, fontSize: 16, marginBottom: 32, position: "relative" }}>
                Connectez-vous à votre compte pour accéder à votre code et commencer à gagner des récompenses.
              </p>
              <Link
                to="/portal/referrals"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  height: 52, padding: "0 32px", borderRadius: 999,
                  background: `linear-gradient(135deg, ${P}, ${PL})`,
                  color: "#fff", fontWeight: 700, fontSize: 15,
                  textDecoration: "none",
                  boxShadow: "0 8px 24px rgba(124,58,237,0.45)",
                  position: "relative",
                }}
              >
                <Gift style={{ width: 18, height: 18 }} />
                Accéder à mon programme de parrainage
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ── Terms ── */}
        <section style={{ padding: "40px 24px 64px", background: "#07070F", borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h3 style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 16 }}>
              Conditions du programme
            </h3>
            <ul style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 2, listStyle: "disc", paddingLeft: 18 }}>
              <li>La récompense référent est de 25$ (PayPal, carte-cadeau Visa/Mastercard prépayée ou Interac, au choix)</li>
              <li>Le rabais filleul est de 5$/mois pendant 10 mois (50$ d'économies au total)</li>
              <li>Le client référé doit compléter 2 cycles de facturation mensuels payés pour que le référent soit qualifié</li>
              <li>L'auto-parrainage est interdit et détecté automatiquement (même adresse, même courriel ou même mode de paiement)</li>
              <li>Un seul code de parrainage par nouveau client</li>
              <li>Nivra se réserve le droit de disqualifier les parrainages frauduleux</li>
              <li>Programme sujet à modification sans préavis</li>
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Parrainage;
