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
      title: "Services généraux",
      questions: [
        {
          q: "Qu'est-ce qu'un courtier télécom?",
          a: "Un courtier télécom est un intermédiaire indépendant qui compare et négocie les offres de plusieurs fournisseurs de télécommunications pour vous obtenir les meilleures conditions. Contrairement à un vendeur de fournisseur, nous travaillons pour vous, pas pour les compagnies.",
        },
        {
          q: "Les services de Nivra sont-ils gratuits?",
          a: "Oui, nos services de consultation et de négociation sont entièrement gratuits pour les particuliers. Nous sommes rémunérés par les fournisseurs sous forme de commission, ce qui n'affecte pas le prix que vous payez.",
        },
        {
          q: "Avec quels fournisseurs travaillez-vous?",
          a: "Nous travaillons avec tous les grands fournisseurs au Québec : Bell, Vidéotron, Rogers, Telus, Fizz, Virgin, Koodo, et plusieurs autres. Cela nous permet de vous offrir un choix complet et impartial.",
        },
        {
          q: "Combien de temps prend le processus?",
          a: "En général, nous pouvons vous proposer une offre personnalisée en 24 à 48 heures après notre première consultation. Le changement de fournisseur lui-même peut prendre de 1 à 2 semaines selon les cas.",
        },
      ],
    },
    {
      title: "Téléphonie mobile",
      questions: [
        {
          q: "Puis-je garder mon numéro de téléphone actuel?",
          a: "Absolument! La portabilité du numéro est un droit protégé par le CRTC. Nous nous occupons de tout le processus de transfert de votre numéro vers votre nouveau fournisseur.",
        },
        {
          q: "Que se passe-t-il avec mon téléphone actuel?",
          a: "Si votre téléphone est déverrouillé, vous pouvez le garder avec n'importe quel fournisseur. S'il est verrouillé, nous pouvons vous aider à le faire déverrouiller ou vous proposer des offres avec un nouvel appareil.",
        },
        {
          q: "Y a-t-il des frais de résiliation avec mon fournisseur actuel?",
          a: "Cela dépend de votre contrat actuel. Nous analysons votre situation et calculons si les économies réalisées compensent les frais de résiliation éventuels.",
        },
      ],
    },
    {
      title: "Internet et télévision",
      questions: [
        {
          q: "Quelle vitesse Internet me recommandez-vous?",
          a: "Cela dépend de votre utilisation. Pour un usage basique (navigation, streaming HD), 50-100 Mbps suffisent. Pour le télétravail, gaming ou streaming 4K, nous recommandons 300 Mbps ou plus.",
        },
        {
          q: "Puis-je avoir Internet et TV de fournisseurs différents?",
          a: "Oui, c'est tout à fait possible. Parfois, combiner les services d'un seul fournisseur offre des rabais, mais pas toujours. Nous analysons toutes les options pour vous.",
        },
        {
          q: "L'installation est-elle incluse?",
          a: "La plupart des fournisseurs offrent l'installation gratuite ou à prix réduit. Nous négocions toujours pour inclure l'installation dans votre forfait.",
        },
      ],
    },
    {
      title: "Entreprises",
      questions: [
        {
          q: "Offrez-vous des services aux entreprises?",
          a: "Oui! Nous avons une équipe dédiée aux entreprises qui peut gérer des flottes de lignes mobiles, des connexions Internet dédiées, des systèmes téléphoniques VoIP et plus encore.",
        },
        {
          q: "Pouvez-vous gérer plusieurs succursales?",
          a: "Absolument. Nous pouvons coordonner les services pour plusieurs emplacements et négocier des tarifs de volume avantageux pour votre entreprise.",
        },
        {
          q: "Offrez-vous un support continu?",
          a: "Oui, nous restons votre point de contact unique pour tous vos besoins télécoms. Pas besoin d'appeler le fournisseur directement - nous gérons tout pour vous.",
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
