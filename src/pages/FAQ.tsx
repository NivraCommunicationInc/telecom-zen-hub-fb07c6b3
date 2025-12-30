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
          a: "Un courtier télécom est un expert indépendant qui analyse vos besoins en télécommunications et vous conseille objectivement sur les meilleures options disponibles sur le marché. Contrairement aux vendeurs de fournisseurs, nous travaillons exclusivement pour vous et sommes payés directement par nos clients.",
        },
        {
          q: "Comment Nivra est-il rémunéré?",
          a: "Nivra facture ses clients directement selon un tarif fixe ou un abonnement, en fonction des services demandés. Nous ne recevons aucune commission, compensation ou rémunération de la part des fournisseurs de télécommunications. Cette indépendance totale nous permet de vous conseiller en toute objectivité.",
        },
        {
          q: "Travaillez-vous avec des fournisseurs comme Bell, Rogers ou TELUS?",
          a: "Non. Nivra ne représente, ne promeut et ne vend les services d'aucun fournisseur de télécommunications. Nous sommes entièrement indépendants et n'avons aucun accord, partenariat ou entente commerciale avec les compagnies de télécom. Notre rôle est de vous conseiller de manière impartiale.",
        },
        {
          q: "Combien coûtent vos services?",
          a: "Nos tarifs varient selon la complexité de vos besoins et le type de service demandé (consultation ponctuelle, accompagnement complet, abonnement mensuel). Contactez-nous pour obtenir un devis personnalisé adapté à votre situation.",
        },
      ],
    },
    {
      title: "Téléphonie mobile",
      questions: [
        {
          q: "Puis-je garder mon numéro de téléphone actuel?",
          a: "Absolument! La portabilité du numéro est un droit protégé par le CRTC. Nous pouvons vous guider dans le processus de transfert de votre numéro vers un nouveau fournisseur de votre choix.",
        },
        {
          q: "Que se passe-t-il avec mon téléphone actuel?",
          a: "Si votre téléphone est déverrouillé, vous pouvez le garder avec n'importe quel fournisseur. S'il est verrouillé, nous pouvons vous conseiller sur les démarches pour le faire déverrouiller.",
        },
        {
          q: "Comment évaluez-vous les offres du marché?",
          a: "Nous analysons objectivement les offres publiques de tous les fournisseurs selon vos critères : prix, couverture, données, appels, qualité du service client, etc. Notre indépendance nous permet de vous donner une recommandation impartiale.",
        },
      ],
    },
    {
      title: "Internet et télévision",
      questions: [
        {
          q: "Quelle vitesse Internet me recommandez-vous?",
          a: "Cela dépend de votre utilisation. Pour un usage basique (navigation, streaming HD), 50-100 Mbps suffisent. Pour le télétravail, gaming ou streaming 4K, nous recommandons 300 Mbps ou plus. Nous analysons vos besoins pour vous orienter vers la meilleure option.",
        },
        {
          q: "Puis-je avoir Internet et TV de fournisseurs différents?",
          a: "Oui, c'est tout à fait possible. Nous pouvons analyser si combiner les services ou les séparer est plus avantageux pour votre situation spécifique.",
        },
        {
          q: "Pouvez-vous m'aider à comparer les offres?",
          a: "C'est notre spécialité! Nous comparons objectivement toutes les offres disponibles selon vos critères et vous présentons les meilleures options avec leurs avantages et inconvénients.",
        },
      ],
    },
    {
      title: "Entreprises",
      questions: [
        {
          q: "Offrez-vous des services aux entreprises?",
          a: "Oui! Nous avons une équipe dédiée aux entreprises qui peut analyser vos besoins en téléphonie, Internet, et systèmes de communication. Nous vous conseillons sur les meilleures solutions adaptées à votre entreprise.",
        },
        {
          q: "Pouvez-vous gérer plusieurs succursales?",
          a: "Absolument. Nous pouvons analyser les besoins de plusieurs emplacements et vous conseiller sur les stratégies pour optimiser vos coûts de télécommunications à travers toute votre organisation.",
        },
        {
          q: "Offrez-vous un support continu?",
          a: "Oui, nous offrons des forfaits d'accompagnement continu pour les entreprises qui souhaitent avoir un conseiller télécom dédié. Vous bénéficiez de notre expertise pour toutes vos décisions télécom.",
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
