import Header from "@/components/Header";
import Footer from "@/components/Footer";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background">
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
                En accédant au site web de Nivra et en utilisant nos services de courtage télécom, vous acceptez 
                d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, 
                veuillez ne pas utiliser nos services.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Description des services</h2>
              <p>
                Nivra est un courtier télécom indépendant qui offre des services de conseil et d'analyse pour aider 
                les clients à optimiser leurs services de télécommunications. Nos services comprennent :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Analyse de vos besoins en télécommunications</li>
                <li>Comparaison des offres disponibles sur le marché</li>
                <li>Recommandations personnalisées et impartiales</li>
                <li>Accompagnement dans vos démarches</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Indépendance</h2>
              <p>
                Nivra est un courtier 100% indépendant. Nous ne recevons aucune commission, rémunération ou 
                compensation de la part des fournisseurs de télécommunications. Nos honoraires sont payés 
                directement par nos clients, ce qui garantit notre impartialité totale dans nos recommandations.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Tarification</h2>
              <p>
                Nos services sont facturés selon un tarif fixe ou un abonnement, selon les services demandés. 
                Les tarifs vous seront communiqués avant toute prestation. Aucuns frais cachés ne seront appliqués.
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
                Nivra fournit des conseils et recommandations basés sur les informations disponibles au moment 
                de la consultation. Nous ne garantissons pas les résultats spécifiques et ne sommes pas responsables 
                des décisions prises par les fournisseurs de télécommunications ou des changements dans leurs offres.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Propriété intellectuelle</h2>
              <p>
                Tout le contenu présent sur ce site (textes, images, logos, etc.) est la propriété de Nivra 
                et est protégé par les lois sur la propriété intellectuelle. Toute reproduction sans autorisation 
                est interdite.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">8. Modification des conditions</h2>
              <p>
                Nivra se réserve le droit de modifier ces conditions d'utilisation à tout moment. Les modifications 
                entreront en vigueur dès leur publication sur ce site. Nous vous encourageons à consulter 
                régulièrement cette page.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">9. Droit applicable</h2>
              <p>
                Ces conditions d'utilisation sont régies par les lois de la province de Québec et les lois 
                fédérales du Canada applicables. Tout litige sera soumis à la compétence exclusive des tribunaux 
                du Québec.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">10. Contact</h2>
              <p>
                Pour toute question concernant ces conditions d'utilisation, veuillez nous contacter :
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> info@nivra.ca</li>
                <li><strong>Téléphone :</strong> 1-800-NIVRA</li>
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
