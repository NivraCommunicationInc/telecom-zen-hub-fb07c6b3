import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY_CONTACT } from "@/config/company";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

const ConformiteCRTC = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={isFr ? "Conformité réglementaire — Nivra Telecom" : "Regulatory Compliance — Nivra Telecom"}
        description={isFr
          ? "Nivra Telecom opère en conformité avec les règlements du CRTC, le Code des FSI et la Loi 25."
          : "Nivra Telecom operates in compliance with CRTC regulations, ISP Code and Law 25."
        }
      />
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {isFr ? "Conformité réglementaire" : "Regulatory Compliance"}
          </h1>

          <p className="text-muted-foreground mb-8">
            {isFr ? "Dernière mise à jour : 13 avril 2025" : "Last updated: April 13, 2025"}
          </p>

          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            {isFr ? (
              <>
                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    CRTC — Conseil de la radiodiffusion et des télécommunications canadiennes
                  </h2>
                  <p>
                    {COMPANY_CONTACT.legalName} opère en conformité avec les règlements du CRTC. Nos services
                    respectent le Code sur les services sans fil et le Code des fournisseurs de services Internet du Canada.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    Code des FSI — Vos droits
                  </h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Contrat clair et simplifié en langage accessible</li>
                    <li>Résiliation sans frais excessifs</li>
                    <li>Notification 30 jours avant tout changement de prix</li>
                    <li>Accès à un processus de résolution de plaintes</li>
                    <li>Protection contre les pratiques déloyales</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    Gestion du réseau
                  </h2>
                  <p>
                    {COMPANY_CONTACT.legalName} pratique une gestion transparente du réseau. Nous ne bloquons,
                    ne ralentissons et ne priorisons aucun type de trafic Internet (neutralité du Net).
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    Processus de plaintes
                  </h2>
                  <p>
                    Si vous avez une plainte non résolue, vous pouvez contacter le{" "}
                    <a
                      href="https://www.ccts-cprst.ca/fr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Commissaire aux plaintes relatives aux services de télécommunications (CPRST)
                    </a>{" "}
                    — un organisme indépendant gratuit pour les consommateurs.
                  </p>
                  <p>
                    Vous pouvez aussi nous contacter directement via notre{" "}
                    <Link to="/support-et-plaintes" className="text-primary hover:underline">
                      processus de plaintes interne
                    </Link>.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    LPRPDE / Loi 25
                  </h2>
                  <p>
                    Nous respectons la Loi sur la protection des renseignements personnels et les documents
                    électroniques (LPRPDE) au niveau fédéral et la{" "}
                    <Link to="/politique-de-confidentialite" className="text-primary hover:underline">
                      Loi 25
                    </Link>{" "}
                    au niveau provincial. Voir notre{" "}
                    <Link to="/privacy-policy" className="text-primary hover:underline">
                      Politique de confidentialité
                    </Link>.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    Contact réglementaire
                  </h2>
                  <p>
                    Pour toute question relative à la conformité :{" "}
                    <a href={`mailto:legal@nivra-telecom.ca`} className="text-primary hover:underline">
                      legal@nivra-telecom.ca
                    </a>
                  </p>
                </section>

                <section className="pt-4">
                  <p className="text-sm">
                    <Link to="/conditions-de-service" className="text-primary hover:underline">
                      ← Retour aux Conditions de service
                    </Link>
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    CRTC — Canadian Radio-television and Telecommunications Commission
                  </h2>
                  <p>
                    {COMPANY_CONTACT.legalName} operates in compliance with CRTC regulations. Our services
                    adhere to the Wireless Code and the Internet Service Provider Code of Canada.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    ISP Code — Your Rights
                  </h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Clear and simplified contract in accessible language</li>
                    <li>Cancellation without excessive fees</li>
                    <li>30-day notice before any price changes</li>
                    <li>Access to a complaint resolution process</li>
                    <li>Protection against unfair practices</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    Network Management
                  </h2>
                  <p>
                    {COMPANY_CONTACT.legalName} practices transparent network management. We do not block,
                    throttle or prioritize any type of Internet traffic (net neutrality).
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    Complaint Process
                  </h2>
                  <p>
                    If you have an unresolved complaint, you can contact the{" "}
                    <a
                      href="https://www.ccts-cprst.ca/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Commission for Complaints for Telecom-television Services (CCTS)
                    </a>{" "}
                    — a free independent organization for consumers.
                  </p>
                  <p>
                    You can also contact us directly through our{" "}
                    <Link to="/support-et-plaintes" className="text-primary hover:underline">
                      internal complaint process
                    </Link>.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    PIPEDA / Law 25
                  </h2>
                  <p>
                    We comply with the Personal Information Protection and Electronic Documents Act (PIPEDA)
                    at the federal level and{" "}
                    <Link to="/politique-de-confidentialite" className="text-primary hover:underline">
                      Law 25
                    </Link>{" "}
                    at the provincial level. See our{" "}
                    <Link to="/privacy-policy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    Regulatory Contact
                  </h2>
                  <p>
                    For any compliance questions:{" "}
                    <a href={`mailto:legal@nivra-telecom.ca`} className="text-primary hover:underline">
                      legal@nivra-telecom.ca
                    </a>
                  </p>
                </section>

                <section className="pt-4">
                  <p className="text-sm">
                    <Link to="/conditions-de-service" className="text-primary hover:underline">
                      ← Back to Terms of Service
                    </Link>
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ConformiteCRTC;
