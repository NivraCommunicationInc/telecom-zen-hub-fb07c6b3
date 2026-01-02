import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Film, Music, Tv, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useStreamingCatalogActive, StreamingCatalogItem } from "@/hooks/useStreamingCatalog";

const categoryLabels: Record<string, { en: string; fr: string }> = {
  video: { en: "Video", fr: "Vidéo" },
  music: { en: "Music", fr: "Musique" },
};

const StreamingPlans = () => {
  const { language } = useLanguage();
  const { data: services, isLoading } = useStreamingCatalogActive();

  const videoServices = services?.filter(s => s.category === "video") || [];
  const musicServices = services?.filter(s => s.category === "music") || [];

  const texts = {
    en: {
      title: "Streaming+ Plans",
      subtitle: "All your favorite streaming services, one simple subscription",
      videoTitle: "Video Streaming",
      musicTitle: "Music Streaming",
      perMonth: "/month",
      subscribe: "Subscribe Now",
      noServices: "No streaming services available at the moment",
      loading: "Loading services...",
      bundleTitle: "Bundle & Save",
      bundleDesc: "Combine Streaming+ with Internet, TV, or Mobile for exclusive discounts!",
      viewPlans: "View Plans",
    },
    fr: {
      title: "Forfaits Streaming+",
      subtitle: "Tous vos services de streaming préférés, un seul abonnement simple",
      videoTitle: "Streaming Vidéo",
      musicTitle: "Streaming Musique",
      perMonth: "/mois",
      subscribe: "S'abonner",
      noServices: "Aucun service de streaming disponible pour le moment",
      loading: "Chargement des services...",
      bundleTitle: "Combinez et économisez",
      bundleDesc: "Combinez Streaming+ avec Internet, TV ou Mobile pour des rabais exclusifs!",
      viewPlans: "Voir les forfaits",
    },
  };

  const t = texts[language];

  const CategoryIcon = ({ category }: { category: string }) => {
    if (category === "video") return <Film className="w-6 h-6" />;
    if (category === "music") return <Music className="w-6 h-6" />;
    return <Tv className="w-6 h-6" />;
  };

  const ServiceCard = ({ service }: { service: StreamingCatalogItem }) => (
    <Card className="hover:shadow-lg transition-shadow border-border/50 hover:border-primary/30 h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CategoryIcon category={service.category} />
            </div>
            <div>
              <CardTitle className="text-lg">{service.name}</CardTitle>
              <Badge variant="outline" className="mt-1 text-xs">
                {categoryLabels[service.category]?.[language] || service.category}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-muted-foreground text-sm mb-4">{service.description}</p>
        
        {Array.isArray(service.features) && service.features.length > 0 && (
          <div className="space-y-2 mb-4 flex-1">
            {service.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-auto pt-4 border-t">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold text-primary">
                ${service.price_monthly.toFixed(2)}
              </span>
              <span className="text-muted-foreground text-sm">{t.perMonth}</span>
            </div>
            <Button asChild size="sm">
              <Link to="/portal/auth">{t.subscribe}</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold">{t.title}</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">{t.loading}</p>
          </div>
        ) : !services || services.length === 0 ? (
          <div className="text-center py-16">
            <Tv className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">{t.noServices}</p>
          </div>
        ) : (
          <div className="space-y-12">
            {videoServices.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Film className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">{t.videoTitle}</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videoServices.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </section>
            )}

            {musicServices.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Music className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">{t.musicTitle}</h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {musicServices.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-16">
              <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
                <CardContent className="py-8 text-center">
                  <h3 className="text-2xl font-bold mb-2">{t.bundleTitle}</h3>
                  <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                    {t.bundleDesc}
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild variant="outline">
                      <Link to="/internet">{t.viewPlans} - Internet</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/tv">{t.viewPlans} - TV</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/mobile">{t.viewPlans} - Mobile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default StreamingPlans;
