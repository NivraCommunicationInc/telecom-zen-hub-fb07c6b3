import { ArrowRight, Check, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const FinalCTA = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const bullets = isFr
    ? ['Sans contrat', 'Activation en 10 min', 'Prix fixe garanti', 'Support local']
    : ['No contract', '10-min activation', 'Fixed price guaranteed', 'Local support'];

  return (
    <section className="relative overflow-hidden px-5 sm:px-10 py-20 sm:py-24" style={{ background: '#FAFAFB' }}>
      <div className="max-w-[1180px] mx-auto">
        <div className="relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #16111F 50%, #1F1430 100%)',
          borderRadius: 32,
          padding: 'clamp(40px, 7vw, 80px)',
        }}>
          {/* Decorative glow */}
          <div aria-hidden className="absolute pointer-events-none" style={{
            top: '-30%', right: '-15%', width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 60%)',
            filter: 'blur(40px)',
          }} />
          <div aria-hidden className="absolute pointer-events-none" style={{
            bottom: '-40%', left: '-10%', width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(192,132,252,0.18) 0%, transparent 60%)',
            filter: 'blur(40px)',
          }} />

          {/* Subtle grid pattern */}
          <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />

          <div className="relative text-center max-w-[720px] mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-7" style={{
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.4)',
              borderRadius: 999,
              backdropFilter: 'blur(10px)',
            }}>
              <Zap className="w-3 h-3" style={{ color: '#C4A8FF' }} fill="#C4A8FF" />
              <span className="uppercase font-bold" style={{ color: '#C4A8FF', fontSize: 10.5, letterSpacing: 1.6 }}>
                {isFr ? 'Activation rapide' : 'Quick activation'}
              </span>
            </div>

            {/* Headline */}
            <h2 className="font-bold text-white mb-5" style={{
              fontSize: 'clamp(30px, 5vw, 52px)',
              letterSpacing: '-1.5px',
              lineHeight: 1.05,
            }}>
              {isFr ? (
                <>Activez votre service<br /><span style={{ color: '#C4A8FF' }}>en quelques minutes</span></>
              ) : (
                <>Activate your service<br /><span style={{ color: '#C4A8FF' }}>in minutes</span></>
              )}
            </h2>

            {/* Subtitle */}
            <p className="mb-9 mx-auto" style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 17,
              lineHeight: 1.55,
              maxWidth: 520,
            }}>
              {isFr
                ? "Vérifiez votre adresse, choisissez votre forfait et commencez. Aucun contrat, aucune surprise."
                : "Check your address, pick your plan, and get started. No contract, no surprises."}
            </p>

            {/* Bullets */}
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 mb-10">
              {bullets.map((text) => (
                <li
                  key={text}
                  className="inline-flex items-center gap-2 font-medium"
                  style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13.5 }}
                >
                  <div className="flex items-center justify-center" style={{
                    width: 18, height: 18, borderRadius: 999,
                    background: 'rgba(124,58,237,0.25)',
                    border: '1px solid rgba(124,58,237,0.4)',
                  }}>
                    <Check className="w-2.5 h-2.5" strokeWidth={3.5} style={{ color: '#C4A8FF' }} />
                  </div>
                  {text}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link
                to="/commander"
                className="group inline-flex items-center justify-center gap-2 px-7 font-semibold transition-all hover:scale-[1.02]"
                style={{
                  height: 54, borderRadius: 999,
                  background: '#FFFFFF', color: '#0A0A0F',
                  fontSize: 15,
                  boxShadow: '0 18px 40px -12px rgba(255,255,255,0.25)',
                }}
              >
                {isFr ? 'Activer mon service' : 'Activate my service'}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/couverture"
                className="inline-flex items-center justify-center gap-2 px-7 font-semibold transition-all hover:bg-white/10"
                style={{
                  height: 54, borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  color: '#FFFFFF',
                  fontSize: 14.5,
                  border: '1px solid rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {isFr ? 'Vérifier la couverture' : 'Check coverage'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
