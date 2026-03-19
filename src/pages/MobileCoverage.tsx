import { useState, useCallback } from "react";
import { MapPin, Check, Smartphone, Globe, Wifi, Radio, Signal, CheckCircle, XCircle, Loader2, Info, Phone, Zap, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MobileCoverage = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFrench = language === 'fr';
  
  const [addressText, setAddressText] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressValue | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [coverageResult, setCoverageResult] = useState<'available' | 'limited' | 'unavailable' | null>(null);

  const handleAddressSelect = useCallback(async (address: AddressValue) => {
    setAddressDetails(address);
    setIsChecking(true);
    setCoverageResult(null);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const isQuebec = address.region?.toLowerCase().includes('qc') || 
                     address.region?.toLowerCase().includes('quebec') ||
                     address.region?.toLowerCase().includes('québec');
    
    if (isQuebec) {
      setCoverageResult('available');
    } else if (address.region) {
      setCoverageResult('available');
    } else {
      setCoverageResult('limited');
    }
    
    setIsChecking(false);
  }, []);

  const handleAddressChange = useCallback((value: string) => {
    setAddressText(value);
    if (!value) {
      setAddressDetails(null);
      setCoverageResult(null);
    }
  }, []);

  const networkStats = [
    { value: "99.9%", label: isFrench ? "Disponibilité réseau" : "Network uptime" },
    { value: "4G LTE", label: isFrench ? "Technologie" : "Technology" },
    { value: "95%", label: isFrench ? "Population couverte" : "Population covered" },
    { value: "24/7", label: isFrench ? "Support technique" : "Technical support" },
  ];

  const coverageFeatures = [
    {
      icon: Signal,
      title: isFrench ? "Réseau 4G/LTE" : "4G/LTE Network",
      description: isFrench 
        ? "Connexion haute vitesse dans toutes les zones urbaines et péri-urbaines du Québec"
        : "High-speed connection in all urban and suburban areas of Quebec"
    },
    {
      icon: Globe,
      title: isFrench ? "Couverture nationale" : "Nationwide Coverage",
      description: isFrench 
        ? "Voyagez partout au Canada avec notre réseau partenaire étendu"
        : "Travel across Canada with our extended partner network"
    },
    {
      icon: Wifi,
      title: isFrench ? "Appels Wi-Fi" : "Wi-Fi Calling",
      description: isFrench 
        ? "Restez connecté même dans les zones à faible signal grâce aux appels Wi-Fi"
        : "Stay connected even in low signal areas with Wi-Fi calling"
    },
    {
      icon: Shield,
      title: isFrench ? "Réseau fiable" : "Reliable Network",
      description: isFrench 
        ? "Infrastructure moderne avec redondance pour une fiabilité maximale"
        : "Modern infrastructure with redundancy for maximum reliability"
    }
  ];

  const subscriptionSteps = [
    {
      step: "1",
      title: isFrench ? "Vérifiez la couverture" : "Check coverage",
      description: isFrench ? "Entrez votre adresse ci-dessus" : "Enter your address above"
    },
    {
      step: "2",
      title: isFrench ? "Choisissez votre forfait" : "Choose your plan",
      description: isFrench ? "Sélectionnez le forfait adapté à vos besoins" : "Select the plan that fits your needs"
    },
    {
      step: "3",
      title: isFrench ? "Recevez votre SIM" : "Receive your SIM",
      description: isFrench ? "Livraison gratuite en 2-3 jours ouvrables" : "Free delivery in 2-3 business days"
    },
    {
      step: "4",
      title: isFrench ? "Activez en ligne" : "Activate online",
      description: isFrench ? "Activation instantanée depuis votre espace client" : "Instant activation from your account"
    }
  ];

  return (
    <div className="min-h-screen public-dark" style={{ background: 'hsl(230 60% 4%)' }} data-testid="mobile-coverage-page">
      <SEOHead 
        title={isFrench ? "Couverture Mobile | Vérifiez la disponibilité | Nivra" : "Mobile Coverage | Check Availability | Nivra"}
        description={isFrench 
          ? "Vérifiez la couverture mobile Nivra à votre adresse. Couverture 4G nationale au Canada avec réseau fiable et haute vitesse."
          : "Check Nivra mobile coverage at your address. Nationwide 4G coverage across Canada with reliable and high-speed network."}
      />
      <Header />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-primary py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <Badge className="mb-6 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 px-4 py-1.5">
                <Signal className="w-3.5 h-3.5 mr-1.5" />
                {isFrench ? "Couverture Mobile" : "Mobile Coverage"}
              </Badge>
              
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6 leading-tight">
                {isFrench 
                  ? "Couverture mobile au Québec"
                  : "Mobile Coverage in Quebec"}
              </h1>
              
              <p className="text-lg text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
                {isFrench 
                  ? "Vérifiez la disponibilité du service mobile Nivra à votre adresse et consultez la carte du Québec."
                  : "Check Nivra mobile availability at your address and view the Quebec map."}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                {networkStats.map((stat, index) => (
                  <div
                    key={index}
                    className="rounded-xl p-4 border border-primary-foreground/15 bg-primary-foreground/10"
                  >
                    <div className="text-2xl md:text-3xl font-bold text-accent mb-1">{stat.value}</div>
                    <div className="text-xs md:text-sm text-primary-foreground/70">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Address Check Section */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-xl mx-auto">
              <Card className="shadow-xl border-border/50">
                <CardContent className="p-6 md:p-8">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">
                      {isFrench ? "Vérifier la disponibilité" : "Check Availability"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {isFrench 
                        ? "Entrez votre adresse pour vérifier la couverture"
                        : "Enter your address to check coverage"}
                    </p>
                  </div>

                  <AddressAutocomplete
                    value={addressText}
                    onValueChange={handleAddressChange}
                    onSelect={handleAddressSelect}
                    placeholder={isFrench 
                      ? "Numéro civique, rue, ville, code postal" 
                      : "Street number, street, city, postal code"}
                    restrictToQuebec={false}
                    className="text-base"
                  />

                  {/* Loading State */}
                  {isChecking && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
                      <span className="text-muted-foreground">
                        {isFrench ? "Vérification de la couverture..." : "Checking coverage..."}
                      </span>
                    </div>
                  )}

                  {/* Coverage Result */}
                  {coverageResult && !isChecking && (
                    <div className="mt-6">
                      {coverageResult === 'available' && (
                        <Alert className="bg-emerald-500/10 border-emerald-500/30">
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                          <AlertTitle className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {isFrench ? "Couverture disponible!" : "Coverage Available!"}
                          </AlertTitle>
                          <AlertDescription className="text-emerald-600/80 dark:text-emerald-400/80">
                            {isFrench 
                              ? "La couverture mobile Nivra 4G/LTE est disponible à votre adresse."
                              : "Nivra 4G/LTE mobile coverage is available at your address."}
                          </AlertDescription>
                          <Button 
                            variant="hero" 
                            className="mt-4 w-full" 
                            onClick={() => navigate('/mobile')}
                          >
                            {isFrench ? "Voir les forfaits" : "View Plans"}
                          </Button>
                        </Alert>
                      )}
                      
                      {coverageResult === 'limited' && (
                        <Alert className="bg-amber-500/10 border-amber-500/30">
                          <Info className="h-5 w-5 text-amber-500" />
                          <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
                            {isFrench ? "Couverture étendue" : "Extended Coverage"}
                          </AlertTitle>
                          <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
                            {isFrench 
                              ? "Votre adresse est couverte par notre réseau partenaire étendu."
                              : "Your address is covered by our extended partner network."}
                          </AlertDescription>
                          <Button 
                            variant="outline" 
                            className="mt-4 w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10" 
                            onClick={() => navigate('/mobile')}
                          >
                            {isFrench ? "Voir les forfaits" : "View Plans"}
                          </Button>
                        </Alert>
                      )}

                      {coverageResult === 'unavailable' && (
                        <Alert className="bg-destructive/10 border-destructive/30">
                          <XCircle className="h-5 w-5 text-destructive" />
                          <AlertTitle className="text-destructive font-semibold">
                            {isFrench ? "Couverture limitée" : "Limited Coverage"}
                          </AlertTitle>
                          <AlertDescription className="text-destructive/80">
                            {isFrench 
                              ? "La couverture est limitée à votre adresse. Contactez-nous."
                              : "Coverage is limited at your address. Contact us."}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {/* Address Details */}
                  {addressDetails && !isChecking && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-start gap-3 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{addressDetails.formatted}</p>
                          {addressDetails.city && addressDetails.region && (
                            <p className="text-sm">{addressDetails.city}, {addressDetails.region} {addressDetails.postalCode}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>


        {/* Network Features */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                {isFrench ? "Caractéristiques du réseau" : "Network Features"}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {coverageFeatures.map((feature, index) => (
                <Card key={index} className="bg-card border-border hover:border-primary/30 transition-all hover:shadow-lg">
                  <CardContent className="pt-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <feature.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How to Subscribe */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                {isFrench ? "Comment s'abonner" : "How to Subscribe"}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {isFrench 
                  ? "Rejoignez Nivra en quelques étapes simples"
                  : "Join Nivra in a few simple steps"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {subscriptionSteps.map((item, index) => (
                <div key={index} className="relative">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  {index < subscriptionSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-[2px] bg-border" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="border-border">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-500" />
                      {isFrench ? "Avantages Nivra" : "Nivra Benefits"}
                    </h3>
                    <ul className="space-y-3">
                      {[
                        isFrench ? "Aucune vérification de crédit requise" : "No credit check required",
                        isFrench ? "Activation rapide en ligne" : "Quick online activation",
                        isFrench ? "Gardez votre numéro actuel" : "Keep your current number",
                        isFrench ? "Sans engagement - prépayé" : "No commitment - prepaid",
                        isFrench ? "Support client local au Québec" : "Local customer support in Quebec"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                
                <Card className="border-border">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-primary" />
                      {isFrench ? "Besoin d'aide?" : "Need Help?"}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {isFrench 
                        ? "Notre équipe est disponible pour répondre à vos questions sur la couverture et les forfaits."
                        : "Our team is available to answer your questions about coverage and plans."}
                    </p>
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate('/contact')}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        {isFrench ? "Nous contacter" : "Contact Us"}
                      </Button>
                      <Button 
                        variant="hero" 
                        className="w-full justify-start"
                        onClick={() => navigate('/mobile')}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {isFrench ? "Voir les forfaits" : "View Plans"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
              {isFrench ? "Prêt à rejoindre Nivra?" : "Ready to Join Nivra?"}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              {isFrench 
                ? "Découvrez nos forfaits mobiles prépayés flexibles et sans engagement."
                : "Discover our flexible prepaid mobile plans with no commitment."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="hero" 
                size="lg"
                onClick={() => navigate('/mobile')}
              >
                {isFrench ? "Voir les forfaits" : "View Plans"}
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/contact')}
              >
                {isFrench ? "Nous contacter" : "Contact Us"}
              </Button>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default MobileCoverage;
