/**
 * Politique d'accessibilité — Public legal page
 * Route: /accessibilite
 * Conforme à la Loi 25 et aux normes WCAG 2.1 AA.
 */
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Accessibility, Eye, Keyboard, Volume2, Mail } from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";

export default function PolitiqueAccessibilite() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Politique d'accessibilité | Nivra Telecom"
        description="Nivra Telecom s'engage à rendre ses services accessibles à toutes et à tous, conformément à la Loi 25 et aux normes WCAG 2.1 AA."
        canonical="https://nivra-telecom.ca/accessibilite"
      />
      <Header />

      <main id="main-content" tabIndex={-1} className="container mx-auto max-w-4xl px-4 py-12">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4">
            <Accessibility className="h-4 w-4" />
            ACCESSIBILITÉ NUMÉRIQUE
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Politique d'accessibilité
          </h1>
          <p className="text-lg text-muted-foreground">
            Nivra Telecom s'engage à offrir une expérience numérique inclusive, conforme aux normes
            WCAG 2.1 niveau AA et aux obligations de la Loi 25 (Québec).
          </p>
        </header>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Notre engagement</h2>
          <p className="text-muted-foreground mb-4">
            Nous travaillons à ce que toutes les personnes — y compris celles vivant avec un handicap
            visuel, auditif, moteur ou cognitif — puissent utiliser notre site web, notre portail
            client et nos services télécoms sans obstacle injustifié.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-6">Mesures mises en place</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <Eye className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Contraste &amp; lisibilité</h3>
              <p className="text-sm text-muted-foreground">
                Contraste minimum 4,5:1 pour le texte, tailles ajustables, sans dépendance unique à
                la couleur pour transmettre l'information.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <Keyboard className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Navigation clavier</h3>
              <p className="text-sm text-muted-foreground">
                Tous les éléments interactifs sont accessibles au clavier (Tab, Entrée, Échap), avec
                un indicateur de focus visible.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <Volume2 className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Lecteurs d'écran</h3>
              <p className="text-sm text-muted-foreground">
                Compatibilité testée avec NVDA, JAWS et VoiceOver. Texte alternatif pour les images,
                rôles ARIA, structure sémantique HTML5.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <Accessibility className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Formulaires accessibles</h3>
              <p className="text-sm text-muted-foreground">
                Étiquettes explicites, messages d'erreur descriptifs, validation non bloquante,
                aucune limite de temps non ajustable.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Normes de référence</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>WCAG 2.1 niveau AA</strong> — Recommandations internationales pour l'accessibilité
              du contenu web (W3C).
            </li>
            <li>
              <strong>Loi 25 (Québec)</strong> — Loi modernisant des dispositions législatives en
              matière de protection des renseignements personnels.
            </li>
            <li>
              <strong>Code des services sans fil du CRTC</strong> — Obligations d'accessibilité pour
              les fournisseurs de services de télécommunication canadiens.
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Limites connues</h2>
          <p className="text-muted-foreground mb-4">
            Malgré nos efforts, certains contenus peuvent présenter des limites d'accessibilité,
            notamment :
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Documents PDF historiques non encore re-numérisés.</li>
            <li>Certaines vidéos sans transcription textuelle (en cours d'ajout).</li>
            <li>Composants tiers (carte de couverture interactive) non entièrement conformes WCAG.</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Nous travaillons activement à corriger ces écarts.
          </p>
        </section>

        <section className="mb-10 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <Mail className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold mb-2">Signaler un problème d'accessibilité</h2>
              <p className="text-muted-foreground mb-3">
                Si vous rencontrez un obstacle, dites-le-nous. Nous nous engageons à vous répondre
                dans un délai maximum de 5 jours ouvrables et à proposer une solution équivalente
                lorsque c'est possible.
              </p>
              <p className="text-sm">
                <a
                  href={`mailto:${COMPANY_CONTACT.supportEmail}?subject=Probl%C3%A8me%20d%27accessibilit%C3%A9`}
                  className="font-medium text-primary hover:underline"
                >
                  {COMPANY_CONTACT.supportEmail}
                </a>
              </p>
            </div>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </main>

      <Footer />
    </div>
  );
}
