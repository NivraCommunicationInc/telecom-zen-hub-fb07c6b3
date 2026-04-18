import { Smartphone, Wifi, Tv, Shield, Check, AlertCircle, ArrowRight, FileText, CreditCard, MapPin, Mail, XCircle, Building2, User, Clock, Receipt, ChevronRight, Layers, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SecurityInfoBox } from "@/components/ServiceInfoBox";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { COMPANY_CONTACT } from "@/config/company";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";

const ServicesDetail = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const { data: siteSettings } = useSiteSettings();

  // No phone support — Nivra communicates by email + chat only.
  // (siteSettings + supportPhone removed; siteSettings hook intentionally
  // dropped from this section because nothing else here consumes it.)

  const services = [
    {
      icon: Wifi,
      title: isFrench ? "Internet Maison & Affaires" : "Home & Business Internet",
      subtitle: isFrench ? "Connexion coaxiale haute vitesse" : "High-speed coaxial connection",
      description: isFrench 
        ? "Service Internet par câble coaxial disponible partout au Québec. Vitesses allant jusqu'à 1 Gbps selon votre région."
        : "Coaxial cable Internet service available throughout Quebec. Speeds up to 1 Gbps depending on your region.",
      features: [
        isFrench ? "Connexion coaxiale fiable" : "Reliable coaxial connection",
        isFrench ? "Installation par nos techniciens" : "Installation by our technicians",
        isFrench ? "Équipement inclus (modem/routeur)" : "Equipment included (modem/router)",
        isFrench ? "Support technique 7j/7" : "24/7 technical support",
      ],
      standalone: true,
      color: "cyan",
    },
    {
      icon: Tv,
      title: isFrench ? "Forfaits Télévision" : "Television Plans",
      subtitle: isFrench ? "Requiert un plan Internet" : "Requires Internet plan",
      description: isFrench 
        ? "Nos forfaits TV sont exclusivement disponibles comme ajout à votre service Internet. Profitez de chaînes HD, 4K et d'options de streaming."
        : "Our TV packages are exclusively available as an add-on to your Internet service. Enjoy HD, 4K channels and streaming options.",
      features: [
        isFrench ? "Chaînes HD et 4K premium" : "Premium HD & 4K channels",
        isFrench ? "Options multi-écrans" : "Multi-screen options",
        isFrench ? "Enregistrement cloud" : "Cloud recording",
        isFrench ? "Applications streaming intégrées" : "Integrated streaming apps",
      ],
      standalone: false,
      requiresInternet: true,
      color: "pink",
    },
    {
      icon: Smartphone,
      title: isFrench ? "Forfaits Mobiles" : "Mobile Plans",
      subtitle: isFrench ? "Vendu seul ou en forfait combiné" : "Sold alone or bundled",
      description: isFrench 
        ? "Nos forfaits mobiles peuvent être commandés indépendamment, sans obligation d'avoir d'autres services."
        : "Our mobile plans can be ordered independently, without requiring other services.",
      features: [
        isFrench ? "Données illimitées disponibles" : "Unlimited data available",
        isFrench ? "Appels Canada/USA inclus" : "Canada/USA calling included",
        isFrench ? "Aucun contrat obligatoire" : "No mandatory contract",
        isFrench ? "Transfert de numéro gratuit" : "Free number transfer",
      ],
      standalone: true,
      color: "blue",
    },
    {
      icon: Shield,
      title: isFrench ? "Sécurité Maison & Affaires" : "Home & Business Security",
      subtitle: isFrench ? "Protection 24/7 complète" : "Complete 24/7 protection",
      description: isFrench 
        ? "Systèmes de sécurité professionnels pour résidences et entreprises. Surveillance constante et équipement de qualité."
        : "Professional security systems for homes and businesses. Constant monitoring and quality equipment.",
      features: [
        isFrench ? "Caméras HD et 4K" : "HD & 4K cameras",
        isFrench ? "Détecteurs de mouvement" : "Motion detectors",
        isFrench ? "Surveillance 24/7" : "24/7 monitoring",
        isFrench ? "Application mobile" : "Mobile app control",
      ],
      standalone: true,
      color: "emerald",
    },
  ];

  const accountFeatures = [
    {
      icon: User,
      title: isFrench ? "Un compte, plusieurs services" : "One account, multiple services",
      description: isFrench 
        ? "Sélectionnez un ou plusieurs services à la fois. Tout est géré sous un seul numéro de compte interne."
        : "Select one or multiple services at once. Everything is managed under a single internal account number.",
    },
    {
      icon: MapPin,
      title: isFrench ? "Plusieurs adresses" : "Multiple addresses",
      description: isFrench 
        ? "Ajoutez plusieurs adresses de service à votre compte. Idéal pour les familles ou entreprises multi-sites."
        : "Add multiple service addresses to your account. Perfect for families or multi-site businesses.",
    },
    {
      icon: Receipt,
      title: isFrench ? "Une facture détaillée" : "One detailed invoice",
      description: isFrench 
        ? "Recevez une seule facture claire, détaillant tous vos services par adresse. Transparence totale."
        : "Receive a single clear invoice, detailing all your services by address. Total transparency.",
    },
    {
      icon: FileText,
      title: isFrench ? "Numéro de confirmation" : "Confirmation number",
      description: isFrench 
        ? "Chaque commande génère un numéro de confirmation unique pour suivi et référence."
        : "Each order generates a unique confirmation number for tracking and reference.",
    },
  ];

  const businessRules = [
    {
      icon: CreditCard,
      title: isFrench ? "Aucune vérification de crédit" : "No credit check",
      description: isFrench 
        ? "Nous n'effectuons aucune vérification de crédit ou bureau de crédit."
        : "We do not perform any credit check or credit bureau verification.",
      color: "text-emerald-500",
    },
    {
      icon: Building2,
      title: isFrench ? "Aucune affiliation télécom" : "No carrier affiliation",
      description: isFrench 
        ? "Nivra est 100% indépendant. Aucune commission des fournisseurs."
        : "Nivra is 100% independent. No commission from providers.",
      color: "text-cyan-500",
    },
    {
      icon: Receipt,
      title: isFrench ? "Paiement direct à Nivra" : "Direct payment to Nivra",
      description: isFrench 
        ? "Le client paie directement à Nivra. Pas d'intermédiaire."
        : "Client pays directly to Nivra. No middleman.",
      color: "text-purple-500",
    },
    {
      icon: XCircle,
      title: isFrench ? "Annulation flexible" : "Flexible cancellation",
      description: isFrench 
        ? "Annulez en tout temps. Après installation: 1 mois facturé. Avant 1 mois: frais d'installation."
        : "Cancel anytime. After installation: 1 month billed. Before 1 month: installation fees.",
      color: "text-amber-500",
    },
    {
      icon: MapPin,
      title: isFrench ? "Frais d'équipement unique" : "One-time equipment fee",
      description: isFrench 
        ? "Frais uniques pour équipement, payés à la commande. Garantie 1 an couvrant défauts d'usine. Retours aux frais du client."
        : "One-time equipment fee, paid at order. 1-year warranty covering factory defects. Returns at client's expense.",
      color: "text-blue-500",
    },
    {
      icon: AlertCircle,
      title: isFrench ? "Pièce d'identité requise" : "ID required",
      description: isFrench 
        ? "Vérification d'identité obligatoire pour valider toute commande."
        : "Identity verification required to validate any order.",
      color: "text-pink-500",
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
    cyan: { 
      bg: "bg-cyan-500/15", 
      text: "text-cyan-500", 
      border: "border-cyan-500/30",
      gradient: "from-cyan-500/20 to-cyan-400/5"
    },
    pink: { 
      bg: "bg-pink-500/15", 
      text: "text-pink-500", 
      border: "border-pink-500/30",
      gradient: "from-pink-500/20 to-pink-400/5"
    },
    blue: { 
      bg: "bg-blue-500/15", 
      text: "text-blue-500", 
      border: "border-blue-500/30",
      gradient: "from-blue-500/20 to-blue-400/5"
    },
    emerald: { 
      bg: "bg-emerald-500/15", 
      text: "text-emerald-500", 
      border: "border-emerald-500/30",
      gradient: "from-emerald-500/20 to-emerald-400/5"
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead {...SEO_DATA.services} />
      <Header />
      
      <main className="pt-24 pb-20 relative">
        {/* 3D Parallax Background */}
        <div className="parallax-container absolute inset-0 pointer-events-none overflow-hidden">
          {/* Layer 1 - Deep background */}
          <div className="parallax-layer parallax-layer-2 absolute inset-0">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-cyan-500/5 via-transparent to-transparent rounded-full blur-3xl transform -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-accent/5 via-transparent to-transparent rounded-full blur-3xl transform translate-y-1/2 -translate-x-1/3" />
          </div>
          
          {/* Layer 2 - Mid background */}
          <div className="parallax-layer parallax-layer-1 absolute inset-0">
            <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-gradient-radial from-purple-500/8 via-transparent to-transparent rounded-full blur-2xl float-3d" />
            <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-gradient-radial from-cyan-400/8 via-transparent to-transparent rounded-full blur-2xl float-3d-delayed" />
          </div>

          {/* Decorative geometric shapes */}
          <div className="absolute top-40 right-20 w-32 h-32 border border-accent/10 rounded-2xl rotate-12 float-3d" />
          <div className="absolute top-60 left-16 w-20 h-20 border border-cyan-500/10 rounded-xl -rotate-12 float-3d-delayed" />
          <div className="absolute bottom-40 right-1/3 w-24 h-24 border border-purple-500/10 rounded-lg rotate-45 float-3d" />
        </div>

        {/* Hero Section with 3D Text */}
        <section className="container mx-auto px-4 mb-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-accent/10 text-accent border-accent/20 px-4 py-1.5 card-3d">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {isFrench ? "Services télécom Nivra" : "Nivra Telecom Services"}
            </Badge>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              <span className="block text-3d-dark">
                {isFrench ? "Nos services" : "Our Services"}
              </span>
              <span className="block bg-gradient-to-r from-accent via-cyan-400 to-accent bg-clip-text text-transparent">
                {isFrench ? "télécom au Québec" : "Telecom in Quebec"}
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {isFrench 
                ? "Activation, installation et support — tout au même endroit pour particuliers et entreprises."
                : "Activation, installation and support — all in one place for home and business."}
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="hero" size="xl" className="btn-3d" onClick={() => {
                const contactSection = document.getElementById('contact-cta');
                if (contactSection) contactSection.scrollIntoView({ behavior: 'smooth' });
              }}>
                <ArrowRight className="w-5 h-5 mr-2" />
                {isFrench ? "Demander une soumission" : "Request a quote"}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href={`mailto:${COMPANY_CONTACT.supportEmail}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  {isFrench ? "Nous écrire" : "Email us"}
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Services Grid with 3D Cards */}
        <section className="container mx-auto px-4 mb-20 relative">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4 text-3d-dark">
              {isFrench ? "Catégories de services" : "Service Categories"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isFrench 
                ? "Sélectionnez un ou plusieurs services selon vos besoins"
                : "Select one or multiple services based on your needs"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {services.map((service, index) => {
              const colors = colorClasses[service.color];
              return (
                <Card 
                  key={index} 
                  className={`bg-card/80 backdrop-blur-sm border-border hover:${colors.border} transition-all duration-500 card-3d overflow-hidden relative group`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  <CardHeader className="relative">
                    <div className="flex items-start justify-between">
                      <div className={`w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                        <service.icon className={`w-8 h-8 ${colors.text}`} />
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        {service.standalone ? (
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                            {isFrench ? "Vendu seul" : "Standalone"}
                          </Badge>
                        ) : null}
                        {service.requiresInternet ? (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                            {isFrench ? "Requiert Internet" : "Requires Internet"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <CardTitle className="text-xl lg:text-2xl text-foreground">{service.title}</CardTitle>
                    <p className="text-sm text-muted-foreground font-medium">{service.subtitle}</p>
                  </CardHeader>
                  <CardContent className="relative">
                    <p className="text-muted-foreground mb-5 leading-relaxed">{service.description}</p>
                    <ul className="space-y-2.5 mb-6">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                          <div className={`w-5 h-5 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                            <Check className={`w-3 h-3 ${colors.text}`} />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button variant="ghost" size="sm" className={`group/btn ${colors.text} p-0 h-auto font-semibold`} onClick={() => {
                      const contactSection = document.getElementById('contact-cta');
                      if (contactSection) contactSection.scrollIntoView({ behavior: 'smooth' });
                    }}>
                      {isFrench ? "Demander une soumission" : "Request a quote"}
                      <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Security Info Box - Annex B4 */}
          <div className="mt-8 max-w-2xl mx-auto">
            <SecurityInfoBox isFrench={isFrench} />
          </div>
        </section>

        {/* Account Features Section */}
        <section className="container mx-auto px-4 mb-20 relative">
          <div className="bg-gradient-to-br from-card/90 via-card/70 to-card/50 backdrop-blur-lg rounded-3xl p-8 lg:p-12 border border-border/50 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Layers className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                  {isFrench ? "Gestion simplifiée" : "Simplified Management"}
                </h2>
                <p className="text-muted-foreground">
                  {isFrench ? "Un compte, plusieurs possibilités" : "One account, multiple possibilities"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {accountFeatures.map((feature, index) => (
                <div key={index} className="group">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-cyan-500" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Business Rules Grid */}
        <section className="container mx-auto px-4 mb-20 relative">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4 text-3d-dark">
              {isFrench ? "Nos règles d'affaires" : "Our Business Rules"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isFrench 
                ? "Transparence et simplicité garanties"
                : "Guaranteed transparency and simplicity"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {businessRules.map((rule, index) => (
              <Card key={index} className="bg-card/60 backdrop-blur-sm border-border/50 hover:border-border transition-all duration-300 card-3d">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-background flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <rule.icon className={`w-5 h-5 ${rule.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">{rule.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{rule.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ID Verification Notice */}
        <section className="container mx-auto px-4 mb-20 relative">
          <Card className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-400/10 border-amber-500/20 max-w-3xl mx-auto shadow-lg">
            <CardContent className="py-8">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-7 h-7 text-amber-500" />
                </div>
                <div>
                  <p className="font-display font-bold text-lg text-foreground mb-2">
                    {isFrench ? "Vérification d'identité obligatoire" : "Mandatory Identity Verification"}
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {isFrench 
                      ? "Toutes les commandes nécessitent une pièce d'identité valide avec photo. Cette vérification sera effectuée avant l'activation de vos services."
                      : "All orders require a valid photo ID. This verification will be completed before activating your services."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 mb-20 relative">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4 text-3d-dark">
              {isFrench ? "Questions fréquentes" : "Frequently Asked Questions"}
            </h2>
          </div>
          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-3">
              <AccordionItem value="item-1" className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 overflow-hidden">
                <AccordionTrigger className="text-foreground hover:no-underline py-5">
                  {isFrench ? "Puis-je commander la TV sans Internet?" : "Can I order TV without Internet?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {isFrench 
                    ? "Non, les forfaits TV sont exclusivement disponibles comme ajout à un service Internet actif. L'Internet coaxial est requis."
                    : "No, TV packages are exclusively available as an add-on to an active Internet service. Coaxial Internet is required."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 overflow-hidden">
                <AccordionTrigger className="text-foreground hover:no-underline py-5">
                  {isFrench ? "Comment fonctionne l'annulation?" : "How does cancellation work?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {isFrench 
                    ? "Vous pouvez annuler en tout temps. Si l'annulation survient après l'installation, 1 mois de facturation s'applique. Si avant 1 mois d'utilisation, les frais d'installation s'appliquent."
                    : "You can cancel at any time. If cancellation occurs after installation, 1 month of billing applies. If before 1 month of use, installation fees apply."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 overflow-hidden">
                <AccordionTrigger className="text-foreground hover:no-underline py-5">
                  {isFrench ? "Que se passe-t-il avec l'équipement?" : "What happens with the equipment?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {isFrench 
                    ? "L'équipement (modem, routeur, décodeur) est facturé avec frais unique à la commande. Garantie fabricant 1 an incluse couvrant les défauts d'usine. Les retours sont aux frais du client."
                    : "Equipment (modem, router, decoder) is charged with a one-time fee at order. 1-year manufacturer warranty included covering factory defects. Returns are at client's expense."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 overflow-hidden">
                <AccordionTrigger className="text-foreground hover:no-underline py-5">
                  {isFrench ? "Puis-je avoir plusieurs adresses?" : "Can I have multiple addresses?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {isFrench 
                    ? "Oui! Vous pouvez ajouter plusieurs adresses de service à votre compte et recevoir une facture unique détaillée par adresse et par service."
                    : "Yes! You can add multiple service addresses to your account and receive a single detailed invoice per address and per service."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5" className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 overflow-hidden">
                <AccordionTrigger className="text-foreground hover:no-underline py-5">
                  {isFrench ? "Y a-t-il une vérification de crédit?" : "Is there a credit check?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {isFrench 
                    ? "Non. Nivra n'effectue aucune vérification de crédit ou bureau de crédit. Vous payez directement à Nivra sans intermédiaire."
                    : "No. Nivra does not perform any credit check or credit bureau verification. You pay directly to Nivra without intermediary."}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Inline CTA - Request Quote */}
        <section id="contact-cta" className="container mx-auto px-4 mb-20 relative">
          <Card className="bg-gradient-to-br from-accent/15 via-cyan-500/10 to-accent/5 border-accent/20 overflow-hidden relative">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-cyan-400/20 via-transparent to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-radial from-accent/15 via-transparent to-transparent rounded-full blur-2xl" />
            
            <CardContent className="py-14 px-8 relative">
              <div className="max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6 shadow-glow">
                  <ArrowRight className="w-8 h-8 text-accent" />
                </div>
                
                <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
                  {isFrench ? "Prêt à activer votre service?" : "Ready to activate your service?"}
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  {isFrench 
                    ? "Demandez une soumission et on s'occupe de la mise en service."
                    : "Request a quote and we'll handle the setup."}
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button variant="hero" size="xl" className="btn-3d" asChild>
                    <Link to="/#contact">
                      <ArrowRight className="w-5 h-5 mr-2" />
                      {isFrench ? "Demander une soumission" : "Request a quote"}
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" className="gap-2" asChild>
                    <a href={`mailto:${COMPANY_CONTACT.supportEmail}`}>
                      <Mail className="w-4 h-4" />
                      {COMPANY_CONTACT.supportEmailDisplay}
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Secondary CTA */}
        <section className="container mx-auto px-4 relative">
          <Card className="bg-card/80 backdrop-blur-sm border-border max-w-3xl mx-auto shadow-lg">
            <CardContent className="py-10 text-center">
              <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-4">
                {isFrench ? "Des questions?" : "Questions?"}
              </h2>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                {isFrench 
                  ? "Notre équipe est disponible pour vous aider avec vos besoins télécom."
                  : "Our team is available to help with your telecom needs."}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/#contact">
                    {isFrench ? "Nous joindre" : "Contact us"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/faq">
                    {isFrench ? "Consulter la FAQ" : "View FAQ"}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ServicesDetail;
