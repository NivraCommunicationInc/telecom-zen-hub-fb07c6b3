import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, MapPin, ShieldCheck, Zap, Headphones, Wallet } from "lucide-react";
import SEO from "@/components/seo/SEO";
import SchemaMarkup from "@/components/seo/SchemaMarkup";

const FAQS = [
  {
    q: "Faut-il signer un contrat pour avoir Internet à Montréal avec Nivra?",
    a: "Non. Tous nos forfaits sont 100% sans contrat ni engagement. Vous payez mois par mois et pouvez annuler à tout moment, sans frais.",
  },
  {
    q: "Quelle vitesse offre le forfait Internet GIGA?",
    a: "Le forfait Internet GIGA offre jusqu'à 1 010 Mbps de vitesse réelle, idéal pour le streaming 4K, le télétravail et le gaming.",
  },
  {
    q: "Faites-vous une vérification de crédit?",
    a: "Aucune vérification de crédit n'est effectuée. Tout le monde est accepté chez Nivra Telecom.",
  },
  {
    q: "Quels sont les délais d'installation à Montréal?",
    a: "L'installation est généralement effectuée en 2 à 3 jours ouvrables après la confirmation de votre disponibilité.",
  },
  {
    q: "Quel est le prix mensuel?",
    a: "Le forfait Internet GIGA est à 60$/mois avant taxes. Aucun frais caché, aucune augmentation surprise.",
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

export default function InternetSansContrat() {
  return (
    <div style={{ background: '#020209' }} className="min-h-screen">
      <SEO
        title="Internet Sans Contrat à Montréal | 60$/mois | Nivra Telecom"
        description="Internet GIGA sans contrat à Montréal. 1 010 Mbps à 60$/mois. Sans engagement, sans vérification de crédit. Fournisseur local québécois. Annulez quand vous voulez."
        canonical="https://nivra-telecom.ca/internet-sans-contrat-montreal"
        keywords={[
          "internet sans contrat montréal",
          "internet prépayé montréal",
          "forfait internet prépayé québec",
          "internet pas cher montréal",
          "internet sans engagement québec",
        ]}
      />
      <SchemaMarkup includeBrand includeProducts extra={[FAQ_SCHEMA]} />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ paddingTop: 96, paddingBottom: 64, textAlign: 'center' }}>
          <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.22) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.10) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
          <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
          <div className="max-w-5xl mx-auto px-4 relative">
            <h1 className="n-animate-in" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(30px, 5vw, 56px)', letterSpacing: '-2px', lineHeight: 1.05, marginBottom: 16, color: '#fff' }}>
              Internet Sans Contrat à Montréal — <span className="n-shimmer-text">60$/mois</span>
            </h1>
            <p className="n-animate-in-delay-1" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 28px' }}>
              1 010 Mbps de vitesse réelle. Aucun engagement. Aucune vérification de crédit. Annulez quand vous voulez.
            </p>
            <Link to="/couverture" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
              Vérifier ma disponibilité
            </Link>
          </div>
        </section>

        {/* Why Nivra */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Pourquoi choisir Nivra à Montréal?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: ShieldCheck, title: "Aucun contrat", desc: "Liberté totale, annulez quand vous voulez." },
                { icon: Wallet, title: "Aucune vérification de crédit", desc: "Tout le monde est accepté." },
                { icon: Zap, title: "1 010 Mbps réels", desc: "Vitesse fibre optique, idéal 4K et gaming." },
                { icon: Headphones, title: "Support local québécois", desc: "Équipe à Montréal en français." },
                { icon: MapPin, title: "Prix fixe sans surprise", desc: "60$/mois garantis, jamais d'augmentation." },
                { icon: Check, title: "Installation rapide", desc: "Activation en 2 à 3 jours ouvrables." },
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

        {/* Comparison */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Nivra vs les grands fournisseurs</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-primary/10">
                    <th className="text-left p-4"></th>
                    <th className="p-4 text-primary font-bold">Nivra</th>
                    <th className="p-4">Fournisseur A</th>
                    <th className="p-4">Fournisseur B</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Prix/mois", "60$", "95-115$", "80-100$"],
                    ["Contrat", "Aucun", "24 mois", "24 mois"],
                    ["Vérification de crédit", "Non", "Oui", "Oui"],
                    ["Résiliation", "Gratuit", "200-400$", "200$"],
                    ["Support", "Local QC", "Centre externe", "Centre externe"],
                  ].map((row) => (
                    <tr key={row[0]} className="border-t">
                      <td className="p-4 font-medium">{row[0]}</td>
                      <td className="p-4 text-primary font-semibold">{row[1]}</td>
                      <td className="p-4 text-muted-foreground">{row[2]}</td>
                      <td className="p-4 text-muted-foreground">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Comment ça fonctionne?</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { n: 1, t: "Vérifiez disponibilité", d: "Entrez votre adresse à Montréal." },
                { n: 2, t: "Choisissez votre forfait", d: "Internet GIGA ou Bundle TV." },
                { n: 3, t: "Installation 2-3 jours", d: "Technicien certifié chez vous." },
                { n: 4, t: "Payez mois par mois", d: "Sans contrat, sans surprise." },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mx-auto mb-4">
                    {s.n}
                  </div>
                  <h3 className="font-semibold mb-2">{s.t}</h3>
                  <p className="text-sm text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 bg-muted/30">
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

        {/* Final CTA */}
        <section className="py-20 px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Prêt à libérer votre Internet?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Rejoignez les Montréalais qui ont changé pour Nivra.
          </p>
          <Button asChild size="lg" className="text-lg">
            <Link to="/forfaits">Commencer maintenant</Link>
          </Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
