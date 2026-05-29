import { useState, useEffect, useRef } from "react";
import { trackLiveActivity } from "@/hooks/useLiveActivityTracker";
import { Tv, Check, MapPin, Shield, Zap, Star, ArrowRight, AlertTriangle, Router, Monitor, Wifi, Package, Loader2 } from "lucide-react";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOptionalAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { TVInfoBox } from "@/components/ServiceInfoBox";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { useTVPlans, useEquipmentPrices } from "@/hooks/usePublicServices";
import { useAutoTranslatePlans } from "@/hooks/useAutoTranslatePlans";
import PremiumPlanCard from "@/components/shared/PremiumPlanCard";


const TVPlans = () => {
  const { language } = useLanguage();
  const { user } = useOptionalAuth();
  const navigate = useNavigate();
  const isFrench = language === 'fr';
  
  const [addressText, setAddressText] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressValue | null>(null);
  const [addressValidated, setAddressValidated] = useState(false);
  const [addressError, setAddressError] = useState("");

  const planViewTracked = useRef(false);
  useEffect(() => { if (planViewTracked.current) return; planViewTracked.current = true; trackLiveActivity("plan_view", "Consultation: Forfaits TV", { metadata: { category: "tv" } }); }, []);

  // Fetch plans from database
  const { standardPlans: rawStandard, gigaPlans: rawGiga, isLoading: isLoadingPlans } = useTVPlans(isFrench);
  const { plans: standardPlans } = useAutoTranslatePlans(rawStandard);
  const { plans: gigaPlans } = useAutoTranslatePlans(rawGiga);
  const { terminalPrice, isLoading: isLoadingEquipment } = useEquipmentPrices();
  
  const isLoading = isLoadingPlans || isLoadingEquipment;
  
  // Use fetched plans from hook
  const plans = standardPlans;
  const gigaTVPlans = gigaPlans;

  const handleAddressSelect = (details: AddressValue) => {
    setAddressDetails(details);
    
    const postalCode = details.postalCode || "";
    const region = details.region || "";
    const isQuebec = /^[GHJ]/i.test(postalCode) || region.toUpperCase() === "QC";
    
    if (isQuebec) {
      setAddressValidated(true);
      setAddressError("");
    } else {
      setAddressValidated(false);
      setAddressError(
        isFrench 
          ? "Service disponible uniquement au Québec. Veuillez entrer une adresse québécoise valide."
          : "Service available only in Quebec. Please enter a valid Quebec address."
      );
    }
  };

  const handleGetStarted = (planId: string) => {
    trackLiveActivity("add_to_cart", `Ajout: ${planId}`, { metadata: { planId, category: "tv" } });
    navigate(`/commander?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="tv-plans-page">
      <SEOHead {...SEO_DATA.tv} />
      <Header />
      
      <main className="pt-24 pb-20 relative">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent rounded-full blur-3xl transform -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-accent/5 via-transparent to-transparent rounded-full blur-3xl transform translate-y-1/2 -translate-x-1/3" />
        </div>

        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-purple-500/10 text-purple-500 border-purple-500/20 px-4 py-1.5">
              <Tv className="w-3.5 h-3.5 mr-1.5" />
              {isFrench ? "Forfaits TV + Internet" : "TV + Internet Plans"}
            </Badge>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              <span className="block">
                {isFrench ? "Forfaits TV Nivra" : "Nivra TV Plans"}
              </span>
              <span className="block bg-gradient-to-r from-purple-500 via-purple-400 to-accent bg-clip-text text-transparent">
                {isFrench ? "Internet inclus" : "Internet Included"}
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
              {isFrench 
                ? "Profitez du meilleur de la télévision avec le Nivra 4K Smart Terminal. Tableau de bord streaming accessible par navigateur uniquement (aucune application requise)."
                : "Enjoy the best of television with the Nivra 4K Smart Terminal. Browser-based streaming dashboard only (no app required)."}
            </p>

            {/* Important Notice */}
            <Alert className="max-w-2xl mx-auto border-amber-500/30 bg-amber-500/10 mb-10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600">
                {isFrench 
                  ? "Important: Les forfaits TV nécessitent un forfait Internet Nivra. Internet est inclus dans tous les forfaits ci-dessous."
                  : "Important: TV plans require a Nivra Internet plan. Internet is included in all plans below."}
              </AlertDescription>
            </Alert>
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

        {/* Address Validation Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <Card className="max-w-2xl mx-auto bg-card/80 backdrop-blur-sm border-border">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-purple-500" />
              </div>
              <CardTitle className="text-xl md:text-2xl">
                {isFrench ? "Vérifiez la disponibilité" : "Check Availability"}
              </CardTitle>
              <p className="text-muted-foreground">
                {isFrench 
                  ? "Entrez votre adresse pour voir si le service est disponible chez vous"
                  : "Enter your address to see if service is available at your location"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
              <AddressAutocomplete
                  value={addressText}
                  onValueChange={(value) => {
                    setAddressText(value);
                    if (!value) {
                      setAddressValidated(false);
                      setAddressDetails(null);
                      setAddressError("");
                    }
                  }}
                  onSelect={handleAddressSelect}
                  placeholder={isFrench ? "123 rue Exemple, Montréal, QC H1A 1A1" : "123 Example St, Montreal, QC H1A 1A1"}
                  restrictToQuebec={true}
                />
              </div>
              
              {addressError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{addressError}</AlertDescription>
                </Alert>
              )}
              
              {addressValidated && addressDetails && (
                <Alert className="border-emerald-500/30 bg-emerald-500/10">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <AlertDescription className="text-emerald-500">
                    {isFrench 
                      ? "Excellente nouvelle! Le service TV + Internet est disponible à cette adresse."
                      : "Great news! TV + Internet service is available at this address."}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Plans Grid */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {isFrench ? "Nos forfaits TV + Internet" : "Our TV + Internet Plans"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isFrench 
                ? "Choisissez le forfait qui correspond à vos besoins. Internet inclus dans chaque forfait."
                : "Choose the plan that fits your needs. Internet included in every plan."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <PremiumPlanCard
                key={index}
                name={plan.name}
                subtitle={`${plan.channels} ${plan.channelType}`}
                price={plan.price}
                priceUnit={isFrench ? "/mois" : "/month"}
                previousPrice={plan.previousPrice ?? null}
                features={plan.features}
                featured={plan.featured}
                badge={plan.badge}
                description={plan.description}
                equipmentType="tv"
                ctaLabel={isFrench ? "Commencer" : "Get Started"}
                disabled={!addressValidated}
                onClick={() => handleGetStarted(plan.id)}
              />
            ))}
          </div>
          
          {!addressValidated && (
            <p className="text-center text-muted-foreground mt-6">
              {isFrench 
                ? "Vérifiez d'abord la disponibilité à votre adresse pour continuer"
                : "First verify availability at your address to continue"}
            </p>
          )}
        </section>

        {/* GIGA Internet + TV Bundles Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center mb-12">
            <Badge className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 px-4 py-1.5">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              {isFrench ? "GIGA Vitesse" : "GIGA Speed"}
            </Badge>
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {isFrench ? "Forfaits GIGA Internet + TV" : "GIGA Internet + TV Bundles"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isFrench 
                ? "Internet ultra-rapide 1 Gbps combiné avec nos forfaits TV premium. L'expérience ultime."
                : "Ultra-fast 1 Gbps internet combined with our premium TV plans. The ultimate experience."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
            {gigaPlans.map((plan, index) => (
              <PremiumPlanCard
                key={index}
                name={plan.name}
                subtitle={`${plan.internetSpeed} · ${plan.channels} ${plan.channelType}`}
                price={plan.price}
                priceUnit={isFrench ? "/mois" : "/month"}
                features={plan.features}
                featured={plan.featured}
                badge={plan.badge}
                description={plan.description}
                equipmentType="combo"
                ctaLabel={isFrench ? "Commencer" : "Get Started"}
                disabled={!addressValidated}
                onClick={() => handleGetStarted(plan.id)}
              />
            ))}
          </div>
          
          {!addressValidated && (
            <p className="text-center text-muted-foreground mt-6">
              {isFrench 
                ? "Vérifiez d'abord la disponibilité à votre adresse pour continuer"
                : "First verify availability at your address to continue"}
            </p>
          )}
        </section>

        {/* Equipment Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Nivra 4K Smart Terminal */}
            <Card className="bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur-lg border-border/50">
              <CardContent className="p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-24 h-24 rounded-2xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Monitor className="w-12 h-12 text-purple-500" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      Nivra 4K Smart Terminal
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {isFrench 
                        ? "Terminal 4K haute performance avec télécommande vocale. Maximum 4 terminaux par adresse. Frais uniques de 50$ par terminal payables avant l'installation."
                        : "High-performance 4K terminal with voice control remote. Maximum 4 terminals per address. One-time $50 fee per terminal payable before installation."}
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                        <Shield className="w-3 h-3 mr-1" />
                        {isFrench ? "Garantie 1 an" : "1-Year Warranty"}
                      </Badge>
                      <Badge variant="outline" className="text-purple-500 border-purple-500/30">
                        <Star className="w-3 h-3 mr-1" />
                        {isFrench ? "Défauts fabricant couverts" : "Manufacturer Defects Covered"}
                      </Badge>
                      <Badge variant="outline" className="border-purple-500/30" style={{ color: '#A78BFA' }}>
                        <Package className="w-3 h-3 mr-1" />
                        {isFrench ? "Max 4 terminaux" : "Max 4 terminals"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground">$50</div>
                    <div className="text-sm text-muted-foreground">
                      {isFrench ? "par terminal" : "per terminal"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Nivra Born Wifi Router */}
            <Card className="bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur-lg border-border/50">
              <CardContent className="p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <Router className="w-12 h-12" style={{ color: '#A78BFA' }} />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      Nivra Born Wifi Router
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {isFrench 
                        ? "Routeur haute performance inclus avec tous les forfaits. Frais uniques de 60$ payables avant l'installation."
                        : "High-performance router included with all plans. One-time $60 fee payable before installation."}
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                        <Shield className="w-3 h-3 mr-1" />
                        {isFrench ? "Garantie 1 an" : "1-Year Warranty"}
                      </Badge>
                      <Badge variant="outline" className="border-purple-500/30" style={{ color: '#A78BFA' }}>
                        <Star className="w-3 h-3 mr-1" />
                        {isFrench ? "Défauts fabricant couverts" : "Manufacturer Defects Covered"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground">$60</div>
                    <div className="text-sm text-muted-foreground">
                      {isFrench ? "Frais uniques" : "One-time fee"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Business Rules */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                {isFrench ? "Ce qui nous différencie" : "What Sets Us Apart"}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/50 border-border">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isFrench ? "Aucune vérification de crédit" : "No Credit Check"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Nous ne vérifions jamais votre crédit"
                      : "We never check your credit"}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-card/50 border-border">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <Shield className="w-6 h-6" style={{ color: '#A78BFA' }} />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isFrench ? "100% Indépendant" : "100% Independent"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Aucune affiliation carrier, modèle client-payeur"
                      : "No carrier affiliation, client-paid model"}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-card/50 border-border">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isFrench ? "Pièce d'identité requise" : "ID Required"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Vérification d'identité gouvernementale obligatoire"
                      : "Government ID verification required"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Info Box */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="max-w-4xl mx-auto">
            <TVInfoBox isFrench={isFrench} />
          </div>
        </section>

        {/* Terms & Conditions */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">
                  {isFrench ? "Termes et conditions : Contrats de service Nivra Communications" : "Terms and conditions: Nivra Communications Service Contracts"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {isFrench ? (
                  <>
                    <p>• Les contrats doivent être affichés en français en premier pour la conformité au Québec.</p>
                    <p>• Aucun check de crédit requis.</p>
                    <p>• Identité gouvernementale obligatoire pour valider toute commande.</p>
                    <p>• 100% indépendant - Aucune affiliation, partenariat ou commission carrier.</p>
                    <p>• Paiement facturé directement au client par Nivra Communications.</p>
                  </>
                ) : (
                  <>
                    <p>• Contracts must be shown in French first for Quebec compliance.</p>
                    <p>• No credit check required.</p>
                    <p>• Government ID mandatory to validate any order.</p>
                    <p>• 100% independent - No carrier affiliation, partnership or commission.</p>
                    <p>• Client pays directly to Nivra Communications.</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Delivery Notice */}
        <section className="container mx-auto px-4 mb-8 relative">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-muted-foreground italic">
              {isFrench 
                ? "Livraison : L'équipement Nivra est livré dans 48h ouvrables en zone urbaine et 72h en zone rurale. Retards possibles durant les jours fériés."
                : "Delivery: Nivra equipment is delivered within 48 working hours in urban areas and 72 hours in rural areas. Delays possible during holidays."}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TVPlans;
