import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";

const ConditionsDeService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Conditions de service
          </h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
              <br />
              <span className="text-sm text-muted-foreground/70">Version : {CONTRACT_TERMS.version}</span>
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Préambule</h2>
              <p>
                {COMPANY_CONTACT.legalName} (« Nivra », « nous », « notre ») est un fournisseur de services 
                de télécommunications prépayés indépendant, sans affiliation avec les opérateurs de réseau. 
                Nos frais sont payés directement par nos clients, garantissant notre impartialité.
              </p>
              <p>
                <strong>Territoire de service :</strong> {CONTRACT_TERMS.regulatory.ccts.description} — Province de Québec uniquement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Nature des services (Prépayé)</h2>
              <p>
                Tous les services Nivra (Internet, TV, Mobile, Streaming+) sont facturés à l'avance par cycle de service.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Le renouvellement s'effectue uniquement si le paiement est reçu et confirmé AVANT le Bill Cycle.</li>
                <li>Si le paiement n'est pas confirmé au Bill Cycle (J0), le service devient Expiré (non-renouvelé).</li>
                <li><strong>Aucun intérêt ni frais de réactivation</strong> ne s'applique pour un non-renouvellement prépayé normal.</li>
                <li>Après 90 jours sans renouvellement, le numéro de téléphone peut devenir irrécupérable (nouveau numéro requis).</li>
                <li>Aucun intérêt ni frais de réactivation ne s'applique simplement parce qu'un e-Transfer est « En vérification ».</li>
                <li>Vous pouvez annuler à tout moment — le service reste actif jusqu'à la fin de la période payée.</li>
                <li>Le cycle en cours n'est pas remboursable, sauf obligation légale ou erreur de facturation confirmée.</li>
                <li>Aucun financement d'appareil n'est proposé dans le cadre de cet accord.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Contestation bancaire / Chargeback</h2>
              <p>
                <strong>Pénalités applicables UNIQUEMENT en cas de contestation bancaire ou chargeback :</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>En cas de contestation bancaire ou chargeback, le service peut être suspendu pendant l'enquête.</li>
                <li>Si la contestation est confirmée contre le client OU si Nivra est débité : un intérêt de <strong>{CONTRACT_TERMS.disputeChargeback.interestRate}% par mois</strong> s'applique sur les montants dus jusqu'au paiement complet.</li>
                <li>Après paiement complet et résolution, des frais de réactivation de <strong>{CONTRACT_TERMS.disputeChargeback.reactivationFee}$</strong> peuvent s'appliquer.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Disponibilité et performance</h2>
              <p>
                Les services sont fournis sur une base « meilleur effort » (<em>best effort</em>). Les vitesses Internet 
                indiquées représentent des vitesses maximales « jusqu'à ». Les interruptions de service sont possibles 
                pour maintenance ou circonstances imprévues.
              </p>
              <p>
                Les délais d'installation et d'activation sont des estimations et peuvent varier selon la disponibilité 
                des techniciens et les conditions du réseau.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Règle TV + Internet</h2>
              <p>
                Le client ne peut pas souscrire au service TV sans un forfait Internet Nivra actif. 
                Si le forfait Internet est annulé, le forfait TV sera également résilié automatiquement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Aucune vérification de crédit</h2>
              <p>
                {CONTRACT_TERMS.noCreditCheck}
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Vérification d'identité</h2>
              <p>
                Une (1) pièce d'identité valide avec photo est requise pour valider toute commande.
                Documents acceptés : permis de conduire, passeport, carte d'assurance maladie du Québec (avec restrictions).
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">8. Taxes applicables</h2>
              <p>
                Toutes les taxes applicables (TPS 5% et TVQ 9,975%) sont ajoutées au prix affiché et calculées 
                automatiquement lors du paiement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">9. Conformité réglementaire</h2>
              <p>
                Cet accord vise à être conforme aux codes de protection des consommateurs du CRTC applicables 
                (Code sur les services sans fil, Code sur les services Internet, Code des fournisseurs de services de télévision).
              </p>
              <p>
                Si vous ne pouvez pas résoudre un problème avec nous, vous pouvez soumettre une plainte au 
                CPRST (Commission des plaintes relatives aux services de télécom-télévision) à{" "}
                <a href={CONTRACT_TERMS.regulatory.ccts.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {CONTRACT_TERMS.regulatory.ccts.website}
                </a>.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">10. Juridiction</h2>
              <p>
                {CONTRACT_TERMS.jurisdiction}
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">11. Pages connexes</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><Link to="/installation-rendezvous" className="text-primary hover:underline">Politique d'installation & rendez-vous</Link></li>
                <li><Link to="/modalites-paiement" className="text-primary hover:underline">Modalités de paiement</Link></li>
                <li><Link to="/equipement-garantie" className="text-primary hover:underline">Équipement & garantie</Link></li>
                <li><Link to="/support-et-plaintes" className="text-primary hover:underline">Support, tickets & plaintes</Link></li>
                <li><Link to="/confidentialite-loi25" className="text-primary hover:underline">Confidentialité (Loi 25 / PIPEDA)</Link></li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">Contact</h2>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
                <li><strong>Adresse :</strong> {COMPANY_CONTACT.fullAddress}</li>
                <li><strong>Heures :</strong> {COMPANY_CONTACT.supportHours}</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ConditionsDeService;
