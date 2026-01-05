import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Info } from "lucide-react";

const SupportEtPlaintes = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Support, tickets & plaintes
          </h1>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Canaux de support</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Portail client :</strong> Section « Tickets » — méthode recommandée</li>
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
              </ul>
              <p className="text-sm text-muted-foreground/70">
                Heures de support : {COMPANY_CONTACT.supportHours}
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Système de tickets</h2>
              <p>
                Tous les tickets de support passent par les statuts suivants :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Open (Ouvert) :</strong> Ticket créé, en attente de traitement</li>
                <li><strong>In Progress (En cours) :</strong> Un agent travaille sur votre demande</li>
                <li><strong>Waiting for client (En attente du client) :</strong> Information additionnelle requise</li>
                <li><strong>Resolved (Résolu) :</strong> Problème résolu</li>
                <li><strong>Closed (Fermé) :</strong> Ticket fermé</li>
              </ul>

              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Fermeture automatique</h3>
                      <p className="text-sm">
                        Les tickets sans réponse du client peuvent être <strong>fermés automatiquement après 7 jours</strong>.
                        Vous pouvez demander la réouverture d'un ticket fermé en contactant le support.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Changements de chaînes TV</h2>
              <p>
                Les demandes de modification de chaînes TV créent un ticket interne avec les délais suivants :
              </p>
              <Card className="bg-cyan-500/10 border-cyan-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Délai de traitement : 2h à 24h</h3>
                      <p className="text-sm">
                        Statuts : <strong>Open → In Progress → Completed</strong>
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Vous recevrez une notification lorsque les modifications seront appliquées.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Contestation de facturation</h2>
              <p>
                Toute contestation de facturation doit être soumise dans les <strong>10 jours</strong> suivant 
                la réception de la facture.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Ouvrez un ticket avec le sujet « Contestation de facturation »</li>
                <li>Incluez le numéro de facture concerné</li>
                <li>Décrivez clairement la nature du litige</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Plaintes non résolues — CCTS</h2>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Commission des plaintes relatives aux services de télécom-télévision (CPRST)
                  </h3>
                  <p className="text-sm mb-4">
                    Si vous ne pouvez pas résoudre un problème avec nous, vous pouvez soumettre une plainte 
                    au CPRST, un organisme indépendant de résolution des plaintes.
                  </p>
                  <ul className="list-none space-y-2 text-sm">
                    <li><strong>Site web :</strong>{" "}
                      <a href={CONTRACT_TERMS.regulatory.ccts.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {CONTRACT_TERMS.regulatory.ccts.website}
                      </a>
                    </li>
                    <li><strong>Description :</strong> {CONTRACT_TERMS.regulatory.ccts.description}</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. CRTC</h2>
              <p>
                Le CRTC offre également des options de plainte/demande pour les questions réglementaires.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Site web :</strong>{" "}
                  <a href={CONTRACT_TERMS.regulatory.crtc.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {CONTRACT_TERMS.regulatory.crtc.website}
                  </a>
                </li>
                <li><strong>Codes applicables :</strong> {CONTRACT_TERMS.regulatory.crtc.codes.join(", ")}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. NIP de sécurité</h2>
              <p>
                Un NIP de sécurité à 4 chiffres est obligatoire pour :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Accéder à votre compte par téléphone</li>
                <li>Autoriser certaines modifications sensibles</li>
                <li>Vérifier votre identité auprès du support</li>
              </ul>
              <p className="text-sm text-muted-foreground/70">
                Vous pouvez désigner un « Autre utilisateur autorisé » dans votre portail client.
                Ne partagez jamais votre NIP par courriel ou messagerie non sécurisée.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">Contact</h2>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
                <li><strong>Adresse :</strong> {COMPANY_CONTACT.fullAddress}</li>
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

export default SupportEtPlaintes;
