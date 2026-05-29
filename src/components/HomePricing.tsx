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
}> = [
  {
    matchName: "internet giga",
    tagline: "Internet pur",
    speed: "1 010 Mbps",
    features: [
      "Téléchargement jusqu'à 1 010 Mbps",
      "Données illimitées",
      "Support VIP 7j/7",
      "Ultra-faible latence",
    ],
    equipmentLabel: "Borne Nivra WiFi",
    equipmentPrice: 60,
    link: "/internet",
    recommended: false,
    icon: Wifi,
  },
  {
    matchName: "giga + tv 15 choix",
    tagline: "Le plus populaire",
    speed: "1 Gbps + TV",
    features: [
      "Internet GIGA 1 Gbps inclus",
      "42 chaînes populaires + sports",
      "15 chaînes au choix",
      "Télécommande vocale",
      "Terminal Nivra 4K Smart",
    ],
    equipmentLabel: "Borne + Terminal TV",
    equipmentPrice: 110,
    link: "/tv",
    recommended: true,
    icon: Zap,
  },
  {
    matchName: "giga + tv 25 choix",
    tagline: "Combo plus",
    speed: "1 Gbps + TV+",
    features: [
      "Internet GIGA 1 Gbps inclus",
      "52 chaînes populaires + sports",
      "25 chaînes au choix",
      "Télécommande vocale",
      "Support VIP prioritaire",
    ],
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
      } satisfies DisplayPlan;
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

        {/* Plan grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch max-w-[1080px] mx-auto mb-10">
          {plans.map((plan) => {
            const isRec = plan.recommended;
            const Icon = plan.icon;
            return (
              <Link
                key={plan.id}
                to={`/commander?plan=${plan.id}`}
                className="group relative flex flex-col transition-all duration-300 hover:-translate-y-1.5"
                style={{
                  background: isRec
                    ? 'linear-gradient(180deg, #16111F 0%, #0A0A0F 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: isRec ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 24,
                  boxShadow: isRec
                    ? '0 24px 60px -20px rgba(124,58,237,0.55), 0 4px 12px rgba(0,0,0,0.08)'
                    : '0 2px 16px rgba(0,0,0,0.3)',
                  color: '#FFFFFF',
                  overflow: 'hidden',
                }}
              >
                {/* Recommended ribbon */}
                {isRec && (
                  <>
                    <div aria-hidden className="absolute pointer-events-none" style={{ top: -120, right: -80, width: 280, height: 280, background: 'radial-gradient(circle, rgba(124,58,237,0.45) 0%, transparent 65%)', filter: 'blur(8px)' }} />
                    <div className="absolute top-5 right-5">
                      <span className="inline-flex items-center px-2.5 py-1 uppercase font-bold" style={{ background: '#7C3AED', color: '#fff', fontSize: 9.5, letterSpacing: 1.2, borderRadius: 999 }}>
                        ★ {isFr ? 'Populaire' : 'Popular'}
                      </span>
                    </div>
                  </>
                )}

                <div className="relative flex flex-col h-full p-7 sm:p-7">
                  {/* Icon */}
                  <div className="mb-5 flex items-center justify-center" style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'rgba(124,58,237,0.18)',
                    border: '1px solid rgba(124,58,237,0.3)',
                  }}>
                    <Icon className="w-5 h-5" style={{ color: isRec ? '#C4A8FF' : '#7C3AED' }} strokeWidth={2.2} />
                  </div>

                  {/* Tagline */}
                  <p className="uppercase font-bold mb-1.5" style={{ color: isRec ? '#C4A8FF' : '#7C3AED', fontSize: 10.5, letterSpacing: 1.4 }}>
                    {plan.tagline}
                  </p>

                  {/* Name */}
                  <h3 className="font-bold mb-1" style={{ fontSize: 22, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                    {plan.name}
                  </h3>
                  <p className="mb-6" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                    {plan.speed}
                  </p>

                  {/* Price */}
                  <div className="mb-6 flex items-baseline gap-0.5">
                    <span style={{ fontSize: 22, fontWeight: 600, marginRight: 2, color: 'rgba(255,255,255,0.7)' }}>$</span>
                    <span className="font-bold leading-none" style={{ fontSize: 56, letterSpacing: '-2.5px' }}>
                      {plan.price.toFixed(0)}
                    </span>
                    <span className="ml-1.5" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 500 }}>/mois</span>
                  </div>

                  {/* Divider */}
                  <div className="w-full mb-5" style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                        <div className="shrink-0 flex items-center justify-center mt-0.5" style={{
                          width: 16, height: 16, borderRadius: 999,
                          background: 'rgba(124,58,237,0.22)',
                        }}>
                          <Check className="w-2.5 h-2.5" strokeWidth={3.5} style={{ color: isRec ? '#C4A8FF' : '#7C3AED' }} />
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.82)' }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Equipment line */}
                  <div className="flex items-center justify-between mb-5 px-3.5 py-2.5" style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                  }}>
                    <div className="flex flex-col">
                      <span style={{ fontSize: 11, color: isRec ? 'rgba(255,255,255,0.5)' : '#888892', fontWeight: 500 }}>
                        {isFr ? 'Équipement requis' : 'Required equipment'}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{plan.equipmentLabel}</span>
                    </div>
                    <span className="font-bold" style={{ fontSize: 14, color: isRec ? '#C4A8FF' : '#7C3AED' }}>
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
