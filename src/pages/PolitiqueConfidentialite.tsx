import PageSEO from "@/components/shared/PageSEO";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const PRIVACY_EMAIL = "confidentialite@nivra-telecom.ca";

export default function PolitiqueConfidentialite() {
  return (
    <>
      <PageSEO
        title="Politique de confidentialité — Loi 25"
        description="Politique de confidentialité de Nivra Telecom, conforme à la Loi 25 du Québec et à la LPRPDE. Vos droits, nos engagements."
        path="/politique-de-confidentialite"
      />
      <Header />
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl py-16 sm:py-20 text-foreground pt-24 sm:pt-28">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 tracking-tight">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground mb-10">Dernière mise à jour : 13 avril 2025</p>

        <section className="space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-2">
          <div>
            <h2>1. Responsable du traitement</h2>
            <p>
              Nivra Telecom inc., entreprise constituée au Québec, Canada, est responsable du traitement de vos
              renseignements personnels. Pour toute question :{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">{PRIVACY_EMAIL}</a>
            </p>
          </div>

          <div>
            <h2>2. Renseignements collectés</h2>
            <p>
              Nous collectons : nom, adresse courriel, numéro de téléphone, adresse de service, informations de
              paiement (tokenisées via PayPal), données de navigation (adresse IP, navigateur, pages visitées).
            </p>
          </div>

          <div>
            <h2>3. Finalités du traitement</h2>
            <p>
              Vos renseignements sont utilisés pour : fournir nos services télécom, traiter vos paiements, vous
              envoyer des communications de service, améliorer notre site web, et respecter nos obligations légales.
            </p>
          </div>

          <div>
            <h2>4. Partage des renseignements</h2>
            <p>
              Nous ne vendons jamais vos renseignements personnels. Nous les partageons uniquement avec nos
              sous-traitants (hébergement cloud, PayPal pour les paiements) qui sont contractuellement tenus de les protéger.
            </p>
          </div>

          <div>
            <h2>5. Vos droits (Loi 25)</h2>
            <p>
              Conformément à la Loi 25, vous avez le droit de : accéder à vos renseignements, les corriger, demander
              leur suppression, retirer votre consentement, et obtenir une copie portable de vos données. Pour exercer
              ces droits, écrivez à{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">{PRIVACY_EMAIL}</a>.
            </p>
          </div>

          <div>
            <h2>6. Cookies et technologies similaires</h2>
            <p>
              Notre site utilise des cookies essentiels (nécessaires au fonctionnement) et des cookies analytiques
              (pour comprendre l'utilisation du site). Vous pouvez gérer vos préférences via notre bannière de consentement.
            </p>
          </div>

          <div>
            <h2>7. Conservation des données</h2>
            <p>
              Vos données sont conservées aussi longtemps que nécessaire pour la prestation du service, puis supprimées
              ou anonymisées selon nos obligations légales (généralement 7 ans pour les données financières).
            </p>
          </div>

          <div>
            <h2>8. Sécurité</h2>
            <p>
              Nous utilisons le chiffrement SSL/TLS, l'authentification à deux facteurs, et des contrôles d'accès
              stricts pour protéger vos données.
            </p>
          </div>

          <div>
            <h2>9. Contact et plaintes</h2>
            <p>
              Pour toute plainte concernant le traitement de vos données, contactez-nous à{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-primary hover:underline">{PRIVACY_EMAIL}</a>.
              Vous pouvez également déposer une plainte auprès de la Commission d'accès à l'information du Québec
              (CAI) à{" "}
              <a href="https://www.cai.gouv.qc.ca" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                www.cai.gouv.qc.ca
              </a>.
            </p>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
