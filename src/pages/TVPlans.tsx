import { useState } from "react";
import { Tv, Check, MapPin, Shield, Zap, Star, ArrowRight, AlertTriangle, Router, Monitor, Wifi, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface AddressDetails {
  formattedAddress: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

const TVPlans = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFrench = language === 'fr';
  
  const [address, setAddress] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(null);
  const [addressValidated, setAddressValidated] = useState(false);
  const [addressError, setAddressError] = useState("");

  const plans = [
    {
      id: "tv-basic",
      name: isFrench ? "Internet 100 + TV Basic" : "Internet 100 + TV Basic",
      internetSpeed: "100 Mbps",
      price: 75,
      badge: isFrench ? "ÉCONOMIQUE" : "VALUE",
      badgeColor: "bg-blue-500",
      channels: 26,
      channelType: isFrench ? "chaînes générales" : "general channels",
      description: isFrench 
        ? "L'essentiel pour regarder vos émissions préférées." 
        : "The essentials for watching your favorite shows.",
      features: [
        isFrench ? "Internet 100 Mbps inclus" : "Internet 100 Mbps included",
        isFrench ? "26 chaînes générales" : "26 general channels",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Tableau de bord streaming (navigateur)" : "Browser-based streaming dashboard",
      ],
    },
    {
      id: "tv-5choices",
      name: isFrench ? "Internet 500 + TV 5 choix" : "Internet 500 + TV 5 choices",
      internetSpeed: "500 Mbps",
      price: 80,
      badge: isFrench ? "POPULAIRE" : "POPULAR",
      badgeColor: "bg-cyan-500",
      channels: 32,
      channelType: isFrench ? "chaînes populaires" : "popular channels",
      description: isFrench 
        ? "Internet rapide avec une sélection de chaînes populaires." 
        : "Fast internet with a selection of popular channels.",
      features: [
        isFrench ? "Internet 500 Mbps inclus" : "Internet 500 Mbps included",
        isFrench ? "32 chaînes populaires" : "32 popular channels",
        isFrench ? "5 chaînes au choix" : "5 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
      ],
    },
    {
      id: "tv-10choices",
      name: isFrench ? "Internet 500 + TV 10 choix" : "Internet 500 + TV 10 choices",
      internetSpeed: "500 Mbps",
      price: 90,
      previousPrice: 109,
      badge: isFrench ? "MEILLEUR VENDEUR" : "BEST SELLER",
      badgeColor: "bg-accent",
      featured: true,
      channels: 37,
      channelType: isFrench ? "chaînes populaires + sports" : "popular + sports channels",
      description: isFrench 
        ? "Parfait pour les familles et amateurs de sport." 
        : "Perfect for families and sports fans.",
      features: [
        isFrench ? "Internet 500 Mbps inclus" : "Internet 500 Mbps included",
        isFrench ? "37 chaînes populaires + sports" : "37 popular + sports channels",
        isFrench ? "10 chaînes au choix" : "10 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Télécommande vocale" : "Voice control remote",
      ],
    },
    {
      id: "tv-15choices",
      name: isFrench ? "Internet 500 + TV 15 choix" : "Internet 500 + TV 15 choices",
      internetSpeed: "500 Mbps",
      price: 95,
      previousPrice: 129,
      badge: isFrench ? "ÉCONOMIE 26%" : "SAVE 26%",
      badgeColor: "bg-emerald-500",
      channels: 42,
      channelType: isFrench ? "chaînes populaires + sports" : "popular + sports channels",
      description: isFrench 
        ? "Plus de choix pour toute la famille." 
        : "More choice for the whole family.",
      features: [
        isFrench ? "Internet 500 Mbps inclus" : "Internet 500 Mbps included",
        isFrench ? "42 chaînes populaires + sports" : "42 popular + sports channels",
        isFrench ? "15 chaînes au choix" : "15 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Télécommande vocale" : "Voice control remote",
      ],
    },
    {
      id: "tv-25choices",
      name: isFrench ? "Internet 500 + TV 25 choix" : "Internet 500 + TV 25 choices",
      internetSpeed: "500 Mbps",
      price: 110,
      previousPrice: 135,
      badge: isFrench ? "PREMIUM" : "PREMIUM",
      badgeColor: "bg-purple-500",
      channels: 52,
      channelType: isFrench ? "chaînes populaires + sports" : "popular + sports channels",
      description: isFrench 
        ? "L'expérience TV ultime avec le maximum de choix." 
        : "The ultimate TV experience with maximum choice.",
      features: [
        isFrench ? "Internet 500 Mbps inclus" : "Internet 500 Mbps included",
        isFrench ? "52 chaînes populaires + sports" : "52 popular + sports channels",
        isFrench ? "25 chaînes au choix" : "25 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Télécommande vocale" : "Voice control remote",
        isFrench ? "Support prioritaire VIP" : "VIP priority support",
      ],
    },
  ];

  const gigaPlans = [
    {
      id: "giga-tv-basic",
      name: isFrench ? "GIGA + TV Basic" : "GIGA + TV Basic",
      internetSpeed: "1 Gbps",
      price: 85,
      badge: isFrench ? "GIGA" : "GIGA",
      badgeColor: "bg-gradient-to-r from-orange-500 to-red-500",
      channels: 26,
      channelType: isFrench ? "chaînes générales" : "general channels",
      description: isFrench 
        ? "Internet ultra-rapide avec les chaînes essentielles." 
        : "Ultra-fast internet with essential channels.",
      features: [
        isFrench ? "Internet GIGA 1 Gbps inclus" : "GIGA 1 Gbps Internet included",
        isFrench ? "26 chaînes générales" : "26 general channels",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Tableau de bord streaming (navigateur)" : "Browser-based streaming dashboard",
      ],
    },
    {
      id: "giga-tv-5choices",
      name: isFrench ? "GIGA + TV 5 choix" : "GIGA + TV 5 choices",
      internetSpeed: "1 Gbps",
      price: 95,
      badge: isFrench ? "GIGA POPULAIRE" : "GIGA POPULAR",
      badgeColor: "bg-gradient-to-r from-orange-500 to-red-500",
      channels: 32,
      channelType: isFrench ? "chaînes populaires" : "popular channels",
      description: isFrench 
        ? "Vitesse GIGA avec une sélection de chaînes populaires." 
        : "GIGA speed with a selection of popular channels.",
      features: [
        isFrench ? "Internet GIGA 1 Gbps inclus" : "GIGA 1 Gbps Internet included",
        isFrench ? "32 chaînes populaires" : "32 popular channels",
        isFrench ? "5 chaînes au choix" : "5 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
      ],
    },
    {
      id: "giga-tv-10choices",
      name: isFrench ? "GIGA + TV 10 choix" : "GIGA + TV 10 choices",
      internetSpeed: "1 Gbps",
      price: 105,
      badge: isFrench ? "GIGA VEDETTE" : "GIGA STAR",
      badgeColor: "bg-gradient-to-r from-orange-500 to-red-500",
      featured: true,
      channels: 37,
      channelType: isFrench ? "chaînes populaires + sports" : "popular + sports channels",
      description: isFrench 
        ? "La combinaison parfaite: vitesse GIGA et divertissement complet." 
        : "The perfect combination: GIGA speed and complete entertainment.",
      features: [
        isFrench ? "Internet GIGA 1 Gbps inclus" : "GIGA 1 Gbps Internet included",
        isFrench ? "37 chaînes populaires + sports" : "37 popular + sports channels",
        isFrench ? "10 chaînes au choix" : "10 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Télécommande vocale" : "Voice control remote",
      ],
    },
    {
      id: "giga-tv-15choices",
      name: isFrench ? "GIGA + TV 15 choix" : "GIGA + TV 15 choices",
      internetSpeed: "1 Gbps",
      price: 110,
      badge: isFrench ? "GIGA FAMILLE" : "GIGA FAMILY",
      badgeColor: "bg-gradient-to-r from-orange-500 to-red-500",
      channels: 42,
      channelType: isFrench ? "chaînes populaires + sports" : "popular + sports channels",
      description: isFrench 
        ? "Parfait pour les grandes familles connectées." 
        : "Perfect for large connected families.",
      features: [
        isFrench ? "Internet GIGA 1 Gbps inclus" : "GIGA 1 Gbps Internet included",
        isFrench ? "42 chaînes populaires + sports" : "42 popular + sports channels",
        isFrench ? "15 chaînes au choix" : "15 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Télécommande vocale" : "Voice control remote",
      ],
    },
    {
      id: "giga-tv-25choices",
      name: isFrench ? "GIGA + TV 25 choix" : "GIGA + TV 25 choices",
      internetSpeed: "1 Gbps",
      price: 120,
      badge: isFrench ? "GIGA ULTIME" : "GIGA ULTIMATE",
      badgeColor: "bg-gradient-to-r from-orange-500 to-red-500",
      channels: 52,
      channelType: isFrench ? "chaînes populaires + sports" : "popular + sports channels",
      description: isFrench 
        ? "L'expérience ultime: vitesse maximale et divertissement premium." 
        : "The ultimate experience: maximum speed and premium entertainment.",
      features: [
        isFrench ? "Internet GIGA 1 Gbps inclus" : "GIGA 1 Gbps Internet included",
        isFrench ? "52 chaînes populaires + sports" : "52 popular + sports channels",
        isFrench ? "25 chaînes au choix" : "25 channels of your choice",
        isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
        isFrench ? "Télécommande vocale" : "Voice control remote",
        isFrench ? "Support prioritaire VIP" : "VIP priority support",
      ],
    },
  ];

  const handleAddressSelect = (details: AddressDetails) => {
    setAddressDetails(details);
    
    const postalCode = details.postalCode || "";
    const province = details.province || "";
    const isQuebec = /^[GHJ]/i.test(postalCode) || province.toUpperCase().includes("QC") || province.toUpperCase().includes("QUEBEC");
    
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
    const state = {
      validatedAddress: address,
      addressDetails,
      selectedPlanId: planId,
      redirectTo: '/portal/tv-order'
    };
    
    if (user) {
      navigate('/portal/tv-order', { state });
    } else {
      navigate('/portal/auth', { state });
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
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
                  value={address}
                  onChange={(value) => {
                    setAddress(value);
                    if (!value) {
                      setAddressValidated(false);
                      setAddressDetails(null);
                      setAddressError("");
                    }
                  }}
                  onAddressSelect={handleAddressSelect}
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
              <Card 
                key={index}
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
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <Tv className="w-6 h-6 text-purple-500" />
                    </div>
                    <span className="text-muted-foreground">+</span>
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <Wifi className="w-6 h-6 text-cyan-500" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    {plan.name}
                  </CardTitle>
                  <div className="mt-4">
                    {plan.previousPrice && (
                      <span className="text-lg text-muted-foreground line-through mr-2">${plan.previousPrice}</span>
                    )}
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground">/{isFrench ? "mois" : "month"}</span>
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-purple-500 border-purple-500/30">
                      {plan.channels} {plan.channelType}
                    </Badge>
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
              <Card 
                key={index}
                className={`relative bg-card/80 backdrop-blur-sm border-border transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 ${
                  plan.featured ? 'ring-2 ring-orange-500 shadow-lg scale-105' : ''
                }`}
              >
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2`}>
                  <Badge className={`${plan.badgeColor} text-white px-4 py-1`}>
                    {plan.badge}
                  </Badge>
                </div>
                
                <CardHeader className="text-center pt-8">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <Tv className="w-6 h-6 text-purple-500" />
                    </div>
                    <span className="text-muted-foreground">+</span>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-orange-500" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">
                    {plan.name}
                  </CardTitle>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                      {plan.internetSpeed}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground">/{isFrench ? "mois" : "month"}</span>
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-purple-500 border-purple-500/30">
                      {plan.channels} {plan.channelType}
                    </Badge>
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
                    className={`w-full mt-6 ${!plan.featured ? 'hover:border-orange-500 hover:text-orange-500' : ''}`}
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
                      <Badge variant="outline" className="text-cyan-500 border-cyan-500/30">
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
                  <div className="w-24 h-24 rounded-2xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <Router className="w-12 h-12 text-cyan-500" />
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
                      <Badge variant="outline" className="text-cyan-500 border-cyan-500/30">
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
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-cyan-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isFrench ? "100% Indépendant" : "100% Independent"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Aucune affiliation, partenariat ou commission carrier"
                      : "No carrier affiliation, partnership or commission"}
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
