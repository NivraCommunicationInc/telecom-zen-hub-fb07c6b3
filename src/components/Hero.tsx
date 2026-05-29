import { ArrowRight, Check, Wifi, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';
  const { data: services, isLoading } = usePublicServices({ surface: "website", categories: ["Internet"] });

  const internetPrice = (() => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map(s => Number(s.price))).toFixed(0);
  })();

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #080612 0%, #11082A 45%, #0C0C18 100%)',
        minHeight: 580,
      }}
    >
      {/* Radial glow top-right */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: -180,
          right: -120,
          width: 700,
          height: 700,
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.22) 0%, transparent 65%)',
          filter: 'blur(1px)',
        }}
      />
      {/* Radial glow bottom-left */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: -100,
          left: -100,
          width: 500,
          height: 500,
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.1) 0%, transparent 65%)',
        }}
      />

      {/* Grid lines decorative */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-[1100px] mx-auto px-5 sm:px-10 w-full" style={{ paddingTop: 72, paddingBottom: 64 }}>
        <div className="flex items-center gap-12 lg:gap-16">

          {/* Left column */}
          <div className="flex-1 max-w-[580px]">

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-6" style={{
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.35)',
              borderRadius: 999,
              padding: '6px 14px',
            }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} />
              <span className="font-semibold uppercase" style={{ color: '#C4B5FD', fontSize: 11, letterSpacing: 2 }}>
                {isFr ? 'Internet & TV au Québec' : 'Internet & TV in Quebec'}
              </span>
            </div>

            {/* Headline */}
            <h1
              className="font-extrabold mb-5 text-white"
              style={{
                fontSize: 'clamp(36px, 5.5vw, 60px)',
                lineHeight: 1.05,
                letterSpacing: '-1.5px',
              }}
            >
              {t('xhero.title')}{" "}
              <span style={{
                background: 'linear-gradient(90deg, #A78BFA 0%, #7C3AED 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {t('xhero.titleAccent')}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mb-8 max-w-[460px]" style={{ color: 'rgba(255,255,255,0.62)', fontSize: 17, lineHeight: 1.65 }}>
              {t('xhero.subtitle')}
            </p>

            {/* Price */}
            <div className="mb-8 flex items-baseline gap-1">
              {isLoading || internetPrice === null ? (
                <Skeleton className="h-16 w-32 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }} />
              ) : (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>{isFr ? 'Dès' : 'From'}</span>
                  <span className="font-black leading-none ml-2" style={{ color: '#FFFFFF', fontSize: 'clamp(52px, 10vw, 76px)', letterSpacing: '-2px' }}>
                    {internetPrice}$
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>/{isFr ? 'mois' : 'mo'}</span>
                </>
              )}
            </div>

            {/* Bullets */}
            <ul className="flex flex-col gap-2.5 sm:flex-row sm:gap-6 mb-10">
              {[t('xhero.bullet1'), t('xhero.bullet2'), t('xhero.bullet3')].map((text) => (
                <li key={text} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  <div className="shrink-0 flex items-center justify-center" style={{
                    width: 18, height: 18, borderRadius: 999,
                    background: 'rgba(124,58,237,0.25)',
                    border: '1px solid rgba(124,58,237,0.4)',
                  }}>
                    <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: '#A78BFA' }} />
                  </div>
                  {text}
                </li>
              ))}
            </ul>

            {/* Trust badges — no emoji */}
            <div className="flex flex-wrap gap-2 mb-10">
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 12,
              }}>
                <Zap className="w-3.5 h-3.5" style={{ color: '#FBBF24' }} />
                {isFr ? 'Premier mois GRATUIT' : 'First month FREE'}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 12,
              }}>
                <Shield className="w-3.5 h-3.5" style={{ color: '#34D399' }} />
                {isFr ? 'Satisfait ou remboursé 30 jours' : '30-day money-back'}
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/forfaits"
                className="flex items-center justify-center gap-2 px-8 font-bold text-white transition-all w-full sm:w-auto cursor-pointer"
                style={{
                  height: 54,
                  borderRadius: 8,
                  background: '#7C3AED',
                  fontSize: 15,
                  boxShadow: '0 4px 24px rgba(124,58,237,0.45)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#6D28D9';
                  e.currentTarget.style.boxShadow = '0 6px 32px rgba(124,58,237,0.6)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#7C3AED';
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(124,58,237,0.45)';
                }}
              >
                {t('xhero.cta')}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/forfaits"
                className="flex items-center justify-center gap-2 px-7 font-semibold transition-all w-full sm:w-auto cursor-pointer"
                style={{
                  height: 54,
                  borderRadius: 8,
                  border: '1.5px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 15,
                  background: 'rgba(255,255,255,0.04)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
              >
                {isFr ? 'Voir tous les forfaits' : 'See all plans'}
              </Link>
            </div>
          </div>

          {/* Right column — telecom stats visual */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <div className="relative w-full max-w-[380px]">

              {/* Main card */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20,
                padding: '32px 28px',
                backdropFilter: 'blur(12px)',
              }}>
                <div className="flex items-center gap-3 mb-6">
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(124,58,237,0.2)',
                    border: '1px solid rgba(124,58,237,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wifi className="w-5 h-5" style={{ color: '#A78BFA' }} />
                  </div>
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                      {isFr ? 'Réseau Fibre' : 'Fibre Network'}
                    </p>
                    <p style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 700, marginTop: 1 }}>
                      {isFr ? 'Actif · 99.9% disponibilité' : 'Active · 99.9% uptime'}
                    </p>
                  </div>
                </div>

                {/* Speed stat */}
                <div style={{
                  background: 'rgba(124,58,237,0.12)',
                  border: '1px solid rgba(124,58,237,0.25)',
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 12,
                }}>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                    {isFr ? 'Vitesse maximale' : 'Max speed'}
                  </p>
                  <p className="font-black" style={{ color: '#FFFFFF', fontSize: 42, letterSpacing: '-2px', lineHeight: 1 }}>
                    1 <span style={{ color: '#A78BFA' }}>Gbps</span>
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                    {isFr ? 'Téléchargement symétrique' : 'Symmetric download'}
                  </p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: isFr ? 'Technologie' : 'Technology', value: 'Fibre optique' },
                    { label: isFr ? 'Activation' : 'Activation', value: isFr ? '3–5 jours' : '3–5 days' },
                    { label: isFr ? 'Couverture' : 'Coverage', value: 'Québec' },
                    { label: isFr ? 'Contrat' : 'Contract', value: isFr ? 'Aucun' : 'None' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                        {stat.label}
                      </p>
                      <p style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge — no contract */}
              <div style={{
                position: 'absolute',
                top: -18,
                right: -18,
                background: '#7C3AED',
                borderRadius: 12,
                padding: '10px 16px',
                boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
              }}>
                <p style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, margin: 0 }}>
                  {isFr ? 'Sans contrat' : 'No contract'}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom stat bar */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
            {[
              { value: '1 Gbps', label: isFr ? 'Vitesse max fibre' : 'Max fibre speed' },
              { value: '99.9%', label: isFr ? 'Disponibilité réseau' : 'Network uptime' },
              { value: '5G/LTE', label: isFr ? 'Réseau mobile' : 'Mobile network' },
              { value: '7j/7', label: isFr ? 'Support client' : 'Customer support' },
            ].map(stat => (
              <div key={stat.value} className="flex items-center gap-3">
                <span className="font-black" style={{ color: '#FFFFFF', fontSize: 18, letterSpacing: '-0.5px' }}>
                  {stat.value}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
