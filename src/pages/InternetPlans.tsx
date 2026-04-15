import { useState, useEffect, useRef } from "react";
import { trackLiveActivity } from "@/hooks/useLiveActivityTracker";
import { Wifi, Check, MapPin, Shield, Zap, Star, ArrowRight, AlertTriangle, Router, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { InternetInfoBox } from "@/components/ServiceInfoBox";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { useInternetPlans, useEquipmentPrices } from "@/hooks/usePublicServices";


const InternetPlans = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFrench = language === 'fr';
  
  const [address, setAddress] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressValue | null>(null);
  const [addressValidated, setAddressValidated] = useState(false);
  const [addressError, setAddressError] = useState("");

  const planViewTracked = useRef(false);
  useEffect(() => { if (planViewTracked.current) return; planViewTracked.current = true; trackLiveActivity("plan_view", "Consultation: Forfaits Internet", { metadata: { category: "internet" } }); }, []);

  // Fetch plans from database
  const { plans, isLoading: isLoadingPlans } = useInternetPlans(isFrench);
  const { routerPrice, isLoading: isLoadingEquipment } = useEquipmentPrices();
  
  const isLoading = isLoadingPlans || isLoadingEquipment;

  const handleAddressSelect = (details: AddressValue) => {
    setAddressDetails(details);
    setAddress(details.line1);
    
    // Check if it's a Quebec address
    const postalCode = details.postalCode || "";
    const region = details.region || "";
    const isQuebec = /^[GHJ]/i.test(postalCode) || region.toUpperCase().includes("QC") || region.toUpperCase().includes("QUEBEC");
    
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
    trackLiveActivity("add_to_cart", `Ajout: ${planId}`, { metadata: { planId, category: "internet" } });
    navigate(`/commander?plan=${planId}`);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="internet-plans-page">
      <SEOHead {...SEO_DATA.internet} />
      <ItemListSchema
        listName="Forfaits Internet Nivra Telecom"
        listDescription="Forfaits Internet et TV sans contrat au Québec"
        listUrl="https://nivra-telecom.ca/internet"
        items={[
          { position: 1, name: "Internet 400 Mbps", description: "Forfait Internet 400 Mbps sans contrat au Québec" },
          { position: 2, name: "Internet 600 Mbps", description: "Forfait Internet 600 Mbps sans contrat au Québec" },
          { position: 3, name: "Internet 1 Gbps", description: "Forfait Internet 1 Gbps sans contrat au Québec" },
        ]}
      />
      <Header />
      <main className="pt-24 pb-20 relative">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent rounded-full blur-3xl transform -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-accent/5 via-transparent to-transparent rounded-full blur-3xl transform translate-y-1/2 -translate-x-1/3" />
        </div>

        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-cyan-500/10 text-cyan-500 border-cyan-500/20 px-4 py-1.5">
              <Wifi className="w-3.5 h-3.5 mr-1.5" />
              {isFrench ? "Internet haute vitesse" : "High-Speed Internet"}
            </Badge>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              <span className="block">
                {isFrench ? "Internet résidentiel" : "Residential Internet"}
              </span>
              <span className="block bg-gradient-to-r from-cyan-500 via-cyan-400 to-accent bg-clip-text text-transparent">
                {isFrench ? "au Québec" : "in Quebec"}
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {isFrench 
                ? "Connexion fiable et rapide avec le routeur Nivra Born Wifi inclus. Aucune vérification de crédit requise."
                : "Fast and reliable connection with the Nivra Born Wifi router included. No credit check required."}
            </p>
          </div>
        </section>

        {/* Address Validation Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <Card className="max-w-2xl mx-auto bg-card/80 backdrop-blur-sm border-border">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-cyan-500" />
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
                  value={address}
                  onValueChange={(value) => {
                    setAddress(value);
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
                      ? "Excellente nouvelle! Le service Internet est disponible à cette adresse."
                      : "Great news! Internet service is available at this address."}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
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

        {/* Plans Grid */}
        {!isLoading && (
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              {isFrench ? "Nos forfaits Internet" : "Our Internet Plans"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isFrench 
                ? "Choisissez le forfait qui correspond à vos besoins"
                : "Choose the plan that fits your needs"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`relative bg-card/80 backdrop-blur-sm border-border transition-all duration-300 hover:shadow-xl ${
                  plan.featured ? 'ring-2 ring-accent shadow-lg scale-105' : ''
                }`}
              >
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2`}>
                  <Badge className={`${plan.badgeColor} text-white px-4 py-1`}>
                    {plan.badge}
                  </Badge>
                </div>
                
                <CardHeader className="text-center pt-8">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-cyan-500" />
                  </div>
                  <CardTitle className="text-3xl font-bold text-foreground">
                    {plan.speed}
                  </CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground">/{isFrench ? "mois" : "month"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    onClick={() => handleGetStarted(plan.id)}
                    variant={plan.featured ? "hero" : "outline"} 
                    className="w-full mt-6"
                    disabled={!addressValidated}
                  >
                    {isFrench ? "Commencer" : "Get Started"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
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
        )}

        {/* Equipment Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <Card className="max-w-4xl mx-auto bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur-lg border-border/50">
            <CardContent className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-24 h-24 rounded-2xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Router className="w-12 h-12 text-cyan-500" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Nivra Born Wifi
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {isFrench 
                      ? `Routeur haute performance inclus avec tous les forfaits. Frais uniques de ${routerPrice}$ payables avant l'installation.`
                      : `High-performance router included with all plans. One-time $${routerPrice} fee payable before installation.`}
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                      <Shield className="w-3 h-3 mr-1" />
                      {isFrench ? "Garantie 1 an" : "1-Year Warranty"}
                    </Badge>
                    <Badge variant="outline" className="text-cyan-500 border-cyan-500/30">
                      <Star className="w-3 h-3 mr-1" />
                      {isFrench ? "Défauts fabricant couverts" : "Manufacturer Defects Covered"}
                    </Badge>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">${routerPrice}</div>
                  <div className="text-sm text-muted-foreground">
                    {isFrench ? "Frais uniques" : "One-time fee"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-cyan-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isFrench ? "100% Indépendant" : "100% Independent"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Aucune affiliation avec les fournisseurs"
                      : "No carrier affiliations"}
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
                      ? "Vérification d'identité gouvernementale"
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
            <InternetInfoBox isFrench={isFrench} />
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
                    <p>• Aucun partenariat ni commission avec les fournisseurs de télécommunications.</p>
                    <p>• Aucune vérification de crédit requise.</p>
                    <p>• Une pièce d'identité gouvernementale est requise pour valider toute commande.</p>
                  </>
                ) : (
                  <>
                    <p>• Contracts must be shown in French first for Quebec compliance.</p>
                    <p>• No carrier partnerships or commissions.</p>
                    <p>• No credit check required.</p>
                    <p>• Government ID required to validate any order.</p>
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
                ? "Livraison : L'équipement Nivra est normalement livré dans les 48 heures ouvrables en zone urbaine et 72 heures ouvrables en zone rurale après la commande. Des délais peuvent survenir pendant les jours fériés."
                : "Delivery: Nivra equipment is normally delivered within 48 working hours in urban areas and 72 working hours in rural areas after the order. Delays may occur during holidays."}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default InternetPlans;
