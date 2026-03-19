import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

const PrivacyPolicyPage = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  return (
    <div className="min-h-screen public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {isFrench ? 'Politique de confidentialité' : 'Privacy Policy'}
          </h1>
          
          <p className="text-muted-foreground mb-8">
            {isFrench ? 'Dernière mise à jour : 2025-01-07' : 'Last updated: 2025-01-07'}
          </p>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            {isFrench ? (
              <>
                <section className="space-y-4">
                  <p className="text-lg font-medium text-foreground">
                    <strong>Date d'entrée en vigueur :</strong> 2026-01-07
                  </p>
                  <p>
                    <strong>Responsable de la protection des renseignements personnels :</strong> Nivra Communication –{" "}
                    <a href="mailto:support@nivra-telecom.ca" className="text-primary hover:underline">
                      support@nivra-telecom.ca
                    </a>
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.1 Cadre</h2>
                  <p>
                    Nivra Telecom protège les renseignements personnels conformément aux lois applicables.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.2 Renseignements que nous collectons</h2>
                  <p>Selon les services, nous pouvons collecter :</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Identité et contact :</strong> prénom, nom, téléphone, courriel, adresse</li>
                    <li><strong>Informations d'admissibilité/compte :</strong> date de naissance (si requise), informations de vérification (si applicable), identifiants de connexion</li>
                    <li><strong>Service & support :</strong> choix de forfait, historique de commandes, tickets, communications</li>
                    <li><strong>Données techniques :</strong> IP, identifiants d'appareil, journaux de sécurité, cookies</li>
                    <li><strong>Paiement :</strong> Nivra ne stocke pas les numéros complets de carte; le traitement est effectué par des fournisseurs de paiement. Nous pouvons conserver des identifiants de transaction et statuts.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.3 Finalités</h2>
                  <p>Nous utilisons ces informations pour :</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>fournir et gérer les services (activation, installation, support)</li>
                    <li>facturation, paiements, prévention de fraude et sécurité</li>
                    <li>communications opérationnelles (confirmation, avis de paiement, rendez-vous)</li>
                    <li>respecter nos obligations légales et gérer les litiges</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.4 Consentement</h2>
                  <p>
                    En utilisant nos services et en nous fournissant des informations, tu consens à leur utilisation selon cette politique. Tu peux retirer ton consentement dans certaines situations, sous réserve des obligations légales et des impacts sur la prestation du service.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.5 Partage et divulgation</h2>
                  <p>
                    Nous pouvons partager des renseignements avec des fournisseurs nécessaires (paiement, hébergement, emailing, support, etc.) et lorsque requis par la loi. Nous ne vendons pas les renseignements personnels.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.6 Conservation</h2>
                  <p>
                    Nous conservons les renseignements uniquement pour la durée nécessaire aux finalités décrites, puis les supprimons ou anonymisons selon nos obligations.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.7 Sécurité</h2>
                  <p>
                    Nous appliquons des mesures administratives, techniques et physiques raisonnables. Aucune méthode n'étant parfaite, un risque résiduel existe.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.8 Cookies</h2>
                  <p>
                    Le site peut utiliser des cookies essentiels et de performance/mesure. Tu peux gérer tes préférences via ton navigateur et, si disponible, via notre bannière de consentement.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.9 Tes droits</h2>
                  <p>
                    Tu peux demander l'accès, la correction, et la suppression lorsque applicable. Pour exercer tes droits :{" "}
                    <a href="mailto:support@nivra-telecom.ca" className="text-primary hover:underline">
                      support@nivra-telecom.ca
                    </a>.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.10 Plaintes</h2>
                  <p>
                    Pour toute plainte, contacte notre responsable de la protection des renseignements personnels.
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="space-y-4">
                  <p className="text-lg font-medium text-foreground">
                    <strong>Effective Date:</strong> 2026-01-07
                  </p>
                  <p>
                    <strong>Personal Information Protection Officer:</strong> Nivra Communication –{" "}
                    <a href="mailto:support@nivra-telecom.ca" className="text-primary hover:underline">
                      support@nivra-telecom.ca
                    </a>
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.1 Framework</h2>
                  <p>
                    Nivra Telecom protects personal information in accordance with applicable laws.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.2 Information We Collect</h2>
                  <p>Depending on the services, we may collect:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Identity and contact:</strong> first name, last name, phone, email, address</li>
                    <li><strong>Eligibility/account information:</strong> date of birth (if required), verification information (if applicable), login credentials</li>
                    <li><strong>Service & support:</strong> plan selection, order history, tickets, communications</li>
                    <li><strong>Technical data:</strong> IP, device identifiers, security logs, cookies</li>
                    <li><strong>Payment:</strong> Nivra does not store full card numbers; processing is done by payment providers. We may retain transaction identifiers and statuses.</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.3 Purposes</h2>
                  <p>We use this information to:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>provide and manage services (activation, installation, support)</li>
                    <li>billing, payments, fraud prevention and security</li>
                    <li>operational communications (confirmation, payment notices, appointments)</li>
                    <li>comply with our legal obligations and manage disputes</li>
                  </ul>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.4 Consent</h2>
                  <p>
                    By using our services and providing us with information, you consent to their use according to this policy. You may withdraw your consent in certain situations, subject to legal obligations and impacts on service delivery.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.5 Sharing and Disclosure</h2>
                  <p>
                    We may share information with necessary providers (payment, hosting, emailing, support, etc.) and when required by law. We do not sell personal information.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.6 Retention</h2>
                  <p>
                    We retain information only for the duration necessary for the purposes described, then delete or anonymize it according to our obligations.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.7 Security</h2>
                  <p>
                    We apply reasonable administrative, technical and physical measures. Since no method is perfect, residual risk exists.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.8 Cookies</h2>
                  <p>
                    The site may use essential and performance/measurement cookies. You can manage your preferences through your browser and, if available, through our consent banner.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.9 Your Rights</h2>
                  <p>
                    You may request access, correction, and deletion where applicable. To exercise your rights:{" "}
                    <a href="mailto:support@nivra-telecom.ca" className="text-primary hover:underline">
                      support@nivra-telecom.ca
                    </a>.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">2.10 Complaints</h2>
                  <p>
                    For any complaint, contact our Personal Information Protection Officer.
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

export default PrivacyPolicyPage;
