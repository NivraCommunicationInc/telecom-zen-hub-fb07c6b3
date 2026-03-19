import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { 
  MessageSquare, 
  Mail, 
  HelpCircle,
  Smartphone,
  Wifi,
  Tv,
  CreditCard,
  Clock,
  Shield
} from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Aide = () => {
  const { data: siteSettings } = useSiteSettings();
  
  // Use site_settings as source of truth, COMPANY_CONTACT as fallback
  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;
  const faqItems = [
    {
      icon: Smartphone,
      question: "Comment activer ma carte SIM ou eSIM?",
      answer: "Après réception de votre SIM, insérez-la dans votre appareil. L'activation est automatique après confirmation du paiement. Pour l'eSIM, vous recevrez un code QR par courriel à scanner dans les paramètres de votre téléphone. Délai habituel : quelques minutes à quelques heures."
    },
    {
      icon: Smartphone,
      question: "Comment transférer (porter) mon numéro existant?",
      answer: "Lors de la commande, indiquez que vous souhaitez conserver votre numéro. Vous devrez fournir : votre numéro actuel, le nom de votre fournisseur actuel, et votre NIP/PIN de portage (si requis par votre ancien fournisseur). Le transfert prend généralement 1-3 jours ouvrables."
    },
    {
      icon: Smartphone,
      question: "Quels sont les paramètres APN pour la data mobile?",
      answer: "Les paramètres APN sont généralement configurés automatiquement. Si besoin : APN = sp.mb.com (ou fourni avec votre confirmation). Contactez le support si vous avez des difficultés de connexion data après 24h."
    },
    {
      icon: Clock,
      question: "Quels sont les délais d'activation?",
      answer: "Mobile : quelques minutes à quelques heures après paiement confirmé. Internet/TV : livraison 24-78h ouvrables (standard) ou installation selon rendez-vous. Ces délais sont des estimations et peuvent varier."
    },
    {
      icon: Wifi,
      question: "Pourquoi ma vitesse Internet est différente de celle annoncée?",
      answer: "Les vitesses sont annoncées « jusqu'à » (maximum théorique). La vitesse réelle dépend de plusieurs facteurs : congestion réseau, qualité du Wi-Fi, câblage interne, distance du routeur, nombre d'appareils connectés. Pour optimiser : utilisez une connexion filaire, placez le routeur au centre du domicile."
    },
    {
      icon: Tv,
      question: "Comment fonctionnent les chaînes Free-Choice et Premium?",
      answer: "Tous les plans TV incluent les chaînes de base obligatoires (25-26 chaînes). Les chaînes Free-Choice sont incluses selon votre plan (vous choisissez lesquelles). Les chaînes Premium sont facturées en supplément. Vous pouvez modifier votre sélection via le portail — délai de traitement 2h à 24h."
    },
    {
      icon: CreditCard,
      question: "Qu'est-ce que le cycle de facturation (Bill Cycle)?",
      answer: "Votre cycle de facturation correspond au jour de création de votre compte. Si ce jour n'existe pas dans le mois (29-31), la facturation est au dernier jour du mois. Services prépayés : vous payez à l'avance pour le prochain cycle."
    },
    {
      icon: CreditCard,
      question: "Comment fonctionne le paiement par e-Transfer?",
      answer: "Envoyez le montant exact à l'adresse indiquée sur votre facture. Utilisez la question/réponse de sécurité fournie. Statuts : En attente → En vérification → Complété. L'activation se fait après vérification (généralement quelques heures, max 24h ouvrables)."
    },
    {
      icon: MessageSquare,
      question: "Comment ouvrir un ticket de support?",
      answer: "Connectez-vous au portail client et allez dans la section « Tickets ». Créez un nouveau ticket avec le sujet approprié. Vous recevrez des mises à jour par courriel. Note : les tickets sans réponse peuvent être fermés après 7 jours — vous pouvez demander la réouverture."
    },
    {
      icon: Shield,
      question: "Puis-je annuler mon service à tout moment?",
      answer: "Oui, les services sont sans engagement. Annulez via le portail ou en contactant le support. Le service reste actif jusqu'à la fin du cycle payé. L'équipement Nivra doit être retourné dans les 14 jours. Les frais de retour sont à votre charge."
    },
  ];

  return (
    <div className="min-h-screen public-light" >
      <Header />
      
      {/* Hero */}
      <section className="pt-28 pb-16 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/25 mb-5">
            <HelpCircle className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Centre d'aide</span>
          </div>
          <h1 className="text-slate-900 mb-4">
            Foire aux <span className="text-accent">questions</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Trouvez rapidement des réponses à vos questions sur nos services.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 52C120 44 240 28 360 24C480 20 600 28 720 32C840 36 960 36 1080 32C1200 28 1320 20 1380 16L1440 12V60H0Z" fill="hsl(var(--background))"/>
          </svg>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="bg-card border border-border rounded-xl px-6"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:text-accent py-4">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-accent flex-shrink-0" />
                    <span>{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 pl-8">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="mb-3">Besoin d'aide supplémentaire?</h2>
            <p className="text-muted-foreground">
              Notre équipe est disponible pour vous aider.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Portail client</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Ouvrez un ticket pour un suivi structuré.
                </p>
                <Link to="/portal/auth">
                  <Button variant="outline" size="sm">Accéder au portail</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Courriel</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {supportEmail}
                </p>
                <a href={`mailto:${supportEmail.toLowerCase()}`}>
                  <Button variant="outline" size="sm">Envoyer un courriel</Button>
                </a>
              </CardContent>
            </Card>

            <Card className="bg-card border-border text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Heures</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {businessHours}
                </p>
                <Link to="/contact">
                  <Button variant="outline" size="sm">Nous joindre</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

        </div>
      </section>

      {/* Links */}
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/conditions-de-service" className="text-primary hover:underline text-sm">
              Conditions de service
            </Link>
            <Link to="/frais-possibles" className="text-primary hover:underline text-sm">
              Frais possibles
            </Link>
            <Link to="/support-et-plaintes" className="text-primary hover:underline text-sm">
              Support et plaintes
            </Link>
            <Link to="/confidentialite-loi25" className="text-primary hover:underline text-sm">
              Confidentialité
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Aide;
