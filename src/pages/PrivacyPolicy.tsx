import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead {...SEO_DATA.privacy} />
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Politique de confidentialité
          </h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Introduction</h2>
              <p>
                Nivra Telecom (« nous », « notre » ou « nos ») s'engage à protéger la vie privée de ses clients et visiteurs. 
                Cette politique de confidentialité explique comment nous collectons, utilisons, divulguons et protégeons 
                vos informations personnelles lorsque vous utilisez nos services télécom.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Informations collectées</h2>
              <p>Nous collectons les types d'informations suivants :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Informations d'identification :</strong> nom, adresse courriel, numéro de téléphone</li>
                <li><strong>Informations de facturation :</strong> adresse, informations de paiement</li>
                <li><strong>Informations sur vos services télécom :</strong> besoins en télécommunications, équipement</li>
                <li><strong>Informations techniques :</strong> adresse IP, type de navigateur, données de navigation</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Utilisation des informations</h2>
              <p>Nous utilisons vos informations pour :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Activer et installer vos services télécom</li>
                <li>Gérer votre compte et fournir le support technique</li>
                <li>Communiquer avec vous concernant nos services</li>
                <li>Améliorer nos services et votre expérience utilisateur</li>
                <li>Respecter nos obligations légales</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Protection des données</h2>
              <p>
                Nivra Telecom s'engage à protéger vos données personnelles. Nous ne partageons aucune information 
                personnelle avec des tiers sans votre consentement explicite. Vos données sont utilisées 
                uniquement pour la prestation de nos services télécom.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Partage des informations</h2>
              <p>
                Nous ne vendons, ne louons ni ne partageons vos informations personnelles avec des tiers, sauf :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Avec votre consentement explicite</li>
                <li>Pour respecter une obligation légale</li>
                <li>Pour protéger nos droits ou notre sécurité</li>
                <li>Avec nos prestataires de services essentiels (hébergement, paiement) sous contrat de confidentialité</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Sécurité des données</h2>
              <p>
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour 
                protéger vos informations personnelles contre l'accès non autorisé, la modification, la divulgation 
                ou la destruction.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Vos droits</h2>
              <p>Conformément aux lois applicables, vous avez le droit de :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Accéder à vos informations personnelles</li>
                <li>Corriger ou mettre à jour vos informations</li>
                <li>Demander la suppression de vos données</li>
                <li>Retirer votre consentement à tout moment</li>
                <li>Porter plainte auprès de l'autorité compétente</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">8. Contact</h2>
              <p>
                Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, 
                veuillez nous contacter :
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> Support@nivratelecom.ca</li>
                <li><strong>Téléphone :</strong> 438-544-2233</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;