/**
 * Billing V2 - Staff Playbook & Documentation
 * Internal guide for managing Interac-only prepaid billing
 */

import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  XCircle,
  CreditCard,
  RefreshCw,
  Users,
  Mail
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const BillingV2Playbook = () => {
  return (
    <AdminLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Guide Billing V2</h1>
            <p className="text-muted-foreground">
              Procédures internes pour la gestion du système prépayé Interac
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Interac Seulement
          </Badge>
        </div>

        {/* Quick Reference Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              <CardTitle className="text-lg">Frais d'activation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">25$ / 45$</p>
              <p className="text-sm text-muted-foreground">1 service / 2+ services</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Clock className="h-8 w-8 text-blue-600" />
              <CardTitle className="text-lg">Cycle</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">30 jours</p>
              <p className="text-sm text-muted-foreground">Par abonnement</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <Mail className="h-8 w-8 text-orange-600" />
              <CardTitle className="text-lg">Rappel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">J-3</p>
              <p className="text-sm text-muted-foreground">Avant fin de cycle</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <CardTitle className="text-lg">Suspension</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">J+2 / J+5</p>
              <p className="text-sm text-muted-foreground">Suspend / Annule</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Procédures Opérationnelles</CardTitle>
            <CardDescription>
              Guide complet pour le personnel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              
              <AccordionItem value="payment-processing">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Traitement des Paiements Interac
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-base">
                  <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Étapes pour confirmer un paiement:</h4>
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Vérifier la réception du virement Interac sur <strong>Support@nivratelecom.ca</strong></li>
                      <li>Noter le nom de l'expéditeur et le montant reçu</li>
                      <li>Aller dans <strong>/admin/billing-v2</strong> → Onglet "Factures"</li>
                      <li>Rechercher la facture par numéro ou email client</li>
                      <li>Cliquer sur <strong>"Marquer comme payé (Interac)"</strong></li>
                      <li>Entrer la référence du virement (optionnel mais recommandé)</li>
                      <li>Confirmer → Le système active automatiquement l'abonnement</li>
                    </ol>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Ce qui se passe automatiquement:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Facture passe à <Badge variant="outline">paid</Badge></li>
                      <li>Paiement enregistré avec référence et date</li>
                      <li>Abonnement passe à <Badge className="bg-green-600">active</Badge></li>
                      <li>Cycle de 30 jours démarre</li>
                      <li>Email de confirmation envoyé au client</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="late-payments">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    Gestion des Retards de Paiement
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-base">
                  <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Processus automatique:</h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Jour</th>
                          <th className="text-left py-2">Action</th>
                          <th className="text-left py-2">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2">J-3</td>
                          <td>Rappel de renouvellement envoyé</td>
                          <td><Badge variant="outline">pending</Badge></td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">J (fin cycle)</td>
                          <td>Facture en retard</td>
                          <td><Badge variant="destructive">overdue</Badge></td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">J+2</td>
                          <td>Service suspendu</td>
                          <td><Badge className="bg-orange-600">suspended</Badge></td>
                        </tr>
                        <tr>
                          <td className="py-2">J+5</td>
                          <td>Service annulé</td>
                          <td><Badge variant="destructive">cancelled</Badge></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Réactivation après suspension:</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Client envoie le paiement Interac</li>
                      <li>Confirmer le paiement dans Admin Billing V2</li>
                      <li>L'abonnement repasse automatiquement à "active"</li>
                      <li>Nouveau cycle de 30 jours commence</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="plan-changes">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-blue-600" />
                    Changements de Forfait
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-base">
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Upgrade (forfait supérieur):</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Créer une facture d'ajustement pour la différence prorata</li>
                      <li>Attendre le paiement Interac</li>
                      <li>Modifier le plan_code et plan_price dans billing_subscriptions</li>
                      <li>La prochaine facture de renouvellement utilisera le nouveau prix</li>
                    </ol>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Downgrade (forfait inférieur):</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Appliquer le changement à la fin du cycle actuel</li>
                      <li>Mettre à jour le plan pour le prochain renouvellement</li>
                      <li>Aucun remboursement automatique (période déjà payée)</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="credits-refunds">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    Crédits et Remboursements
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-base">
                  <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Émettre un crédit:</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Créer une facture avec type = 'credit' et montant négatif</li>
                      <li>Le crédit sera appliqué automatiquement au prochain renouvellement</li>
                      <li>Documenter la raison dans les notes</li>
                    </ol>
                  </div>
                  
                  <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Remboursement Interac:</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Envoyer le virement Interac depuis le compte Support</li>
                      <li>Créer une facture credit/adjustment négative</li>
                      <li>Marquer comme 'paid' avec la référence du remboursement</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="stripe-migration">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-600" />
                    Future Migration Stripe
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-base">
                  <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Architecture prévue:</h4>
                    <p className="mb-4">
                      Le système Billing V2 est conçu pour supporter Stripe sans modifier la structure:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Ajouter 'stripe' à l'enum billing_payment_method</li>
                      <li>Stocker stripe_customer_id sur billing_customers</li>
                      <li>Stocker stripe_subscription_id sur billing_subscriptions</li>
                      <li>Créer webhook pour événements Stripe (payment_intent.succeeded)</li>
                      <li>Le webhook appelle billing-confirm-payment automatiquement</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Coexistence Interac + Stripe:</h4>
                    <p>
                      Les deux modes peuvent coexister. Le champ <code>payment_method</code> sur 
                      billing_invoices indique la méthode utilisée. L'admin peut toujours 
                      confirmer manuellement les paiements Interac pendant que Stripe gère 
                      les cartes automatiquement.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="troubleshooting">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    Résolution de Problèmes
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-base">
                  <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg space-y-4">
                    <div>
                      <h4 className="font-semibold">Client dit avoir payé mais facture pending:</h4>
                      <ul className="list-disc list-inside ml-4">
                        <li>Vérifier la boîte Interac sur Support@nivratelecom.ca</li>
                        <li>Vérifier que le montant correspond exactement</li>
                        <li>Demander la preuve de virement au client</li>
                        <li>Marquer manuellement comme payé si confirmé</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold">Service suspendu par erreur:</h4>
                      <ul className="list-disc list-inside ml-4">
                        <li>Vérifier l'historique des paiements du client</li>
                        <li>Si paiement manqué: marquer comme payé</li>
                        <li>L'abonnement repasse automatiquement à active</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold">Facture en double:</h4>
                      <ul className="list-disc list-inside ml-4">
                        <li>Vérifier les dates de cycle (ne doivent pas se chevaucher)</li>
                        <li>Annuler la facture en double (status = 'cancelled')</li>
                        <li>Documenter dans les notes</li>
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </CardContent>
        </Card>

        {/* Email Template Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Références Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <p className="font-semibold mb-2">Texte standard Interac dans tous les emails:</p>
              <blockquote className="border-l-4 border-primary pl-4 italic">
                "Veuillez envoyer votre paiement par Interac e-Transfer à <strong>Support@nivratelecom.ca</strong>.<br/>
                Votre service sera activé dès réception et confirmation du paiement."
              </blockquote>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default BillingV2Playbook;
