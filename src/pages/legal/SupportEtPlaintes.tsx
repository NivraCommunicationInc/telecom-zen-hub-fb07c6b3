import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, MessageSquare, Phone, Mail, Clock, Shield, ExternalLink, Target } from "lucide-react";

const SupportEtPlaintes = () => {
  return (
    <div className="min-h-screen public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
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

            {/* Support Channels */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Canaux de support</h2>
              
              <div className="grid md:grid-cols-3 gap-4 not-prose">
                <Card className="bg-card border-border">
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">Portail client</h3>
                    <p className="text-sm text-muted-foreground mb-2">Méthode recommandée</p>
                    <Link to="/portal/auth" className="text-sm text-primary hover:underline">
                      Ouvrir un ticket
                    </Link>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                      <Mail className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">Courriel</h3>
                    <p className="text-sm text-muted-foreground mb-2">{COMPANY_CONTACT.supportEmailDisplay}</p>
                    <a href={`mailto:${COMPANY_CONTACT.supportEmailDisplay}`} className="text-sm text-primary hover:underline">
                      Envoyer un courriel
                    </a>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">Heures</h3>
                    <p className="text-sm text-muted-foreground mb-2">{COMPANY_CONTACT.supportHours}</p>
                    <Link to="/contact" className="text-sm text-primary hover:underline">
                      Nous joindre
                    </Link>
                  </CardContent>
                </Card>
              </div>
              
              <Card className="bg-muted/30 border-border not-prose">
                <CardContent className="p-4 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground mb-1">Heures de support</p>
                    <p className="text-sm text-muted-foreground">
                      {COMPANY_CONTACT.supportHoursWeekday} | {COMPANY_CONTACT.supportHoursWeekend}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Response Targets */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Délais cibles de réponse</h2>
              
              <Card className="bg-cyan-500/10 border-cyan-500/30 not-prose">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-500" />
                    Objectifs (sans garantie)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Première réponse (ticket)</span>
                      <span className="font-medium text-foreground">24h ouvrables</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Résolution standard</span>
                      <span className="font-medium text-foreground">48-72h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Changements chaînes TV</span>
                      <span className="font-medium text-foreground">2h - 24h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Urgences techniques</span>
                      <span className="font-medium text-foreground">Même jour si possible</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic pt-2 border-t border-cyan-500/20">
                    Ces délais sont des objectifs et non des garanties. Les délais réels peuvent varier selon la complexité 
                    et le volume de demandes.
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* Ticket System */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Système de tickets</h2>
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

              <Card className="bg-amber-500/10 border-amber-500/30 not-prose">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Fermeture automatique</h3>
                      <p className="text-sm text-muted-foreground">
                        Les tickets sans réponse du client peuvent être <strong>fermés automatiquement après 7 jours</strong>.
                        Vous pouvez demander la réouverture d'un ticket fermé en contactant le support.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* TV Changes */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Changements de chaînes TV</h2>
              <p>
                Les demandes de modification de chaînes TV créent un ticket interne avec les délais suivants :
              </p>
              <Card className="bg-cyan-500/10 border-cyan-500/30 not-prose">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Délai de traitement : 2h à 24h</h3>
                      <p className="text-sm text-muted-foreground">
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

            {/* Billing Disputes */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Contestation de facturation</h2>
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

            {/* Technical Evidence */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Preuves techniques</h2>
              <Card className="bg-muted/30 border-border not-prose">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Conformément aux lois applicables, les éléments suivants peuvent être utilisés comme preuves 
                        en cas de litige :
                      </p>
                      <ul className="list-disc pl-6 mt-2 text-sm text-muted-foreground space-y-1">
                        <li>Logs d'activation et confirmations de service</li>
                        <li>Preuves de livraison et accusés de réception</li>
                        <li>Statuts de paiement et confirmations e-Transfer</li>
                        <li>Historique des tickets et communications</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* CCTS */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Plaintes non résolues — CCTS</h2>
              <Card className="bg-primary/5 border-primary/20 not-prose">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Commission des plaintes relatives aux services de télécom-télévision (CPRST)
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Si vous ne pouvez pas résoudre un problème avec nous, vous pouvez soumettre une plainte 
                    au CPRST, un organisme indépendant de résolution des plaintes.
                  </p>
                  <ul className="list-none space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-primary" />
                      <strong>Site web :</strong>{" "}
                      <a href={CONTRACT_TERMS.regulatory.ccts.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {CONTRACT_TERMS.regulatory.ccts.website}
                      </a>
                    </li>
                    <li><strong>Description :</strong> {CONTRACT_TERMS.regulatory.ccts.description}</li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* CRTC */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">8. CRTC</h2>
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

            {/* Security PIN */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">9. NIP de sécurité</h2>
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

            {/* Contact */}
            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">Contact</h2>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Adresse :</strong> {COMPANY_CONTACT.fullAddress}</li>
                <li><strong>Chat / Tickets :</strong> <Link to="/contact" className="text-primary hover:underline">Nous joindre</Link></li>
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
