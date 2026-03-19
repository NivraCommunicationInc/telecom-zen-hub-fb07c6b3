import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { COMPANY_CONTACT } from "@/config/company";
import { CONTRACT_TERMS } from "@/lib/contractPolicies";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, AlertTriangle } from "lucide-react";

const ConfidentialiteLoi25 = () => {
  return (
    <div className="min-h-screen public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
            Politique de confidentialité
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Loi 25 du Québec • PIPEDA fédéral
          </p>
          
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-8">
            <p className="text-lg">
              Dernière mise à jour : {CONTRACT_TERMS.lastUpdated}
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">1. Introduction</h2>
              <p>
                {COMPANY_CONTACT.legalName} (« Nivra », « nous », « notre ») s'engage à protéger 
                les renseignements personnels de ses clients conformément aux lois canadiennes et 
                québécoises en vigueur, notamment :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Loi 25 du Québec</strong> — Loi modernisant des dispositions législatives en matière de protection des renseignements personnels</li>
                <li><strong>PIPEDA</strong> — Loi sur la protection des renseignements personnels et les documents électroniques (fédéral)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">2. Renseignements collectés</h2>
              <p>Nous collectons les renseignements suivants :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Identification :</strong> Nom, adresse courriel, numéro de téléphone</li>
                <li><strong>Facturation :</strong> Adresse de service, informations de paiement (carte de crédit, e-Transfer)</li>
                <li><strong>Service :</strong> Besoins en télécommunications, équipement, historique de commandes</li>
                <li><strong>Technique :</strong> Adresse IP, type de navigateur, données de navigation (portail client)</li>
                <li><strong>Vérification :</strong> Pièce d'identité gouvernementale (à des fins de validation uniquement)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">3. Utilisation des renseignements</h2>
              <p>Vos renseignements sont utilisés pour :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Activer et gérer vos services télécom</li>
                <li>Vérifier votre identité</li>
                <li>Traiter les paiements et facturer les services</li>
                <li>Fournir le support technique et client</li>
                <li>Communiquer concernant votre compte (avis, factures, notifications)</li>
                <li>Respecter nos obligations légales et réglementaires</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">4. Avis et factures</h2>
              <Card className="bg-cyan-500/10 border-cyan-500/30">
                <CardContent className="p-6">
                  <p className="font-medium text-foreground">
                    Les avis et factures sont transmis via le portail client et/ou par courriel.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Il est de votre responsabilité de maintenir une adresse courriel valide et de consulter 
                    régulièrement votre portail client.
                  </p>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">5. Protection des données</h2>
              <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <Shield className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-medium text-foreground mb-2">Mesures de sécurité</p>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    <li>Chiffrement des données en transit et au repos</li>
                    <li>Accès au portail client contrôlé par rôles avec authentification sécurisée</li>
                    <li>NIP de sécurité obligatoire pour les opérations sensibles</li>
                    <li>Journalisation des accès et modifications</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">6. Partage des renseignements</h2>
              <p>
                Nous ne vendons, ne louons ni ne partageons vos renseignements personnels avec des tiers, sauf :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Avec votre consentement explicite</li>
                <li>Pour respecter une obligation légale ou une ordonnance judiciaire</li>
                <li>Pour protéger nos droits ou notre sécurité</li>
                <li>Avec nos prestataires de services essentiels (hébergement, paiement) sous contrat de confidentialité</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">7. Vos droits (Loi 25)</h2>
              <p>Conformément à la Loi 25 du Québec, vous avez le droit de :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Accéder</strong> à vos renseignements personnels</li>
                <li><strong>Rectifier</strong> des renseignements inexacts ou incomplets</li>
                <li><strong>Retirer</strong> votre consentement à tout moment</li>
                <li><strong>Demander la suppression</strong> de vos données (sous réserve de nos obligations légales)</li>
                <li><strong>Porter plainte</strong> auprès de la Commission d'accès à l'information du Québec</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">8. Avertissement de sécurité</h2>
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-foreground mb-2">Attention à la fraude</p>
                      <p className="text-sm">
                        Nivra ne vous demandera <strong>JAMAIS</strong> votre numéro d'assurance sociale (NAS) 
                        ou vos informations de carte de crédit complètes par courriel ou téléphone.
                      </p>
                      <p className="text-sm mt-2">
                        Utilisez uniquement les canaux sécurisés : portail client ou paiement en magasin.
                        Signalez toute tentative suspecte à {COMPANY_CONTACT.supportEmailDisplay}.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">9. Conservation des données</h2>
              <p>
                Vos renseignements personnels sont conservés aussi longtemps que nécessaire pour :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fournir les services demandés</li>
                <li>Respecter nos obligations légales et comptables</li>
                <li>Résoudre les litiges éventuels</li>
              </ul>
              <p className="text-sm text-muted-foreground/70">
                Les factures, contrats et journaux d'audit sont conservés conformément aux exigences légales applicables.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">10. Responsable de la protection des renseignements</h2>
              <p>
                Pour toute question concernant cette politique ou pour exercer vos droits, contactez :
              </p>
              <ul className="list-none space-y-2">
                <li><strong>Courriel :</strong> {COMPANY_CONTACT.supportEmailDisplay}</li>
                <li><strong>Téléphone :</strong> {COMPANY_CONTACT.supportPhoneDisplay}</li>
                <li><strong>Adresse :</strong> {COMPANY_CONTACT.fullAddress}</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-foreground">11. Modifications</h2>
              <p>
                Nous pouvons modifier cette politique de confidentialité à tout moment. 
                Les modifications importantes seront communiquées via le portail client ou par courriel.
              </p>
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

export default ConfidentialiteLoi25;
