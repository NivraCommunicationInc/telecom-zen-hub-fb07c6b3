/**
 * Sécurité & anti-fraude — Public information page
 * Route: /securite-anti-fraude
 * Conseils aux clients pour reconnaître et signaler les tentatives de fraude.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Mail, Phone, ExternalLink } from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";

export default function SecuriteAntiFraude() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Sécurité & anti-fraude | Nivra Telecom"
        description="Conseils pour reconnaître les fraudes par hameçonnage, SMS, appels frauduleux. Comment protéger votre compte Nivra Telecom et signaler une tentative."
        canonical="https://nivra-telecom.ca/securite-anti-fraude"
      />
      <Header />

      <main id="main-content" tabIndex={-1} className="container mx-auto max-w-4xl px-4 py-12">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-4">
            <Shield className="h-4 w-4" />
            SÉCURITÉ DU COMPTE
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Protégez-vous contre la fraude
          </h1>
          <p className="text-lg text-muted-foreground">
            Les fraudeurs imitent souvent les compagnies de télécom pour voler vos informations.
            Voici comment les reconnaître et nous signaler une tentative.
          </p>
        </header>

        <section className="mb-10 rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Ce que Nivra ne fait JAMAIS</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  Vous demander votre mot de passe par téléphone, courriel ou SMS.
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  Vous demander de payer en cartes-cadeaux, virement Interac vers un inconnu, ou cryptomonnaie.
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  Vous menacer de suspendre votre service dans les minutes qui suivent si vous ne payez pas immédiatement.
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  Vous demander d'installer un logiciel d'accès à distance (TeamViewer, AnyDesk, etc.).
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Comment reconnaître une fraude</h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-2">📧 Courriels frauduleux (hameçonnage)</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Adresse de l'expéditeur étrange (ex: <code className="text-xs">nivra@gmail.com</code> au lieu de <code className="text-xs">@nivra-telecom.ca</code>).</li>
                <li>• Liens vers des sites qui ressemblent à Nivra mais avec un domaine différent.</li>
                <li>• Fautes d'orthographe, ton menaçant, demande urgente.</li>
                <li>• Pièces jointes inattendues (PDF, .zip, .exe).</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-2">📱 SMS frauduleux (smishing)</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• « Votre compte sera fermé, cliquez ici… » suivi d'un lien raccourci.</li>
                <li>• « Vous avez gagné un téléphone gratuit, confirmez votre adresse… »</li>
                <li>• Numéro d'envoi inhabituel (5 chiffres ou international).</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-2">☎️ Appels frauduleux (vishing)</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• L'appelant prétend être de Nivra, Bell, Vidéotron, Telus ou même de l'ARC.</li>
                <li>• Il connaît votre nom mais demande des « confirmations » d'informations sensibles.</li>
                <li>• Pression pour agir immédiatement, refus de vous laisser rappeler.</li>
                <li>• Demande de paiement urgent ou de fournir un code de vérification.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Bonnes pratiques pour protéger votre compte</h2>
          <ul className="space-y-3">
            {[
              "Utilisez un mot de passe unique et fort (12+ caractères, majuscules, chiffres, symboles).",
              "Activez l'authentification à deux facteurs (2FA) dans votre portail client.",
              "Ne réutilisez jamais le mot de passe Nivra sur d'autres sites.",
              "Vérifiez l'URL avant de vous connecter : doit être nivra-telecom.ca (avec le tiret).",
              "Si vous recevez un appel suspect, raccrochez et rappelez le numéro officiel ci-dessous.",
              "Ne partagez jamais un code de vérification reçu par SMS — c'est lui qui ouvre votre compte.",
              "Mettez à jour vos appareils (téléphone, routeur, ordinateur) régulièrement.",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10 rounded-xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-2xl font-bold mb-4">Signaler une tentative de fraude</h2>
          <p className="text-muted-foreground mb-4">
            Si vous recevez un message ou un appel suspect prétendant venir de Nivra, signalez-le-nous
            immédiatement. Plus tôt nous sommes informés, plus vite nous pouvons protéger les autres
            clients.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={`mailto:${COMPANY_CONTACT.supportEmail}?subject=Signalement%20de%20fraude`}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 transition hover:border-primary"
            >
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Par courriel</div>
                <div className="text-sm font-semibold">{COMPANY_CONTACT.supportEmail}</div>
              </div>
            </a>
            <Link
              to="/plainte"
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-4 transition hover:border-primary"
            >
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Formulaire sécurisé</div>
                <div className="text-sm font-semibold">Déposer un signalement</div>
              </div>
            </Link>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-4">Ressources externes</h2>
          <ul className="space-y-2">
            <li>
              <a
                href="https://www.antifraudcentre-centreantifraude.ca/index-fra.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                Centre antifraude du Canada <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a
                href="https://www.ccts-cprst.ca/fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                CPRST — Commission des plaintes relatives aux services de télécom (CRTC) <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a
                href="https://www.opc.gouv.qc.ca/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                Office de la protection du consommateur du Québec <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          </ul>
        </section>

        <p className="text-xs text-muted-foreground">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </main>

      <Footer />
    </div>
  );
}
