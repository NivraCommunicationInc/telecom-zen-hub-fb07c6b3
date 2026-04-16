import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, Mail } from "lucide-react";
import SEOHead from "@/components/SEOHead";

const values = [
  {
    icon: "🤝",
    title: "Transparence",
    text: "Le prix affiché est le prix que vous payez. Aucune surprise sur votre facture, aucune hausse après la période promotionnelle.",
  },
  {
    icon: "🇨🇦",
    title: "Entreprise québécoise",
    text: "Nous sommes une entreprise fondée et opérée au Québec. Notre support est en français, notre équipe est locale, et nous réinvestissons dans nos communautés.",
  },
  {
    icon: "⚡",
    title: "Simplicité",
    text: "De la commande à l'activation, tout se fait en ligne en quelques minutes. Pas de technicien à attendre, pas de formulaire papier.",
  },
];

const differentiators = [
  "Sans contrat — résiliez à tout moment sans frais de résiliation",
  "Prix fixe garanti — votre prix ne change pas après 12 mois",
  "Support en français 7 jours sur 7 par courriel et clavardage",
  "Activation en ligne — sans technicien, sans rendez-vous obligatoire",
  "Équipement qui vous appartient — borne WiFi et terminaux sont à vous",
  "Conforme CRTC — nous respectons le Code des fournisseurs de services Internet",
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="À propos de Nivra Telecom | Fournisseur Internet sans contrat au Québec"
        description="Découvrez Nivra Telecom, entreprise québécoise offrant Internet et TV sans contrat. Notre mission: un service transparent, simple et honnête pour tous les Québécois."
      />
      <Header />

      {/* Section 1 — Hero */}
      <section style={{ background: '#EDE9FF' }} className="pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h1 style={{ color: '#111111', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 16 }}>
            À propos de Nivra Telecom
          </h1>
          <p style={{ color: '#555555', fontSize: 'clamp(16px, 2.5vw, 20px)', lineHeight: 1.6, maxWidth: 600, margin: '0 auto' }}>
            Une entreprise québécoise qui croit que l'Internet devrait être simple, honnête et sans surprise.
          </p>
        </div>
      </section>

      {/* Section 2 — Notre mission */}
      <section className="py-16 md:py-20" style={{ background: '#FFFFFF' }}>
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 style={{ color: '#111111', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, marginBottom: 20 }}>
            Notre mission
          </h2>
          <p style={{ color: '#444444', fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>
            Nous avons fondé Nivra Telecom avec une conviction simple — les Québécois méritent un service Internet et TV de qualité, sans être piégés dans des contrats de 2 ans, sans hausses de prix surprises après 12 mois, et sans devoir appeler pendant 45 minutes pour annuler.
          </p>
          <p style={{ color: '#444444', fontSize: 16, lineHeight: 1.8 }}>
            Chez Nivra, tout se passe en ligne. Vous commandez, vous gérez, vous annulez — quand vous voulez, comme vous voulez. Pas de contrat. Pas de prise de tête.
          </p>
        </div>
      </section>

      {/* Section 3 — Nos valeurs */}
      <section className="py-16 md:py-20" style={{ background: '#F7F7F7' }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-center" style={{ color: '#111111', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, marginBottom: 40 }}>
            Nos valeurs
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <div
                key={i}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  border: '1px solid #EEEEEE',
                  padding: '28px 24px',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{v.icon}</div>
                <h3 style={{ color: '#111111', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{v.title}</h3>
                <p style={{ color: '#555555', fontSize: 14, lineHeight: 1.7 }}>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Pourquoi Nivra */}
      <section className="py-16 md:py-20" style={{ background: '#FFFFFF' }}>
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 style={{ color: '#111111', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, marginBottom: 28 }}>
            Pourquoi Nivra ?
          </h2>
          <ul className="space-y-4">
            {differentiators.map((d, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
                <span style={{ color: '#333333', fontSize: 15, lineHeight: 1.6 }}>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 5 — Contact / CTA */}
      <section className="py-16 md:py-20" style={{ background: '#7C3AED' }}>
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 style={{ color: '#FFFFFF', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, marginBottom: 12 }}>
            Une question ? On est là.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, lineHeight: 1.7, marginBottom: 8 }}>
            Notre équipe répond par courriel et clavardage, du lundi au dimanche de 8h à 20h.
          </p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <Mail className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.7)' }} />
            <a href="mailto:support@nivra-telecom.ca" style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>
              support@nivra-telecom.ca
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/forfaits">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                style={{ background: '#FFFFFF', color: '#7C3AED', borderRadius: 999, fontWeight: 700, border: 'none' }}
              >
                Voir nos forfaits
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                style={{ background: 'transparent', color: '#FFFFFF', borderRadius: 999, fontWeight: 600, border: '2px solid rgba(255,255,255,0.4)' }}
              >
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
