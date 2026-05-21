import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Zap, Wallet, Calendar, Check } from "lucide-react";
import SEO from "@/components/seo/SEO";
import SchemaMarkup from "@/components/seo/SchemaMarkup";

const FAQS = [
  {
    q: "Qu'est-ce qu'un service Internet prépayé?",
    a: "Vous payez votre mois d'Internet à l'avance, sans contrat ni engagement. Vous gardez le service tant que vous payez et pouvez arrêter à tout moment.",
  },
  {
    q: "Pourquoi choisir le prépayé plutôt qu'un contrat?",
    a: "Aucun engagement, aucun frais de résiliation, aucune vérification de crédit, et pas d'augmentation surprise après 6 mois.",
  },
  {
    q: "Y a-t-il un dépôt à payer?",
    a: "Aucun dépôt requis. Vous payez simplement votre premier mois d'avance.",
  },
  {
    q: "Comment payer mon mois?",
    a: "Par carte de crédit, débit Interac ou PayPal — directement dans votre portail client.",
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

export default function InternetPrepaye() {
  return (
    <div className="min-h-screen">
      <SEO
        title="Internet Prépayé au Québec | Sans Contrat | Nivra Telecom"
        description="Le seul fournisseur Internet prépayé au Québec sans contrat. Payez mois par mois. Annulez quand vous voulez. 60$/mois."
        canonical="https://nivra-telecom.ca/internet-prepaye-quebec"
        keywords={[
          "internet prépayé québec",
          "internet prépayé montréal",
          "internet sans engagement",
          "internet mois par mois",
          "internet sans contrat québec",
        ]}
      />
      <SchemaMarkup includeBrand includeProducts extra={[FAQ_SCHEMA]} />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="bg-gradient-to-br from-primary/10 via-background to-background py-20 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Internet Prépayé au <span className="text-primary">Québec</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Payez mois par mois. Aucun contrat. Aucun engagement. Annulez quand vous voulez.
              60$/mois pour 940 Mbps.
            </p>
            <Button asChild size="lg" className="text-lg">
              <Link to="/couverture">Vérifier ma disponibilité</Link>
            </Button>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Pourquoi le prépayé Nivra?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Calendar, title: "Mois par mois", desc: "Payez seulement ce que vous utilisez." },
                { icon: ShieldCheck, title: "Aucun engagement", desc: "Annulez quand vous voulez." },
                { icon: Wallet, title: "Aucun crédit requis", desc: "Tout le monde accepté." },
                { icon: Zap, title: "940 Mbps réels", desc: "Vitesse fibre optique." },
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
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Comment fonctionne le prépayé?
            </h2>
            <div className="space-y-4">
              {[
                ["1. Vérifiez votre disponibilité", "Entrez votre adresse au Québec."],
                ["2. Choisissez votre forfait", "Internet GIGA à 60$/mois."],
                ["3. Payez votre premier mois", "Par carte, Interac ou PayPal."],
                ["4. Installation 2-3 jours", "Technicien certifié à votre porte."],
                ["5. Profitez de votre Internet", "Renouvelez chaque mois ou arrêtez quand vous voulez."],
              ].map(([t, d]) => (
                <Card key={t}>
                  <CardContent className="pt-6 flex gap-3">
                    <Check className="h-6 w-6 text-primary shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-1">{t}</h3>
                      <p className="text-sm text-muted-foreground">{d}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
            Commencez votre Internet prépayé maintenant
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
