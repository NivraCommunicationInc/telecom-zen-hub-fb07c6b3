import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Users, 
  Shield, 
  FileText, 
  Headphones, 
  Settings,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Lock,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  Zap
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { COMPANY_CONTACT } from "@/config/company";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";

const About = () => {
  const { data: siteSettings } = useSiteSettings();
  
  // Use site_settings as source of truth, COMPANY_CONTACT as fallback
  const supportPhone = siteSettings?.support_phone || COMPANY_CONTACT.supportPhoneDisplay;
  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;
  const address = siteSettings?.address || COMPANY_CONTACT.fullAddress;
  const services = [
    {
      icon: Zap,
      title: "Activation & gestion de services",
      description: "Mise en service, modifications, transferts et gestion de vos services télécoms, pour particuliers et PME."
    },
    {
      icon: Settings,
      title: "Installation & configuration",
      description: "Planification d'installation, configuration initiale, tests et validation de la mise en service."
    },
    {
      icon: Headphones,
      title: "Support technique & tickets",
      description: "Support structuré par tickets avec statut, historique, priorités et communications à chaque étape."
    },
    {
      icon: FileText,
      title: "Facturation & documents",
      description: "Accès à vos documents et historique dans votre portail, avec des informations centralisées et cohérentes."
    }
  ];

  const trustPoints = [
    {
      icon: ClipboardCheck,
      title: "Processus traçable",
      description: "Statut, historique et suivi sur chaque demande."
    },
    {
      icon: MessageSquare,
      title: "Communication claire",
      description: "Confirmations, délais annoncés, mises à jour régulières."
    },
    {
      icon: Lock,
      title: "Protection des données",
      description: "Accès contrôlé et bonnes pratiques de sécurité."
    },
    {
      icon: MapPin,
      title: "Support basé au Canada",
      description: "Équipe locale, disponible par les canaux officiels."
    }
  ];

  const approachSteps = [
    { step: "01", title: "Demande", description: "Vous décrivez votre besoin (activation, installation, changement, support)." },
    { step: "02", title: "Prise en charge", description: "Création du dossier, validation des informations et planification si nécessaire." },
    { step: "03", title: "Mise en service", description: "Activation / installation / configuration, puis vérification." },
    { step: "04", title: "Suivi", description: "Support continu et historique accessible selon votre accès." }
  ];

  const faqItems = [
    {
      question: "Êtes-vous un fournisseur ou un service de gestion?",
      answer: "Nous offrons une prise en charge télécom structurée : activation, installation, support et gestion de services, avec suivi et historique."
    },
    {
      question: "Comment fonctionne le support?",
      answer: "Vous ouvrez un ticket, vous suivez le statut, et vous recevez des mises à jour jusqu'à la résolution."
    },
    {
      question: "Quels sont les délais de traitement?",
      answer: "Les délais varient selon la demande (activation, installation, support). Un statut et une estimation sont communiqués dès la prise en charge."
    },
    {
      question: "Comment protégez-vous mes informations?",
      answer: "Accès contrôlé, canaux sécurisés, et bonnes pratiques de sécurité. Nous ne demandons jamais d'informations sensibles par courriel."
    },
    {
      question: "Puis-je gérer plusieurs comptes ou lignes?",
      answer: "Oui. Votre portail permet une gestion centralisée, selon votre configuration."
    }
  ];

  return (
    <div className="min-h-screen public-light" >
      <SEOHead {...SEO_DATA.about} />
      <Header />
      
      {/* Hero Section */}
      <section className="pt-28 pb-16 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 max-w-5xl relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/25 mb-5">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Fournisseur télécom canadien</span>
            </div>
            <h1 className="text-slate-900 mb-4">
              Nivra <span className="text-accent">Telecom</span>
            </h1>
            <p className="text-lg text-slate-500 mb-6 leading-relaxed max-w-2xl mx-auto">
              Services télécoms au Canada : activation, installation, support et gestion de compte. 
              Une expérience simple, structurée et fiable — pour le résidentiel et l'entreprise.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/services">
                <Button variant="hero" size="lg" className="w-full sm:w-auto">
                  Voir nos services
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/#contact">
                <Button variant="heroOutline" size="lg" className="w-full sm:w-auto">
                  Contacter le support
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 52C120 44 240 28 360 24C480 20 600 28 720 32C840 36 960 36 1080 32C1200 28 1320 20 1380 16L1440 12V60H0Z" fill="hsl(var(--background))"/>
          </svg>
        </div>
      </section>

      {/* Notre Engagement */}
      <section className="section-padding">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-4">
                Une expérience télécom claire, du début à la fin
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Notre mission est simple : rendre les services télécoms plus faciles à utiliser et plus fiables au quotidien. 
                Chez Nivra, chaque demande suit un processus clair, chaque étape est tracée, et le support reste accessible quand vous en avez besoin.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Simplicité</strong> — étapes claires, communications directes, aucun détour inutile</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Transparence</strong> — informations expliquées, suivi documenté, statuts visibles</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Support</strong> — assistance réactive, tickets, mises à jour et résolution</span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-primary border border-border p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                    <span className="font-bold text-slate-900 text-4xl">N</span>
                  </div>
                  <p className="text-slate-500 text-sm">Fournisseur indépendant depuis 2020</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ce que nous faisons */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="mb-3">
              Des services télécom complets, avec un vrai suivi
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Activation, installation, support et gestion — tout au même endroit.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((service, index) => (
              <div 
                key={index} 
                className="bg-card border border-border rounded-2xl p-5 hover:border-accent/30 hover:shadow-elevated transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <service.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm">{service.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi Nivra */}
      <section className="section-padding">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="mb-3">
              Des engagements concrets, mesurables
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Processus clair, communication transparente, support accessible.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {trustPoints.map((point, index) => (
              <div 
                key={index} 
                className="flex gap-4 p-5 bg-card border border-border rounded-2xl hover:border-accent/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                  <point.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{point.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Notre fonctionnement - Timeline */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="mb-3">
              Notre fonctionnement
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Un processus structuré pour des résultats prévisibles.
            </p>
          </div>
          
          {/* Desktop Timeline */}
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute top-8 left-0 right-0 h-px bg-border" />
              <div className="grid grid-cols-4 gap-5 relative">
                {approachSteps.map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-4 relative z-10 shadow-sm">
                      <span className="font-bold text-accent text-lg">{step.step}</span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Mobile Timeline */}
          <div className="md:hidden space-y-5">
            {approachSteps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="font-bold text-accent">{step.step}</span>
                  </div>
                  {index < approachSteps.length - 1 && (
                    <div className="w-px h-full bg-border mt-2" />
                  )}
                </div>
                <div className="pb-5">
                  <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Confiance & Conformité */}
      <section className="section-padding">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="bg-primary border border-border rounded-2xl p-8 md:p-10">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-1">
                  La sécurité fait partie du service
                </h2>
                <p className="text-slate-500 text-sm">
                  Vos données sont protégées à chaque étape.
                </p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 text-sm">
                  Nous ne demandons <strong>jamais</strong> de NAS ni de numéros de carte de crédit par courriel.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 text-sm">
                  Les informations sensibles doivent être transmises uniquement via les canaux sécurisés.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 text-sm">
                  Accès au portail selon les rôles, avec permissions contrôlées.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <p className="text-slate-600 text-sm">
                  Pratiques alignées avec les principes de protection des renseignements personnels au Canada.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 text-accent text-xs font-medium">
                <Lock className="w-3 h-3" /> Chiffrement SSL
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 text-accent text-xs font-medium">
                <Users className="w-3 h-3" /> Accès contrôlé
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 text-accent text-xs font-medium">
                <Shield className="w-3 h-3" /> Bonnes pratiques
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Notre présence */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-4">
                Couverture nationale, focus Québec
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Nous desservons l'ensemble du Canada, avec une présence opérationnelle forte au Québec. 
                Notre support est basé au Canada et connaît les réalités locales du marché.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Québec
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Ontario
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Canada
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl bg-primary border border-border overflow-hidden flex items-center justify-center">
                <div className="text-center p-8">
                  <MapPin className="w-12 h-12 text-accent/30 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Couverture nationale</p>
                  <p className="text-xs text-slate-400 mt-1">Focus Québec</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact-about" className="section-padding">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <h2 className="mb-4">
                  Nous contacter
                </h2>
                <p className="text-muted-foreground mb-6">
                  Notre équipe est disponible pour répondre à vos questions.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Adresse</p>
                      <p className="text-sm text-muted-foreground">{address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Téléphone</p>
                      <a href={`tel:${supportPhone.replace(/[^+\d]/g, '')}`} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                        {supportPhone}
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Courriel</p>
                      <a href={`mailto:${supportEmail.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                        {supportEmail}
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Heures de support</p>
                      <p className="text-sm text-muted-foreground">{businessHours}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col justify-center">
                <div className="bg-muted/50 rounded-2xl p-6 border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Besoin d'aide?</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Ouvrez un ticket de support ou contactez-nous directement.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link to="/portal/auth" className="flex-1">
                      <Button variant="accent" className="w-full">
                        <Headphones className="w-4 h-4 mr-2" />
                        Ouvrir un ticket
                      </Button>
                    </Link>
                    <Link to="/#contact" className="flex-1">
                      <Button variant="outline" className="w-full">
                        Nous joindre
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="mb-3">
              Questions fréquentes
            </h2>
            <p className="text-muted-foreground">
              Tout ce que vous devez savoir sur Nivra.
            </p>
          </div>
          
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card border border-border rounded-2xl px-6 data-[state=open]:border-accent/30"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-5">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;