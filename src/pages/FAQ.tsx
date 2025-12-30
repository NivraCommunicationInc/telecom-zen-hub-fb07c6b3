import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";

const FAQ = () => {
  const categories = [
    {
      title: "À propos de Nivra",
      questions: [
        {
          q: "Qu'est-ce que Nivra?",
          a: "Nivra est un courtier télécom entièrement indépendant basé au Québec. Nous conseillons les particuliers et les entreprises sur leurs besoins en télécommunications sans représenter aucun fournisseur.",
        },
        {
          q: "Travaillez-vous avec les fournisseurs de télécommunications?",
          a: "Non. Nivra n'a aucune affiliation, partenariat ou entente commerciale avec les compagnies de télécommunications comme Bell, Rogers, TELUS ou autres. Nous ne recevons aucune rémunération de leur part.",
        },
        {
          q: "Comment Nivra est-il rémunéré?",
          a: "Nivra est payé exclusivement par ses clients, soit par des frais de consultation ponctuels, soit par des abonnements mensuels. Cette indépendance totale garantit des conseils 100% objectifs.",
        },
        {
          q: "Quelles régions desservez-vous?",
          a: "Pour le moment, Nivra offre ses services uniquement au Québec. Nous prévoyons élargir notre couverture dans le futur.",
        },
      ],
    },
    {
      title: "Consultations et rendez-vous",
      questions: [
        {
          q: "Offrez-vous une consultation gratuite?",
          a: "Oui! Nous offrons une première consultation téléphonique gratuite de 30 minutes pour évaluer vos besoins et vous expliquer comment nous pouvons vous aider.",
        },
        {
          q: "Comment prendre rendez-vous?",
          a: "Vous pouvez réserver directement via notre calendrier intégré sur la page de prise de rendez-vous. Tout se fait en ligne, sans quitter notre site.",
        },
        {
          q: "Proposez-vous des rabais ou promotions?",
          a: "Nivra identifie uniquement les avantages employeur auxquels vous pourriez avoir droit. Nous ne faisons pas la promotion d'offres de fournisseurs et ne négocions pas de rabais de leur part.",
        },
      ],
    },
    {
      title: "Paiements et facturation",
      questions: [
        {
          q: "Comment puis-je voir mes factures et paiements?",
          a: "Toutes vos factures, paiements et crédits sont visibles en temps réel dans votre portail client. L'administrateur voit également les mêmes informations de son côté.",
        },
        {
          q: "Qu'arrive-t-il si je paie en retard?",
          a: "Des frais de retard de 5% sont automatiquement ajoutés aux factures en souffrance. Le montant total incluant les frais est clairement affiché avant de confirmer votre paiement.",
        },
        {
          q: "Comment fonctionnent les crédits?",
          a: "Les crédits sont appliqués automatiquement à vos prochaines factures. Votre solde de crédits est visible dans votre portail client et se met à jour instantanément.",
        },
      ],
    },
    {
      title: "Sécurité et confidentialité",
      questions: [
        {
          q: "Mes données sont-elles protégées?",
          a: "Absolument. Vos informations personnelles et de compte sont strictement privées. Aucun accès public n'est possible et chaque client ne voit que ses propres données.",
        },
        {
          q: "Comment accéder à mon compte client?",
          a: "Connectez-vous via le portail client sécurisé. Votre compte affiche vos factures, commandes, abonnements, contrats et historique de paiements.",
        },
        {
          q: "Qui peut voir mes informations?",
          a: "Seuls vous et les administrateurs autorisés de Nivra peuvent accéder à vos données. Aucune information n'est partagée avec des tiers ou des fournisseurs de télécommunications.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Foire aux <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">questions</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Trouvez rapidement des réponses à vos questions les plus fréquentes sur nos services.
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          {categories.map((category) => (
            <div key={category.title} className="mb-12">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6">{category.title}</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {category.questions.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`${category.title}-${index}`}
                    className="bg-card border border-border rounded-xl px-6"
                  >
                    <AccordionTrigger className="text-left font-medium text-foreground hover:text-cyan-400 py-4">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-4">
            Vous n'avez pas trouvé votre réponse?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Notre équipe est disponible pour répondre à toutes vos questions et vous accompagner dans vos démarches.
          </p>
          <Link to="/#contact">
            <Button variant="hero" size="lg">
              Nous contacter
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;
