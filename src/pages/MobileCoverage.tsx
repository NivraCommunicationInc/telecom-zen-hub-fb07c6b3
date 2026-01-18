import { useState, useCallback } from "react";
import { MapPin, Check, Smartphone, Globe, Wifi, Radio, Signal, CheckCircle, XCircle, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  
  // Address state
  const [addressText, setAddressText] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressValue | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [coverageResult, setCoverageResult] = useState<'available' | 'limited' | 'unavailable' | null>(null);

  const handleAddressSelect = useCallback(async (address: AddressValue) => {
    setAddressDetails(address);
    setIsChecking(true);
    setCoverageResult(null);
    
    // Simulate coverage check (in reality, this would call an API)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For mobile, coverage is nationwide in Canada - check if it's a valid Quebec/Canada address
    const isQuebec = address.region?.toLowerCase().includes('qc') || 
                     address.region?.toLowerCase().includes('quebec') ||
                     address.region?.toLowerCase().includes('québec');
    
    if (isQuebec) {
      setCoverageResult('available');
    } else if (address.region) {
      // Other Canadian provinces - extended coverage
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

  const coverageFeatures = [
    {
      icon: Signal,
      title: isFrench ? "Couverture 4G/LTE" : "4G/LTE Coverage",
      description: isFrench 
        ? "Réseau 4G haute vitesse dans toutes les grandes villes et zones urbaines"
        : "High-speed 4G network in all major cities and urban areas"
    },
    {
      icon: Globe,
      title: isFrench ? "Couverture nationale" : "Nationwide Coverage",
      description: isFrench 
        ? "Couverture étendue partout au Canada via notre réseau partenaire"
        : "Extended coverage across Canada through our partner network"
    },
    {
      icon: Radio,
      title: isFrench ? "Réseau fiable" : "Reliable Network",
      description: isFrench 
        ? "Infrastructure moderne avec une excellente qualité de signal"
        : "Modern infrastructure with excellent signal quality"
    },
    {
      icon: Wifi,
      title: isFrench ? "Appels Wi-Fi" : "Wi-Fi Calling",
      description: isFrench 
        ? "Passez des appels même dans les zones à faible couverture grâce au Wi-Fi"
        : "Make calls even in low coverage areas using Wi-Fi"
    }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="mobile-coverage-page">
      <SEOHead 
        title={isFrench ? "Couverture Mobile | Vérifiez la disponibilité | Nivra" : "Mobile Coverage | Check Availability | Nivra"}
        description={isFrench 
          ? "Vérifiez la couverture mobile Nivra à votre adresse. Couverture 4G nationale au Canada avec réseau fiable et haute vitesse."
          : "Check Nivra mobile coverage at your address. Nationwide 4G coverage across Canada with reliable and high-speed network."}
      />
      <Header />
      
      <main className="pt-24 pb-20 relative">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-blue-500/5 via-transparent to-transparent rounded-full blur-3xl transform -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent rounded-full blur-3xl transform translate-y-1/2 -translate-x-1/3" />
        </div>

        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-12 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-blue-500/10 text-blue-500 border-blue-500/20 px-4 py-1.5">
              <Signal className="w-3.5 h-3.5 mr-1.5" />
              {isFrench ? "Couverture Mobile" : "Mobile Coverage"}
            </Badge>
            
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              {isFrench 
                ? "Vérifiez la couverture mobile Nivra"
                : "Check Nivra Mobile Coverage"}
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {isFrench 
                ? "Entrez votre adresse ci-dessous pour découvrir si vous pouvez obtenir Nivra Mobile et où vous aurez une couverture en déplacement."
                : "Enter your address below to find out if you can get Nivra Mobile and where you will have coverage on the go."}
            </p>
          </div>
        </section>

        {/* Address Check Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <Card className="max-w-2xl mx-auto shadow-lg border-border/50">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">
                {isFrench ? "Vérifier la disponibilité" : "Check Availability"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
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
              </div>

              {/* Loading State */}
              {isChecking && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
                  <span className="text-muted-foreground">
                    {isFrench ? "Vérification de la couverture..." : "Checking coverage..."}
                  </span>
                </div>
              )}

              {/* Coverage Result */}
              {coverageResult && !isChecking && (
                <div className="pt-4">
                  {coverageResult === 'available' && (
                    <Alert className="bg-emerald-500/10 border-emerald-500/30">
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                      <AlertTitle className="text-emerald-600 font-semibold">
                        {isFrench ? "Couverture disponible!" : "Coverage Available!"}
                      </AlertTitle>
                      <AlertDescription className="text-emerald-600/80">
                        {isFrench 
                          ? "Excellente nouvelle! La couverture mobile Nivra est disponible à votre adresse avec une couverture 4G complète."
                          : "Great news! Nivra mobile coverage is available at your address with full 4G coverage."}
                      </AlertDescription>
                      <Button 
                        variant="hero" 
                        className="mt-4" 
                        onClick={() => navigate('/mobile')}
                      >
                        {isFrench ? "Voir les forfaits" : "View Plans"}
                      </Button>
                    </Alert>
                  )}
                  
                  {coverageResult === 'limited' && (
                    <Alert className="bg-amber-500/10 border-amber-500/30">
                      <Info className="h-5 w-5 text-amber-500" />
                      <AlertTitle className="text-amber-600 font-semibold">
                        {isFrench ? "Couverture étendue" : "Extended Coverage"}
                      </AlertTitle>
                      <AlertDescription className="text-amber-600/80">
                        {isFrench 
                          ? "Votre adresse est couverte par notre réseau partenaire étendu. La couverture peut varier selon les zones."
                          : "Your address is covered by our extended partner network. Coverage may vary by area."}
                      </AlertDescription>
                      <Button 
                        variant="outline" 
                        className="mt-4 border-amber-500/30 text-amber-600 hover:bg-amber-500/10" 
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
                          ? "La couverture mobile est limitée à votre adresse. Contactez-nous pour plus d'informations."
                          : "Mobile coverage is limited at your address. Contact us for more information."}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Address Details Display */}
              {addressDetails && !isChecking && (
                <div className="pt-4 border-t border-border/50">
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
        </section>

        {/* Coverage Map Placeholder */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-8 md:p-12">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Map Visual */}
                  <div className="flex-1">
                    <div className="relative w-full aspect-[16/10] bg-white/50 dark:bg-slate-700/50 rounded-xl overflow-hidden shadow-inner">
                      {/* Stylized Canada Map Representation */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center p-6">
                          <Globe className="w-16 h-16 mx-auto mb-4 text-blue-500/60" />
                          <p className="text-sm text-muted-foreground">
                            {isFrench 
                              ? "Couverture nationale 4G"
                              : "Nationwide 4G Coverage"}
                          </p>
                        </div>
                      </div>
                      {/* Coverage indicators */}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-6">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-blue-500/70" />
                          <span className="text-xs text-muted-foreground">
                            {isFrench ? "Réseau principal" : "Home Network"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-cyan-400/70" />
                          <span className="text-xs text-muted-foreground">
                            {isFrench ? "Réseau étendu" : "Extended Network"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold text-foreground mb-3">
                      {isFrench ? "Couverture d'un océan à l'autre" : "Coast-to-Coast Coverage"}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {isFrench 
                        ? "Que vous voyagiez au Canada pour le travail ou les loisirs, vous pouvez compter sur un service mobile fiable."
                        : "Whether you're travelling within Canada for work or play, you can count on reliable mobile service."}
                    </p>
                    <p className="text-sm text-muted-foreground italic">
                      {isFrench 
                        ? "Les zones de couverture sont approximatives et peuvent varier. Divers facteurs peuvent influencer la réception."
                        : "Coverage areas are approximate and may vary. Various factors can influence reception."}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Coverage Features */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
              {isFrench ? "Caractéristiques du réseau" : "Network Features"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {coverageFeatures.map((feature, index) => (
              <Card key={index} className="bg-card/50 border-border hover:border-primary/30 transition-colors">
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
        </section>

        {/* How to Subscribe Section */}
        <section className="container mx-auto px-4 mb-16 relative">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-border">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-foreground mb-4">
                    {isFrench ? "Comment s'abonner" : "How to Subscribe"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {isFrench 
                      ? "Nivra offre une couverture mobile étendue pour la plupart de nos clients au Québec et partout au Canada. Pour voir si le mobile est disponible à votre adresse, entrez votre adresse dans la recherche ci-dessus."
                      : "Nivra offers extended mobile coverage for most of our customers in Quebec and across Canada. To see if mobile is available at your address, enter your address in the search above."}
                  </p>
                  <div className="space-y-3">
                    {[
                      isFrench ? "Aucune vérification de crédit requise" : "No credit check required",
                      isFrench ? "Activation rapide" : "Quick activation",
                      isFrench ? "Gardez votre numéro actuel" : "Keep your current number"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold text-foreground mb-4">
                    {isFrench ? "Couverture fiable partout" : "Reliable Coverage Everywhere"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {isFrench 
                      ? "Que vous voyagiez au Canada pour le travail ou les loisirs, vous pouvez compter sur un service mobile fiable avec Nivra."
                      : "Whether you're travelling within Canada for work or play, you can count on reliable mobile service with Nivra."}
                  </p>
                  <div className="space-y-3">
                    {[
                      isFrench ? "Réseau 4G haute vitesse" : "High-speed 4G network",
                      isFrench ? "Couverture nationale" : "Nationwide coverage",
                      isFrench ? "Support local au Québec" : "Local support in Quebec"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 relative">
          <Card className="max-w-3xl mx-auto bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-purple-500/10 border-primary/30">
            <CardContent className="py-12 text-center">
              <Smartphone className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                {isFrench ? "Prêt à commencer?" : "Ready to Get Started?"}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                {isFrench 
                  ? "Découvrez nos forfaits mobiles abordables sans vérification de crédit."
                  : "Discover our affordable mobile plans with no credit check."}
              </p>
              <Button variant="hero" size="lg" onClick={() => navigate('/mobile')}>
                {isFrench ? "Voir les forfaits" : "View Plans"}
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default MobileCoverage;
