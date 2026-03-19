import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const ModalitesPaiement = () => {
  return (
    <div className="min-h-screen public-light" >
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Modalités de paiement
          </h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Services prépayés</h2>
              <p>
                Tous les services Nivra sont facturés à l'avance par cycle de service. 
                Le renouvellement s'effectue uniquement si le paiement est reçu et confirmé.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Vous pouvez annuler à tout moment — le service reste actif jusqu'à la fin de la période payée.</li>
                <li>Le cycle en cours n'est pas remboursable, sauf obligation légale ou erreur de facturation confirmée.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Moyens de paiement acceptés</h2>
              <ul className="list-disc pl-6 space-y-2">
                {CONTRACT_TERMS.paymentTerms.acceptedMethods.map((method, index) => (
                  <li key={index}>{method}</li>
                ))}
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Paiement par Virement Interac (e-Transfer)</h2>
              <Card className="bg-cyan-500/10 border-cyan-500/30">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-4">Instructions e-Transfer</h3>
                  <ul className="list-none space-y-2">
                    <li><strong>Courriel de destination :</strong> {ETRANSFER_CONFIG.emailDisplay}</li>
                    <li><strong>Question de sécurité :</strong> {ETRANSFER_CONFIG.securityQuestion}</li>
                    <li><strong>Réponse :</strong> {ETRANSFER_CONFIG.securityAnswer}</li>
                  </ul>
                  <p className="mt-4 text-sm">
                    <strong>Important :</strong> Incluez votre numéro de commande ou numéro de compte dans le message du virement.
                  </p>
                </CardContent>
              </Card>

              <h3 className="text-xl font-display font-bold text-foreground mt-6">Statuts de paiement e-Transfer</h3>
              <p>Après l'envoi de votre virement, votre paiement passera par les statuts suivants :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Pending (En attente) :</strong> Virement envoyé, en attente de réception</li>
                <li><strong>In verification (En vérification) :</strong> Virement reçu, en cours de validation</li>
                <li><strong>Complete (Complété) :</strong> Paiement confirmé, service activé/renouvelé</li>
                <li><strong>Declined (Refusé) :</strong> Virement refusé ou annulé</li>
                <li><strong>Fraud (Fraude) :</strong> Activité suspecte détectée — compte suspendu</li>
              </ul>
              <p className="text-sm text-muted-foreground/70">
                L'activation du service s'effectue après réception et vérification du virement.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Cycle de facturation (Bill Cycle)</h2>
              <p>
                Chaque compte a un <strong>Bill Cycle Day</strong> (jour du mois) défini par défaut à la date de création du compte.
              </p>
              <Card className="bg-cyan-500/10 border-cyan-500/30 my-4">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-3">Fonctionnement du cycle prépayé</h3>
                  <ul className="list-disc pl-6 space-y-2 text-sm">
                    <li><strong>Facture émise :</strong> {CONTRACT_TERMS.billingCycle.invoiceGeneratedDaysBefore} jours avant le Bill Cycle (J-5)</li>
                    <li><strong>Paiement requis :</strong> AVANT la date du Bill Cycle (J0) pour renouveler le service</li>
                    <li><strong>Non-renouvellement :</strong> Si le paiement n'est pas confirmé au J0, le service devient Expiré</li>
                    <li><strong>Jours 29-31 :</strong> Si le mois ne contient pas ce jour, la facturation se fait le dernier jour du mois</li>
                  </ul>
                </CardContent>
              </Card>
              <ul className="list-disc pl-6 space-y-2">
                <li>Devise : {CONTRACT_TERMS.paymentTerms.currency}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Non-renouvellement et frais</h2>
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Politique de non-renouvellement (prépayé)</h3>
                      <ul className="list-disc pl-6 space-y-2 text-sm">
                        <li><strong>Non-renouvellement :</strong> Si le paiement n'est pas confirmé au Bill Cycle (J0), le service devient Expiré</li>
                        <li><strong>E-Transfer en vérification au J0 :</strong> Fenêtre de grâce de <strong>{CONTRACT_TERMS.billingCycle.etransferGraceHours} heures</strong> maximum</li>
                        <li><strong>Aucun intérêt/frais</strong> pour un non-renouvellement prépayé normal</li>
                        <li><strong>Après 90 jours sans renouvellement :</strong> Le numéro peut devenir irrécupérable (nouveau numéro requis)</li>
                        <li><strong>Contestation bancaire/Chargeback :</strong> Intérêt de <strong>{CONTRACT_TERMS.disputeChargeback.interestRate}%</strong> par mois + frais de réactivation de <strong>{CONTRACT_TERMS.disputeChargeback.reactivationFee}$</strong> (UNIQUEMENT pour disputes/chargebacks)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Contestation de facturation</h2>
              <p>
                Toute contestation de facturation doit être soumise dans les <strong>10 jours</strong> suivant 
                la réception de la facture via le portail client ou par courriel.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Rétrofacturation et fraude</h2>
              <p>
                Les rétrofacturations (chargebacks) non justifiées ou frauduleuses peuvent entraîner :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>La suspension immédiate du compte</li>
                <li>Des frais de traitement</li>
                <li>La transmission du dossier aux autorités compétentes</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">Contact</h2>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
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

export default ModalitesPaiement;
