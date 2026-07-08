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
    a: "Par carte de crédit ou débit Interac — directement dans votre portail client.",
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
    <div style={{ background: '#020209' }} className="min-h-screen">
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
        <section className="relative overflow-hidden" style={{ paddingTop: 96, paddingBottom: 64, textAlign: 'center' }}>
          <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.22) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.10) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
          <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
          <div className="max-w-5xl mx-auto px-4 relative">
            <h1 className="n-animate-in" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(30px, 5vw, 56px)', letterSpacing: '-2px', lineHeight: 1.05, marginBottom: 16, color: '#fff' }}>
              Internet Prépayé au <span className="n-shimmer-text">Québec</span>
            </h1>
            <p className="n-animate-in-delay-1" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 28px' }}>
              Payez mois par mois. Aucun contrat. Aucun engagement. Annulez quand vous voulez. 60$/mois pour 1 010 Mbps.
            </p>
            <Link to="/couverture" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
              Vérifier ma disponibilité
            </Link>
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
                { icon: Zap, title: "1 010 Mbps réels", desc: "Vitesse fibre optique." },
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
                ["3. Payez votre premier mois", "Par carte ou Interac."],
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
