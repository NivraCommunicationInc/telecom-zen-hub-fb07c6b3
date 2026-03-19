/**
 * Plan Comparator Page
 * Allows users to compare Internet, TV, and Mobile plans side-by-side
 */
import { useState, useMemo } from "react";
import { 
  Check, X, ArrowRight, Wifi, Tv, Smartphone, Filter, 
  ChevronDown, Zap, Shield, Info, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOptionalAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { 
  useInternetPlans, 
  useMobilePlans, 
  useTVPlans,
  useEquipmentPrices,
  type InternetPlan,
  type MobilePlan,
  type TVPlan
} from "@/hooks/usePublicServices";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | "internet" | "tv" | "mobile";

interface ComparablePlan {
  id: string;
  name: string;
  category: "internet" | "tv" | "mobile";
  price: number;
  badge?: string;
  badgeColor?: string;
  speed?: string;
  channels?: number;
  channelType?: string;
  dataAutoTopUp?: string;
  dataNoAutoTopUp?: string;
  features: string[];
  featured?: boolean;
}

const ComparePlans = () => {
  const { language } = useLanguage();
  const { user } = useOptionalAuth();
  const navigate = useNavigate();
  const isFrench = language === 'fr';

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Fetch all plans
  const { plans: internetPlans, isLoading: loadingInternet } = useInternetPlans(isFrench);
  const { plans: mobilePlans, isLoading: loadingMobile } = useMobilePlans(isFrench);
  const { standardPlans, gigaPlans, isLoading: loadingTV } = useTVPlans(isFrench);
  const { routerPrice, simPrice, terminalPrice } = useEquipmentPrices();

  const isLoading = loadingInternet || loadingMobile || loadingTV;

  // Combine all plans into a unified format
  const allPlans = useMemo<ComparablePlan[]>(() => {
    const plans: ComparablePlan[] = [];

    // Add Internet plans
    internetPlans.forEach((p) => {
      plans.push({
        id: p.id,
        name: p.name,
        category: "internet",
        price: p.price,
        badge: p.badge,
        badgeColor: p.badgeColor,
        speed: p.speed,
        features: p.features,
        featured: p.featured,
      });
    });

    // Add Mobile plans
    mobilePlans.forEach((p) => {
      plans.push({
        id: p.id,
        name: p.name,
        category: "mobile",
        price: p.price,
        badge: p.badge,
        badgeColor: p.badgeColor,
        dataAutoTopUp: p.dataAutoTopUp,
        dataNoAutoTopUp: p.dataNoAutoTopUp,
        features: p.features,
        featured: p.featured,
      });
    });

    // Add TV plans (standard + giga)
    [...standardPlans, ...gigaPlans].forEach((p) => {
      plans.push({
        id: p.id,
        name: p.name,
        category: "tv",
        price: p.price,
        badge: p.badge,
        badgeColor: p.badgeColor,
        speed: p.internetSpeed,
        channels: p.channels,
        channelType: p.channelType,
        features: p.features,
        featured: p.featured,
      });
    });

    return plans.sort((a, b) => a.price - b.price);
  }, [internetPlans, mobilePlans, standardPlans, gigaPlans]);

  // Filter plans by category
  const filteredPlans = useMemo(() => {
    if (categoryFilter === "all") return allPlans;
    return allPlans.filter((p) => p.category === categoryFilter);
  }, [allPlans, categoryFilter]);

  // Get selected plans for comparison
  const comparisonPlans = useMemo(() => {
    return allPlans.filter((p) => selectedPlans.includes(p.id));
  }, [allPlans, selectedPlans]);

  const togglePlanSelection = (planId: string) => {
    setSelectedPlans((prev) => {
      if (prev.includes(planId)) {
        return prev.filter((id) => id !== planId);
      }
      if (prev.length >= 4) {
        return prev; // Max 4 plans
      }
      return [...prev, planId];
    });
  };

  const clearSelection = () => setSelectedPlans([]);

  const handleGetStarted = (plan: ComparablePlan) => {
    let redirectPath = '/portal/new-order';
    if (plan.category === 'internet') redirectPath = '/internet-plans';
    else if (plan.category === 'tv') redirectPath = '/tv-plans';
    else if (plan.category === 'mobile') redirectPath = '/mobile-plans';
    
    navigate(redirectPath);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "internet": return Wifi;
      case "tv": return Tv;
      case "mobile": return Smartphone;
      default: return Wifi;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "internet": return "text-cyan-500 bg-cyan-500/10";
      case "tv": return "text-purple-500 bg-purple-500/10";
      case "mobile": return "text-blue-500 bg-blue-500/10";
      default: return "text-primary bg-primary/10";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "internet": return isFrench ? "Internet" : "Internet";
      case "tv": return isFrench ? "TV + Internet" : "TV + Internet";
      case "mobile": return isFrench ? "Mobile" : "Mobile";
      default: return category;
    }
  };

  const getEquipmentFee = (category: string) => {
    switch (category) {
      case "internet": return { label: isFrench ? "Routeur" : "Router", price: routerPrice };
      case "tv": return { label: isFrench ? "Terminal 4K" : "4K Terminal", price: terminalPrice };
      case "mobile": return { label: "SIM", price: simPrice };
      default: return null;
    }
  };

  return (
    <div className="min-h-screen public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
      <SEOHead 
        title={isFrench ? "Comparer les forfaits | Nivra Telecom" : "Compare Plans | Nivra Telecom"}
        description={isFrench 
          ? "Comparez nos forfaits Internet, TV et Mobile côte-à-côte pour trouver l'offre parfaite."
          : "Compare our Internet, TV, and Mobile plans side-by-side to find the perfect offer."}
      />
      <Header />
      
      <main className="pt-24 pb-20 relative">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-primary/5 via-transparent to-transparent rounded-full blur-3xl transform -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-accent/5 via-transparent to-transparent rounded-full blur-3xl transform translate-y-1/2 -translate-x-1/3" />
        </div>

        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-12 relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              {isFrench ? "Comparateur de forfaits" : "Plan Comparator"}
            </Badge>
            
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
              {isFrench ? "Comparez nos forfaits" : "Compare Our Plans"}
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {isFrench 
                ? "Sélectionnez jusqu'à 4 forfaits pour les comparer côte-à-côte et trouver celui qui vous convient."
                : "Select up to 4 plans to compare side-by-side and find the one that's right for you."}
            </p>
          </div>
        </section>

        {/* Loading State */}
        {isLoading && (
          <section className="container mx-auto px-4 mb-12">
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">
                {isFrench ? "Chargement des forfaits..." : "Loading plans..."}
              </span>
            </div>
          </section>
        )}

        {!isLoading && (
          <>
            {/* Filters Section */}
            <section className="container mx-auto px-4 mb-8">
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <Card className="bg-card/80 backdrop-blur-sm border-border">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Filter className="w-5 h-5 text-primary" />
                          {isFrench ? "Filtres" : "Filters"}
                        </CardTitle>
                        <ChevronDown className={cn(
                          "w-5 h-5 text-muted-foreground transition-transform",
                          filtersOpen && "rotate-180"
                        )} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-3">
                        {(["all", "internet", "tv", "mobile"] as CategoryFilter[]).map((cat) => {
                          const Icon = cat === "all" ? Filter : getCategoryIcon(cat);
                          const isActive = categoryFilter === cat;
                          
                          return (
                            <Button
                              key={cat}
                              variant={isActive ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCategoryFilter(cat)}
                              className={cn(
                                "gap-2",
                                isActive && "bg-primary text-primary-foreground"
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              {cat === "all" 
                                ? (isFrench ? "Tous" : "All") 
                                : getCategoryLabel(cat)}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </section>

            {/* Selected Plans Counter */}
            {selectedPlans.length > 0 && (
              <section className="container mx-auto px-4 mb-6">
                <div className="flex items-center justify-between bg-primary/10 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium">
                    {selectedPlans.length} {isFrench ? "forfait(s) sélectionné(s)" : "plan(s) selected"}
                    <span className="text-muted-foreground ml-1">(max 4)</span>
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      {isFrench ? "Effacer" : "Clear"}
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => document.getElementById('comparison-section')?.scrollIntoView({ behavior: 'smooth' })}
                      disabled={selectedPlans.length < 2}
                    >
                      {isFrench ? "Comparer" : "Compare"}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {/* Plans Grid */}
            <section className="container mx-auto px-4 mb-16">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPlans.map((plan) => {
                  const Icon = getCategoryIcon(plan.category);
                  const isSelected = selectedPlans.includes(plan.id);
                  const equipment = getEquipmentFee(plan.category);
                  
                  return (
                    <Card 
                      key={plan.id}
                      className={cn(
                        "relative transition-all duration-200 cursor-pointer",
                        isSelected 
                          ? "ring-2 ring-primary shadow-lg bg-primary/5" 
                          : "hover:shadow-md hover:border-primary/30"
                      )}
                      onClick={() => togglePlanSelection(plan.id)}
                    >
                      {/* Selection Checkbox */}
                      <div className="absolute top-3 left-3 z-10">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => togglePlanSelection(plan.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>

                      {/* Badge */}
                      {plan.badge && (
                        <div className="absolute top-3 right-3">
                          <Badge className={cn("text-white text-xs", plan.badgeColor)}>
                            {plan.badge}
                          </Badge>
                        </div>
                      )}

                      <CardContent className="pt-12 pb-4">
                        {/* Category Icon & Label */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", getCategoryColor(plan.category))}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(plan.category)}
                          </Badge>
                        </div>

                        {/* Plan Name */}
                        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                          {plan.name}
                        </h3>

                        {/* Key Info */}
                        <div className="space-y-1 mb-4 text-sm text-muted-foreground">
                          {plan.speed && (
                            <div className="flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 text-accent" />
                              <span>{plan.speed}</span>
                            </div>
                          )}
                          {plan.channels && (
                            <div className="flex items-center gap-1">
                              <Tv className="w-3.5 h-3.5 text-purple-500" />
                              <span>{plan.channels} {plan.channelType}</span>
                            </div>
                          )}
                          {plan.dataAutoTopUp && (
                            <div className="flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                              <span>{plan.dataAutoTopUp}</span>
                            </div>
                          )}
                        </div>

                        {/* Price */}
                        <div className="border-t border-border pt-3">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-foreground">${plan.price}</span>
                            <span className="text-sm text-muted-foreground">/{isFrench ? "mois" : "mo"}</span>
                          </div>
                          {equipment && (
                            <p className="text-xs text-muted-foreground mt-1">
                              + {equipment.label}: ${equipment.price} {isFrench ? "(unique)" : "(one-time)"}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Comparison Table */}
            {comparisonPlans.length >= 2 && (
              <section id="comparison-section" className="container mx-auto px-4 mb-16">
                <div className="text-center mb-8">
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
                    {isFrench ? "Comparaison détaillée" : "Detailed Comparison"}
                  </h2>
                  <p className="text-muted-foreground">
                    {isFrench 
                      ? "Visualisez les différences entre vos forfaits sélectionnés"
                      : "See the differences between your selected plans"}
                  </p>
                </div>

                <Card className="overflow-hidden">
                  <ScrollArea className="w-full">
                    <div className="min-w-[640px]">
                      {/* Header Row */}
                      <div className="grid gap-4 p-4 bg-muted/50 border-b" 
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-semibold text-muted-foreground">
                          {isFrench ? "Caractéristiques" : "Features"}
                        </div>
                        {comparisonPlans.map((plan) => {
                          const Icon = getCategoryIcon(plan.category);
                          return (
                            <div key={plan.id} className="text-center">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2",
                                getCategoryColor(plan.category)
                              )}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <h3 className="font-semibold text-sm line-clamp-2">{plan.name}</h3>
                              {plan.badge && (
                                <Badge className={cn("text-white text-xs mt-1", plan.badgeColor)}>
                                  {plan.badge}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Price Row */}
                      <div className="grid gap-4 p-4 border-b"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-medium">{isFrench ? "Prix mensuel" : "Monthly Price"}</div>
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="text-center">
                            <span className="text-2xl font-bold text-primary">${plan.price}</span>
                            <span className="text-sm text-muted-foreground">/{isFrench ? "mois" : "mo"}</span>
                          </div>
                        ))}
                      </div>

                      {/* Category Row */}
                      <div className="grid gap-4 p-4 border-b bg-muted/30"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-medium">{isFrench ? "Type" : "Type"}</div>
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="text-center">
                            <Badge variant="outline">{getCategoryLabel(plan.category)}</Badge>
                          </div>
                        ))}
                      </div>

                      {/* Speed Row (if applicable) */}
                      <div className="grid gap-4 p-4 border-b"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-medium">{isFrench ? "Vitesse Internet" : "Internet Speed"}</div>
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="text-center">
                            {plan.speed ? (
                              <span className="font-semibold text-accent">{plan.speed}</span>
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Channels Row (TV only) */}
                      <div className="grid gap-4 p-4 border-b bg-muted/30"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-medium">{isFrench ? "Chaînes TV" : "TV Channels"}</div>
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="text-center">
                            {plan.channels ? (
                              <span className="font-semibold text-purple-500">
                                {plan.channels} {plan.channelType}
                              </span>
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Data Row (Mobile only) */}
                      <div className="grid gap-4 p-4 border-b"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-medium">{isFrench ? "Données mobiles" : "Mobile Data"}</div>
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="text-center">
                            {plan.dataAutoTopUp ? (
                              <div>
                                <span className="font-semibold text-blue-500">{plan.dataAutoTopUp}</span>
                                <p className="text-xs text-muted-foreground">(Auto Top-Up)</p>
                              </div>
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Equipment Fee Row */}
                      <div className="grid gap-4 p-4 border-b bg-muted/30"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-medium">{isFrench ? "Frais équipement" : "Equipment Fee"}</div>
                        {comparisonPlans.map((plan) => {
                          const equipment = getEquipmentFee(plan.category);
                          return (
                            <div key={plan.id} className="text-center">
                              {equipment ? (
                                <span className="text-amber-500 font-medium">
                                  ${equipment.price} ({equipment.label})
                                </span>
                              ) : (
                                <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Features List */}
                      <div className="grid gap-4 p-4"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div className="font-medium">{isFrench ? "Caractéristiques" : "Features"}</div>
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="space-y-2">
                            {plan.features.slice(0, 5).map((feature, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm">
                                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{feature}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* CTA Row */}
                      <div className="grid gap-4 p-4 bg-muted/50 border-t"
                        style={{ gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)` }}>
                        <div />
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="text-center">
                            <Button 
                              variant={plan.featured ? "default" : "outline"}
                              onClick={() => handleGetStarted(plan)}
                              className="w-full"
                            >
                              {isFrench ? "Choisir" : "Select"}
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </Card>
              </section>
            )}

            {/* Empty Comparison State */}
            {selectedPlans.length < 2 && selectedPlans.length > 0 && (
              <section className="container mx-auto px-4 mb-16">
                <Card className="max-w-md mx-auto text-center p-8 bg-muted/30">
                  <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">
                    {isFrench ? "Sélectionnez au moins 2 forfaits" : "Select at least 2 plans"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Cliquez sur les forfaits ci-dessus pour les ajouter à la comparaison."
                      : "Click on the plans above to add them to the comparison."}
                  </p>
                </Card>
              </section>
            )}

            {/* CTA Section */}
            <section className="container mx-auto px-4 relative">
              <Card className="max-w-3xl mx-auto bg-gradient-to-br from-primary/10 via-accent/10 to-purple-500/10 border-primary/30">
                <CardContent className="py-12 text-center">
                  <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                    {isFrench ? "Besoin d'aide pour choisir?" : "Need Help Choosing?"}
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                    {isFrench 
                      ? "Notre équipe est disponible pour vous guider vers le forfait idéal pour vos besoins."
                      : "Our team is available to guide you to the ideal plan for your needs."}
                  </p>
                  <Button variant="hero" size="lg" onClick={() => navigate('/contact')}>
                    {isFrench ? "Contactez-nous" : "Contact Us"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ComparePlans;
