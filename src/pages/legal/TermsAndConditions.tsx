import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

const TermsAndConditions = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            {isFrench ? 'Termes et conditions' : 'Terms & Conditions'}
          </h1>
          
          <p className="text-muted-foreground mb-8">
            {isFrench ? 'Dernière mise à jour : 2025-01-07' : 'Last updated: 2025-01-07'}
          </p>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            {isFrench ? (
              <>
                <section className="space-y-4">
                  <p className="text-lg font-medium text-foreground">
                    <strong>Date d'entrée en vigueur :</strong> 2025-01-07
                  </p>
                  <p>
                    <strong>Entreprise :</strong> Nivra Telecom – 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.1 Acceptation</h2>
                  <p>
                    En accédant au site, en créant un compte ou en achetant un service, tu acceptes ces conditions et nos politiques.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.2 Admissibilité et compte</h2>
                  <p>
                    Tu confirmes fournir des informations exactes. Tu es responsable de la confidentialité de tes identifiants et des activités sur ton compte.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.3 Services, disponibilité, interruptions</h2>
                  <p>
                    Les services peuvent dépendre de facteurs techniques (couverture, réseau, installations, entretien, pannes, force majeure). Nivra ne garantit pas une disponibilité ininterrompue.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.4 Prix, taxes, modifications</h2>
                  <p>
                    Les prix, frais et taxes applicables sont indiqués avant paiement. Nous pouvons modifier des prix/frais avec préavis raisonnable lorsque requis.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.5 Paiements, renouvellements mensuels</h2>
                  <p>
                    Les paiements carte sont traités par un fournisseur de paiement. Pour les abonnements mensuels, tu autorises les prélèvements récurrents jusqu'à annulation. En cas d'échec de paiement, nous pouvons notifier et suspendre le service après un délai raisonnable.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.6 Annulation</h2>
                  <p>
                    Tu peux annuler selon la Politique de remboursement. Sauf mention contraire, l'annulation prend effet à la fin de la période en cours.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.7 Utilisation acceptable et fraude</h2>
                  <p>
                    Interdit : utilisation frauduleuse, contournement de sécurité, revente non autorisée, abus, activités illégales, harcèlement, atteinte aux systèmes. Nivra peut suspendre/terminer le service en cas de risque, fraude, non-paiement ou violation.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.8 Rendez-vous et installation (si applicable)</h2>
                  <p>
                    Si un rendez-vous est manqué sans préavis raisonnable, des frais peuvent s'appliquer si affiché au moment de la réservation.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.9 Limitation de responsabilité</h2>
                  <p>
                    Dans la mesure permise par la loi : Nivra n'est pas responsable des pertes indirectes. Notre responsabilité totale est limitée aux montants payés pour le service concerné, sauf si la loi impose autrement.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.10 Plaintes</h2>
                  <p>
                    Contacte-nous d'abord via{" "}
                    <a href="mailto:Support@nivratelecom.ca" className="text-primary hover:underline">
                      Support@nivratelecom.ca
                    </a>. Le cas échéant, des recours externes peuvent exister selon le type de service.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.11 Droit applicable</h2>
                  <p>
                    Ces conditions sont régies par les lois applicables au Québec et au Canada.
                  </p>
                </section>
              </>
            ) : (
              <>
                <section className="space-y-4">
                  <p className="text-lg font-medium text-foreground">
                    <strong>Effective Date:</strong> 2025-01-07
                  </p>
                  <p>
                    <strong>Company:</strong> Nivra Telecom – 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.1 Acceptance</h2>
                  <p>
                    By accessing the site, creating an account or purchasing a service, you accept these terms and our policies.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.2 Eligibility and Account</h2>
                  <p>
                    You confirm that you provide accurate information. You are responsible for the confidentiality of your credentials and activities on your account.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.3 Services, Availability, Interruptions</h2>
                  <p>
                    Services may depend on technical factors (coverage, network, installations, maintenance, outages, force majeure). Nivra does not guarantee uninterrupted availability.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.4 Prices, Taxes, Modifications</h2>
                  <p>
                    Applicable prices, fees and taxes are indicated before payment. We may modify prices/fees with reasonable notice when required.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.5 Payments, Monthly Renewals</h2>
                  <p>
                    Card payments are processed by a payment provider. For monthly subscriptions, you authorize recurring charges until cancellation. In case of payment failure, we may notify and suspend service after a reasonable delay.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.6 Cancellation</h2>
                  <p>
                    You may cancel according to the Refund Policy. Unless otherwise stated, cancellation takes effect at the end of the current period.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.7 Acceptable Use and Fraud</h2>
                  <p>
                    Prohibited: fraudulent use, security circumvention, unauthorized resale, abuse, illegal activities, harassment, system damage. Nivra may suspend/terminate service in case of risk, fraud, non-payment or violation.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.8 Appointments and Installation (if applicable)</h2>
                  <p>
                    If an appointment is missed without reasonable notice, fees may apply if displayed at the time of booking.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.9 Limitation of Liability</h2>
                  <p>
                    To the extent permitted by law: Nivra is not liable for indirect losses. Our total liability is limited to the amounts paid for the service concerned, unless the law requires otherwise.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.10 Complaints</h2>
                  <p>
                    Contact us first at{" "}
                    <a href="mailto:Support@nivratelecom.ca" className="text-primary hover:underline">
                      Support@nivratelecom.ca
                    </a>. Where applicable, external remedies may exist depending on the type of service.
                  </p>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-display font-bold text-foreground">3.11 Governing Law</h2>
                  <p>
                    These terms are governed by the laws applicable in Quebec and Canada.
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

export default TermsAndConditions;
