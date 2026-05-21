import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ShieldCheck, Zap, Headphones, Wallet, Check } from "lucide-react";
import SEO from "@/components/seo/SEO";
import SchemaMarkup from "@/components/seo/SchemaMarkup";

const FAQS = [
  {
    q: "Nivra Telecom est-il disponible à Montréal-Nord?",
    a: "Oui. Nivra Telecom dessert l'ensemble du quartier Montréal-Nord. Vérifiez la disponibilité exacte à votre adresse sur notre page de couverture.",
  },
  {
    q: "Quels forfaits sont offerts à Montréal-Nord?",
    a: "Internet GIGA à 60$/mois et Bundle Internet + TV à 100$/mois. Aucun contrat, aucun engagement.",
  },
  {
    q: "Combien de temps pour l'installation à Montréal-Nord?",
    a: "L'installation est généralement effectuée en 2 à 3 jours ouvrables.",
  },
  {
    q: "Le support est-il offert en français?",
    a: "Oui, notre équipe est 100% bilingue (français/anglais) et basée au Québec.",
  },
];

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function InternetMontrealNord() {
  return (
    <div className="min-h-screen">
      <SEO
        title="Internet à Montréal-Nord | Sans Contrat | Nivra Telecom"
        description="Forfaits Internet et TV à Montréal-Nord. GIGA 60$/mois sans contrat. Disponible maintenant dans votre quartier."
        canonical="https://nivra-telecom.ca/internet-montreal-nord"
        keywords={[
          "internet montréal-nord",
          "internet sans contrat montréal-nord",
          "fournisseur internet montréal-nord",
          "internet pas cher montréal-nord",
        ]}
      />
      <SchemaMarkup includeBrand includeProducts extra={[FAQ_SCHEMA]} />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="bg-gradient-to-br from-primary/10 via-background to-background py-20 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Internet à <span className="text-primary">Montréal-Nord</span> — Sans Contrat
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              GIGA 940 Mbps à 60$/mois. Disponible maintenant dans votre quartier.
            </p>
            <Button asChild size="lg" className="text-lg">
              <Link to="/couverture">Vérifier ma disponibilité</Link>
            </Button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Pourquoi les résidents de Montréal-Nord choisissent Nivra
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: ShieldCheck, title: "Aucun contrat", desc: "Liberté totale." },
                { icon: Wallet, title: "Aucun crédit requis", desc: "Tout le monde accepté." },
                { icon: Zap, title: "940 Mbps réels", desc: "Vitesse fibre optique." },
                { icon: Headphones, title: "Support local QC", desc: "Équipe québécoise." },
                { icon: MapPin, title: "Couverture complète", desc: "Tout Montréal-Nord." },
                { icon: Check, title: "Installation 2-3 jours", desc: "Activation rapide." },
              ].map((item) => (
                <Card key={item.title}>
                  <CardContent className="pt-6">
                    <item.icon className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Carte de couverture Montréal-Nord</h2>
            <p className="text-muted-foreground mb-8">
              Vérifiez si votre adresse est desservie en quelques secondes.
            </p>
            <Button asChild size="lg">
              <Link to="/couverture">Voir la carte de couverture</Link>
            </Button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Questions fréquentes</h2>
            <div className="space-y-4">
              {FAQS.map((f) => (
                <Card key={f.q}>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-lg mb-2">{f.q}</h3>
                    <p className="text-muted-foreground">{f.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Commandez votre Internet Montréal-Nord
          </h2>
          <Button asChild size="lg" className="text-lg">
            <Link to="/forfaits">Voir les forfaits</Link>
          </Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
