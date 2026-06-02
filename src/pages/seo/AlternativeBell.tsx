import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X } from "lucide-react";
import SEO from "@/components/seo/SEO";
import SchemaMarkup from "@/components/seo/SchemaMarkup";

const FAQS = [
  {
    q: "Combien puis-je économiser en changeant de fournisseur?",
    a: "La plupart de nos clients économisent entre 25$ et 55$ par mois, soit 300$ à 660$ par année.",
  },
  {
    q: "Comment annuler mon contrat actuel?",
    a: "Vous devez contacter votre fournisseur actuel directement. Des frais de résiliation peuvent s'appliquer si vous êtes encore sous contrat. Nous pouvons vous aider à planifier la transition.",
  },
  {
    q: "La vitesse Internet Nivra est-elle comparable aux grands fournisseurs?",
    a: "Oui. Notre forfait GIGA offre 1 010 Mbps réels, équivalent ou supérieur aux forfaits standards des grands fournisseurs.",
  },
  {
    q: "Y a-t-il des frais cachés?",
    a: "Aucun. Le prix affiché est le prix payé (avant taxes). Pas de frais d'activation surprise, pas d'augmentation après 6 mois.",
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

export default function AlternativeBell() {
  const [currentBill, setCurrentBill] = useState<number>(95);
  const savings = Math.max(0, currentBill - 60);
  const yearly = savings * 12;

  return (
    <div style={{ background: '#020209' }} className="min-h-screen">
      <SEO
        title="La vraie alternative sans contrat au Québec | Nivra Telecom"
        description="Fatigué des contrats sans fin? Nivra Telecom offre Internet GIGA à 60$/mois sans contrat au Québec. Économisez jusqu'à 600$/an."
        canonical="https://nivra-telecom.ca/alternative-bell-videotron-quebec"
        keywords={[
          "alternative fournisseur internet québec",
          "internet sans contrat québec",
          "changer fournisseur internet québec",
          "internet moins cher québec",
          "fournisseur internet québec sans contrat",
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
              <span className="n-shimmer-text">La vraie alternative</span> sans contrat au Québec
            </h1>
            <p className="n-animate-in-delay-1" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 28px' }}>
              Internet GIGA à 60$/mois. Sans contrat. Sans vérification de crédit. Économisez jusqu'à 600$/an.
            </p>
            <Link to="/couverture" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
              Calculer mes économies
            </Link>
          </div>
        </section>

        {/* Savings calculator */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  Calculez vos économies
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bill">Combien payez-vous actuellement par mois? (CAD)</Label>
                    <Input
                      id="bill"
                      type="number"
                      min={0}
                      value={currentBill}
                      onChange={(e) => setCurrentBill(Number(e.target.value) || 0)}
                      className="text-lg mt-2"
                    />
                  </div>
                  <div className="bg-primary/10 rounded-lg p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Économies mensuelles
                    </p>
                    <p className="text-4xl font-bold text-primary mb-4">
                      {savings.toFixed(2)}$ / mois
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Économies annuelles
                    </p>
                    <p className="text-2xl font-bold">
                      {yearly.toFixed(2)}$ / an
                    </p>
                  </div>
                  <Button asChild size="lg" className="w-full">
                    <Link to="/forfaits">Voir les forfaits Nivra</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* What Nivra does differently */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Ce que Nivra fait différemment
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                ["Aucun contrat de 24 mois", "Les grands fournisseurs exigent 24 mois — Nivra: 0 mois."],
                ["Aucune vérification de crédit", "Pas de crédit requis, tout le monde accepté."],
                ["Prix fixe garanti", "Pas d'augmentation surprise après 6 mois."],
                ["Résiliation gratuite", "Pas de frais de 200-400$ comme chez les géants."],
                ["Support 100% québécois", "Notre équipe est à Montréal, pas dans un centre d'appels externe."],
                ["Activation rapide", "2-3 jours ouvrables — souvent plus rapide que la concurrence."],
              ].map(([t, d]) => (
                <Card key={t}>
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <Check className="h-6 w-6 text-primary shrink-0" />
                      <div>
                        <h3 className="font-semibold mb-1">{t}</h3>
                        <p className="text-sm text-muted-foreground">{d}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Detailed comparison */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Comparaison détaillée</h2>
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
                    ["Prix Internet GIGA", "60$", "95-115$", "80-100$"],
                    ["Contrat", "Aucun", "24 mois", "24 mois"],
                    ["Crédit requis", <X key="x1" className="inline h-5 w-5 text-primary" />, <Check key="c1" className="inline h-5 w-5" />, <Check key="c2" className="inline h-5 w-5" />],
                    ["Frais de résiliation", "0$", "200-400$", "200$"],
                    ["Frais d'installation", "Inclus", "100-150$", "100$"],
                    ["Support local QC", <Check key="c3" className="inline h-5 w-5 text-primary" />, <X key="x2" className="inline h-5 w-5" />, <X key="x3" className="inline h-5 w-5" />],
                  ].map((row, i) => (
                    <tr key={i} className="border-t">
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

        <section className="py-20 px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Faites le saut aujourd'hui
          </h2>
          <Button asChild size="lg" className="text-lg">
            <Link to="/forfaits">Voir les forfaits Nivra</Link>
          </Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
