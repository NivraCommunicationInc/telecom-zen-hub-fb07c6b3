import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const FinalCTA = () => {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #9333EA 100%)',
        paddingTop: 72,
        paddingBottom: 72,
      }}
    >
      {/* Decorative orbs */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-40%', left: '-10%', width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: '-40%', right: '-10%', width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(192,132,252,0.35) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative max-w-[1100px] mx-auto px-5 sm:px-10 text-center">
        <div className="max-w-[720px] mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-6"
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 50,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase text-white" style={{ fontSize: 11, letterSpacing: 2 }}>
              {isFr ? "Activation rapide" : "Quick activation"}
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-[44px] font-extrabold text-white mb-4"
            style={{ letterSpacing: '-0.8px', lineHeight: 1.1 }}
          >
            {isFr ? "Passez à un service simple et transparent" : "Switch to simple, transparent service"}
          </h2>

          <p
            className="mb-8 max-w-xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16.5, lineHeight: 1.6 }}
          >
            {isFr
              ? "Aucun contrat, aucune surprise. Activez votre service en quelques minutes."
              : "No contract, no surprises. Activate your service in just a few minutes."}
          </p>

          <ul className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-7 mb-9">
            {[t('finalcta.bullet1'), t('finalcta.bullet2'), t('finalcta.bullet3')].map((text) => (
              <li
                key={text}
                className="flex items-center gap-2 font-medium"
                style={{ color: 'rgba(255,255,255,0.95)', fontSize: 14 }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 22, height: 22, borderRadius: 50,
                    background: 'rgba(255,255,255,0.2)',
                  }}
                >
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </div>
                {text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/commander"
              className="inline-flex items-center justify-center gap-2 px-8 font-bold transition-all hover:gap-3 hover:scale-[1.02]"
              style={{
                height: 54, borderRadius: 50,
                background: '#FFFFFF', color: '#7C3AED',
                fontSize: 15,
                boxShadow: '0 14px 32px -10px rgba(0,0,0,0.35)',
              }}
            >
              {isFr ? "Activer mon service" : "Activate my service"}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/couverture"
              className="inline-flex items-center justify-center gap-2 px-8 font-semibold transition-all hover:bg-white/10"
              style={{
                height: 54, borderRadius: 50,
                background: 'transparent',
                color: '#FFFFFF',
                fontSize: 14.5,
                border: '1.5px solid rgba(255,255,255,0.4)',
              }}
            >
              {isFr ? "Vérifier la couverture" : "Check coverage"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
