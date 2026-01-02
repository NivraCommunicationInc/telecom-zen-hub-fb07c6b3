import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Users, 
  Shield, 
  FileText, 
  Headphones, 
  TrendingDown,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Lock,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  Search,
  Settings,
  Zap,
  BarChart3
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const About = () => {
  const { t } = useLanguage();

  const services = [
    {
      icon: Users,
      title: "Gestion de comptes & lignes",
      description: "Administration complète pour particuliers et PME. Ajout, modification et suivi de vos services télécom."
    },
    {
      icon: TrendingDown,
      title: "Optimisation de forfaits",
      description: "Analyse de votre consommation et recommandations pour réduire vos coûts sans compromettre la qualité."
    },
    {
      icon: Headphones,
      title: "Support, tickets & suivi",
      description: "Système de tickets avec SLA définis, suivi en temps réel et communication proactive sur l'avancement."
    },
    {
      icon: FileText,
      title: "Facturation & documents",
      description: "Accès à vos factures, historique de paiements et documents contractuels via votre portail sécurisé."
    }
  ];

  const trustPoints = [
    {
      icon: ClipboardCheck,
      title: "Processus clair et traçable",
      description: "Chaque demande génère un ticket avec statut, historique et notifications automatiques."
    },
    {
      icon: MessageSquare,
      title: "Communication proactive",
      description: "Confirmations à chaque étape, délais estimés et mises à jour régulières par courriel."
    },
    {
      icon: Lock,
      title: "Protection des données",
      description: "Accès contrôlé selon les rôles, chiffrement des données sensibles et conformité aux normes canadiennes."
    },
    {
      icon: MapPin,
      title: "Support basé au Canada",
      description: "Équipe locale disponible par téléphone, courriel et portail client sécurisé."
    }
  ];

  const approachSteps = [
    { step: "01", title: "Audit", description: "Analyse de vos besoins et services actuels" },
    { step: "02", title: "Recommandation", description: "Solutions personnalisées et devis détaillé" },
    { step: "03", title: "Activation", description: "Mise en place rapide et suivi de commande" },
    { step: "04", title: "Suivi continu", description: "Support dédié et optimisation régulière" }
  ];

  const faqItems = [
    {
      question: "Êtes-vous un fournisseur ou un service de gestion?",
      answer: "Nivra est un fournisseur de services télécom indépendant. Nous vendons directement nos propres services sans affiliation ni commission de la part des grands opérateurs. Vous êtes notre client, pas un produit."
    },
    {
      question: "Comment fonctionne le support?",
      answer: "Chaque demande crée un ticket avec un numéro de suivi. Vous recevez des notifications par courriel à chaque mise à jour. Notre équipe répond généralement sous 24h ouvrables, avec des SLA définis selon la priorité."
    },
    {
      question: "Quels sont les délais de traitement?",
      answer: "Les demandes simples (changement de forfait, ajout d'option) sont traitées sous 1-2 jours ouvrables. Les installations ou transferts peuvent prendre 5-10 jours selon la complexité et la disponibilité technique."
    },
    {
      question: "Comment protégez-vous mes informations?",
      answer: "Nous appliquons les principes de confidentialité conformes à la LPRPDE (PIPEDA). Vos données sont chiffrées, l'accès est contrôlé par rôles, et nous ne partageons jamais vos informations sans votre consentement explicite."
    },
    {
      question: "Puis-je gérer plusieurs comptes ou lignes?",
      answer: "Oui, votre portail client permet de gérer plusieurs comptes et lignes sous un même profil. Idéal pour les familles ou les petites entreprises avec plusieurs utilisateurs."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-navy-900 via-navy-800 to-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 mb-6">
              <Shield className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-medium text-teal-400">Fournisseur télécom canadien</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-foreground mb-6 leading-tight">
              À propos de <span className="text-teal-400">Nivra</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Services télécoms au Canada : gestion de comptes, optimisation et support. 
              Une expérience simple, transparente et fiable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/services">
                <Button variant="hero" size="lg" className="w-full sm:w-auto">
                  Voir nos services
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/#contact">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-border hover:bg-muted">
                  Contacter le support
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Notre Mission */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
                Notre mission
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Offrir aux Canadiens un accès simple et transparent aux services télécom, 
                sans les complications habituelles. Nous croyons qu'une bonne expérience client 
                commence par la clarté et se maintient par un support réactif.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Simplicité</strong> — Processus clairs, sans jargon ni étapes inutiles</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Transparence</strong> — Tarifs affichés, frais expliqués, aucune surprise</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Accompagnement</strong> — Support humain, suivi personnalisé, réponses rapides</span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-navy-800 to-navy-900 border border-border p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-400 flex items-center justify-center mx-auto mb-6">
                    <span className="font-display font-bold text-navy-900 text-5xl">N</span>
                  </div>
                  <p className="text-muted-foreground text-sm">Fournisseur indépendant depuis 2020</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ce que nous faisons */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Ce que nous faisons
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Des services télécom complets pour simplifier votre quotidien
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <div 
                key={index} 
                className="bg-card border border-border rounded-xl p-6 hover:border-teal-500/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mb-4">
                  <service.icon className="w-6 h-6 text-teal-500" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pourquoi nous choisir */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Pourquoi nous choisir
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Des engagements concrets pour une expérience fiable
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {trustPoints.map((point, index) => (
              <div 
                key={index} 
                className="flex gap-4 p-6 bg-card border border-border rounded-xl"
              >
                <div className="w-12 h-12 rounded-xl bg-navy-800 flex items-center justify-center flex-shrink-0">
                  <point.icon className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground mb-1">{point.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Notre approche - Timeline */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Notre approche
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Un processus structuré pour des résultats prévisibles
            </p>
          </div>
          
          {/* Desktop Timeline */}
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute top-8 left-0 right-0 h-0.5 bg-border" />
              <div className="grid grid-cols-4 gap-6 relative">
                {approachSteps.map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 rounded-full bg-navy-800 border-4 border-background flex items-center justify-center mx-auto mb-4 relative z-10">
                      <span className="font-display font-bold text-teal-400">{step.step}</span>
                    </div>
                    <h3 className="font-display font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Mobile Timeline */}
          <div className="md:hidden space-y-6">
            {approachSteps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-navy-800 flex items-center justify-center flex-shrink-0">
                    <span className="font-display font-bold text-teal-400 text-sm">{step.step}</span>
                  </div>
                  {index < approachSteps.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-2" />
                  )}
                </div>
                <div className="pb-6">
                  <h3 className="font-display font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Confiance & Conformité */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-navy-800 border border-border rounded-2xl p-8 md:p-12">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground mb-2">
                  Confiance & conformité
                </h2>
                <p className="text-muted-foreground">
                  Votre sécurité est notre priorité
                </p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                <p className="text-foreground text-sm">
                  Nous ne demandons <strong>jamais</strong> de NAS ni de numéros de carte de crédit par courriel.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                <p className="text-foreground text-sm">
                  Les informations sensibles doivent être transmises uniquement via les canaux sécurisés.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                <p className="text-foreground text-sm">
                  Accès au portail selon les rôles (client / employé / admin) avec permissions contrôlées.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                <p className="text-foreground text-sm">
                  Conformité aux principes de la LPRPDE pour la protection des renseignements personnels.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium">
                <Lock className="w-3 h-3" /> Chiffrement SSL
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium">
                <Shield className="w-3 h-3" /> Conforme LPRPDE
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium">
                <Users className="w-3 h-3" /> Accès contrôlé
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Notre présence */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
                Notre présence
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Nous desservons l'ensemble du Canada, avec une expertise particulière au Québec et en Ontario. 
                Notre équipe de support est basée au Canada et comprend les réalités locales du marché télécom.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-teal-500" /> Québec
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-teal-500" /> Ontario
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-teal-500" /> Canada
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl bg-navy-800 border border-border overflow-hidden flex items-center justify-center">
                <div className="text-center p-8">
                  <MapPin className="w-16 h-16 text-teal-500/30 mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">Couverture nationale</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Focus Québec & Ontario</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-6">
                  Nous contacter
                </h2>
                <p className="text-muted-foreground mb-8">
                  Notre équipe est disponible pour répondre à vos questions et vous accompagner.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Adresse</p>
                      <p className="text-sm text-muted-foreground">Montréal, Québec, Canada</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Téléphone</p>
                      <p className="text-sm text-muted-foreground">1-800-NIVRA (à venir)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Courriel</p>
                      <p className="text-sm text-muted-foreground">support@nivra.ca</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-teal-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Heures de support</p>
                      <p className="text-sm text-muted-foreground">Lun-Ven : 9h-18h (HE)</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col justify-center">
                <div className="bg-muted/50 rounded-xl p-6 border border-border">
                  <h3 className="font-display font-semibold text-foreground mb-4">Besoin d'aide?</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Ouvrez un ticket de support ou prenez rendez-vous avec un conseiller.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link to="/client/tickets" className="flex-1">
                      <Button variant="hero" className="w-full">
                        <Headphones className="w-4 h-4 mr-2" />
                        Ouvrir un ticket
                      </Button>
                    </Link>
                    <Link to="/book" className="flex-1">
                      <Button variant="outline" className="w-full border-border">
                        <Clock className="w-4 h-4 mr-2" />
                        Prendre rendez-vous
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
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground mb-4">
              Questions fréquentes
            </h2>
            <p className="text-lg text-muted-foreground">
              Tout ce que vous devez savoir sur Nivra
            </p>
          </div>
          
          <Accordion type="single" collapsible className="space-y-4">
            {faqItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-teal-500/30"
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
