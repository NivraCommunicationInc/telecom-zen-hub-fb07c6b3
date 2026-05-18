import { useMemo } from "react";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";

type DisplayPlan = {
  id: string;
  name: string;
  speed: string;
  price: number;
  description: string;
  features: string[];
  equipmentType: "internet" | "tv" | "combo";
  link: string;
  recommended: boolean;
};

// Canonical homepage selection — exact 3 plans, fixed content, prices come from DB.
const HOMEPAGE_PLAN_SPECS: Array<{
  matchName: string;
  speed: string;
  description: string;
  features: string[];
  equipmentType: "internet" | "tv" | "combo";
  link: string;
  recommended: boolean;
}> = [
  {
    matchName: "internet giga",
    speed: "1 010 Mbps",
    description: "Données illimitées — Support VIP — Ultra-faible latence",
    features: [
      "Téléchargement jusqu'à 1 010 Mbps",
      "Données illimitées",
      "Support VIP 7j/7",
      "Ultra-faible latence",
    ],
    equipmentType: "internet",
    link: "/internet",
    recommended: false,
  },
  {
    matchName: "giga + tv 15 choix",
    speed: "1 Gbps",
    description: "Internet Giga + 42 chaînes populaires + 15 chaînes au choix",
    features: [
      "Internet GIGA 1 Gbps inclus",
      "42 chaînes populaires + sports",
      "15 chaînes au choix",
      "Télécommande vocale",
      "Terminal Nivra 4K Smart inclus",
    ],
    equipmentType: "combo",
    link: "/tv",
    recommended: true,
  },
  {
    matchName: "giga + tv 25 choix",
    speed: "1 Gbps",
    description: "Internet Giga + 52 chaînes populaires + 25 chaînes au choix",
    features: [
      "Internet GIGA 1 Gbps inclus",
      "52 chaînes populaires + sports",
      "25 chaînes au choix",
      "Télécommande vocale",
      "Support VIP prioritaire",
      "Terminal Nivra 4K Smart inclus",
    ],
    equipmentType: "combo",
    link: "/tv",
    recommended: false,
  },
];

const HomePricing = () => {
  const { t } = useLanguage();
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
        speed: spec.speed,
        price: Number(match.price),
        description: spec.description,
        features: spec.features,
        equipmentType: spec.equipmentType,
        link: spec.link,
        recommended: spec.recommended,
      } satisfies DisplayPlan;
    }).filter((p): p is DisplayPlan => p !== null);
  }, [services]);

  if (isLoading) {
    return (
      <section className="px-5 sm:px-10" style={{ background: '#FFFFFF', paddingTop: 48, paddingBottom: 48 }}>
        <div className="max-w-[1100px] mx-auto">
          <Skeleton className="h-8 w-56 mx-auto mb-3" />
          <Skeleton className="h-5 w-72 mx-auto mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[380px] rounded-[20px]" />)}
          </div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  return (
    <section id="forfaits" className="px-5 sm:px-10" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFB 100%)', paddingTop: 64, paddingBottom: 72 }}>
      <span id="services" aria-hidden="true" className="block" style={{ scrollMarginTop: 80 }} />
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4" style={{ background: '#F3EEFF', borderRadius: 50 }}>
            <Star className="w-3.5 h-3.5" style={{ color: '#7C3AED', fill: '#7C3AED' }} />
            <span className="font-bold uppercase" style={{ color: '#7C3AED', fontSize: 11, letterSpacing: 2 }}>
              {t('pricing.recommended') || 'Forfaits'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-extrabold mb-3" style={{ color: '#0D0D0D', letterSpacing: '-0.8px', lineHeight: 1.1 }}>
            {t('pricing.title')}
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: '#555', fontSize: 17, lineHeight: 1.6 }}>
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch mb-10 max-w-[880px] mx-auto">
          {plans.map((plan) => {
            const isRec = plan.recommended;
            return (
              <Link
                key={plan.id}
                to={`/commander?plan=${plan.id}`}
                className="group relative block transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: isRec
                    ? 'linear-gradient(180deg, #FFFFFF 0%, #FBF8FF 100%)'
                    : '#FFFFFF',
                  border: isRec ? '2px solid #7C3AED' : '1px solid #ECECEC',
                  borderRadius: 20,
                  boxShadow: isRec
                    ? '0 16px 40px -16px rgba(124,58,237,0.30), 0 2px 8px rgba(0,0,0,0.04)'
                    : '0 2px 14px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                }}
              >
                {isRec && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                    <div className="flex items-center gap-1 text-white uppercase px-3 py-1"
                      style={{ background: '#7C3AED', borderRadius: '0 0 10px 10px', fontSize: 9, fontWeight: 800, letterSpacing: '1px', boxShadow: '0 3px 8px rgba(124,58,237,0.35)' }}>
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {t('pricing.recommended')}
                    </div>
                  </div>
                )}

                <div className="p-5 sm:p-6 flex flex-col h-full relative">
                  <div className={isRec ? 'pt-2' : ''}>
                    <h3 className="font-bold mb-0.5" style={{ color: '#0D0D0D', fontSize: 16, letterSpacing: '-0.2px' }}>{plan.name}</h3>
                    <p className="font-semibold mb-4" style={{ color: '#7C3AED', fontSize: 11, letterSpacing: '0.4px' }}>{plan.speed}</p>
                  </div>

                  <div className="mb-4 flex items-baseline gap-0.5">
                    <span className="font-extrabold leading-none" style={{ color: '#0D0D0D', fontSize: 38, letterSpacing: '-1.2px' }}>
                      {plan.price.toFixed(0)}
                    </span>
                    <span className="font-bold" style={{ color: '#0D0D0D', fontSize: 18 }}>$</span>
                    <span className="ml-1" style={{ color: '#888', fontSize: 12, fontWeight: 500 }}>/mois</span>
                  </div>

                  <div className="h-px w-full mb-4" style={{ background: '#F0F0F0' }} />

                  <div className="space-y-2 mb-5 flex-1">
                    {plan.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2" style={{ fontSize: 12.5 }}>
                        <div className="shrink-0 flex items-center justify-center mt-0.5" style={{ width: 15, height: 15, borderRadius: 50, background: isRec ? '#7C3AED' : '#F3EEFF' }}>
                          <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: isRec ? '#FFFFFF' : '#7C3AED' }} />
                        </div>
                        <span style={{ color: '#333', lineHeight: 1.45 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <EquipmentRequiredBox type={plan.equipmentType} />

                  <div
                    className="w-full flex items-center justify-center gap-1.5 font-bold mt-4 transition-all group-hover:gap-2.5"
                    style={{
                      height: 42, borderRadius: 50,
                      background: isRec ? '#7C3AED' : '#0D0D0D',
                      color: '#FFFFFF', fontSize: 13,
                      boxShadow: isRec ? '0 8px 18px -8px rgba(124,58,237,0.45)' : '0 4px 12px -4px rgba(0,0,0,0.25)',
                    }}
                  >
                    Commencer
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <LegalDisclaimer />
      </div>
    </section>
  );
};

export default HomePricing;
