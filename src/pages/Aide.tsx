import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/seo/SEO";
import SchemaMarkup from "@/components/seo/SchemaMarkup";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Mail,
  HelpCircle,
  Smartphone,
  Wifi,
  Tv,
  CreditCard,
  Clock,
  Shield,
} from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const P = "#7C3AED";
const PE = "#A78BFA";
const BG = "#0A0A0F";
const CARD = "#1A1A2E";
const BORDER = "rgba(124,58,237,0.18)";
const MUTED = "rgba(255,255,255,0.55)";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

const Aide = () => {
  const { data: siteSettings } = useSiteSettings();

  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;

  const faqItems = [
    {
      icon: Smartphone,
      question: "Comment activer ma carte SIM ou eSIM?",
      answer: "Après réception de votre SIM, insérez-la dans votre appareil. L'activation est automatique après confirmation du paiement. Pour l'eSIM, vous recevrez un code QR par courriel à scanner dans les paramètres de votre téléphone. Délai habituel : quelques minutes à quelques heures.",
    },
    {
      icon: Smartphone,
      question: "Comment transférer (porter) mon numéro existant?",
      answer: "Lors de la commande, indiquez que vous souhaitez conserver votre numéro. Vous devrez fournir : votre numéro actuel, le nom de votre fournisseur actuel, et votre NIP/PIN de portage (si requis par votre ancien fournisseur). Le transfert prend généralement 1-3 jours ouvrables.",
    },
    {
      icon: Smartphone,
      question: "Quels sont les paramètres APN pour la data mobile?",
      answer: "Les paramètres APN sont généralement configurés automatiquement. Si besoin : APN = sp.mb.com (ou fourni avec votre confirmation). Contactez le support si vous avez des difficultés de connexion data après 24h.",
    },
    {
      icon: Clock,
      question: "Quels sont les délais d'activation?",
      answer: "Mobile : quelques minutes à quelques heures après paiement confirmé. Internet/TV : livraison 24-78h ouvrables (standard) ou installation selon rendez-vous. Ces délais sont des estimations et peuvent varier.",
    },
    {
      icon: Wifi,
      question: "Pourquoi ma vitesse Internet est différente de celle annoncée?",
      answer: "Les vitesses sont annoncées « jusqu'à » (maximum théorique). La vitesse réelle dépend de plusieurs facteurs : congestion réseau, qualité du Wi-Fi, câblage interne, distance du routeur, nombre d'appareils connectés. Pour optimiser : utilisez une connexion filaire, placez le routeur au centre du domicile.",
    },
    {
      icon: Tv,
      question: "Comment fonctionnent les chaînes Free-Choice et Premium?",
      answer: "Tous les plans TV incluent les chaînes de base obligatoires (25-26 chaînes). Les chaînes Free-Choice sont incluses selon votre plan (vous choisissez lesquelles). Les chaînes Premium sont facturées en supplément. Vous pouvez modifier votre sélection via le portail — délai de traitement 2h à 24h.",
    },
    {
      icon: CreditCard,
      question: "Qu'est-ce que le cycle de facturation (Bill Cycle)?",
      answer: "Votre cycle de facturation correspond au jour de création de votre compte. Si ce jour n'existe pas dans le mois (29-31), la facturation est au dernier jour du mois. Services prépayés : vous payez à l'avance pour le prochain cycle.",
    },
    {
      icon: CreditCard,
      question: "Comment fonctionne le paiement par e-Transfer?",
      answer: "Envoyez le montant exact à l'adresse indiquée sur votre facture. Utilisez la question/réponse de sécurité fournie. Statuts : En attente → En vérification → Complété. L'activation se fait après vérification (généralement quelques heures, max 24h ouvrables).",
    },
    {
      icon: MessageSquare,
      question: "Comment ouvrir un ticket de support?",
      answer: "Connectez-vous au portail client et allez dans la section « Tickets ». Créez un nouveau ticket avec le sujet approprié. Vous recevrez des mises à jour par courriel. Note : les tickets sans réponse peuvent être fermés après 7 jours — vous pouvez demander la réouverture.",
    },
    {
      icon: Shield,
      question: "Puis-je annuler mon service à tout moment?",
      answer: "Oui, les services sont sans engagement. Annulez via le portail ou en contactant le support. Le service reste actif jusqu'à la fin du cycle payé. L'équipement Nivra doit être retourné dans les 14 jours. Les frais de retour sont à votre charge.",
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: BG }}>
      <SEO
        title="Aide & Support | Nivra Telecom Internet & TV"
        description="Centre d'aide Nivra Telecom. Trouvez des réponses à vos questions sur nos forfaits Internet, TV et mobile au Québec."
        canonical="https://nivra-telecom.ca/aide"
      />
      <SchemaMarkup includeBrand />
      <Header />

      {/* ── Hero ── */}
      <section
        style={{
          background: "linear-gradient(160deg, #0A0A0F 0%, #14082E 50%, #0A0A0F 100%)",
          position: "relative",
          overflow: "hidden",
          paddingTop: 140,
          paddingBottom: 80,
        }}
      >
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div className="nv-orb-1" style={{ position: "absolute", top: "-10%", right: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 65%)", filter: "blur(60px)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        </div>

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", position: "relative", textAlign: "center" }}>
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
            <motion.div variants={fadeUp}>
              <span className="nv-badge" style={{ marginBottom: 24, display: "inline-flex" }}>
                <HelpCircle style={{ width: 14, height: 14 }} />
                Centre d'aide
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.2rem)", fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 16 }}
            >
              Foire aux{" "}
              <span style={{ background: `linear-gradient(90deg, ${PE}, ${P})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                questions
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} style={{ fontSize: 17, color: MUTED, lineHeight: 1.7 }}>
              Trouvez rapidement des réponses à vos questions sur nos services.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ Content ── */}
      <section style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                style={{
                  background: CARD,
                  border: "1px solid " + BORDER,
                  borderRadius: 16,
                  padding: "0 24px",
                }}
                className="border-0"
              >
                <AccordionTrigger
                  style={{ color: "#fff", fontWeight: 500, padding: "18px 0" }}
                  className="hover:no-underline text-left"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <item.icon style={{ width: 18, height: 18, color: PE, flexShrink: 0 }} />
                    <span>{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent style={{ color: MUTED, paddingBottom: 18, paddingLeft: 30, fontSize: 14, lineHeight: 1.7 }}>
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Contact Support ── */}
      <section style={{ padding: "72px 24px", background: "#0D0B1A", borderTop: "1px solid rgba(124,58,237,0.1)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true }}
            variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div variants={fadeUp} style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2rem)", fontWeight: 800, color: "#fff", marginBottom: 10 }}>
                Besoin d'aide supplémentaire?
              </h2>
              <p style={{ color: MUTED, fontSize: 15 }}>Notre équipe est disponible pour vous aider.</p>
            </motion.div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
              {[
                {
                  icon: MessageSquare,
                  title: "Portail client",
                  desc: "Ouvrez un ticket pour un suivi structuré.",
                  link: "/portal/auth",
                  linkLabel: "Accéder au portail",
                },
                {
                  icon: Mail,
                  title: "Courriel",
                  desc: supportEmail,
                  href: `mailto:${supportEmail.toLowerCase()}`,
                  linkLabel: "Envoyer un courriel",
                },
                {
                  icon: Clock,
                  title: "Heures",
                  desc: businessHours,
                  link: "/contact",
                  linkLabel: "Nous joindre",
                },
              ].map(({ icon: Icon, title, desc, link, href, linkLabel }, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  style={{
                    background: CARD,
                    border: "1px solid " + BORDER,
                    borderRadius: 20,
                    padding: 28,
                    textAlign: "center",
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px",
                  }}>
                    <Icon style={{ width: 22, height: 22, color: PE }} />
                  </div>
                  <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</h3>
                  <p style={{ color: MUTED, fontSize: 13.5, marginBottom: 20, lineHeight: 1.6 }}>{desc}</p>
                  {link ? (
                    <Link
                      to={link}
                      style={{
                        display: "inline-flex", alignItems: "center", height: 38, padding: "0 18px",
                        borderRadius: 999, border: "1px solid rgba(124,58,237,0.4)",
                        color: PE, fontSize: 13, fontWeight: 600, textDecoration: "none",
                        transition: "background 0.2s",
                      }}
                    >
                      {linkLabel}
                    </Link>
                  ) : (
                    <a
                      href={href}
                      style={{
                        display: "inline-flex", alignItems: "center", height: 38, padding: "0 18px",
                        borderRadius: 999, border: "1px solid rgba(124,58,237,0.4)",
                        color: PE, fontSize: 13, fontWeight: 600, textDecoration: "none",
                      }}
                    >
                      {linkLabel}
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer Links ── */}
      <section style={{ padding: "40px 24px 64px", background: BG }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 24px" }}>
          {[
            { to: "/conditions-de-service", label: "Conditions de service" },
            { to: "/frais-possibles", label: "Frais possibles" },
            { to: "/support-et-plaintes", label: "Support et plaintes" },
            { to: "/confidentialite-loi25", label: "Confidentialité" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{ color: PE, fontSize: 13, textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Aide;
