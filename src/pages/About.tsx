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
    <div style={{ background: '#020209', minHeight: '100vh' }}>
      <SEOHead
        title="À propos de Nivra Telecom | Fournisseur Internet sans contrat au Québec"
        description="Découvrez Nivra Telecom, entreprise québécoise offrant Internet et TV sans contrat. Notre mission: un service transparent, simple et honnête pour tous les Québécois."
        canonical="https://nivra-telecom.ca/a-propos"
      />
      <Header />

      {/* Hero */}
      <section style={{ paddingTop: 110, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
        <div className="max-w-[820px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="n-animate-in inline-flex items-center gap-2 mb-8" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '7px 18px' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: '#A78BFA', boxShadow: '0 0 8px #A78BFA' }} />
            <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
              Notre histoire
            </span>
          </div>
          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5.5vw, 64px)', lineHeight: 1.0, letterSpacing: '-2.5px', marginBottom: 20, color: '#fff' }}>
            À propos de <span className="n-shimmer-text">Nivra Telecom</span>
          </h1>
          <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(16px, 2.5vw, 19px)', lineHeight: 1.65, maxWidth: 580, margin: '0 auto' }}>
            Une entreprise québécoise qui croit que l'Internet devrait être simple, honnête et sans surprise.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section style={{ background: '#020209', padding: '80px 20px' }}>
        <div className="max-w-[760px] mx-auto">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '-1.5px', color: '#fff', marginBottom: 24 }}>
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
      <section style={{ background: '#020209', padding: '80px 20px' }}>
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
      <section style={{ background: '#020209', padding: '80px 20px' }}>
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
      <section style={{ background: '#020209', padding: '80px 20px' }}>
        <div className="max-w-[760px] mx-auto" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.05) 100%)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 24, padding: 'clamp(40px, 7vw, 64px)', textAlign: 'center', backdropFilter: 'blur(16px)' }}>
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
