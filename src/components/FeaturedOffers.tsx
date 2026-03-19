import { useMemo } from "react";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Smartphone, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const getServiceFeatures = (service: PublicService): string[] => {
  if (service.features_json.length > 0) return service.features_json.slice(0, 2);
  if (service.short_description) {
    return service.short_description
      .split(/•|\||;/g)
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 2);
  }
  return (service.description || "")
    .split(/•|\||;/g)
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 2);
};

const isPlaceholderService = (service: PublicService) => /\btest\b/i.test(service.name);

export function FeaturedOffers() {
  const { data: services, isLoading } = usePublicServices({ surface: "website" });
  const { language } = useLanguage();
  const isFr = language === "fr";

  const { leftCard, rightCard } = useMemo(() => {
    const cleanServices = (services || []).filter((service) => !isPlaceholderService(service));
    if (!cleanServices.length) return { leftCard: null, rightCard: null };

    const byRank = (a: PublicService, b: PublicService) =>
      (b.is_featured ? 2 : 0) +
      (b.is_recommended ? 1 : 0) -
      ((a.is_featured ? 2 : 0) + (a.is_recommended ? 1 : 0)) ||
      a.display_order - b.display_order ||
      Number(a.price) - Number(b.price);

    const internet = cleanServices
      .filter((s) => s.category === "Internet")
      .sort(byRank)[0];

    const mobile = cleanServices
      .filter((s) => s.category === "Mobile")
      .sort(byRank)[0];

    return { leftCard: internet || null, rightCard: mobile || null };
  }, [services]);

  if (isLoading) {
    return (
      <section className="bg-background py-0">
        <div className="container mx-auto max-w-[1320px] px-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-[420px] rounded-2xl" />
            <Skeleton className="h-[420px] rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  if (!leftCard && !rightCard) return null;

  const leftFeatures = leftCard ? getServiceFeatures(leftCard) : [];
  const rightFeatures = rightCard ? getServiceFeatures(rightCard) : [];

  return (
    <section className="bg-background pb-8 pt-1">
      <div className="container mx-auto max-w-[1320px] px-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {leftCard && (
            <Link
              to="/internet"
              className="group relative flex min-h-[430px] flex-col justify-between overflow-hidden rounded-2xl bg-foreground text-primary-foreground transition-transform duration-300 hover:scale-[1.01]"
            >
              <div className="absolute right-0 top-1/2 h-[320px] w-[320px] -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />

              <div className="relative z-10 p-6 sm:p-8">
                {leftCard.badges[0] && (
                  <span className="inline-flex rounded-full bg-background px-3 py-1 text-xs font-black uppercase tracking-wider text-foreground">
                    {leftCard.badges[0]}
                  </span>
                )}
              </div>

              <div className="relative z-10 flex flex-1 flex-col justify-center p-6 sm:p-8">
                <h3 className="mb-3 text-3xl font-black leading-tight sm:text-4xl">{leftCard.name}</h3>
                {(leftCard.short_description || leftCard.description) && (
                  <p className="mb-4 max-w-sm text-base text-primary-foreground/70">
                    {leftCard.short_description || leftCard.description}
                  </p>
                )}

                <div className="space-y-2">
                  {leftFeatures.map((feature) => (
                    <p key={feature} className="text-sm text-primary-foreground/75">
                      • {feature}
                    </p>
                  ))}
                </div>

                <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-15">
                  <Wifi className="h-48 w-48" strokeWidth={1} />
                </div>
              </div>

              <div className="relative z-10 p-6 pt-0 sm:p-8 sm:pt-0">
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-5xl font-black leading-none sm:text-6xl">{Number(leftCard.price).toFixed(0)}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">00 $</span>
                    <span className="text-sm text-primary-foreground/60">/{isFr ? "mois" : "mo"}*</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-background transition-all group-hover:gap-3">
                  {isFr ? "Profitez de l'offre" : "Get the offer"}
                  <ArrowRight className="h-4 w-4" />
                  <ArrowRight className="-ml-2 h-4 w-4" />
                  <ArrowRight className="-ml-2 h-4 w-4" />
                </div>
              </div>
            </Link>
          )}

          {rightCard && (
            <Link
              to="/mobile"
              className="group relative flex min-h-[430px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-foreground text-primary-foreground transition-transform duration-300 hover:scale-[1.01]"
            >
              <div className="absolute -right-12 -top-10 h-52 w-52 rounded-full bg-background/20 blur-2xl" />

              <div className="relative z-10 flex items-start justify-between p-6 sm:p-8">
                {rightCard.badges[0] ? (
                  <span className="inline-flex rounded-full bg-background px-3 py-1 text-xs font-black uppercase tracking-wider text-foreground">
                    {rightCard.badges[0]}
                  </span>
                ) : (
                  <span />
                )}

                {rightFeatures[0] && (
                  <span className="rounded-full bg-background px-4 py-2 text-sm font-black uppercase text-foreground shadow-card">
                    {rightFeatures[0]}
                  </span>
                )}
              </div>

              <div className="relative z-10 flex flex-1 flex-col justify-center p-6 sm:p-8">
                <h3 className="mb-3 text-3xl font-black leading-tight sm:text-4xl">{rightCard.name}</h3>
                {(rightCard.short_description || rightCard.description) && (
                  <p className="max-w-sm text-base text-primary-foreground/80">
                    {rightCard.short_description || rightCard.description}
                  </p>
                )}

                <div className="pointer-events-none absolute bottom-20 right-6 opacity-15">
                  <Smartphone className="h-44 w-44" strokeWidth={1} />
                </div>
              </div>

              <div className="relative z-10 p-6 pt-0 sm:p-8 sm:pt-0">
                <p className="mb-1 text-xs uppercase tracking-wider text-primary-foreground/70">
                  {isFr ? "À PARTIR DE" : "STARTING AT"}
                </p>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-5xl font-black leading-none sm:text-6xl">{Number(rightCard.price).toFixed(0)}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">00 $</span>
                    <span className="text-sm text-primary-foreground/60">/{isFr ? "mois" : "mo"}*</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-background transition-all group-hover:gap-3">
                  {isFr ? "Ajoutez le forfait" : "Add the plan"}
                  <ArrowRight className="h-4 w-4" />
                  <ArrowRight className="-ml-2 h-4 w-4" />
                  <ArrowRight className="-ml-2 h-4 w-4" />
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
