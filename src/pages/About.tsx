import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Check, Mail, Shield, MapPin, Zap } from "lucide-react";
import SEOHead from "@/components/SEOHead";

const values = [
  {
    Icon: Shield,
    title: "Transparence",
    text: "Le prix affiché est le prix que vous payez. Aucune surprise sur votre facture, aucune hausse après la période promotionnelle.",
  },
  {
    Icon: MapPin,
    title: "Entreprise québécoise",
    text: "Nous sommes une entreprise fondée et opérée au Québec. Notre support est en français, notre équipe est locale, et nous réinvestissons dans nos communautés.",
  },
  {
    Icon: Zap,
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
    <div style={{ background: '#080612', minHeight: '100vh' }}>
      <SEOHead
        title="À propos de Nivra Telecom | Fournisseur Internet sans contrat au Québec"
        description="Découvrez Nivra Telecom, entreprise québécoise offrant Internet et TV sans contrat. Notre mission: un service transparent, simple et honnête pour tous les Québécois."
      />
      <Header />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(160deg, #080612 0%, #11082A 55%, #0C0C18 100%)', paddingTop: 96, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ top: -140, right: -80, width: 500, height: 500, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.2) 0%, transparent 65%)' }} />
        <div className="max-w-[820px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 999, padding: '6px 16px' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} />
            <span style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              Notre histoire
            </span>
          </div>
          <h1 className="font-extrabold text-white" style={{ fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.05, letterSpacing: '-1.5px', marginBottom: 20 }}>
            À propos de Nivra Telecom
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 'clamp(16px, 2.5vw, 19px)', lineHeight: 1.65, maxWidth: 580, margin: '0 auto' }}>
            Une entreprise québécoise qui croit que l'Internet devrait être simple, honnête et sans surprise.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section style={{ background: '#0A0A18', padding: '80px 20px' }}>
        <div className="max-w-[760px] mx-auto">
          <h2 className="font-bold text-white" style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-0.8px', marginBottom: 24 }}>
            Notre mission
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.68)', fontSize: 17, lineHeight: 1.8, marginBottom: 16 }}>
            Nous avons fondé Nivra Telecom avec une conviction simple — les Québécois méritent un service Internet et TV de qualité, sans être piégés dans des contrats de 2 ans, sans hausses de prix surprises après 12 mois, et sans devoir appeler pendant 45 minutes pour annuler.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.68)', fontSize: 17, lineHeight: 1.8 }}>
            Chez Nivra, tout se passe en ligne. Vous commandez, vous gérez, vous annulez — quand vous voulez, comme vous voulez. Pas de contrat. Pas de prise de tête.
          </p>
        </div>
      </section>

      {/* Values */}
      <section style={{ background: '#080612', padding: '80px 20px' }}>
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-center font-bold text-white" style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-0.8px', marginBottom: 48 }}>
            Nos valeurs
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {values.map(({ Icon, title, text }, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '32px 28px' }}>
                <div className="flex items-center justify-center mb-5" style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <Icon className="w-5 h-5" style={{ color: '#A78BFA' }} />
                </div>
                <h3 className="font-bold text-white" style={{ fontSize: 18, marginBottom: 10 }}>{title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, lineHeight: 1.75 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section style={{ background: '#0A0A18', padding: '80px 20px' }}>
        <div className="max-w-[760px] mx-auto">
          <h2 className="font-bold text-white" style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-0.8px', marginBottom: 36 }}>
            Pourquoi Nivra ?
          </h2>
          <ul className="space-y-4">
            {differentiators.map((d, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="shrink-0 flex items-center justify-center mt-0.5" style={{ width: 22, height: 22, borderRadius: 999, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)' }}>
                  <Check className="w-3 h-3" strokeWidth={3} style={{ color: '#A78BFA' }} />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15, lineHeight: 1.65 }}>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#080612', padding: '80px 20px' }}>
        <div className="max-w-[760px] mx-auto" style={{ background: 'linear-gradient(135deg, #16111F 0%, #0A0A0F 100%)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 24, padding: 'clamp(40px, 7vw, 64px)', textAlign: 'center' }}>
          <div className="flex items-center justify-center mb-5" style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', margin: '0 auto 20px' }}>
            <Mail className="w-6 h-6" style={{ color: '#A78BFA' }} />
          </div>
          <h2 className="font-bold text-white" style={{ fontSize: 'clamp(22px, 3.5vw, 34px)', letterSpacing: '-0.8px', marginBottom: 12 }}>
            Une question ? On est là.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: 16, lineHeight: 1.7, marginBottom: 8 }}>
            Notre équipe répond par courriel et clavardage, du lundi au dimanche de 8h à 20h.
          </p>
          <a href="mailto:support@nivra-telecom.ca" style={{ color: '#C4B5FD', fontSize: 15, fontWeight: 600, display: 'block', marginBottom: 28 }}>
            support@nivra-telecom.ca
          </a>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/forfaits"
              className="inline-flex items-center justify-center font-bold"
              style={{ height: 52, paddingLeft: 28, paddingRight: 28, background: '#FFFFFF', color: '#0A0A0F', borderRadius: 999, fontSize: 15, textDecoration: 'none' }}
            >
              Voir nos forfaits
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center font-semibold"
              style={{ height: 52, paddingLeft: 28, paddingRight: 28, background: 'rgba(255,255,255,0.07)', color: '#FFFFFF', borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)', fontSize: 14, textDecoration: 'none' }}
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
