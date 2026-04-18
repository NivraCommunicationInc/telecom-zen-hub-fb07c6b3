import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { COMPANY_CONTACT } from "@/config/company";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead {...SEO_DATA.terms} />
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Conditions d'utilisation
          </h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Acceptation des conditions</h2>
              <p>
                En accédant au site web de {COMPANY_CONTACT.companyName} et en utilisant nos services télécom, vous acceptez 
                d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, 
                veuillez ne pas utiliser nos services.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Description des services</h2>
              <p>
                {COMPANY_CONTACT.companyName} est un fournisseur de services télécom au Québec. Nos services comprennent :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Activation de services mobiles, Internet, TV et sécurité</li>
                <li>Installation et configuration d'équipements</li>
                <li>Support technique et assistance</li>
                <li>Gestion de compte et facturation</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Prestation de services</h2>
              <p>
                {COMPANY_CONTACT.companyName} s'engage à fournir des services télécom de qualité. Nos tarifs sont clairs 
                et transparents. Aucuns frais cachés ne seront appliqués sans votre consentement préalable.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Tarification</h2>
              <p>
                Nos services sont facturés selon les tarifs communiqués lors de la soumission. 
                Les tarifs vous seront confirmés avant toute activation. Aucuns frais cachés ne seront appliqués.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Obligations du client</h2>
              <p>En utilisant nos services, vous vous engagez à :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fournir des informations exactes et complètes</li>
                <li>Mettre à jour vos informations si nécessaire</li>
                <li>Utiliser nos services de manière légale et appropriée</li>
                <li>Respecter les droits de propriété intellectuelle</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Limitation de responsabilité</h2>
              <p>
                {COMPANY_CONTACT.companyName} fournit des services télécom basés sur les informations disponibles au moment 
                de la soumission. Nous ne garantissons pas les résultats spécifiques et ne sommes pas responsables 
                des décisions prises par des tiers ou des changements dans les offres.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Propriété intellectuelle</h2>
              <p>
                Tout le contenu présent sur ce site (textes, images, logos, etc.) est la propriété de {COMPANY_CONTACT.companyName} 
                et est protégé par les lois sur la propriété intellectuelle. Toute reproduction sans autorisation 
                est interdite.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">8. Contestation de paiement</h2>
              <p>
                Le client s'engage à contacter {COMPANY_CONTACT.companyName} avant toute contestation ou rétrofacturation 
                auprès de son institution financière.
              </p>
              <p>
                Toute contestation abusive ou frauduleuse pourra entraîner la suspension immédiate des services 
                ainsi que des recours administratifs ou légaux.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">9. Nature des services</h2>
              <p>
                Les services offerts par {COMPANY_CONTACT.companyName} sont prépayés. Aucun crédit n'est accordé. 
                Le service est activé uniquement après réception du paiement.
              </p>
              <p>
                Aucun remboursement ne sera effectué pour une période de service déjà entamée, 
                sauf indication contraire explicite.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">10. Activation des services</h2>
              <p>
                Les services sont généralement activés rapidement après confirmation du paiement. 
                Des délais peuvent survenir selon la nature du service ou des vérifications requises.
              </p>
              <p>
                {COMPANY_CONTACT.companyName} ne garantit pas un délai d'activation exact.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">11. Prévention de la fraude</h2>
              <p>
                {COMPANY_CONTACT.companyName} se réserve le droit de suspendre, retarder ou annuler toute commande 
                en cas de suspicion de fraude ou d'activité anormale.
              </p>
              <p>
                Des vérifications supplémentaires peuvent être demandées avant l'activation du service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">12. Limitation de responsabilité</h2>
              <p>
                {COMPANY_CONTACT.companyName} ne pourra être tenu responsable des pertes indirectes, incluant 
                perte de revenus, perte de données ou interruption de service.
              </p>
              <p>
                La responsabilité totale de {COMPANY_CONTACT.companyName}, le cas échéant, est limitée au montant 
                payé par le client pour le service concerné.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">13. Facturation</h2>
              <p>
                Les factures sont générées électroniquement et accessibles via le portail client.
              </p>
              <p>
                Le client est responsable de vérifier ses factures et de signaler toute erreur dans un délai raisonnable.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">14. Modification des conditions</h2>
              <p>
                {COMPANY_CONTACT.companyName} se réserve le droit de modifier ces conditions d'utilisation à tout moment. Les modifications 
                entreront en vigueur dès leur publication sur ce site. Nous vous encourageons à consulter 
                régulièrement cette page.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">15. Droit applicable</h2>
              <p>
                Ces conditions d'utilisation sont régies par les lois de la province de Québec et les lois 
                fédérales du Canada applicables. Tout litige sera soumis à la compétence exclusive des tribunaux 
                du Québec.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">16. Contact</h2>
              <p>
                Pour toute question concernant ces conditions d'utilisation, veuillez nous contacter :
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfUse;