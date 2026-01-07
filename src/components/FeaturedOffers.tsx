import { useSiteOffers } from "@/hooks/useSiteOffers";
import { PromoCard } from "./PromoCard";
import { Skeleton } from "@/components/ui/skeleton";

export function FeaturedOffers() {
  const { data: offers, isLoading } = useSiteOffers({ featured: true });
  
  if (isLoading) {
    return (
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Offres en vedette</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </section>
    );
  }
  
  if (!offers || offers.length === 0) {
    return null;
  }
  
  return (
    <section className="py-12 bg-muted/30">
      <div className="container mx-auto px-4 max-w-6xl">
        <h2 className="text-2xl font-bold mb-6 text-center">Offres en vedette</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.slice(0, 3).map((offer) => (
            <PromoCard key={offer.id} offer={offer} />
          ))}
        </div>
      </div>
    </section>
  );
}
