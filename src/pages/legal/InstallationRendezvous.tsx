import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";

const InstallationRendezvous = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Politique d'installation & rendez-vous
          </h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Délais de livraison</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Livraison standard :</strong> {CONTRACT_TERMS.delivery.standardDays} (jours ouvrables)</li>
                <li><strong>Livraison express (Uber Direct) :</strong> {CONTRACT_TERMS.delivery.uberExpress} — disponible dans les villes éligibles</li>
              </ul>
              <p className="text-sm text-muted-foreground/70">
                Villes éligibles pour la livraison express : {CONTRACT_TERMS.delivery.eligibleCities.join(", ")}
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Types de livraison par service</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Livraison uniquement :</strong> {CONTRACT_TERMS.delivery.deliveryOnlyServices.join(", ")}</li>
                <li><strong>Installation possible :</strong> {CONTRACT_TERMS.delivery.installationServices.join(", ")}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Frais applicables</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Frais d'activation :</strong> {CONTRACT_TERMS.fees.activationSingle}$ (1 service) / {CONTRACT_TERMS.fees.activationMultiple}$ (2+ services)</li>
                <li><strong>Frais de livraison :</strong> {CONTRACT_TERMS.fees.delivery}$</li>
                <li><strong>Livraison express :</strong> {CONTRACT_TERMS.fees.uberExpress}$</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Politique d'annulation de rendez-vous</h2>
              <p>
                Toute annulation de rendez-vous doit être effectuée <strong>au moins 24 heures à l'avance</strong>.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Les annulations tardives ou absences sans préavis peuvent entraîner des <strong>frais de déplacement de 50$</strong>.</li>
                <li>Pour modifier un rendez-vous, contactez-nous via le portail client ou par téléphone.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Délais estimatifs</h2>
              <p>
                Les délais d'installation et d'activation sont des <strong>estimations</strong> et peuvent varier selon :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>La disponibilité des techniciens</li>
                <li>Les conditions du réseau</li>
                <li>L'accessibilité de l'adresse de service</li>
                <li>La validation des informations client</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Présence requise</h2>
              <p>
                Pour les installations Internet et TV, la présence du client ou d'une personne autorisée (18 ans et plus) 
                est requise au rendez-vous. Une pièce d'identité valide doit être présentée au technicien.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">Contact</h2>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
                <li><strong>Heures :</strong> {COMPANY_CONTACT.supportHours}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <p className="text-sm">
                <Link to="/conditions-de-service" className="text-primary hover:underline">← Retour aux Conditions de service</Link>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default InstallationRendezvous;
