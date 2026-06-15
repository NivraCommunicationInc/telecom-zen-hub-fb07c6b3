import { useMemo } from "react";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ArrowRight, Zap, Tv, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type DisplayPlan = {
  id: string;
  name: string;
  tagline: string;
  speed: string;
  price: number;
  features: string[];
  equipmentLabel: string;
  equipmentPrice: number;
  link: string;
  recommended: boolean;
  icon: typeof Wifi;
  planType: "internet" | "tv_combo";
  choices?: number;
  totalChannels?: number;
};

const HOMEPAGE_PLAN_SPECS: Array<{
  matchName: string;
  tagline: string;
  speed: string;
  features: string[];
  equipmentLabel: string;
  equipmentPrice: number;
  link: string;
  recommended: boolean;
  icon: typeof Wifi;
  planType: "internet" | "tv_combo";
  choices?: number;
  totalChannels?: number;
}> = [
  {
    matchName: "internet giga",
    tagline: "Internet pur",
    speed: "940",
    planType: "internet",
    features: [],
    equipmentLabel: "Borne Nivra WiFi",
    equipmentPrice: 60,
    link: "/internet",
    recommended: false,
    icon: Wifi,
  },
  {
    matchName: "internet giga + télé 15 choix",
    tagline: "Le plus populaire",
    speed: "GIGA 940 Mbit/s",
    planType: "tv_combo",
    choices: 15,
    totalChannels: 39,
    features: [],
    equipmentLabel: "Borne + Terminal TV",
    equipmentPrice: 110,
    link: "/tv",
    recommended: true,
    icon: Zap,
  },
  {
    matchName: "internet giga + télé 25 choix",
    tagline: "Combo plus",
    speed: "GIGA 940 Mbit/s",
    planType: "tv_combo",
    choices: 25,
    totalChannels: 49,
    features: [],
    equipmentLabel: "Borne + Terminal TV",
    equipmentPrice: 110,
    link: "/tv",
    recommended: false,
    icon: Tv,
  },
];

const HomePricing = () => {
  const { t, language } = useLanguage();
  const isFr = language === "fr";
  const { data: services, isLoading } = usePublicServices({
    surface: "website",
    categories: ["Internet", "TV"],
  });

  const plans = useMemo<DisplayPlan[]>(() => {
    if (!services?.length) return [];
    return HOMEPAGE_PLAN_SPECS.map((spec) => {
      const match = services.find(
        (s) => s.name.trim().toLowerCase() === spec.matchName,
      );
      if (!match) return null;
      return {
        id: match.id,
        name: match.name,
        tagline: spec.tagline,
        speed: spec.speed,
        price: Number(match.price),
        features: spec.features,
        equipmentLabel: spec.equipmentLabel,
        equipmentPrice: spec.equipmentPrice,
        link: spec.link,
        recommended: spec.recommended,
        icon: spec.icon,
        planType: spec.planType,
        choices: spec.choices,
        totalChannels: spec.totalChannels,
      } as DisplayPlan;
    }).filter((p): p is DisplayPlan => p !== null);
  }, [services]);

  if (isLoading) {
    return (
      <section className="px-5 sm:px-10 py-20" style={{ background: '#080612' }}>
        <div className="max-w-[1180px] mx-auto">
          <Skeleton className="h-10 w-72 mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <Skeleton className="h-5 w-80 mx-auto mb-12" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[460px] rounded-3xl" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  return (
    <section id="forfaits" className="relative px-5 sm:px-10 py-20 sm:py-24 overflow-hidden" style={{ background: '#080612' }}>
      <span id="services" aria-hidden="true" className="block" style={{ scrollMarginTop: 80 }} />

      {/* Subtle background accents */}
      <div aria-hidden className="absolute pointer-events-none" style={{ top: -200, left: '50%', transform: 'translateX(-50%)', width: 900, height: 600, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.06) 0%, transparent 60%)' }} />

      <div className="relative max-w-[1180px] mx-auto">
        {/* Section header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-5" style={{ borderRadius: 999, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7C3AED' }} />
            <span className="uppercase font-bold" style={{ color: '#7C3AED', fontSize: 10.5, letterSpacing: 1.6 }}>
              {isFr ? 'Forfaits sans contrat' : 'No-contract plans'}
            </span>
          </div>
          <h2 className="font-bold mb-4 text-white" style={{ fontSize: 'clamp(28px, 4.2vw, 44px)', letterSpacing: '-1.2px', lineHeight: 1.05 }}>
            {t('pricing.title')}
          </h2>
          <p className="max-w-[560px] mx-auto" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16.5, lineHeight: 1.55 }}>
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Swipe hint — mobile only */}
        <div className="flex items-center justify-center gap-2 mb-4 md:hidden" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
            <path d="M1 6h14M9 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{isFr ? 'Glisser pour voir tous les forfaits' : 'Swipe to see all plans'}</span>
        </div>

        {/* Plan grid — horizontal scroll on mobile, 3-col grid on desktop */}
        <div
          id="plans-scroll"
          className="flex overflow-x-auto snap-x snap-mandatory pb-4 gap-4 -mx-5 px-5 mb-6 md:grid md:grid-cols-3 md:gap-5 lg:gap-6 md:items-stretch md:max-w-[1080px] md:mx-auto md:overflow-visible md:pb-0 md:px-0"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {plans.map((plan) => {
            const isRec = plan.recommended;
            const isTV = plan.planType === "tv_combo";
            const baseExamples = isFr
              ? ['TVA', 'ICI Radio-Canada', 'Noovo', 'Télé-Québec', 'CTV Montréal']
              : ['TVA', 'ICI Radio-Canada', 'Noovo', 'Télé-Québec', 'CTV Montreal'];

            return (
              <Link
                key={plan.id}
                to={`/commander?plan=${plan.id}`}
                className="group relative flex flex-col transition-all duration-300 hover:-translate-y-1.5 shrink-0 w-[82vw] max-w-[340px] snap-start md:w-auto md:max-w-none"
                style={{
                  background: isRec
                    ? 'linear-gradient(180deg, rgba(124,58,237,0.22) 0%, rgba(10,10,15,1) 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: isRec ? '1px solid rgba(124,58,237,0.45)' : '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 24,
                  boxShadow: isRec
                    ? '0 24px 60px -20px rgba(124,58,237,0.55), 0 4px 12px rgba(0,0,0,0.08)'
                    : '0 2px 16px rgba(0,0,0,0.3)',
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textDecoration: 'none',
                }}
              >
                {/* PRIX À VIE banner */}
                <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  <div className="flex items-center justify-center gap-2 font-bold uppercase" style={{
                    background: isRec
                      ? 'linear-gradient(90deg, #7C3AED, #6D28D9)'
                      : 'linear-gradient(90deg, rgba(124,58,237,0.55), rgba(109,40,217,0.55))',
                    color: '#FFFFFF', padding: '9px 0', fontSize: 10, letterSpacing: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
                    {isFr ? 'PRIX À VIE GARANTI' : 'PRICE LOCKED FOR LIFE'}
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
                  </div>
                  <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', animation: 'n-beam-h 4s ease-in-out infinite' }} />
                </div>

                <div className="relative flex flex-col flex-1 p-5 sm:p-6">
                  {/* Popular badge */}
                  {isRec && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center px-2.5 py-1 uppercase font-bold" style={{ background: '#7C3AED', color: '#fff', fontSize: 9.5, letterSpacing: 1.2, borderRadius: 999 }}>
                        ★ {isFr ? 'Populaire' : 'Popular'}
                      </span>
                    </div>
                  )}

                  {/* Tagline + Name */}
                  <p className="uppercase font-bold mb-1" style={{ color: isRec ? '#C4A8FF' : '#7C3AED', fontSize: 10, letterSpacing: 1.4, fontFamily: "'JetBrains Mono', monospace" }}>
                    {plan.tagline}
                  </p>
                  <h3 className="font-bold mb-4" style={{ fontSize: 18, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
                    {plan.name}
                  </h3>

                  {/* ── TV section (combos only) ── */}
                  {isTV && (
                    <div style={{ background: 'rgba(124,58,237,0.09)', border: '1px solid rgba(124,58,237,0.22)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                      <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
                        <Tv className="w-3 h-3 flex-shrink-0" style={{ color: '#A78BFA' }} />
                        <span style={{ color: '#A78BFA', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
                          {isFr ? 'TÉLÉ' : 'TV'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, color: '#fff' }}>{plan.totalChannels}</span>
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{isFr ? 'chaînes' : 'channels'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: 8 }}>
                        <span style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: '#C4B5FD', fontWeight: 600 }}>
                          24 {isFr ? 'La Base' : 'Base'}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700 }}>+</span>
                        <span style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: '#6EE7B7', fontWeight: 600 }}>
                          {plan.choices} {isFr ? 'au choix' : 'of your choice'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {baseExamples.map(ch => (
                          <span key={ch} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 5, padding: '1px 6px', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>{ch}</span>
                        ))}
                        <span style={{ fontSize: 10, color: 'rgba(110,231,183,0.6)', padding: '1px 4px', fontFamily: "'JetBrains Mono', monospace" }}>+{plan.choices} {isFr ? 'choix' : 'choice'}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Internet / Vitesse section ── */}
                  <div style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                    <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
                      <Wifi className="w-3 h-3 flex-shrink-0" style={{ color: '#67E8F9' }} />
                      <span style={{ color: '#67E8F9', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
                        INTERNET
                      </span>
                    </div>
                    {!isTV ? (
                      <>
                        <div className="flex items-baseline gap-1.5" style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-2.5px', lineHeight: 1, color: '#fff' }}>{plan.speed}</span>
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{isFr ? 'Mbit/s illimité' : 'Mbit/s unlimited'}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {[
                            isFr ? `Vitesse de téléchargement jusqu'à ${plan.speed} Mbit/s` : `Download speed up to ${plan.speed} Mbit/s`,
                            isFr ? 'Données incluses illimitées' : 'Unlimited data included',
                            isFr ? 'Ultra-faible latence · CGNAT-Free' : 'Ultra-low latency · CGNAT-Free',
                          ].map((line, i) => (
                            <div key={i} className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                              <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} style={{ color: '#67E8F9' }} />
                              {line}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-0.3px' }}>GIGA 940 Mbit/s</p>
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, marginTop: 2 }}>{isFr ? 'Données illimitées incluses' : 'Unlimited data included'}</p>
                        </div>
                        <Zap className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div style={{ marginBottom: 4 }}>
                    <div className="flex items-baseline gap-0.5">
                      <span style={{ fontSize: 20, fontWeight: 600, marginRight: 1, color: 'rgba(255,255,255,0.7)' }}>$</span>
                      <span className="font-bold leading-none" style={{ fontSize: 50, letterSpacing: '-2.5px' }}>
                        {plan.price.toFixed(0)}
                      </span>
                      <span className="ml-1" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 500 }}>/mois</span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, marginTop: 3 }}>
                      {isFr ? 'TAXES INCLUSES · PRIX À VIE' : 'TAX INCLUDED · PRICE FOR LIFE'}
                    </p>
                  </div>

                  <div className="w-full" style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px 0' }} />

                  {/* Key points */}
                  <div className="flex flex-col gap-2 flex-1" style={{ marginBottom: 14 }}>
                    {[
                      isFr ? 'Aucun contrat — annulation libre' : 'No contract — cancel anytime',
                      isFr ? 'Prix à vie garanti — peut seulement diminuer' : 'Price locked for life — can only go down',
                      isFr ? 'Aucune vérification de crédit' : 'No credit check',
                    ].map((pt, i) => (
                      <div key={i} className="flex items-start gap-2" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>
                        <div className="shrink-0 flex items-center justify-center" style={{ width: 15, height: 15, borderRadius: 999, background: 'rgba(124,58,237,0.22)', marginTop: 1 }}>
                          <Check className="w-2 h-2" strokeWidth={3.5} style={{ color: isRec ? '#C4A8FF' : '#7C3AED' }} />
                        </div>
                        {pt}
                      </div>
                    ))}
                  </div>

                  {/* Equipment line */}
                  <div className="flex items-center justify-between mb-4 px-3 py-2.5" style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                  }}>
                    <div className="flex flex-col">
                      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                        {isFr ? 'Équipement requis' : 'Required equipment'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{plan.equipmentLabel}</span>
                    </div>
                    <span className="font-bold" style={{ fontSize: 13, color: isRec ? '#C4A8FF' : '#7C3AED' }}>
                      +{plan.equipmentPrice}$
                    </span>
                  </div>

                  {/* CTA */}
                  <div
                    className="w-full flex items-center justify-center gap-2 font-semibold transition-all group-hover:gap-3"
                    style={{
                      height: 48, borderRadius: 999,
                      background: isRec ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
                      color: isRec ? '#0A0A0F' : '#FFFFFF',
                      border: isRec ? 'none' : '1px solid rgba(255,255,255,0.15)',
                      fontSize: 14,
                    }}
                  >
                    {isFr ? 'Choisir ce forfait' : 'Choose this plan'}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Dots indicateurs — mobile only */}
        <div className="flex items-center justify-center gap-2 mb-8 md:hidden">
          {plans.map((_, i) => (
            <button
              key={i}
              aria-label={`Forfait ${i + 1}`}
              onClick={() => {
                const el = document.getElementById('plans-scroll');
                if (el) el.scrollTo({ left: i * el.offsetWidth * 0.86, behavior: 'smooth' });
              }}
              className="rounded-full transition-all"
              style={{ width: 8, height: 8, background: i === 1 ? '#7C3AED' : 'rgba(255,255,255,0.25)', cursor: 'pointer', border: 'none', padding: 0 }}
            />
          ))}
        </div>

        {/* Trust line */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-6" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          {[
            isFr ? 'Sans contrat' : 'No contract',
            isFr ? 'Sans frais cachés' : 'No hidden fees',
            isFr ? 'Activation 10 min' : 'Activation in 10 min',
          ].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" strokeWidth={3} style={{ color: '#7C3AED' }} />
              {item}
            </span>
          ))}
        </div>

        <LegalDisclaimer />
      </div>
    </section>
  );
};

export default HomePricing;
