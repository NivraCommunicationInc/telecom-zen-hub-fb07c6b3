import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT, ETRANSFER_CONFIG } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const ModalitesPaiement = () => {
  return (
    <div className="min-h-screen bg-background">
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
              <h2 className="text-2xl font-display font-bold text-foreground">4. Cycle de facturation</h2>
              <p>
                Chaque compte a un <strong>cycle de facturation</strong> (« Bill Cycle ») défini lors de l'activation. 
                La date d'échéance est basée sur ce cycle.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Délai de paiement : {CONTRACT_TERMS.paymentTerms.dueDays} jours après l'émission de la facture</li>
                <li>Devise : {CONTRACT_TERMS.paymentTerms.currency}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Retards de paiement</h2>
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Politique de retard</h3>
                      <ul className="list-disc pl-6 space-y-2 text-sm">
                        <li>Intérêt de retard : <strong>{CONTRACT_TERMS.latePayment.feePercent}% par mois</strong> sur le solde impayé après 15 jours</li>
                        <li>Suspension du service : après <strong>{CONTRACT_TERMS.latePayment.suspensionDays} jours</strong> de retard</li>
                        <li>Frais de réactivation : <strong>{CONTRACT_TERMS.latePayment.reactivationFee}$</strong> pour rétablir un service suspendu</li>
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
