import { useMemo } from "react";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Wifi, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const getServiceFeatures = (service: PublicService): string[] => {
  if (service.features_json.length > 0) return service.features_json.slice(0, 3);
  if (service.short_description) return service.short_description.split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 3);
  return (service.description || "").split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 3);
};

export function FeaturedOffers() {
  const { data: services, isLoading } = usePublicServices({ surface: "website" });
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const { leftCard, rightCard } = useMemo(() => {
    if (!services?.length) return { leftCard: null, rightCard: null };

    // Find best Internet plan for left card, best Mobile for right card
    const internet = services
      .filter(s => s.category === "Internet" && (s.is_featured || s.is_recommended))
      .sort((a, b) => a.display_order - b.display_order)[0];

    const mobile = services
      .filter(s => s.category === "Mobile" && (s.is_featured || s.is_recommended))
      .sort((a, b) => a.display_order - b.display_order)[0];

    // Fallbacks
    const fallbackLeft = internet || services.filter(s => s.category === "Internet").sort((a, b) => a.display_order - b.display_order)[0];
    const fallbackRight = mobile || services.filter(s => s.category === "Mobile").sort((a, b) => a.display_order - b.display_order)[0];

    return { leftCard: fallbackLeft || null, rightCard: fallbackRight || null };
  }, [services]);

  if (isLoading) {
    return (
      <section className="bg-white py-0">
        <div className="container mx-auto px-4 max-w-[1320px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-[420px] rounded-xl" />
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white pt-0 pb-6">
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* LEFT CARD — Dark, product-focused (Videotron style) */}
          <Link
            to="/internet"
            className="group relative overflow-hidden rounded-xl min-h-[400px] md:min-h-[440px] flex flex-col justify-between bg-[#1a1a2e] transition-transform duration-300 hover:scale-[1.01]"
          >
            {/* Badge */}
            <div className="relative z-10 p-6 sm:p-8">
              <span className="inline-block bg-amber-400 text-black text-xs font-extrabold uppercase tracking-wider px-3 py-1.5">
                {isFr ? "OFFRE DE LANCEMENT" : "LAUNCH OFFER"}
              </span>
            </div>

            {/* Decorative glow */}
            <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 p-6 sm:p-8 flex-1 flex flex-col justify-center">
              <h3 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
                {leftCard?.name || (isFr ? "Internet haute vitesse" : "High-speed Internet")}
              </h3>
              <p className="text-white/60 text-base mb-6 max-w-xs">
                {isFr
                  ? "La vitesse et la fiabilité dont vous avez besoin."
                  : "The speed and reliability you need."}
              </p>

              {/* Wifi icon as visual element */}
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
                <Wifi className="w-48 h-48 text-blue-400" strokeWidth={1} />
              </div>
            </div>

            {/* Price + CTA */}
            <div className="relative z-10 p-6 sm:p-8 pt-0">
              {leftCard && (
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl sm:text-6xl font-black text-white leading-none">
                    {Number(leftCard.price).toFixed(0)}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-white/80 text-sm font-semibold">00 $</span>
                    <span className="text-white/50 text-sm">/{isFr ? "mois" : "mo"}*</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
                {isFr ? "Profitez de l'offre" : "Get the offer"}
                <ArrowRight className="w-4 h-4" />
                <ArrowRight className="w-4 h-4 -ml-2" />
                <ArrowRight className="w-4 h-4 -ml-2" />
              </div>
            </div>
          </Link>

          {/* RIGHT CARD — Bright promotional (Videotron style) */}
          <Link
            to="/mobile"
            className="group relative overflow-hidden rounded-xl min-h-[400px] md:min-h-[440px] flex flex-col justify-between bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 transition-transform duration-300 hover:scale-[1.01]"
          >
            {/* Badge */}
            <div className="relative z-10 p-6 sm:p-8">
              <span className="inline-block bg-amber-400 text-black text-xs font-extrabold uppercase tracking-wider px-3 py-1.5">
                {isFr ? "PROMO EN LUMIÈRE" : "PROMO SPOTLIGHT"}
              </span>
            </div>

            {/* Promotional burst element */}
            <div className="absolute top-8 right-6 sm:right-10 z-10">
              <div className="relative w-28 h-28 sm:w-36 sm:h-36">
                <div className="absolute inset-0 bg-amber-400 rounded-full flex items-center justify-center rotate-12 shadow-lg shadow-amber-400/30">
                  <div className="text-center text-black leading-tight">
                    <span className="block text-xs font-bold uppercase">
                      {isFr ? "1 MOIS" : "1 MONTH"}
                    </span>
                    <span className="block text-lg sm:text-xl font-black uppercase">
                      {isFr ? "GRATUIT" : "FREE"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative z-10 p-6 sm:p-8 flex-1 flex flex-col justify-center">
              <h3 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
                {rightCard?.name || (isFr ? "Forfait Mobile" : "Mobile Plan")}
              </h3>
              <p className="text-white/70 text-base max-w-xs">
                {isFr
                  ? "Tellement généreux qu'on en prend deux."
                  : "So generous you'll want two."}
              </p>

              {/* Phone icon as visual */}
              <div className="absolute right-6 bottom-24 opacity-10">
                <Smartphone className="w-40 h-40 text-white" strokeWidth={1} />
              </div>
            </div>

            {/* Price + CTA */}
            <div className="relative z-10 p-6 sm:p-8 pt-0">
              <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
                {isFr ? "À PARTIR DE" : "STARTING AT"}
              </p>
              {rightCard && (
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl sm:text-6xl font-black text-white leading-none">
                    {Number(rightCard.price).toFixed(0)}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-white/80 text-sm font-semibold">00 $</span>
                    <span className="text-white/50 text-sm">/{isFr ? "mois" : "mo"}*</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider group-hover:gap-3 transition-all">
                {isFr ? "Ajoutez le forfait" : "Add the plan"}
                <ArrowRight className="w-4 h-4" />
                <ArrowRight className="w-4 h-4 -ml-2" />
                <ArrowRight className="w-4 h-4 -ml-2" />
              </div>
            </div>
          </Link>

        </div>
      </div>
    </section>
  );
}
