import { useMemo, useEffect, useRef } from "react";
import { trackLiveActivity } from "@/hooks/useLiveActivityTracker";
import { Smartphone, Check, Shield, Zap, ArrowRight, Phone, MessageSquare, Globe, Wifi, CreditCard, Loader2 } from "lucide-react";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOptionalAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MobileInfoBox } from "@/components/ServiceInfoBox";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { useMobilePlans, useEquipmentPrices } from "@/hooks/usePublicServices";
import { useAutoTranslatePlans } from "@/hooks/useAutoTranslatePlans";
import { ProductSchema, BreadcrumbSchema, type ProductSchemaItem } from "@/components/seo";
import PremiumPlanCard from "@/components/shared/PremiumPlanCard";

const MobilePlans = () => {
  const { language } = useLanguage();
  const { user } = useOptionalAuth();
  const navigate = useNavigate();
  const isFrench = language === 'fr';
  
  const planViewTracked = useRef(false);
  useEffect(() => { if (planViewTracked.current) return; planViewTracked.current = true; trackLiveActivity("plan_view", "Consultation: Forfaits Mobile", { metadata: { category: "mobile" } }); }, []);

  // Fetch plans from database
  const { plans: rawPlans, isLoading: isLoadingPlans } = useMobilePlans(isFrench);
  const { plans } = useAutoTranslatePlans(rawPlans);
  const { simPrice, esimPrice, isLoading: isLoadingEquipment } = useEquipmentPrices();
  
  const isLoading = isLoadingPlans || isLoadingEquipment;

  // Generate product schema from plans
  const productSchemaItems: ProductSchemaItem[] = useMemo(() => 
    plans.map((plan) => ({
      name: plan.name,
      description: `${plan.description} - ${plan.dataAutoTopUp} avec Auto Top-Up, ${plan.dataNoAutoTopUp} sans Auto Top-Up. Inclut: ${plan.features.join(", ")}`,
      price: plan.price,
      priceCurrency: "CAD",
      sku: `mobile-${plan.price}`,
      category: "Mobile Prepaid Plans",
      features: plan.features,
      url: "https://nivra-telecom.ca/mobile",
      availability: "InStock",
    })),
    [plans]
  );

  const handleGetStarted = (planId: string) => {
    trackLiveActivity("add_to_cart", `Ajout: ${planId}`, { metadata: { planId, category: "mobile" } });
    navigate(`/commander?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="mobile-plans-page">
      <SEOHead {...SEO_DATA.mobile} />
      <ProductSchema products={productSchemaItems} isService={true} />
      <BreadcrumbSchema items={[
        { name: "Accueil", url: "https://nivra-telecom.ca/" },
        { name: "Services", url: "https://nivra-telecom.ca/services" },
        { name: "Forfaits Mobile" }
      ]} />
      <Header />
      
      <main className="pt-24 pb-20 relative">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-blue-500/5 via-transparent to-transparent rounded-full blur-3xl transform -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent rounded-full blur-3xl transform translate-y-1/2 -translate-x-1/3" />
        </div>

        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-blue-500/10 text-blue-500 border-blue-500/20 px-4 py-1.5">
              <Smartphone className="w-3.5 h-3.5 mr-1.5" />
              {isFrench ? "Nivra Communications" : "Nivra Communications"}
            </Badge>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              <span className="block">
                {isFrench ? "Forfaits Mobiles" : "Mobile Plans"}
              </span>
              <span className="block bg-gradient-to-r from-blue-500 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                {isFrench ? "Sans vérification de crédit" : "No Credit Check"}
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
              {isFrench 
                ? "Forfaits mobiles prépayés avec données 4G généreuses. Aucune vérification de crédit requise, seulement une pièce d'identité gouvernementale."
                : "Prepaid mobile plans with generous 4G data. No credit check required, only government ID needed."}
            </p>

            {/* Key Benefits */}
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <Badge variant="outline" className="px-4 py-2 text-sm border-emerald-500/30 text-emerald-500">
                <Shield className="w-4 h-4 mr-2" />
                {isFrench ? "Aucune vérification de crédit" : "No credit check"}
              </Badge>
              <Badge variant="outline" className="px-4 py-2 text-sm border-blue-500/30 text-blue-500">
                <CreditCard className="w-4 h-4 mr-2" />
                {isFrench ? `${simPrice}$ frais SIM unique` : `$${simPrice} one-time SIM fee`}
              </Badge>
              <Badge variant="outline" className="px-4 py-2 text-sm border-purple-500/30 text-purple-500">
                <Phone className="w-4 h-4 mr-2" />
                {isFrench ? "Transfert ou nouveau numéro" : "Transfer or new number"}
              </Badge>
            </div>
          </div>
        </section>

        {/* Loading State */}
        {isLoading && (
          <section className="container mx-auto px-4 mb-16 relative">
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">
                {isFrench ? "Chargement des forfaits..." : "Loading plans..."}
              </span>
            </div>
          </section>
        )}
        {!isLoading && (
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan, index) => (
              <PremiumPlanCard
                key={plan.id}
                name={plan.name}
                subtitle={isFrench ? "Mobile prépayé" : "Prepaid mobile"}
                price={plan.price}
                priceUnit={isFrench ? "/30 jours" : "/30 days"}
                features={plan.features}
                featured={plan.featured}
                badge={plan.badge}
                description={plan.description}
                equipmentType="mobile"
                ctaLabel={isFrench ? "Commander" : "Order Now"}
                onClick={() => handleGetStarted(plan.id)}
                extra={
                  <div
                    className="rounded-2xl p-4 space-y-2.5"
                    style={{ background: "#FAFAFB", border: "1px solid #ECECEC" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" style={{ color: "#10B981" }} />
                        <span className="text-sm font-semibold" style={{ color: "#0D0D0D" }}>
                          {isFrench ? "Avec Auto Top-Up" : "With Auto Top-Up"}
                        </span>
                      </div>
                      <span
                        className="px-2.5 py-0.5 text-xs font-bold"
                        style={{ background: "#ECFDF5", color: "#065F46", borderRadius: 50 }}
                      >
                        {plan.dataAutoTopUp}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4" style={{ color: "#2563EB" }} />
                        <span className="text-sm font-semibold" style={{ color: "#0D0D0D" }}>
                          {isFrench ? "Sans Auto Top-Up" : "No Auto Top-Up"}
                        </span>
                      </div>
                      <span
                        className="px-2.5 py-0.5 text-xs font-bold"
                        style={{ background: "#EFF6FF", color: "#1E40AF", borderRadius: 50 }}
                      >
                        {plan.dataNoAutoTopUp}
                      </span>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        </section>
        )}

        {/* SIM Fee Notice */}
        <section className="container mx-auto px-4 mb-16 relative">
          <Card className="max-w-2xl mx-auto bg-amber-500/10 border-amber-500/30">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isFrench ? `Frais de carte SIM - ${simPrice}$` : `SIM Card Fee - $${simPrice}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? `Un frais unique de ${simPrice}$ est appliqué pour chaque nouveau numéro ou transfert de numéro. Ce frais inclut votre carte SIM ou eSIM et l'activation de votre ligne.`
                      : `A one-time fee of $${simPrice} is applied for each new number or number transfer. This fee includes your SIM or eSIM card and line activation.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
              {isFrench ? "Pourquoi choisir Nivra Mobile?" : "Why Choose Nivra Mobile?"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-card/50 border-border">
              <CardContent className="pt-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {isFrench ? "Aucune vérification de crédit" : "No Credit Check"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isFrench 
                    ? "Obtenez votre forfait mobile sans impact sur votre dossier de crédit."
                    : "Get your mobile plan without impacting your credit score."}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border">
              <CardContent className="pt-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {isFrench ? "Couverture nationale 4G" : "Nationwide 4G Coverage"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isFrench 
                    ? "Profitez d'une couverture 4G partout au Canada."
                    : "Enjoy 4G coverage across Canada."}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border">
              <CardContent className="pt-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-7 h-7 text-purple-500" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {isFrench ? "Textos internationaux" : "International Texts"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isFrench 
                    ? "Envoyez des textos et MMS partout dans le monde sans frais supplémentaires."
                    : "Send texts and MMS worldwide at no extra cost."}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Info Box */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="max-w-2xl mx-auto">
            <MobileInfoBox isFrench={isFrench} />
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 relative">
          <Card className="max-w-3xl mx-auto bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-purple-500/10 border-cyan-500/30">
            <CardContent className="py-12 text-center">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                {isFrench ? "Prêt à commencer?" : "Ready to Get Started?"}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                {isFrench 
                  ? "Commandez votre forfait mobile maintenant et soyez connecté en quelques minutes."
                  : "Order your mobile plan now and be connected in minutes."}
              </p>
              <Button variant="hero" size="lg" onClick={() => handleGetStarted('mobile-60')}>
                {isFrench ? "Commander maintenant" : "Order Now"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default MobilePlans;