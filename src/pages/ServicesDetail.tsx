import { Smartphone, Wifi, Tv, Shield, Check, AlertCircle, ArrowRight, FileText, CreditCard, MapPin, Truck, Phone, XCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ServicesDetail = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  const services = [
    {
      icon: Wifi,
      title: isFrench ? "Internet résidentiel & affaires" : "Residential & Business Internet",
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
      color: "purple",
    },
    {
      icon: Tv,
      title: isFrench ? "Forfaits télévision" : "Television Plans",
      subtitle: isFrench ? "Requiert Internet" : "Requires Internet",
      description: isFrench 
        ? "Nos forfaits TV sont exclusivement disponibles comme ajout à votre service Internet. Profitez de chaînes HD et d'options de streaming."
        : "Our TV packages are exclusively available as an add-on to your Internet service. Enjoy HD channels and streaming options.",
      features: [
        isFrench ? "Chaînes HD premium" : "Premium HD channels",
        isFrench ? "Options multi-écrans" : "Multi-screen options",
        isFrench ? "Enregistrement cloud" : "Cloud recording",
        isFrench ? "Applications streaming" : "Streaming apps",
      ],
      standalone: false,
      requiresInternet: true,
      color: "pink",
    },
    {
      icon: Smartphone,
      title: isFrench ? "Forfaits mobiles" : "Mobile Plans",
      subtitle: isFrench ? "Vendu seul ou en forfait" : "Sold alone or bundled",
      description: isFrench 
        ? "Nos forfaits mobiles peuvent être commandés de façon indépendante, sans obligation d'avoir d'autres services."
        : "Our mobile plans can be ordered independently, without the obligation to have other services.",
      features: [
        isFrench ? "Données illimitées disponibles" : "Unlimited data available",
        isFrench ? "Appels Canada/USA" : "Canada/USA calling",
        isFrench ? "Aucun contrat obligatoire" : "No mandatory contract",
        isFrench ? "Transfert de numéro gratuit" : "Free number transfer",
      ],
      standalone: true,
      color: "blue",
    },
    {
      icon: Shield,
      title: isFrench ? "Sécurité résidentielle & commerciale" : "Home & Business Security",
      subtitle: isFrench ? "Protection complète" : "Complete protection",
      description: isFrench 
        ? "Systèmes de sécurité pour la maison et l'entreprise. Surveillance 24/7 et équipement de qualité professionnelle."
        : "Security systems for home and business. 24/7 monitoring and professional-grade equipment.",
      features: [
        isFrench ? "Caméras HD" : "HD cameras",
        isFrench ? "Détecteurs de mouvement" : "Motion detectors",
        isFrench ? "Surveillance 24/7" : "24/7 monitoring",
        isFrench ? "Application mobile" : "Mobile app",
      ],
      standalone: true,
      color: "emerald",
    },
  ];

  const pricingInfo = [
    {
      icon: Truck,
      title: isFrench ? "Frais de livraison" : "Delivery Fee",
      amount: "30 $",
      description: isFrench ? "Partout au Québec, par commande" : "Anywhere in Quebec, per order",
    },
    {
      icon: Phone,
      title: isFrench ? "Frais d'activation" : "Activation Fee",
      amount: "25 $",
      description: isFrench ? "Unique par service" : "One-time per service",
    },
    {
      icon: Building2,
      title: isFrench ? "Frais d'installation" : "Installation Fee",
      amount: "50 $",
      description: isFrench ? "Peut être crédité avec un code promo" : "Can be credited with promo code",
    },
  ];

  const policies = [
    {
      icon: FileText,
      title: isFrench ? "Facturation unique" : "Single Invoice",
      description: isFrench 
        ? "Commander plusieurs services pour plusieurs adresses? Une seule facture détaillée par adresse/service."
        : "Ordering multiple services for multiple addresses? One detailed invoice per address/service.",
    },
    {
      icon: XCircle,
      title: isFrench ? "Annulation flexible" : "Flexible Cancellation",
      description: isFrench 
        ? "Annulez en tout temps. Si après installation, 1 mois de facturation s'applique. Si avant 1 mois, les frais d'installation s'appliquent."
        : "Cancel anytime. If after installation, 1 month billing applies. If before 1 month, installation fees apply.",
    },
    {
      icon: CreditCard,
      title: isFrench ? "Aucune vérification de crédit" : "No Credit Check",
      description: isFrench 
        ? "Nous n'effectuons aucune vérification de crédit ou bureau de crédit. Paiement direct à Nivra."
        : "We do not perform any credit check or credit bureau verification. Direct payment to Nivra.",
    },
    {
      icon: MapPin,
      title: isFrench ? "Équipement en location" : "Equipment Rental",
      description: isFrench 
        ? "Location gratuite d'équipement. Retours à la charge du client lors de l'annulation."
        : "Free equipment rental. Returns at client's expense upon cancellation.",
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    purple: { bg: "bg-purple-500/20", text: "text-purple-500", border: "border-purple-500/30" },
    pink: { bg: "bg-pink-500/20", text: "text-pink-500", border: "border-pink-500/30" },
    blue: { bg: "bg-blue-500/20", text: "text-blue-500", border: "border-blue-500/30" },
    emerald: { bg: "bg-emerald-500/20", text: "text-emerald-500", border: "border-emerald-500/30" },
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-16">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              {isFrench ? "Nos services télécom" : "Our Telecom Services"}
            </Badge>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
              {isFrench ? "Solutions télécom" : "Telecom Solutions"}
              <span className="block text-accent">{isFrench ? "adaptées à vos besoins" : "tailored to your needs"}</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              {isFrench 
                ? "Nivra est un courtier indépendant. Nous sommes payés uniquement par nos clients — jamais par les fournisseurs."
                : "Nivra is an independent broker. We are paid only by our clients — never by providers."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="hero" size="lg" asChild>
                <Link to="/portal/new-order">
                  {isFrench ? "Commander maintenant" : "Order Now"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/book">
                  {isFrench ? "Consultation gratuite" : "Free Consultation"}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="container mx-auto px-4 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service, index) => {
              const colors = colorClasses[service.color];
              return (
                <Card key={index} className={`bg-card border-border hover:${colors.border} transition-colors`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                        <service.icon className={`w-7 h-7 ${colors.text}`} />
                      </div>
                      <div className="flex gap-2">
                        {service.standalone ? (
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                            {isFrench ? "Vendu seul" : "Standalone"}
                          </Badge>
                        ) : null}
                        {service.requiresInternet ? (
                          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                            {isFrench ? "Requiert Internet" : "Requires Internet"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <CardTitle className="text-xl text-foreground">{service.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{service.subtitle}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{service.description}</p>
                    <ul className="space-y-2">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                          <Check className={`w-4 h-4 ${colors.text}`} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Pricing & Fees */}
        <section className="container mx-auto px-4 mb-16">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              {isFrench ? "Frais et tarification" : "Fees & Pricing"}
            </h2>
            <p className="text-muted-foreground">
              {isFrench ? "Transparence totale sur tous les frais" : "Full transparency on all fees"}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {pricingInfo.map((item, index) => (
              <Card key={index} className="bg-card border-border text-center">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-accent" />
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-1">{item.amount}</p>
                  <p className="font-medium text-foreground mb-1">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            {isFrench 
              ? "* Taxes applicables (TPS 5% + TVQ 9.975%) en sus"
              : "* Applicable taxes (GST 5% + QST 9.975%) extra"}
          </p>
        </section>

        {/* Policies */}
        <section className="container mx-auto px-4 mb-16">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              {isFrench ? "Nos politiques" : "Our Policies"}
            </h2>
            <p className="text-muted-foreground">
              {isFrench ? "Simplicité et transparence garanties" : "Simplicity and transparency guaranteed"}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {policies.map((policy, index) => (
              <Card key={index} className="bg-card border-border">
                <CardContent className="pt-6 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <policy.icon className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">{policy.title}</p>
                    <p className="text-sm text-muted-foreground">{policy.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Important Notice */}
        <section className="container mx-auto px-4 mb-16">
          <Card className="bg-amber-500/10 border-amber-500/30 max-w-3xl mx-auto">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-2">
                    {isFrench ? "Vérification d'identité requise" : "Identity Verification Required"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Toutes les commandes nécessitent une vérification d'identité. Une pièce d'identité valide avec photo sera demandée avant l'activation de vos services."
                      : "All orders require identity verification. A valid photo ID will be requested before activating your services."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 mb-16">
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              {isFrench ? "Questions fréquentes" : "Frequently Asked Questions"}
            </h2>
          </div>
          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-2">
              <AccordionItem value="item-1" className="bg-card border border-border rounded-lg px-4">
                <AccordionTrigger className="text-foreground hover:no-underline">
                  {isFrench ? "Puis-je commander la TV sans Internet?" : "Can I order TV without Internet?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {isFrench 
                    ? "Non, les forfaits TV sont exclusivement disponibles comme ajout à un service Internet actif."
                    : "No, TV packages are exclusively available as an add-on to an active Internet service."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="bg-card border border-border rounded-lg px-4">
                <AccordionTrigger className="text-foreground hover:no-underline">
                  {isFrench ? "Comment fonctionne l'annulation?" : "How does cancellation work?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {isFrench 
                    ? "Vous pouvez annuler en tout temps. Si l'annulation survient après l'installation, 1 mois de facturation s'applique. Si avant 1 mois d'utilisation, les frais d'installation de 50$ s'appliquent."
                    : "You can cancel at any time. If cancellation occurs after installation, 1 month of billing applies. If before 1 month of use, installation fees of $50 apply."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="bg-card border border-border rounded-lg px-4">
                <AccordionTrigger className="text-foreground hover:no-underline">
                  {isFrench ? "Que se passe-t-il avec l'équipement?" : "What happens with the equipment?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {isFrench 
                    ? "L'équipement (modem, routeur, décodeur) est fourni en location gratuite. Lors de l'annulation, les frais de retour sont à votre charge."
                    : "Equipment (modem, router, decoder) is provided as free rental. Upon cancellation, return shipping is at your expense."}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="bg-card border border-border rounded-lg px-4">
                <AccordionTrigger className="text-foreground hover:no-underline">
                  {isFrench ? "Plusieurs adresses, une facture?" : "Multiple addresses, one invoice?"}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {isFrench 
                    ? "Oui! Vous pouvez commander des services pour plusieurs adresses et recevoir une facture unique détaillée par adresse et par service."
                    : "Yes! You can order services for multiple addresses and receive a single detailed invoice per address and per service."}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4">
          <Card className="bg-gradient-to-br from-accent/10 to-cyan-500/5 border-accent/20 max-w-3xl mx-auto">
            <CardContent className="py-12 text-center">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                {isFrench ? "Prêt à commander?" : "Ready to order?"}
              </h2>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                {isFrench 
                  ? "Créez votre compte client et passez votre commande directement en ligne. Numéro de confirmation instantané."
                  : "Create your client account and place your order directly online. Instant confirmation number."}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/portal/new-order">
                    {isFrench ? "Passer une commande" : "Place an Order"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/auth">
                    {isFrench ? "Créer un compte" : "Create Account"}
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
