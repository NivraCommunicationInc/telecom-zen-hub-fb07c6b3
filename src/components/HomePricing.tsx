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
    <section id="forfaits" className="px-5 sm:px-10" style={{ background: '#FFFFFF', paddingTop: 48, paddingBottom: 48 }}>
      {/* Anchor for primary "Services" nav target — kept as a sibling so both #forfaits and #services resolve to this section */}
      <span id="services" aria-hidden="true" className="block" style={{ scrollMarginTop: 80 }} />
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-[36px] font-extrabold mb-3" style={{ color: '#0D0D0D', letterSpacing: '-0.5px' }}>
            {t('pricing.title')}
          </h2>
          <p style={{ color: '#444444', fontSize: 16 }}>
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch mb-8 max-w-[960px] mx-auto">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/commander?plan=${plan.id}`}
              className="group relative block transition-all duration-200"
              style={{
                background: '#FFFFFF',
                border: plan.recommended ? '2px solid #7C3AED' : '1.5px solid #EEEEEE',
                borderRadius: 20,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)')}
            >
              {plan.recommended && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="flex items-center gap-1 text-white uppercase px-3 py-1.5" style={{ background: '#7C3AED', borderRadius: 50, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>
                    <Star className="w-3 h-3 fill-current" />
                    {t('pricing.recommended')}
                  </div>
                </div>
              )}

              <div className="p-8 flex flex-col h-full">
                <h3 className="font-bold mb-1 pr-20" style={{ color: '#0D0D0D', fontSize: 18 }}>{plan.name}</h3>
                <p className="text-xs mb-5" style={{ color: '#999999' }}>{plan.speed}</p>

                <div className="mb-5">
                  <span className="font-extrabold leading-none" style={{ color: '#0D0D0D', fontSize: 52 }}>
                    {plan.price.toFixed(0)}$
                  </span>
                  <span className="ml-1" style={{ color: '#999999', fontSize: 18, fontWeight: 400 }}>/mois</span>
                </div>

                <div className="space-y-3 mb-7 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5" style={{ fontSize: 15 }}>
                      <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#7C3AED' }} />
                      <span style={{ color: '#444444' }}>{f}</span>
                    </div>
                  ))}
                </div>

                <EquipmentRequiredBox type={plan.equipmentType} />

                <div
                  className="w-full flex items-center justify-center gap-2 font-bold text-white mt-4"
                  style={{ height: 50, borderRadius: 50, background: '#7C3AED', fontSize: 15 }}
                >
                  Commencer
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
        <LegalDisclaimer />
      </div>
    </section>
  );
};

export default HomePricing;
