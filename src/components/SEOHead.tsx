import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { COMPANY_CONTACT } from "@/config/company";
import { SEO_CONFIG } from "@/config/seo";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * SEOHead - Dynamic SEO meta tags for each page via react-helmet-async.
 * Updates document head with title, description, canonical, OG, Twitter cards.
 */
export const SEOHead = ({
  title,
  description,
  canonical,
  ogImage = SEO_CONFIG.defaultOgImage,
  noindex = false,
}: SEOHeadProps) => {
  const location = useLocation();
  const baseUrl = SEO_CONFIG.baseUrl;
  const fullCanonical = canonical || `${baseUrl}${location.pathname}`;
  const fullOgImage = ogImage.startsWith("http") ? ogImage : `${baseUrl}${ogImage}`;

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={fullCanonical} />

      {/* Robots */}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      {/* Open Graph */}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="fr_CA" />
      <meta property="og:site_name" content={COMPANY_CONTACT.companyName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={fullOgImage} />

      {/* Google Site Verification */}
      {SEO_CONFIG.googleSiteVerification && (
        <meta name="google-site-verification" content={SEO_CONFIG.googleSiteVerification} />
      )}
    </Helmet>
  );
};

// SEO data for each page
export const SEO_DATA = {
  home: {
    title: "Nivra Telecom | Internet & TV prépayé au Québec",
    description:
      "Internet haute vitesse dès 45$/mois, TV et Mobile 4G sans contrat au Québec. Montréal, Laval, Québec, Rive-Sud et plus.",
  },
  about: {
    title: "À propos de Nivra Telecom | Notre mission et valeurs",
    description:
      "Découvrez Nivra Telecom, entreprise québécoise de télécommunications prépayées. Services simples, rapides et sans engagement pour tous les Québécois.",
  },
  contact: {
    title: "Contactez Nivra Telecom | Support client au Québec",
    description:
      "Contactez notre équipe de support via chat ou tickets. Service en français, réponse entre 1h et 24h, lun-ven 9h-22h.",
  },
  services: {
    title: "Nos services télécom | Nivra Telecom Québec",
    description:
      "Internet haute vitesse, télévision IPTV, téléphonie mobile prépayée et sécurité résidentielle. Services sans contrat disponibles partout au Québec.",
  },
  internet: {
    title: "Internet haute vitesse au Québec | Nivra Telecom — Dès 45$/mois",
    description:
      "Internet 100 Mbps, 500 Mbps et Giga jusqu'à 1 010 Mbps. Données illimitées. Sans contrat. Dès 45$/mois.",
  },
  tv: {
    title: "Télévision au Québec | Nivra Telecom — Forfaits dès 75$/mois",
    description:
      "Forfaits TV avec Internet. Chaînes générales, sports, cinéma. Dès 75$/mois avec Internet.",
  },
  mobile: {
    title: "Forfaits Mobile 4G au Québec | Nivra Telecom — Dès 50$/mois",
    description:
      "Mobile 4G illimité Canada. 50 Go et 75 Go. Appels illimités. SMS/MMS internationaux. Dès 50$/mois.",
  },
  streaming: {
    title: "Services de streaming | Nivra Telecom Québec",
    description:
      "Ajoutez Netflix, Disney+, Spotify et plus à votre forfait. Prix réduits en combinant avec nos services télécom.",
  },
  faq: {
    title: "FAQ - Questions fréquentes | Nivra Telecom",
    description:
      "Trouvez les réponses à vos questions sur les forfaits, l'installation, la facturation et le support technique chez Nivra Telecom.",
  },
  careers: {
    title: "Carrières chez Nivra Telecom | Emplois au Québec",
    description:
      "Joignez l'équipe Nivra Telecom! Postes disponibles en vente, support technique et service client. Travaillez dans une entreprise québécoise en croissance.",
  },
  privacy: {
    title: "Politique de confidentialité | Nivra Telecom",
    description:
      "Consultez notre politique de confidentialité et protection des données personnelles conforme à la Loi 25 du Québec.",
  },
  terms: {
    title: "Conditions d'utilisation | Nivra Telecom",
    description:
      "Conditions générales d'utilisation des services Nivra Telecom. Lisez nos termes avant de souscrire à nos forfaits télécom.",
  },
} as const;

export default SEOHead;
