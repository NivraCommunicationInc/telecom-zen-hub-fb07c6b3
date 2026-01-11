import { useSiteOffers } from "@/hooks/useSiteOffers";
import { PromoCard } from "./PromoCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

export function FeaturedOffers() {
  const { data: offers, isLoading } = useSiteOffers({ featured: true });
  
  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Nos meilleures offres</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Offres en vedette
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Découvrez nos forfaits les plus populaires avec tout ce qu'il vous faut
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[420px] rounded-xl" />
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
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Nos meilleures offres</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Offres en vedette
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Découvrez nos forfaits les plus populaires avec tout ce qu'il vous faut
          </p>
        </div>
        
        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {offers.slice(0, 3).map((offer) => (
            <PromoCard key={offer.id} offer={offer} />
          ))}
        </div>
      </div>
    </section>
  );
}
